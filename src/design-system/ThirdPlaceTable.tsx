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
 */
export function ThirdPlaceTable({ rows, qualifyCount = 4, tieResolutionSlot }: ThirdPlaceTableProps) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="sr-only">Best third-placed teams</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.posHead}>
              <span className="sr-only">Position</span>#
            </th>
            <th scope="col" className={styles.grpHead}>
              Grp
            </th>
            <th scope="col" className={styles.teamHead}>
              Team
            </th>
            <th scope="col" className={styles.num}>
              Pl
            </th>
            <th scope="col" className={styles.num}>
              GD
            </th>
            <th scope="col" className={styles.num}>
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const qualifies = r.position <= qualifyCount
            return (
              <Fragment key={r.position}>
                <tr className={qualifies ? undefined : styles.dimmed}>
                  <td className={styles.posCell}>
                    <span
                      className={`${styles.bar} ${qualifies ? styles.qualify : styles.out}`}
                      aria-hidden="true"
                    />
                    <span className={`${styles.pos} ${qualifies ? styles.qualifyText : styles.outText}`}>
                      {r.position}
                    </span>
                  </td>
                  <td className={styles.grpCell}>
                    <span className={styles.chip}>{r.groupLetter}</span>
                  </td>
                  <td className={styles.teamCell}>
                    <TeamFlag countryCode={r.team.countryCode} label={r.team.name} size="table" />
                    <span className={styles.teamName}>{r.team.name}</span>
                  </td>
                  <td className={styles.num}>{r.played}</td>
                  <td className={styles.num}>{formatGD(r.goalDifference)}</td>
                  <td className={`${styles.num} ${styles.pts}`}>{r.points}</td>
                </tr>
                {r.position === qualifyCount && (
                  <tr className={styles.eliminationRow}>
                    <td colSpan={6}>
                      <span className={styles.eliminationLine}>
                        <span className={styles.eliminationLabel}>Elimination line</span>
                      </span>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>

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
