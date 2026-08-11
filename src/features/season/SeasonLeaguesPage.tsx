import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Alert, Button, EmptyState, Skeleton, TextInput } from '../../design-system'
import { InvitePanel } from '../leagues/InvitePanel'
import { presentGameLeagues, type SeasonLeaguesGateway } from './gameLeaguesModel'
import type { SeasonLeagueStandingsGateway } from './leagueStandingsModel'
import type { SeasonLeagueMatchweekPredictions } from '../../services/supabase/seasonLeaguePredictionsModel'
import type { SeasonLeagueMovement } from '../../services/supabase/seasonLeagueMovementModel'
import type { SeasonLeagueStandingsProps } from './SeasonLeagueStandings'
import {
  isSeasonLeagueTab,
  SeasonLeagueWorkspace,
  type SeasonLeagueTab,
} from './SeasonLeagueWorkspace'
import { useSeasonLeagues } from './useSeasonLeagues'
import styles from './SeasonLeaguesPage.module.css'

/**
 * §7.3's Leagues section, for one game inside one competition.
 *
 * IT NAMES THE GAME ITS LEAGUES RANK, in the copy above the list. ADR 0011
 * keeps each game's standings its own, and a competition running three games
 * has three separate things a private league could mean. A heading reading
 * "Leagues" alone would assert a competition-wide ranking that does not exist.
 *
 * A LEAGUE OPENS INTO ITS WORKSPACE, IN PLACE, AND ONE AT A TIME. The accepted
 * destination is **Table · Matchweek · Members**; the previous session shipped
 * the table alone because contract 149 did not exist, and it does now. It
 * expands within the card rather than navigating, because a member belongs to
 * several leagues in the same game and comparing two of them should not cost
 * two journeys. Only one is open at a time: two tables of the same players on
 * the same screen invite exactly the cross-league comparison neither means.
 *
 * WHICH LEAGUE IS OPEN, AND WHICH TAB, LIVE IN THE URL. Opening a league,
 * reading its matchweek, following a player into their season and pressing Back
 * used to land on a collapsed list — the state was React's alone, so the
 * journey lost its place every time it left the page. `?league=` and `?tab=`
 * make the workspace addressable, which is what Back and a shared link both
 * need. Nothing ephemeral is persisted this way: a search box or an open
 * disclosure stays in component state where it belongs.
 *
 * A REFUSAL IS A SENTENCE, NEVER A DEAD CONTROL. When the caller has not
 * joined the game, the create form is replaced by the reason — not disabled
 * with a tooltip, and not left enabled to fail on submit.
 *
 * THE INVITE CODE IS ON THE CARD. A private league nobody can be invited to is
 * an empty room, so the existing tap-to-copy chip is reused rather than hiding
 * the code behind navigation this page does not have.
 */

export type SeasonLeaguesPageProps = {
  gateway: SeasonLeaguesGateway
  /**
   * The per-league table read. Required rather than optional: the surface spent
   * its whole life so far explaining why there was no table, and an optional
   * gateway is how it would quietly go back to having none.
   */
  standings: SeasonLeagueStandingsGateway
  /**
   * Head-to-head against one league rival for one matchweek (contract 129).
   * Optional: a season past its last lock has no matchweek to compare, and the
   * route is what knows.
   */
  headToHead?: SeasonLeagueStandingsProps['headToHead']
  /** The game these leagues belong to, as the interface names it. */
  gameName: string
  /** Whether the caller holds an active membership in that game. */
  joinedGame: boolean
  /**
   * The matchweek the workspace's Matchweek tab opens at, as a competition
   * round id. Null when the season has none — the tab says so rather than
   * loading nothing.
   */
  competitionRoundId?: string | null
  /** Contract 149. Omitted leaves the Matchweek tab unavailable rather than empty. */
  loadMatchweek?: (
    leagueId: string,
    competitionRoundId: string,
  ) => Promise<SeasonLeagueMatchweekPredictions>
  /** Contract 150, for the movement line above the tabs. */
  loadMovement?: (leagueId: string) => Promise<SeasonLeagueMovement>
  /** Where a member's name links — one player's season (contract 151). */
  playerHref?: (playerId: string) => string
}

const SKELETON_CARDS = 2

/**
 * The Matchweek tab with no reader supplied. It rejects rather than resolving
 * empty, because "this build cannot load it" and "the league predicted nothing"
 * are different answers and the panel renders them differently.
 */
function unavailableMatchweek(): Promise<never> {
  return Promise.reject(new Error('No matchweek reader was supplied to this surface.'))
}

