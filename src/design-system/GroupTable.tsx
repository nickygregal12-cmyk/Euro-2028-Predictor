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
 *
 * Layout: each row is a single CSS grid on a shared template (see
 * GroupTable.module.css and docs/design-system.md §5). Position, side bar,
 * flag, team name, Pl, GD and Pts are each a direct grid child — no nested flex
 * grouping of flag+name — so cells always sit inline in their columns. Uses ARIA
 * table roles because the visual grid replaces native table layout.
 */
export function GroupTable({ caption, rows }: GroupTableProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.table} role="table" aria-label={caption}>
        <div className={styles.headRow} role="row">
          <span className={styles.posHead} role="columnheader">
            <span className="sr-only">Position</span>#
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
          const zone = zoneFor(r.position)
          return (
            <div
              key={r.position}
              className={`${styles.row} ${r.position === 4 ? styles.dimmed : ''}`}
              role="row"
            >
              <span className={`${styles.pos} ${styles[`${zone}Text`]}`} role="cell">
                {r.position}
              </span>
              <span className={`${styles.bar} ${styles[zone]}`} aria-hidden="true" />
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
          )
        })}
      </div>

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
