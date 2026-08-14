import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, EmptyState, Skeleton, Workspace } from '../../design-system'
import { createGameLeague, fetchMyGameLeagues } from '../../services/supabase/gameLeagues'
import {
  fetchMyPrivateCompetitions,
  fetchPrivateCupLaunchReadiness,
  type PrivateCompetitionDiscovery,
} from '../../services/supabase/privateCompetitionDiscovery'
import { CreatePrivateJourney } from '../leagues/CreatePrivateJourney'
import { JoinLeagueModal } from '../leagues/JoinLeagueModal'
import { OrganiserPanel } from '../leagues/OrganiserPanel'
import type { InviteJoinResult } from '../leagues/useInviteCode'
import { PrivatePlayExplainer } from './PrivatePlayExplainer'
import {
  fetchMyOrganisedCompetition,
  fetchMyOrganisedCompetitions,
} from '../../services/supabase/organisedCompetitions'
import {
  createPrivateSeasonCup,
  createPrivateSeasonLms,
  launchPrivateSeasonCup,
} from '../../services/supabase/privateCompetitions'
import { presentCreateJourney } from '../leagues/createJourneyModel'
import { isActiveMembership } from '../../services/supabase/competitionGamesModel'
import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
import { competitionSectionRoute, weeklyRoutes } from '../../app/weeklyRoutes'
import {
  presentPrivatePlay,
  privatePlayHref,
  PRIVATE_PLAY_GAME_NAME,
  type PrivatePlayFilter,
  type PrivatePlayGameKind,
  type PrivatePlaySource,
} from './privatePlayModel'
import styles from './GlobalLeaguesPage.module.css'
import s from '../shared.module.css'

/**
 * `/leagues` — every private league and private competition the player is in.
 *
 * Match Predictor private play is rebuilt through `get_my_game_leagues` because
 * it really is a `leagues` row. Last Man Standing and Predictor Championship
 * private play is rebuilt once, caller-addressed, through Contract 179's
 * `get_my_private_competitions`. Keeping those reads separate is the fix for
 * PPLAY-001: a successful bonus-game create/join can no longer disappear merely
 * because this surface asked the ordinary-league table to rediscover it.
 */

const GAME_KINDS: readonly PrivatePlayGameKind[] = [
  'main_predictor',
  'last_man_standing',
  'predictor_cup',
]

const PRIVATE_READ_FAILURE = 'Last Man Standing and Predictor Championship private play'

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ready'
      sources: PrivatePlaySource[]
      privateCompetitions: readonly PrivateCompetitionDiscovery[]
      unreadable: string[]
      privateTruncated: boolean
    }

type JoinConfirmation = 'confirmed' | 'missing' | 'unverifiable' | null

