import styles from './GroupTable.module.css'
import { TeamFlag } from './TeamFlag'
import type { MatchTeam } from './types'

export type GroupTableRow = {
  position: number // 1..4
  team: MatchTeam
  played: number
  goalDifference: number
  points: number
}

export type GroupTableProps = {
  caption: string // e.g. 'Group A'
  rows: GroupTableRow[] // ordered 1..4
}

// Qualification zone drives both the side-bar colour and the number colour —
// colour is never the only signal (position number + bar + legend).
function zoneFor(position: number): 'qualify' | 'third' | 'out' {
  if (position <= 2) return 'qualify'
  if (position === 3) return 'third'
  return 'out'
}

function formatGD(gd: number): string {
  return gd > 0 ? `+${gd}` : String(gd)
}

/**
 * Predicted group standings. Presentational: the parent computes ordering via
 * the domain layer (calculateGroupTable / resolveGroupTies) and passes rows in.
 */
export function GroupTable({ caption, rows }: GroupTableProps) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.posHead}>
              <span className="sr-only">Position</span>#
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
            const zone = zoneFor(r.position)
            return (
              <tr key={r.position} className={r.position === 4 ? styles.dimmed : undefined}>
                <td className={styles.posCell}>
                  <span className={`${styles.bar} ${styles[zone]}`} aria-hidden="true" />
                  <span className={`${styles.pos} ${styles[`${zone}Text`]}`}>{r.position}</span>
                </td>
                <td className={styles.teamCell}>
                  <TeamFlag countryCode={r.team.countryCode} label={r.team.name} size="table" />
                  <span className={styles.teamName}>{r.team.name}</span>
                </td>
                <td className={styles.num}>{r.played}</td>
                <td className={styles.num}>{formatGD(r.goalDifference)}</td>
                <td className={`${styles.num} ${styles.pts}`}>{r.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.qualify}`} aria-hidden="true" /> Qualify
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.third}`} aria-hidden="true" /> Best-third race
        </span>
      </div>
    </div>
  )
}