export function SeasonLeaguesPage({
  gateway,
  standings,
  gameName,
  joinedGame,
  headToHead,
  competitionRoundId = null,
  loadMatchweek,
  loadMovement,
  playerHref,
}: SeasonLeaguesPageProps) {
  const {
    status,
    leagues,
    error,
    creating,
    createError,
    joining,
    joinError,
    create,
    join,
    reload,
  } = useSeasonLeagues(gateway)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  // One open league at a time, and which one — plus which of its three views —
  // is navigation state rather than component state, so Back from a player's
  // season returns to the matchweek the player was reading.
  const [search, setSearch] = useSearchParams()
  const openLeagueId = search.get('league')
  const rawTab = search.get('tab')
  const tab: SeasonLeagueTab = isSeasonLeagueTab(rawTab) ? rawTab : 'table'

  function openLeague(leagueId: string | null, nextTab: SeasonLeagueTab = 'table') {
    const next = new URLSearchParams(search)
    if (leagueId === null) {
      next.delete('league')
      next.delete('tab')
    } else {
      next.set('league', leagueId)
      next.set('tab', nextTab)
    }
    // Replace rather than push: opening and closing a card is not a step a
    // player expects to walk back through one press at a time.
    setSearch(next, { replace: true })
  }

  const view = presentGameLeagues({ gameName, joinedGame, leagues })

  async function onCreate(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    // The field clears only on success, so a refused name is still there to
    // correct rather than retyped from memory.
    if (await create(trimmed)) setName('')
  }

  async function onJoin(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    if (await join(trimmed)) setCode('')
  }

  if (status === 'loading') {
    return (
      <section className={styles.page} aria-busy="true">
        <h2 className={styles.heading}>Leagues</h2>
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <Skeleton key={index} width="100%" height={92} />
        ))}
      </section>
    )
  }

  if (status === 'failed') {
    return (
      <section className={styles.page}>
        <h2 className={styles.heading}>Leagues</h2>
        <Alert variant="error" title="We could not load your leagues">
          {error}
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.heading}>Leagues</h2>
      <p className={styles.scope}>{view.scopeLine}</p>

      {view.empty ? (
        <EmptyState
          title="No leagues yet"
          description="Create one and share the code, or join a friend's with theirs."
        />
      ) : (
        <ul className={styles.list}>
          {view.leagues.map((league) => {
            const open = openLeagueId === league.id
            const tableId = `league-table-${league.id}`
            return (
              <li key={league.id} className={styles.card}>
                <h3 className={styles.cardName}>{league.name}</h3>
                <p className={styles.cardMeta}>
                  {league.memberLine} · {league.ownerLine}
                </p>
                <InvitePanel leagueName={league.name} code={league.inviteCode} mode="chip" />

                {/* The control names the league it opens, so a screen-reader
                    user moving between cards is never left with a list of
                    identical "View table" buttons. */}
                {/* `aria-controls` only while the table exists: pointing at an
                    id that is not in the document is what axe reports as an
                    invalid attribute value, and the repository counts axe's
                    incomplete results rather than discarding them. */}
                <Button
                  variant="secondary"
                  aria-expanded={open}
                  aria-controls={open ? tableId : undefined}
                  onClick={() => openLeague(open ? null : league.id, tab)}
                >
                  {open ? `Hide ${league.name}` : `Open ${league.name}`}
                </Button>

                {open ? (
                  <div id={tableId}>
                    <SeasonLeagueWorkspace
                      leagueId={league.id}
                      leagueName={league.name}
                      standings={standings}
                      headToHead={headToHead}
                      competitionRoundId={competitionRoundId}
                      loadMatchweek={loadMatchweek ?? unavailableMatchweek}
                      loadMovement={loadMovement}
                      playerHref={playerHref}
                      tab={tab}
                      onTabChange={(next) => openLeague(league.id, next)}
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <div className={styles.forms}>
        <form className={styles.form} onSubmit={onCreate}>
          <h3 className={styles.formHeading}>Create a league</h3>
          {view.createRefusal ? (
            <p className={styles.refusal}>{view.createRefusal}</p>
          ) : (
            <>
              <TextInput
                label="League name"
                value={name}
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
                error={createError ?? undefined}
                hint="1 to 40 characters. You can invite people once it exists."
              />
              <Button type="submit" disabled={creating || name.trim().length === 0}>
                {creating ? 'Creating…' : 'Create league'}
              </Button>
            </>
          )}
        </form>

        {/* Joining stays available whether or not the caller has joined the
            game: the code decides which game the league belongs to, and the
            server refuses with a sentence this page renders. Hiding it would
            leave a player holding a code with nowhere to put it. */}
        <form className={styles.form} onSubmit={onJoin}>
          <h3 className={styles.formHeading}>Join with a code</h3>
          <TextInput
            label="Invite code"
            value={code}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            error={joinError ?? undefined}
            hint="The code the league owner shared with you."
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={joining || code.trim().length === 0}
          >
            {joining ? 'Joining…' : 'Join league'}
          </Button>
        </form>
      </div>
    </section>
  )
}
