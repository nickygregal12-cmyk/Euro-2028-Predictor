import { useId, useState } from 'react'
import { ChevronDownIcon } from '../../design-system/icons'
import type { MatchPredictorPage } from '../season/matchPredictorModel'
import { presentMatchweekPoints } from './matchweekPointsModel'
import s from './matchweekPoints.module.css'

/**
 * "Why did I get these points?", for a settled season matchweek.
 *
 * IT IS A DISCLOSURE, CLOSED BY DEFAULT. The card above it already shows every
 * fixture with its result; this exists for the player who wants the arithmetic,
 * and opening it is their choice. The summary line is readable without opening
 * anything, which is what most players want — three exact, four results, one
 * blank.
 *
 * IT PRINTS THE SERVER'S TOTAL, ALWAYS. The rows and the subtotal come from the
 * card; the total is the one the season banked. Where the rows do not account
 * for it, the mismatch is stated rather than resolved in the player's favour or
 * against it — see `matchweekPointsModel` for why that is the safer failure.
 *
 * PRESENTATIONAL. Every decision is the model's; this owns open/closed state.
 */

export type MatchweekPointsProps = {
  card: MatchPredictorPage
}

export function MatchweekPoints({ card }: MatchweekPointsProps) {
  const view = presentMatchweekPoints(card)
  const [open, setOpen] = useState(false)
  const panelId = useId()

  // Nothing settled, nothing to explain. Saying "0 so far" about a matchweek
  // still being played would be a claim about points that have not been decided.
  if (view.kind === 'unsettled') return null

  if (view.kind === 'unbanked') {
    return (
      <section className={s.wrap} aria-label="How this matchweek scored">
        <p className={s.unbanked}>
          You did not enter this matchweek, so nothing was banked and it scored {view.total}. That
          is different from entering predictions and leaving some blank.
        </p>
      </section>
    )
  }

  return (
    <section className={s.wrap} aria-label="How this matchweek scored">
      <button
        type="button"
        className={s.header}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((was) => !was)}
      >
        <ChevronDownIcon size={16} className={`${s.chev} ${open ? s.chevOpen : ''}`} />
        <span className={s.headerText}>
          <span className={s.headerTitle}>Why {view.total} points</span>
          <span className={s.headerMeta}>{summary(view)}</span>
        </span>
        <span className={s.headerTotal}>{view.total}</span>
      </button>

      {open ? (
        <div id={panelId} className={s.panel}>
          <ul className={s.rows}>
            {view.rows.map((row) => (
              <li key={row.fixtureId} className={s.row}>
                <span className={s.fixture}>
                  {row.home} v {row.away}
                </span>
                <span className={s.detail}>
                  {row.explanation}
                  {' · '}
                  {/* The two scorelines, always both. "Exact score" without the
                      numbers asks the player to remember what they predicted. */}
                  {row.prediction === null
                    ? `no prediction, finished ${row.result}`
                    : `you ${row.prediction}, finished ${row.result}`}
                </span>
                <span className={`${s.points} ${row.points === 0 ? s.pointsZero : ''}`}>
                  {row.points > 0 ? `+${row.points}` : '0'}
                </span>
              </li>
            ))}
          </ul>

          {view.unsettled > 0 ? (
            <p className={s.note}>
              {view.unsettled} fixture{view.unsettled === 1 ? '' : 's'} on this matchweek {view.unsettled === 1 ? 'has' : 'have'} not
              been settled yet, so {view.unsettled === 1 ? 'it is' : 'they are'} not listed above. The
              total below is what the season has banked so far.
            </p>
          ) : null}

          <dl className={s.sums}>
            <div className={s.sumRow}>
              <dt>Fixtures</dt>
              <dd>{view.subtotal}</dd>
            </div>
            {view.joker ? (
              // Once, after the fixtures, because that is where ADR 0012 applies
              // it. Doubling each row would reach the same total by a route the
              // rule does not take.
              <div className={s.sumRow}>
                <dt>Joker · doubles the whole matchweek</dt>
                <dd>+{view.joker.doubled}</dd>
              </div>
            ) : null}
            <div className={`${s.sumRow} ${s.sumTotal}`}>
              <dt>Banked</dt>
              <dd>{view.total}</dd>
            </div>
          </dl>

          {!view.reconciles && view.unsettled === 0 ? (
            <p role="note" className={s.mismatch}>
              These fixtures do not add up to the {view.total} the season banked — a result may have
              been corrected after this matchweek was scored. {view.total} is the total that counts;
              the itemisation above is incomplete.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function summary(view: Extract<ReturnType<typeof presentMatchweekPoints>, { kind: 'itemised' }>) {
  const parts: string[] = []
  if (view.exact > 0) parts.push(`${view.exact} exact`)
  if (view.correctResult > 0) parts.push(`${view.correctResult} right result`)
  if (view.missed > 0) parts.push(`${view.missed} wrong`)
  if (view.blank > 0) parts.push(`${view.blank} left blank`)
  if (view.joker) parts.push('Joker played')
  return parts.length > 0 ? parts.join(' · ') : 'No fixtures settled on this card'
}
