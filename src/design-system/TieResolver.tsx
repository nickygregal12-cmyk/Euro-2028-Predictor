import { useEffect, useId, useState } from 'react'
import styles from './TieResolver.module.css'
import { Button } from './Button'
import { TeamFlag } from './TeamFlag'
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from './icons'
import type { SaveStatus } from './MatchCard'

export type TieResolverTeam = { id: string; name: string; countryCode: string }

export type TieResolverReviewAction = {
  label: string
  onClick: () => void
}

export type TieResolverProps = {
  // Short context, e.g. "Group A needs your decision" or
  // "Best thirds · positions 4 & 5".
  title: string
  // Plain-language explanation of why the app can't separate the teams.
  reason: string
  // Teams in their current order (best first) — the stored resolution order
  // when one exists, otherwise the arbitrary tied order for the user to arrange.
  teams: TieResolverTeam[]
  // Whether the user has already confirmed an order for this tie.
  resolved: boolean
  saveStatus?: SaveStatus
  // Optional routes back to the score inputs that produced this tie.
  reviewActions?: TieResolverReviewAction[]
  // Called with the chosen order (best first) when the user confirms.
  onResolve: (orderedIds: string[]) => void
}

// Stable identity of a teams list, so local edits reset only when the tie
// itself changes (different teams / different stored order), not on every
// unrelated re-render.
function idsKey(teams: TieResolverTeam[]): string {
  return teams.map((team) => team.id).join('|')
}

/**
 * Manual tie-resolution control (scoring-rules §6 step 7). Presentational: the
 * parent supplies the tied teams and persists the chosen order via `onResolve`.
 * The user arranges the teams with up/down controls and may review the scores
 * that caused the tie before confirming an explicit order.
 */
export function TieResolver({
  title,
  reason,
  teams,
  resolved,
  saveStatus = 'idle',
  reviewActions = [],
  onResolve,
}: TieResolverProps) {
  const [order, setOrder] = useState<TieResolverTeam[]>(teams)
  const headingId = useId()

  // Re-sync when the underlying tie changes (new teams or a reloaded order).
  useEffect(() => {
    setOrder(teams)
  }, [idsKey(teams)]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = idsKey(order) !== idsKey(teams)
  const confirmLabel = resolved
    ? 'Update order'
    : dirty
      ? 'Save this order'
      : 'Keep this order'

  function move(index: number, delta: number) {
    setOrder((previous) => {
      const next = [...previous]
      const target = index + delta
      if (target < 0 || target >= next.length) return previous
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  return (
    <section
      className={`${styles.card} ${resolved ? styles.resolvedCard : styles.pendingCard}`}
      aria-labelledby={headingId}
    >
      <div className={styles.head}>
        <span className={styles.headIcon}>
          {resolved ? <CheckIcon size={16} /> : <AlertIcon size={16} />}
        </span>
        <div className={styles.headText}>
          <h3 id={headingId} className={styles.title}>
            {title}
          </h3>
          <span className={styles.status}>
            {resolved ? 'Order set' : 'Needs your call'}
          </span>
        </div>
      </div>

      <p className={styles.reason}>{reason}</p>

      <ol className={styles.list}>
        {order.map((team, index) => (
          <li key={team.id} className={styles.row}>
            <span className={styles.pos} aria-hidden="true">
              {index + 1}
            </span>
            <span className={styles.bar} aria-hidden="true" />
            <span className={styles.flag}>
              <TeamFlag countryCode={team.countryCode} label={team.name} size="table" />
            </span>
            <span className={styles.name}>{team.name}</span>
            <span className={styles.controls}>
              <button
                type="button"
                className={styles.moveBtn}
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${team.name} up`}
              >
                <ChevronUpIcon size={18} />
              </button>
              <button
                type="button"
                className={styles.moveBtn}
                onClick={() => move(index, 1)}
                disabled={index === order.length - 1}
                aria-label={`Move ${team.name} down`}
              >
                <ChevronDownIcon size={18} />
              </button>
            </span>
          </li>
        ))}
      </ol>

      <div className={styles.footer}>
        <span className={styles.saveStatus} role="status">
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && !dirty && 'Saved'}
          {saveStatus === 'error' && (
            <span className={styles.saveError}>Save failed — try again</span>
          )}
        </span>
        <div className={styles.actions}>
          {reviewActions.map((action) => (
            <Button key={action.label} variant="secondary" onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
          <Button
            variant="primary"
            onClick={() => onResolve(order.map((team) => team.id))}
            disabled={saveStatus === 'saving' || (resolved && !dirty)}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </section>
  )
}
