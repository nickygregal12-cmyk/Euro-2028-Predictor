import type { RoundKey } from './bracketPipeline'
import s from './RoundSwitcher.module.css'

export type RoundSwitcherItem = {
  key: RoundKey
  label: string
  picked: number
  total: number
}

export type RoundSwitcherProps = {
  rounds: RoundSwitcherItem[]
  active: RoundKey
  onSelect: (key: RoundKey) => void
}

/**
 * Segmented control across the four knockout rounds, each with its per-round
 * progress count ("6 of 8"). The active round's label is accent green. All
 * rounds stay tappable — later rounds simply show whatever is resolvable
 * (design-system §5).
 */
export function RoundSwitcher({ rounds, active, onSelect }: RoundSwitcherProps) {
  return (
    <div className={s.switcher} role="tablist" aria-label="Knockout round">
      {rounds.map((r) => {
        const isActive = r.key === active
        const complete = r.total > 0 && r.picked === r.total
        return (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${s.tab} ${isActive ? s.tabActive : ''}`}
            onClick={() => onSelect(r.key)}
          >
            <span className={s.label}>{r.label}</span>
            <span className={`${s.count} ${complete ? s.countDone : ''}`}>
              {r.picked} of {r.total}
            </span>
          </button>
        )
      })}
    </div>
  )
}
