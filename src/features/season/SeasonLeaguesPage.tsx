import { useState } from 'react'
import { Alert, Button, EmptyState, Skeleton, TextInput } from '../../design-system'
import { InvitePanel } from '../leagues/InvitePanel'
import { presentGameLeagues, type SeasonLeaguesGateway } from './gameLeaguesModel'
import type { SeasonLeagueStandingsGateway } from './leagueStandingsModel'
import { SeasonLeagueStandings } from './SeasonLeagueStandings'
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
 * A LEAGUE OPENS INTO ITS TABLE, IN PLACE, AND ONE AT A TIME. This page used
 * to state that no table could be shown, because the only read available
 * ranked by the tournament scoring tables and would have returned zero for
 * every member of a season league; contract 128 supplied the read that
 * genuinely answers, so the note is gone and the table is here. It expands
 * within the card rather than navigating, because a member belongs to several
 * leagues in the same game and comparing two of them should not cost two
 * journeys. Only one is open at a time: two tables of the same players on the
 * same screen invite exactly the cross-league comparison neither of them means.
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
  /** The game these leagues belong to, as the interface names it. */
  gameName: string
  /** Whether the caller holds an active membership in that game. */
  joinedGame: boolean
}

const SKELETON_CARDS = 2

export function SeasonLeaguesPage({
  gateway,
  standings,
  gameName,
  joinedGame,
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
  // One open table at a time; tapping the open one closes it.
  const [openLeagueId, setOpenLeagueId] = useState<string | null>(null)

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
                  onClick={() => setOpenLeagueId(open ? null : league.id)}
                >
                  {open ? `Hide ${league.name} table` : `View ${league.name} table`}
                </Button>

                {open ? (
                  <div id={tableId}>
                    <SeasonLeagueStandings
                      gateway={standings}
                      leagueId={league.id}
                      leagueName={league.name}
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
