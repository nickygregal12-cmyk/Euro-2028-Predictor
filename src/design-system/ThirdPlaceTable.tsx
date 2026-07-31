import { Fragment, type ReactNode } from 'react'
import styles from './ThirdPlaceTable.module.css'
import { TeamFlag } from './TeamFlag'
import { InfoIcon } from './icons'
import type { MatchTeam } from './types'

export type ThirdPlaceRow = {
  position: number // 1..6
  groupLetter: string // 'A'..'F' — drives R16 allocation, so it's first-class here
  team: MatchTeam
  played: number
  goalDifference: number
  points: number
}

export type ThirdPlaceTableProps = {
  rows: ThirdPlaceRow[] // ordered 1..6
  qualifyCount?: number // default 4 — elimination line sits after this position
  // The manual tie-resolution prompt surfaces here when ranking is unresolvable.
  tieResolutionSlot?: ReactNode
}

function formatGD(gd: number): string {
  return gd > 0 ? `+${gd}` : String(gd)
}

/**
 * Best third-placed ranking across all six groups. Presentational: the parent
 * ranks via rankThirdPlacedTeams() and passes rows in; when that returns an
 * unresolved tie, the parent renders the prompt into `tieResolutionSlot`.
 *
 * Layout mirrors GroupTable — each row is a single CSS grid on a shared
 * template (see the module CSS and docs/design-system.md §5) — with an extra
 * group-letter chip column. Every cell is a direct grid child.
 */
export function ThirdPlaceTable({ rows, qualifyCount = 4, tieResolutionSlot }: ThirdPlaceTableProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.table} role="table" aria-label="Best third-placed teams">
        <div className={styles.headRow} role="row">
          <span className={styles.posHead} role="columnheader">
            <span className="sr-only">Position</span>#
          </span>
          <span className={styles.grpHead} role="columnheader">
            Grp
          </span>
          <span className={styles.teamHead} role="columnheader">
            Team
          </span>
          <span className={styles.numHead} role="columnheader">
            Pl
          </span>
          <span className={styles.numHead} role="columnheader">
            GD
          </span>
          <span className={styles.numHead} role="columnheader">
            Pts
          </span>
        </div>

        {rows.map((r) => {
          const qualifies = r.position <= qualifyCount
          return (
            <Fragment key={r.position}>
              <div className={`${styles.row} ${qualifies ? '' : styles.dimmed}`} role="row">
                <span
                  className={`${styles.pos} ${qualifies ? styles.qualifyText : styles.outText}`}
                  role="cell"
                >
                  {r.position}
                </span>
                <span
                  className={`${styles.bar} ${qualifies ? styles.qualify : styles.out}`}
                  aria-hidden="true"
                />
                <span className={styles.grpCell} role="cell">
                  <span className={styles.chip}>{r.groupLetter}</span>
                </span>
                <span className={styles.flagCell} role="cell">
                  <TeamFlag countryCode={r.team.countryCode} label={r.team.name} size="table" />
                </span>
                <span className={styles.teamName} role="cell">
                  {r.team.name}
                </span>
                <span className={styles.num} role="cell">
                  {r.played}
                </span>
                <span className={styles.num} role="cell">
                  {formatGD(r.goalDifference)}
                </span>
                <span className={`${styles.num} ${styles.pts}`} role="cell">
                  {r.points}
                </span>
              </div>
              {r.position === qualifyCount && (
                // A `role="table"` may only contain `row`/`rowgroup` children, so
                // this divider is a row with a single cell rather than a
                // `separator` — which axe flags as `aria-required-children`
                // (critical, WCAG 2.0 A / 1.3.1). `LeagueTable`'s split divider
                // already used this shape; this one predated it.
                //
                // The label is real cell text rather than an `aria-label` on an
                // `aria-hidden` wrapper, so the announcement survives the change
                // instead of depending on a label the rule would strip meaning
                // from.
                <div className={styles.eliminationRow} role="row">
                  <span className={styles.eliminationLabel} role="cell">
                    Elimination line
                  </span>
                </div>
              )}
            </Fragment>
          )
        })}
      </div>

      <div className={styles.footer}>
        <span className={styles.footerNote}>
          <InfoIcon size={14} className={styles.footerIcon} />
          <span>
            Top {qualifyCount} thirds advance; which Round-of-16 slot each fills follows UEFA's
            allocation table.
          </span>
        </span>
        {tieResolutionSlot ? <div className={styles.tieSlot}>{tieResolutionSlot}</div> : null}
      </div>
    </div>
  )
}
