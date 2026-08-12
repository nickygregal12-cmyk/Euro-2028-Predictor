import { useId } from 'react'
import type { SeasonClubForm } from '../../services/supabase/seasonClubFormModel'
import styles from './SeasonCompetitionForm.module.css'

/**
 * Recent club form, beneath the competition's fixture list.
 *
 * WHY IT IS NOT A LEAGUE TABLE, AND SAYS SO. The Matches section's accepted
 * shape is Fixtures · Results · Table · Stats, and the **Table** half has no
 * authority: contract 141's migration is explicit that what it derives "is also
 * not a league table", because a league table carries competition rules —
 * deductions, tie-break order, promotion boundaries — that belong to the
 * competition rather than to a derivation. Its read is also capped at twenty
 * matches, so it could not produce a season table even if the rules were
 * absent. Rendering these numbers under a heading reading "Table" would be a
 * heading that lies, so the gap is registered as `MIG-UI-13` and this panel is
 * what the data actually supports.
 *
 * NO DEAD CONTROLS EITHER. There is no Table tab waiting to be filled and no
 * "Coming soon" segment: the section shows what is true and nothing else, which
 * is the finishing standard rather than a shortfall against it.
 *
 * EVERY NUMBER IS OVER THE SAME WINDOW, and the window is stated once above the
 * table rather than implied. A club that has played fewer matches than the
 * window shows its own played count, because a record over four matches is not
 * a record over six.
 *
 * ONLY SETTLED FOOTBALL COUNTS. The read takes `status = 'played'` fixtures, so
 * a postponed or abandoned match contributes nothing rather than a nil-nil, and
 * a provider's provisional score is nowhere in it.
 */

export type SeasonCompetitionFormProps = {
  clubs: readonly SeasonClubForm[]
  /** How many matches back the server was asked for. */
  matches: number
  /**
   * How the same facts are laid out.
   *
   * `table` is the eight-column grid this panel has always been. `panel` is
   * the SAME numbers stacked per club, for the 320px contextual column, where
   * an eight-column table would either overflow the page or become a
   * horizontal scroll nobody discovers. Nothing is dropped between the two —
   * played, won, drawn, lost, goals for and against and the form string all
   * appear in both, and the screen-reader sentence is identical — because a
   * layout that quietly holds less information is a different panel wearing
   * the same name.
   */
  layout?: 'table' | 'panel'
}

export function SeasonCompetitionForm({
  clubs,
  matches,
  layout = 'table',
}: SeasonCompetitionFormProps) {
  // Generated: the gallery renders this panel twice, once per theme, and a
  // fixed id is a critical duplicate-id-aria the moment it does.
  const headingId = useId()
  const played = clubs.filter((club) => club.played > 0)
  // Nothing settled yet is a real state and needs no panel: an empty table of
  // zeroes looks broken and says less than saying nothing.
  if (played.length === 0) return null

  // Most wins, then goal difference, then name. Stated as an ordering of THIS
  // panel rather than of the competition — the competition's own order is a
  // league table, which this is not.
  const ordered = [...played].sort((left, right) => {
    if (left.won !== right.won) return right.won - left.won
    const leftDiff = left.goalsFor - left.goalsAgainst
    const rightDiff = right.goalsFor - right.goalsAgainst
    if (leftDiff !== rightDiff) return rightDiff - leftDiff
    return left.name.localeCompare(right.name)
  })

  return (
    <section className={styles.panel} data-layout={layout} aria-labelledby={headingId}>
      {/* "Club form", not "Recent form". The Match Centre already heads the
          two clubs of an OPENED fixture with "Recent form", and both live on
          this page — a fixture opens inside the list. Two headings with the
          same accessible name on one page is a real defect for anyone
          navigating by heading, and the browser suite caught it as a
          strict-mode violation, which is the same thing said mechanically. */}
      <h2 className={styles.heading} id={headingId}>
        Club form
      </h2>
      <p className={styles.note}>
        Every club in this competition over its last {matches} settled matches, most recent
        first. This is form, not the league table — a table carries the competition&rsquo;s own
        rules and is not derived here.
      </p>

      {layout === 'panel' ? (
        <ul className={styles.clubList}>
          {ordered.map((club) => (
            <li key={club.teamId} className={styles.clubRow}>
              <span className={styles.clubRowName}>{club.name}</span>
              <FormString club={club} goals />
              <span className={styles.clubRowMeta} aria-hidden="true">
                {club.played}P · {club.won}W {club.drawn}D {club.lost}L · {club.goalsFor}–
                {club.goalsAgainst}
              </span>
            </li>
          ))}
        </ul>
      ) : (
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.club}>
                Club
              </th>
              <th scope="col">P</th>
              <th scope="col">W</th>
              <th scope="col">D</th>
              <th scope="col">L</th>
              <th scope="col">GF</th>
              <th scope="col">GA</th>
              <th scope="col">Form</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((club) => (
              <tr key={club.teamId}>
                <th scope="row" className={styles.club}>
                  {club.name}
                </th>
                <td>{club.played}</td>
                <td>{club.won}</td>
                <td>{club.drawn}</td>
                <td>{club.lost}</td>
                <td>{club.goalsFor}</td>
                <td>{club.goalsAgainst}</td>
                <td>
                  <FormString club={club} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  )
}

/**
 * The record in one sentence for assistive technology; the pills beside it are
 * the visual form string and are hidden from it, because "W W L D W" read
 * letter by letter is noise rather than information.
 *
 * Extracted so both layouts spell the accessible sentence exactly once. Two
 * copies of it would be two things to keep in step, and the one that drifted
 * would be the one nobody can see.
 */
function FormString({ club, goals = false }: { club: SeasonClubForm; goals?: boolean }) {
  return (
    <>
      <span className={styles.srOnly}>
        Won {club.won}, drawn {club.drawn}, lost {club.lost} of the last {club.played}
        {/* Only in the panel layout. In the table the goals are their own two
            columns with their own headers, so repeating them here would make a
            screen reader say each number twice. */}
        {goals ? `, scoring ${club.goalsFor} and conceding ${club.goalsAgainst}` : ''}
      </span>
      <span className={styles.form} aria-hidden="true">
        {club.form.map((outcome, index) => (
          <span
            // The form string is positional and a club can have two identical
            // results, so the index IS the identity here.
            key={`${club.teamId}-${index}`}
            className={[
              styles.letter,
              outcome === 'W' ? styles.letterWon : '',
              outcome === 'L' ? styles.letterLost : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {outcome}
          </span>
        ))}
      </span>
    </>
  )
}
