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
}

export function SeasonCompetitionForm({ clubs, matches }: SeasonCompetitionFormProps) {
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
    <section className={styles.panel} aria-labelledby="competition-form">
      <h2 className={styles.heading} id="competition-form">
        Recent form
      </h2>
      <p className={styles.note}>
        Each club&rsquo;s last {matches} settled matches in this competition, most recent first.
        This is form, not the league table — a table carries the competition&rsquo;s own rules and
        is not derived here.
      </p>

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
                  {/* The record in one sentence for assistive technology; the
                      pills beside it are the visual form string and are hidden
                      from it, because "W W L D W" read letter by letter is
                      noise rather than information. */}
                  <span className={styles.srOnly}>
                    Won {club.won}, drawn {club.drawn}, lost {club.lost} of the last{' '}
                    {club.played}
                  </span>
                  <span className={styles.form} aria-hidden="true">
                    {club.form.map((outcome, index) => (
                      <span
                        // The form string is positional and a club can have two
                        // identical results, so the index IS the identity here.
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
