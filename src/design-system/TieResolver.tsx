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

export type TieResolverProps = {
  // Short context, e.g. "Group A" or "Best thirds · positions 4 & 5".
  title: string
  // Plain-language explanation of why the app can't separate the teams.
  reason: string
  // Teams in their current order (best first) — the stored resolution order
  // when one exists, otherwise the arbitrary tied order for the user to arrange.
  teams: TieResolverTeam[]
  // Whether the user has already confirmed an order for this tie.
  resolved: boolean
  saveStatus?: SaveStatus
  // Called with the chosen order (best first) when the user confirms.
  onResolve: (orderedIds: string[]) => void
}

// Stable identity of a teams list, so local edits reset only when the tie
// itself changes (different teams / different stored order), not on every
// unrelated re-render.
function idsKey(teams: TieResolverTeam[]): string {
  return teams.map((t) => t.id).join('|')
}

/**
 * Manual tie-resolution control (scoring-rules §6 step 7). Presentational: the
 * parent supplies the tied teams and persists the chosen order via `onResolve`.
 * The user arranges the teams with up/down controls (44px targets, labelled per
 * team) and confirms. Amber throughout — third-place / caution is amber in the
 * design system.
 */
export function TieResolver({
  title,
  reason,
  teams,
  resolved,
  saveStatus = 'idle',
  onResolve,
}: TieResolverProps) {
  const [order, setOrder] = useState<TieResolverTeam[]>(teams)
  const headingId = useId()

  // Re-sync when the underlying tie changes (new teams or a reloaded order).
  useEffect(() => {
    setOrder(teams)
  }, [idsKey(teams)]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = idsKey(order) !== idsKey(teams)

  function move(index: number, delta: number) {
    setOrder((prev) => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
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
        {order.map((team, i) => (
          <li key={team.id} className={styles.row}>
            <span className={styles.pos} aria-hidden="true">
              {i + 1}
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
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${team.name} up`}
              >
                <ChevronUpIcon size={18} />
              </button>
              <button
                type="button"
                className={styles.moveBtn}
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
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
        <Button
          variant="primary"
          onClick={() => onResolve(order.map((t) => t.id))}
          disabled={saveStatus === 'saving' || (resolved && !dirty)}
        >
          {resolved ? 'Update order' : 'Confirm order'}
        </Button>
      </div>
    </section>
  )
}
