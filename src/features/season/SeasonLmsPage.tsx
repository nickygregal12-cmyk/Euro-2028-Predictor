import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import type { LmsClub, SeasonLmsGateway } from './lmsRoundModel'
import { useSeasonLms } from './useSeasonLms'
import styles from './SeasonLmsPage.module.css'

/**
 * The season Last Man Standing round: one pick, from the clubs playing.
 *
 * THE CHOICE IS A LIST OF CLUBS, NOT A LIST OF FIXTURES, because that is the
 * decision the player is actually making — they pick a club to win, and which
 * fixture it happens to be in is context rather than the choice. Both clubs in
 * a fixture are offered on the same row so the opponent stays visible, which is
 * the information the pick turns on.
 *
 * A CONSUMED CLUB IS SHOWN AND DISABLED RATHER THAN HIDDEN. ADR 0013's used
 * list is the whole shape of the game: a player planning ahead needs to see
 * what they have spent, and a club that silently vanished would read as a
 * missing fixture. The reset opens a new cycle rather than deleting history,
 * and the server scopes the list to the current cycle, so what is disabled here
 * is what is genuinely unavailable now.
 *
 * WHAT THE PICK DID AND WHAT THE PLAYER IS ARE SHOWN SEPARATELY, never merged.
 * The model refuses to infer one from the other because whether a draw
 * eliminates is a stored rule, and this renders that separation rather than
 * collapsing it back.
 */

export type SeasonLmsPageProps = {
  gateway: SeasonLmsGateway
  now: () => Date
}

const SKELETON_ROWS = 5

export function SeasonLmsPage({ gateway, now }: SeasonLmsPageProps) {
  const { status, page, presentation, picking, error, conflict, pick, reload } = useSeasonLms(
    gateway,
    now,
  )

  if (status === 'loading') {
    return (
      <section className={styles.panel} aria-busy="true">
        <Skeleton width="60%" height={24} />
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} width="100%" height={64} />
        ))}
      </section>
    )
  }

  if (status === 'failed' || !page || !presentation) {
    return (
      <section className={styles.panel}>
        <Alert variant="error" title="We could not load the round">
          {error}
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </section>
    )
  }

  if (!page.round) {
    return (
      <section className={styles.panel}>
        <EmptyState
          title="No round to play"
          description={presentation.refusal ?? 'There is no round to play yet.'}
        />
      </section>
    )
  }

  const choose = (club: LmsClub) => {
    const isPick = page.pick?.teamId === club.teamId
    const disabled = !presentation.canPick || club.used || picking !== null
    return (
      <button
        key={club.teamId}
        type="button"
        className={[styles.club, isPick ? styles.clubPicked : ''].filter(Boolean).join(' ')}
        aria-pressed={isPick}
        disabled={disabled}
        onClick={() => pick(club.teamId)}
      >
        <span className={styles.clubName}>{club.name}</span>
        {/* "Used" is suppressed on the player's own pick. The club IS used —
            the pick is what consumed it — but labelling it that way reads as
            "unavailable to you", which is the opposite of what it means here.
            One of the two labels is the truth the player needs, and it is
            "Your pick". */}
        {club.used && !isPick ? <span className={styles.clubNote}>Used</span> : null}
        {isPick ? <span className={styles.clubPick}>Your pick</span> : null}
        {picking === club.teamId ? <span className={styles.clubNote}>Saving…</span> : null}
      </button>
    )
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{page.round.label}</p>
        <h2 className={styles.heading}>Last Man Standing</h2>
        <p className={styles.status}>{presentation.statusLine}</p>
        {presentation.outcomeLine ? (
          <p className={styles.outcome}>{presentation.outcomeLine}</p>
        ) : null}
      </header>

      {/* A refusal is stated once, above the choices, rather than repeated on
          every disabled control. */}
      {presentation.refusal ? (
        <Alert variant="info" title="You cannot pick in this round">
          {presentation.refusal}
        </Alert>
      ) : null}

      {conflict ? (
        <Alert variant="error" title="This round changed elsewhere">
          {error}
          <Button variant="secondary" onClick={reload}>
            Reload
          </Button>
        </Alert>
      ) : error ? (
        <Alert variant="error" title="That pick was not saved">
          {error}
        </Alert>
      ) : null}

      {page.fixtures.length === 0 ? (
        <EmptyState
          title="No fixtures in this round yet"
          description="The clubs appear once this round's fixtures are published."
        />
      ) : (
        <ul className={styles.fixtures}>
          {page.fixtures.map((fixture) => (
            <li key={fixture.fixtureId} className={styles.fixture}>
              {choose(fixture.home)}
              <span className={styles.versus} aria-hidden="true">
                v
              </span>
              {choose(fixture.away)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
