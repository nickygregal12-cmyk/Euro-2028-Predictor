import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import { createGameLeague, fetchMyGameLeagues } from '../../services/supabase/gameLeagues'
import { CreateLeagueJourney } from '../leagues/CreateLeagueJourney'
import { JoinLeagueModal } from '../leagues/JoinLeagueModal'
import { presentCreateJourney } from '../leagues/createJourneyModel'
import { isActiveMembership } from '../../services/supabase/competitionGamesModel'
import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
import { competitionSectionRoute, weeklyRoutes } from '../../app/weeklyRoutes'
import {
  presentPrivatePlay,
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
 * WHAT IT REPLACES. This route asked which football competition first. A
 * private league is where a player's friends are, and it was filed behind a
 * taxonomy the player does not think in; the 10 August authority retires that
 * shape outright.
 *
 * IT LISTS PARTICIPATION, NOT AVAILABILITY. Only containers the player actually
 * belongs to appear. Creating and joining are the two actions at the top,
 * because those are the ways the list grows.
 *
 * CREATE AND JOIN ARE BOTH HERE NOW, and both do what they say. Creating is
 * addressed by a `game_competition_id` — the league ranks one game inside one
 * competition — so the journey asks which game and which competition before
 * anything else, and offers only the combinations `create_game_league` will
 * accept. The two games it will not accept are listed with the reason rather
 * than rendered as forms that fail on submit, which is what `UI-F13`'s
 * blocked branches would have been.
 *
 * JOINING NEEDS NO SUCH WIZARD, because `join_league` resolves the game from
 * the invite code itself and refuses a caller who has not joined it. A code is
 * therefore enough on its own here, and the sheet the tournament already uses
 * is the same sheet — one code path, not two.
 */

const GAME_KINDS: readonly PrivatePlayGameKind[] = [
  'main_predictor',
  'last_man_standing',
  'predictor_cup',
]

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; sources: PrivatePlaySource[]; unreadable: string[] }

export function GlobalLeaguesPage() {
  const { status: membership, player, reload } = usePlayerCompetitions()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [filter, setFilter] = useState<PrivatePlayFilter>('all')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const key = (player?.mine ?? []).map((entry) => entry.competition.seasonRowName).join('|')

  useEffect(() => {
    if (player === null) return
    let active = true
    setLoad({ status: 'loading' })

    void (async () => {
      // One request per JOINED GAME, not per published competition: the list is
      // already bounded by what the player plays, which is what keeps this
      // page the same cost on a twenty-competition platform.
      const requests: { source: Omit<PrivatePlaySource, 'leagues'>; id: string }[] = []
      for (const entry of player.mine) {
        for (const game of entry.games) {
          if (!isActiveMembership(game)) continue
          if (!GAME_KINDS.includes(game.gameKey as PrivatePlayGameKind)) continue
          requests.push({
            id: game.id,
            source: {
              competitionName: entry.competition.name,
              seasonLabel: entry.competition.seasonLabel,
              gameKey: game.gameKey as PrivatePlayGameKind,
              // The competition's Leagues section, which is where a container
              // is actually managed today. A container has no page of its own
              // in the season tree yet.
              href: competitionSectionRoute(entry.competition, 'leagues'),
            },
          })
        }
      }

      const results = await Promise.allSettled(
        requests.map(async (request) => ({
          ...request.source,
          leagues: await fetchMyGameLeagues(request.id),
        })),
      )
      if (!active) return

      const sources: PrivatePlaySource[] = []
      const unreadable = new Set<string>()
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') sources.push(result.value)
        // Named rather than dropped: a list that silently omits a league tells
        // a player it does not exist.
        else unreadable.add(requests[index]?.source.competitionName ?? 'A competition')
      })

      setLoad({ status: 'ready', sources, unreadable: [...unreadable] })
    })()

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, player === null, reloadKey])

  const view = useMemo(
    () =>
      load.status === 'ready'
        ? presentPrivatePlay(load.sources, load.unreadable, filter)
        : null,
    [load, filter],
  )

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
    <div className={s.page}>
      <h1 className={s.title}>Leagues</h1>
      <p className={styles.intro}>
        Private leagues, Last Man Standing competitions and Championships you have joined — across
        every football competition you play in.
      </p>

      {joined ? (
        <Alert variant="success" title="You have joined the league">
          It is in the list below. Its table updates as the matchweek scores.
        </Alert>
      ) : null}

      {creating ? (
        <CreateLeagueJourney
          journey={presentCreateJourney(player)}
          create={createGameLeague}
          onCancel={() => {
            setCreating(false)
            setReloadKey((value) => value + 1)
          }}
        />
      ) : (
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => setCreating(true)}>
            Create a league
          </Button>
          <Button variant="secondary" onClick={() => setJoining(true)}>
            Join with a code
          </Button>
        </div>
      )}

      <JoinLeagueModal
        open={joining}
        onClose={() => setJoining(false)}
        onJoined={() => {
          setJoining(false)
          setJoined(true)
          setReloadKey((value) => value + 1)
        }}
      />

      {view.unreadable.length > 0 ? (
        <Alert variant="warning" title="Some private play could not be read">
          {view.unreadable.join(', ')} could not be checked just now, so anything you have there is
          missing from this list.
        </Alert>
      ) : null}

      {view.counts.all > 1 ? (
        <div className={styles.filters} role="group" aria-label="Filter by game">
          {(['all', ...GAME_KINDS] as PrivatePlayFilter[]).map((option) => {
            const count = view.counts[option]
            // A filter with nothing behind it is not offered: an empty result a
            // player asked for is indistinguishable from a broken page.
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
          description="A private league ranks one game inside one competition. Open a game you play and create or join one there."
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
                  {entry.competitionName} {entry.seasonLabel} · {entry.gameName}
                </p>
                <p className={styles.meta}>
                  {entry.memberLine} · {entry.ownerLine}
                </p>
                <p className={styles.code}>
                  Invite code <span className={styles.codeValue}>{entry.inviteCode}</span>
                </p>
                {entry.href ? (
                  <Link className={styles.open} to={entry.href}>
                    Open in {entry.competitionName}
                  </Link>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}

    </div>
  )
}
