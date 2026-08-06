import { Alert, Button, Skeleton } from '../../design-system'
import type { SeasonLmsRegistrationGateway } from './lmsRegistrationModel'
import { useSeasonLmsRegistration } from './useSeasonLmsRegistration'
import styles from './SeasonLmsRegistration.module.css'

/**
 * Registration for a season Last Man Standing competition.
 *
 * IT RENDERS NOTHING ONCE THE PLAYER IS ENTERED. The round surface below
 * already states membership ("You are still in", "You are entered"), and two
 * components asserting the same fact from two different reads is how they come
 * to disagree on screen. Membership has one statement, and it is not this one.
 *
 * A CLOSED WINDOW STILL EXPLAINS ITSELF rather than disappearing. A player who
 * arrives too late needs to know that is what happened — a panel that vanished
 * would leave them looking for a join control that was never there.
 *
 * THE DEADLINE IS FORMATTED HERE, NOT IN THE MODEL. The model hands over ISO
 * instants so it stays pure and its tests stay locale-independent; the view
 * formats in the viewer's own locale, as the Matches surface already does.
 */

export type SeasonLmsRegistrationProps = {
  gateway: SeasonLmsRegistrationGateway
  /** Told after a successful join, so the round surface reloads with it. */
  onJoined?: () => void
}

function formatInstant(instant: string | null): string | null {
  if (!instant) return null
  const at = new Date(instant)
  if (Number.isNaN(at.getTime())) return null
  return at.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SeasonLmsRegistration({ gateway, onJoined }: SeasonLmsRegistrationProps) {
  const { status, presentation, joining, error, join, reload } = useSeasonLmsRegistration(
    gateway,
    onJoined,
  )

  if (status === 'loading') {
    return (
      <section className={styles.panel} aria-busy="true">
        <Skeleton width="50%" height={20} />
        <Skeleton width="100%" height={44} />
      </section>
    )
  }

  if (status === 'failed' || !presentation) {
    return (
      <section className={styles.panel}>
        <Alert variant="error" title="We could not load registration">
          {error}
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </section>
    )
  }

  // Membership is stated once, by the round surface below.
  if (presentation.state === 'entered') return null

  const deadline =
    presentation.state === 'open' ? formatInstant(presentation.closesAt) : null
  const opening =
    presentation.state === 'not_open' ? formatInstant(presentation.opensAt) : null

  return (
    <section className={styles.panel}>
      <h3 className={styles.heading}>{presentation.headline}</h3>
      <p className={styles.body}>{presentation.explanation}</p>

      {deadline ? (
        <p className={styles.deadline}>Registration closes {deadline}.</p>
      ) : null}
      {opening ? <p className={styles.deadline}>Registration opens {opening}.</p> : null}

      {error ? (
        <Alert variant="error" title="We could not enter you">
          {error}
        </Alert>
      ) : null}

      {presentation.canJoin ? (
        <Button onClick={join} disabled={joining}>
          {joining ? 'Joining…' : 'Join'}
        </Button>
      ) : null}
    </section>
  )
}
