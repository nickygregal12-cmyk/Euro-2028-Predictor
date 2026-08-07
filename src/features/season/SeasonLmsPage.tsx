import { Alert, Button, ClubIdentity, EmptyState, Skeleton } from '../../design-system'
import { resolveClubIdentity } from '../../domain/clubIdentity/clubIdentityTokens'
import { LMS_REGISTRATION_COPY, type SeasonLmsRegistrationGateway } from './lmsRegistrationModel'
import type { LmsClub, SeasonLmsGateway } from './lmsRoundModel'
import { formatInstant } from './formatInstant'
import { SeasonLmsRegistration } from './SeasonLmsRegistration'
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
 *
 * REGISTRATION IS OPTIONAL AND SUPPLIED BY THE CALLER. Until it is passed, this
 * page behaves exactly as it did — which matters, because the refusal it shows
 * a non-entrant ("Join Last Man Standing to make a pick") named an action the
 * interface did not offer. It is the route, not this page, that knows WHICH
 * competition the player is looking at: a season can hold a restarted
 * successor alongside its predecessor, and resolving that is a server-side
 * question this surface must not answer for itself.
 *
 * CLUB IDENTITY IS PRESENTATIONAL. The bounded LMS read currently supplies the
 * canonical team id and name but not provider kit colours, so the shared
 * identity resolver deliberately falls back to the neutral shirt where colour
 * truth is unavailable. The text name remains the control's accessible label;
 * the repeated shirt is decorative here rather than a second spoken name.
 */

export type SeasonLmsPageProps = {
  gateway: SeasonLmsGateway
  now: () => Date
  /** Registration for this competition, when the caller can name it. */
  registration?: SeasonLmsRegistrationGateway
}

const SKELETON_ROWS = 5

export function SeasonLmsPage({ gateway, now, registration }: SeasonLmsPageProps) {
  const { status, page, presentation, picking, error, conflict, pick, reload } = useSeasonLms(
    gateway,
    now,
  )

  // Rendered above the round wherever the round can be reached, including when
  // there is no round yet: registration for a competition that has not started
  // playing is exactly when a player most needs it.
  const registrationPanel = registration ? (
    <SeasonLmsRegistration
      gateway={registration}
      copy={LMS_REGISTRATION_COPY}
      onJoined={reload}
    />
  ) : null

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
        {registrationPanel}
        <EmptyState
          title="No round to play"
          description={presentation.refusal ?? 'There is no round to play yet.'}
        />
      </section>
    )
  }

  const deadline = formatInstant(page.round.locksAt)

  const choose = (club: LmsClub) => {
    const isPick = page.pick?.teamId === club.teamId
    const disabled = !presentation.canPick || club.used || picking !== null
    const identity = resolveClubIdentity({ externalId: club.teamId, name: club.name })

    return (
      <button
        key={club.teamId}
        type="button"
        className={[styles.club, isPick ? styles.clubPicked : ''].filter(Boolean).join(' ')}
        aria-pressed={isPick}
        disabled={disabled}
        onClick={() => pick(club.teamId)}
      >
        <span className={styles.clubVisual} aria-hidden="true">
          <ClubIdentity name={club.name} tokens={identity} size="table" />
        </span>
        <span className={styles.clubCopy}>
          <span className={styles.clubName}>{club.name}</span>
          {/* "Used" is suppressed on the player's own pick. The club IS used —
              the pick is what consumed it — but labelling it that way reads as
              "unavailable to you", which is the opposite of what it means here.
              One of the two labels is the truth the player needs, and it is
              "Your pick". */}
          {club.used && !isPick ? <span className={styles.clubNote}>Used</span> : null}
          {isPick ? <span className={styles.clubPick}>Your pick</span> : null}
          {picking === club.teamId ? <span className={styles.clubNote}>Saving…</span> : null}
        </span>
      </button>
    )
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{page.round.label}</p>
        <h2 className={styles.heading}>Last Man Standing</h2>
        {/* The round read has carried this instant all along and the surface
            threw it away, so a player could see that a round was open without
            being told how long for. The line is dropped rather than guessed
            when the server sends no instant. */}
        {deadline ? <p className={styles.deadline}>Picks lock {deadline}.</p> : null}
        <p className={styles.status}>{presentation.statusLine}</p>
        {presentation.outcomeLine ? (
          <p className={styles.outcome}>{presentation.outcomeLine}</p>
        ) : null}
      </header>

      {registrationPanel}

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
