import { useState } from 'react'
import { TeamFlag } from '../../design-system'
import { ChevronDownIcon } from '../../design-system/icons'
import {
  groupScoreEvents,
  type ScoreEvent,
} from '../../domain/tournament/scoreEvents'
import s from './pointsBreakdown.module.css'

export type PointsBreakdownProps = {
  // The flat list of scored events. Grouping, subtotals and the pinned total are
  // all derived from this one array (domain `groupScoreEvents`), so the total
  // can never disagree with the rows (design-system §6).
  events: ScoreEvent[]
  // Categories start collapsed; pass true to expand any with scored events.
  defaultExpanded?: boolean
}

/**
 * Points breakdown (design-system §6): one collapsible row per scoring category
 * with its subtotal, expanding to the individual score events (flag +
 * plain-language explanation + points; joker-doubled events get a gold pill).
 * Unscored categories show "0 · pending", never hidden. The total is pinned
 * beneath and always equals the sum of the rendered events.
 *
 * Presentational: it renders the events it's handed and owns only expand state.
 */
export function PointsBreakdown({ events, defaultExpanded = false }: PointsBreakdownProps) {
  const { categories, total } = groupScoreEvents(events)
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    defaultExpanded
      ? Object.fromEntries(categories.filter((c) => !c.pending).map((c) => [c.category, true]))
      : {},
  )

  return (
    <div className={s.wrap}>
      <ul className={s.list}>
        {categories.map((cat) => {
          const isOpen = Boolean(open[cat.category]) && !cat.pending
          const rowId = `pb-${cat.category}`
          return (
            <li key={cat.category} className={s.category}>
              <button
                type="button"
                className={s.header}
                aria-expanded={cat.pending ? undefined : isOpen}
                aria-controls={cat.pending ? undefined : rowId}
                disabled={cat.pending}
                onClick={() => setOpen((o) => ({ ...o, [cat.category]: !o[cat.category] }))}
              >
                <ChevronDownIcon
                  size={16}
                  className={`${s.chev} ${isOpen ? s.chevOpen : ''} ${cat.pending ? s.chevHidden : ''}`}
                />
                <span className={s.categoryLabel}>{cat.label}</span>
                {cat.pending ? (
                  <span className={s.pending}>0 · pending</span>
                ) : (
                  <span className={s.subtotal}>{cat.subtotal}</span>
                )}
              </button>

              {isOpen ? (
                <ul id={rowId} className={s.events}>
                  {cat.events.map((event) => (
                    <li key={event.id} className={s.event}>
                      {event.flag ? (
                        <TeamFlag countryCode={event.flag.countryCode} label={event.flag.name} size="table" />
                      ) : (
                        <span className={s.noFlag} aria-hidden="true" />
                      )}
                      <span className={s.explanation}>{event.explanation}</span>
                      {event.joker ? (
                        <span className={s.jokerPill}>2× · +{event.points}</span>
                      ) : (
                        <span
                          className={`${s.eventPoints} ${event.points === 0 ? s.eventPointsZero : ''}`}
                        >
                          {event.points > 0 ? `+${event.points}` : event.points}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className={s.totalRow}>
        <span className={s.totalLabel}>Total</span>
        <span className={s.total}>{total}</span>
      </div>
    </div>
  )
}
