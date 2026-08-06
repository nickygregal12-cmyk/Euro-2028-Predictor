import { useState } from 'react'
import { Alert, Button, EmptyState, Skeleton, TextInput } from '../../design-system'
import { InvitePanel } from '../leagues/InvitePanel'
import { presentGameLeagues, type SeasonLeaguesGateway } from './gameLeaguesModel'
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
 * NO LEAGUE OPENS INTO A TABLE, and the page says so rather than leaving the
 * absence to be discovered. The read that would rank a league's members is
 * written against the tournament scoring tables and would return zero for
 * every member of a season league — see `gameLeaguesModel` for the detail. A
 * card that navigates nowhere is honest; a table of zeroes is not.
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
  /** The game these leagues belong to, as the interface names it. */
  gameName: string
  /** Whether the caller holds an active membership in that game. */
  joinedGame: boolean
}

const SKELETON_CARDS = 2

export function SeasonLeaguesPage({
  gateway,
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
          {view.leagues.map((league) => (
            <li key={league.id} className={styles.card}>
              <h3 className={styles.cardName}>{league.name}</h3>
              <p className={styles.cardMeta}>
                {league.memberLine} · {league.ownerLine}
              </p>
              <InvitePanel leagueName={league.name} code={league.inviteCode} mode="chip" />
            </li>
          ))}
        </ul>
      )}

      {/* Stated once, beneath the list, so a player who taps a card and finds
          nothing has already been told why there is nothing to tap. */}
      <p className={styles.note}>{view.standingsNote}</p>

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