export function GlobalLeaguesPage() {
  const { status: membership, player, reload } = usePlayerCompetitions()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [filter, setFilter] = useState<PrivatePlayFilter>('all')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState<InviteJoinResult | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const key = (player?.mine ?? []).map((entry) => entry.competition.seasonRowName).join('|')

  useEffect(() => {
    if (player === null) return
    let active = true
    setLoad({ status: 'loading' })

    void (async () => {
      // Ordinary private leagues only. Bonus-game private containers have their
      // own caller-addressed read below and must never be projected through this
      // storage model again.
      const requests: { source: Omit<PrivatePlaySource, 'leagues'>; id: string }[] = []
      for (const entry of player.mine) {
        for (const game of entry.games) {
          if (!isActiveMembership(game)) continue
          if (game.gameKey !== 'main_predictor') continue
          requests.push({
            id: game.id,
            source: {
              competitionName: entry.competition.name,
              seasonLabel: entry.competition.seasonLabel,
              gameKey: 'main_predictor',
              href: privatePlayHref(
                'main_predictor',
                competitionSectionRoute(entry.competition, 'leagues'),
              ),
            },
          })
        }
      }

      const [leagueResults, privateResults] = await Promise.all([
        Promise.allSettled(
          requests.map(async (request) => ({
            ...request.source,
            leagues: await fetchMyGameLeagues(request.id),
          })),
        ),
        Promise.allSettled([fetchMyPrivateCompetitions(50, 0)]),
      ])
      if (!active) return

      const sources: PrivatePlaySource[] = []
      const unreadable = new Set<string>()
      leagueResults.forEach((result, index) => {
        if (result.status === 'fulfilled') sources.push(result.value)
        // Named rather than dropped: a list that silently omits a league tells
        // a player it does not exist.
        else unreadable.add(requests[index]?.source.competitionName ?? 'A competition')
      })

      let privateCompetitions: readonly PrivateCompetitionDiscovery[] = []
      let privateTruncated = false
      const privateResult = privateResults[0]
      if (privateResult?.status === 'fulfilled') {
        privateCompetitions = privateResult.value.competitions
        privateTruncated = privateResult.value.hasMore
      } else {
        unreadable.add(PRIVATE_READ_FAILURE)
      }

      setLoad({
        status: 'ready',
        sources,
        privateCompetitions,
        unreadable: [...unreadable],
        privateTruncated,
      })
    })()

    return () => {
      active = false
    }
    // `player` is represented by `key` plus the null boundary on purpose: a
    // preference-shell rerender with the same joined competitions must not turn
    // this into a polling loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, player === null, reloadKey])

  const view = useMemo(
    () =>
      load.status === 'ready'
        ? presentPrivatePlay(load.sources, load.unreadable, filter, load.privateCompetitions)
        : null,
    [load, filter],
  )

  const joinConfirmation: JoinConfirmation = useMemo(() => {
    if (!joined || load.status !== 'ready') return null
    const joinedId = joined.kind === 'league' ? joined.leagueId : joined.competitionId
    if (!joinedId) return 'unverifiable'

    const all = presentPrivatePlay(
      load.sources,
      load.unreadable,
      'all',
      load.privateCompetitions,
    )
    if (all.entries.some((entry) => entry.key === joinedId)) return 'confirmed'

    // A failed read can never prove absence. PPLAY-004 is specifically about
    // refusing to turn a successful mutation into a confident cross-surface
    // claim when the authority that should verify it was unavailable.
    if (load.unreadable.length > 0) return 'unverifiable'
    return 'missing'
  }, [joined, load])

  if (membership === 'failed') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Leagues</h1>
        <Alert variant="error" title="We could not load your competitions">
          Nothing is claimed either way — your leagues are unaffected.
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    )
  }

  if (membership === 'loading' || !view) {
    return (
      <div className={s.page} aria-busy="true">
        <h1 className={s.title}>Leagues</h1>
        <Skeleton width="100%" height={72} />
        <Skeleton width="100%" height={72} />
      </div>
    )
  }

  return (
    <Workspace
      asideLabel="About private play"
      aside={
        <>
          <PrivatePlayExplainer />
          <OrganiserPanel
            list={fetchMyOrganisedCompetitions}
            open={fetchMyOrganisedCompetition}
            readCupLaunch={fetchPrivateCupLaunchReadiness}
            launchCup={launchPrivateSeasonCup}
            onCompetitionChanged={() => setReloadKey((value) => value + 1)}
          />
        </>
      }
    >
      <div className={s.page}>
        <h1 className={s.title}>Leagues</h1>
        <p className={styles.intro}>
          Private leagues, Last Man Standing competitions and Championships you have joined — across
          every football competition you play in.
        </p>

        {joinConfirmation === 'confirmed' ? (
          <Alert variant="success" title="You have joined">
            Confirmed in your private-play list below.
          </Alert>
        ) : null}

        {joinConfirmation === 'missing' ? (
          <Alert variant="warning" title="Joined, but not confirmed in this list yet">
            The join succeeded, but the authoritative reread did not return that private play. Try
            again before relying on this page as proof of membership.
          </Alert>
        ) : null}

        {joinConfirmation === 'unverifiable' ? (
          <Alert variant="warning" title="Joined, but the destination could not be verified">
            The join succeeded, but this page could not complete the authoritative reread needed to
            identify its row safely.
          </Alert>
        ) : null}

        {creating ? (
          <CreatePrivateJourney
            journey={presentCreateJourney(player)}
            createLeague={createGameLeague}
            createLms={createPrivateSeasonLms}
            createCup={createPrivateSeasonCup}
            launchCup={launchPrivateSeasonCup}
            onCancel={() => {
              setCreating(false)
              setReloadKey((value) => value + 1)
            }}
          />
        ) : (
          <div className={styles.actions}>
            <Button variant="primary" onClick={() => setCreating(true)}>
              Create private play
            </Button>
            <Button variant="secondary" onClick={() => setJoining(true)}>
              Join with a code
            </Button>
          </div>
        )}

        <JoinLeagueModal
          open={joining}
          onClose={() => setJoining(false)}
          onJoined={(result) => {
            setJoining(false)
            setJoined(result)
            setFilter('all')
            setReloadKey((value) => value + 1)
          }}
        />

        {view.unreadable.length > 0 ? (
          <Alert variant="warning" title="Some private play could not be read">
            {view.unreadable.join(', ')} could not be checked just now, so anything you have there is
            missing from this list.
          </Alert>
        ) : null}

        {load.status === 'ready' && load.privateTruncated ? (
          <Alert variant="warning" title="More private competitions exist">
            This view shows the first 50 private Last Man Standing and Championship containers. It
            will not pretend that first page is the whole list.
          </Alert>
        ) : null}

        {view.counts.all > 1 ? (
          <div className={styles.filters} role="group" aria-label="Filter by game">
            {(['all', ...GAME_KINDS] as PrivatePlayFilter[]).map((option) => {
              const count = view.counts[option]
              if (option !== 'all' && count === 0) return null
              const label = option === 'all' ? 'All' : PRIVATE_PLAY_GAME_NAME[option]
              const selected = option === filter
              return (
                <button
                  key={option}
                  type="button"
                  className={`${styles.filter} ${selected ? styles.filterOn : ''}`}
                  aria-pressed={selected}
                  onClick={() => setFilter(option)}
                >
                  {label} <span className={styles.count}>{count}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {view.empty ? (
          <EmptyState
            title="You have not joined any private play yet"
            description="Create one here, or join with the code a friend shared."
            action={
              <Link className={styles.link} to={weeklyRoutes.competitions}>
                Find a competition
              </Link>
            }
          />
        ) : (
          <ul className={styles.list}>
            {view.entries.map((entry) => (
              <li key={entry.key}>
                <article className={styles.card}>
                  <h2 className={styles.name}>{entry.name}</h2>
                  <p className={styles.where}>
                    {entry.competitionName}
                    {entry.seasonLabel ? ` ${entry.seasonLabel}` : ''} · {entry.gameName}
                  </p>
                  <p className={styles.meta}>
                    {entry.memberLine} · {entry.ownerLine}
                    {entry.statusLine ? ` · ${entry.statusLine}` : ''}
                  </p>

                  {entry.inviteCode ? (
                    <p className={styles.code}>
                      Invite code <span className={styles.codeValue}>{entry.inviteCode}</span>
                    </p>
                  ) : entry.inviteAvailable ? (
                    <p className={styles.code}>Invite code available from the organiser</p>
                  ) : null}

                  {entry.href ? (
                    <Link className={styles.open} to={entry.href}>
                      Open in {entry.competitionName}
                    </Link>
                  ) : (
                    <p className={styles.pending}>
                      This private competition is saved in your list. Its dedicated game workspace
                      is still being built.
                    </p>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Workspace>
  )
}
