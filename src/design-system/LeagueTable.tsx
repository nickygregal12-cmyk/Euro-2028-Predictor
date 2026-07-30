import styles from './LeagueTable.module.css'
import { ClubIdentity, type ClubIdentityTokens } from './ClubIdentity'

export type LeagueZoneKind =
  | 'champion'
  | 'promotion'
  | 'europe'
  | 'playoff'
  | 'relegation'

export type LeagueZone = {
  // Inclusive position range, 1-indexed.
  from: number
  to: number
  kind: LeagueZoneKind
  // Shown in the legend and used in the accessible row description.
  label: string
}

export type LeagueTableRow = {
  position: number
  name: string
  club: ClubIdentityTokens
  played: number
  goalDifference: number
  points: number
  // Movement against the previous completed round. Omit where no history
  // exists — a dash is honest; an arrow that always points up is not.
  movement?: 'up' | 'down' | 'none'
}

export type LeagueTableProps = {
  caption: string
  // Ordered by position. The parent computes ordering in the domain layer.
  rows: LeagueTableRow[]
  // Positional zones for this competition. The Premier League and the Scottish
  // Premiership differ, so this is passed rather than derived.
  zones?: LeagueZone[]
  /**
   * Position after which the Scottish split divides the table. When set, a
   * labelled divider is rendered after that position and the two halves are
   * described separately to assistive technology.
   *
   * Positions continue 1..12 across the divider — the split does not restart
   * numbering, and points carry through it.
   */
  splitAfter?: number
  splitLabels?: { top: string; bottom: string }
}

function zoneFor(position: number, zones: LeagueZone[]): LeagueZone | undefined {
  return zones.find((z) => position >= z.from && position <= z.to)
}

function formatGD(gd: number): string {
  return gd > 0 ? `+${gd}` : String(gd)
}

/**
 * A domestic league table. Presentational: ordering, points and goal difference
 * are computed in the domain layer and passed in.
 *
 * Follows GroupTable's layout contract (docs/design-system.md §5) — each row is
 * a single CSS grid on a shared template, every cell a direct grid child, ARIA
 * table roles because the visual grid replaces native table layout.
 *
 * Zones are a prop rather than a rule, because competitions differ: the Premier
 * League has a champion, European places and three relegation positions; the
 * Scottish Premiership has a champion, a play-off place and one relegation.
 * **Zone colour is never the only signal** — the side bar, the position number
 * colour and the legend all carry it, and each row's accessible description
 * names its zone.
 *
 * Twenty rows is a long scan on a 360px screen, so the table is deliberately
 * narrow: position, club, played, goal difference, points. Form and full
 * W/D/L are omitted rather than compressed — a table that needs horizontal
 * scrolling is a table nobody screenshots.
 */
export function LeagueTable({
  caption,
  rows,
  zones = [],
  splitAfter,
  splitLabels,
}: LeagueTableProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.table} role="table" aria-label={caption}>
        <div className={styles.headRow} role="row">
          <span className={styles.posHead} role="columnheader">
            <span className="sr-only">Position</span>#
          </span>
          <span className={styles.clubHead} role="columnheader">
            Club
          </span>
          <span className={styles.numHead} role="columnheader">
            <abbr title="Played">Pl</abbr>
          </span>
          <span className={styles.numHead} role="columnheader">
            <abbr title="Goal difference">GD</abbr>
          </span>
          <span className={styles.numHead} role="columnheader">
            <abbr title="Points">Pts</abbr>
          </span>
        </div>

        {rows.map((r) => {
          const zone = zoneFor(r.position, zones)
          const showDivider = splitAfter !== undefined && r.position === splitAfter + 1

          return (
            <div key={r.position} className={styles.group}>
              {showDivider ? (
                <div className={styles.divider} role="row">
                  <span role="cell" className={styles.dividerLabel}>
                    {splitLabels?.bottom ?? 'Bottom half'}
                  </span>
                </div>
              ) : null}

              <div
                className={`${styles.row} ${zone ? styles[zone.kind] : ''}`}
                role="row"
              >
                <span className={styles.pos} role="cell">
                  <span className={styles.bar} aria-hidden="true" />
                  {r.position}
                </span>

                <span className={styles.mark} role="cell">
                  <ClubIdentity name={r.name} tokens={r.club} size="table" />
                </span>

                <span className={styles.club} role="cell">
                  {r.name}
                  {zone ? <span className="sr-only"> — {zone.label}</span> : null}
                  {r.movement && r.movement !== 'none' ? (
                    <span
                      className={`${styles.move} ${styles[r.movement]}`}
                      aria-label={r.movement === 'up' ? 'Up' : 'Down'}
                    >
                      {r.movement === 'up' ? '▲' : '▼'}
                    </span>
                  ) : null}
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
            </div>
          )
        })}
      </div>

      {zones.length > 0 ? (
        <ul className={styles.legend}>
          {zones.map((z) => (
            <li key={z.kind + z.from} className={styles.legendItem}>
              <span
                className={`${styles.legendBar} ${styles[z.kind]}`}
                aria-hidden="true"
              />
              {z.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
