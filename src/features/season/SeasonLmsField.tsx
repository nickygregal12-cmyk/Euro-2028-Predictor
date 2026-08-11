import { useEffect, useState } from 'react'
import { Alert, Skeleton, StatCard } from '../../design-system'
import type { LmsEntrant, SeasonLmsField as Field } from '../../services/supabase/seasonLmsFieldModel'
import { isConcealed } from '../../services/supabase/seasonLmsFieldModel'
import styles from './SeasonLmsField.module.css'

/**
 * The field: who is left, and — once the round locks — what everybody picked
 * (contract 164).
 *
 * THE REVEAL IS THE SERVER'S AND THIS RENDERS ITS NULLS AS NULLS. Before the
 * round locks, another entrant's pick, lives, saves and even whether they have
 * picked come back null, and this shows "Hidden until the round locks" rather
 * than a dash, a zero or a blank. The distinction matters more here than
 * anywhere else in the product: the clubs are a depleting resource, so a zero
 * where a rival's lives should be is a claim about how boldly they can afford
 * to play, and a blank where their pick should be reads as "has not picked".
 *
 * `isConcealed` ASKS THE ROW, NOT THE CLOCK. A component comparing a lock
 * instant to a device clock would disagree with the server for exactly as long
 * as the two differ, which is the window in which the answer matters.
 *
 * THE CALLER'S OWN ROW IS NEVER CONCEALED and is pinned first, because the
 * question a player opens this with is "where do I stand" and scrolling a field
 * of forty to find themselves is the answer arriving late.
 *
 * THE FIVE STATES ARE DISTINGUISHED IN WORDS, not by colour alone: pending,
 * locked, survived, eliminated, and the lives and saves that separate the first
 * two from being final. Colour carries none of it on its own.
 *
 * AN OUTCOME IS THE SETTLEMENT AUTHORITY'S. A pick shows no verdict until the
 * fixture is played; nothing here reads a scoreline.
 */

export type SeasonLmsFieldProps = {
  read: () => Promise<Field>
}

type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; field: Field }

export function SeasonLmsField({ read }: SeasonLmsFieldProps) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    read()
      .then((field) => {
        if (active) setState({ status: 'ready', field })
      })
      .catch(() => {
        if (active) setState({ status: 'failed' })
      })
    return () => {
      active = false
    }
  }, [read, nonce])

  if (state.status === 'loading') {
    return (
      <section className={styles.section} aria-busy="true">
        <h3 className={styles.heading}>The field</h3>
        <Skeleton width="100%" height={160} />
      </section>
    )
  }

  if (state.status === 'failed') {
    return (
      <section className={styles.section}>
        <h3 className={styles.heading}>The field</h3>
        <Alert variant="warning" title="We could not load the field">
          <button type="button" className={styles.retry} onClick={() => setNonce((n) => n + 1)}>
            Try again
          </button>
        </Alert>
      </section>
    )
  }

  const { field } = state

  // Neither is an error and the two are different: one season runs no Last Man
  // Standing, the other runs one the player is not in.
  if (!field.available) return null
  if (!field.entered) {
    return (
      <section className={styles.section}>
        <h3 className={styles.heading}>The field</h3>
        <p className={styles.note}>
          Join this competition to see who is still standing.
        </p>
      </section>
    )
  }

  const revealed = field.round?.revealed ?? false
  // The caller first, then everybody still in, then the eliminated. Within each
  // group the server's order is kept.
  const ordered = [
    ...field.entrants.filter((entrant) => entrant.isMe),
    ...field.entrants.filter((entrant) => !entrant.isMe && entrant.stillIn),
    ...field.entrants.filter((entrant) => !entrant.isMe && !entrant.stillIn),
  ]

  return (
    <section className={styles.section} aria-labelledby="lms-field-heading">
      <h3 className={styles.heading} id="lms-field-heading">
        The field
      </h3>

      <div className={styles.stats}>
        <StatCard label="Still in" value={String(field.field.remaining)} />
        <StatCard label="Out" value={String(field.field.eliminated)} />
        <StatCard label="Entrants" value={String(field.field.entrants)} />
        {/* Only once the server has revealed. Before that, how many have picked
            is itself information. */}
        {field.field.picked !== null ? (
          <StatCard label="Picked" value={String(field.field.picked)} />
        ) : null}
      </div>

      {!revealed ? (
        <p className={styles.note}>
          Picks stay hidden until this round locks
          {field.round?.label ? ` — ${field.round.label}` : ''}. That includes whether anyone has
          picked yet: with clubs running out, knowing would be an advantage.
        </p>
      ) : null}

      <ul className={styles.list}>
        {ordered.map((entrant) => (
          <Entrant key={entrant.userId} entrant={entrant} revealed={revealed} />
        ))}
      </ul>
    </section>
  )
}

function Entrant({ entrant, revealed }: { entrant: LmsEntrant; revealed: boolean }) {
  const concealed = isConcealed(entrant)

  return (
    <li className={`${styles.entrant} ${entrant.isMe ? styles.me : ''}`}>
      <div className={styles.who}>
        <span className={styles.name}>
          {entrant.displayName}
          {entrant.isMe ? <span className={styles.youTag}>You</span> : null}
        </span>
        {/* Stated in words. Colour alone would carry the difference between
            surviving and being out, which is the one distinction that must
            survive a monochrome screenshot. */}
        <span className={styles.state}>{stateSentence(entrant, revealed)}</span>
      </div>

      <div className={styles.detail}>
        {concealed ? (
          <span className={styles.hidden}>Hidden until the round locks</span>
        ) : (
          <>
            <span className={styles.pick}>
              {entrant.pick
                ? entrant.pick.teamName ?? 'Club picked'
                : entrant.hasPicked === false
                  ? 'No pick yet'
                  : '—'}
            </span>
            {entrant.livesRemaining !== null || entrant.savesRemaining !== null ? (
              <span className={styles.allowances}>
                {entrant.livesRemaining !== null
                  ? `${entrant.livesRemaining} ${
                      entrant.livesRemaining === 1 ? 'life' : 'lives'
                    }`
                  : null}
                {entrant.livesRemaining !== null && entrant.savesRemaining !== null ? ' · ' : null}
                {entrant.savesRemaining !== null
                  ? `${entrant.savesRemaining} ${
                      entrant.savesRemaining === 1 ? 'save' : 'saves'
                    }`
                  : null}
              </span>
            ) : null}
          </>
        )}
      </div>
    </li>
  )
}

/**
 * The five states, in words.
 *
 * The pick's own outcome is preferred where the settlement authority has given
 * one, because "survived" is a fact about this round and "still in" is a fact
 * about the competition, and a player wants the first once it exists.
 */
function stateSentence(entrant: LmsEntrant, revealed: boolean): string {
  if (!entrant.stillIn) return 'Eliminated'
  if (entrant.pick?.outcome) return capitalise(entrant.pick.outcome)
  if (!revealed) return entrant.isMe && entrant.hasPicked ? 'Picked · locked in' : 'Still in'
  if (entrant.hasPicked === false) return 'Still in · no pick'
  return 'Still in · awaiting the result'
}

function capitalise(value: string): string {
  const words = value.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
