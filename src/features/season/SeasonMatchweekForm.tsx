import { useId } from 'react'
import type { MatchweekFormClub, MatchweekFormGuide } from './matchweekFormModel'
import styles from './SeasonMatchweekForm.module.css'

/**
 * The matchweek's football, beside the card that predicts it.
 *
 * IT IS THE ANSWER TO "WHAT SHOULD I PREDICT", which is the half of `UI-F06`
 * the prediction surface had none of. The consensus panel above it answers
 * "what did everybody else predict" and is withheld until the matchweek locks,
 * so before the lock the contextual column was empty at exactly the moment it
 * was most useful.
 *
 * NOTHING HERE IS A RECOMMENDATION. There is no suggested score, no favourite,
 * no probability and no arrow — only what each club's last few settled matches
 * were. A player reads it and decides; the product does not decide for them.
 *
 * THE WINDOW IS STATED ONCE, ABOVE, rather than implied per row, and a club
 * that has played fewer matches than the window shows its own count — because
 * a record over four matches is not a record over six.
 *
 * THE TABLE POSITION SITS UNDER THE FORM, which is `UI-F06`'s hierarchy: a run
 * of six results can flatter or slander a club, and where it actually sits is
 * the season. It is contract 160's number under the competition's own stored
 * rules, and it is simply absent where the competition has no table or the
 * club is not in it — never a default, because a default position is a claim.
 *
 * THE LETTERS ARE DECORATIVE AND THE SENTENCE IS SPOKEN. "W W D L" read aloud
 * one character at a time is noise; the record beside it is the same fact in
 * words, and it is the one assistive technology gets.
 */

export type SeasonMatchweekFormProps = {
  guide: MatchweekFormGuide
}

export function SeasonMatchweekForm({ guide }: SeasonMatchweekFormProps) {
  // Generated: the gallery renders panels twice, once per theme, and a fixed
  // id is a duplicate-id violation the moment it does.
  const headingId = useId()

  // Nothing settled anywhere is a real state and needs no panel. A grid of
  // "no settled matches yet" says less than saying nothing, and at the start
  // of a season it is every club in the competition.
  if (guide.empty || guide.fixtures.length === 0) return null

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h3 className={styles.heading} id={headingId}>
        Recent form
      </h3>
      <p className={styles.note}>
        Each club&rsquo;s last {guide.window} settled matches, most recent first, with its league
        position. Form and standing only — no prediction is made for you.
      </p>

      <ul className={styles.list}>
        {guide.fixtures.map((fixture) => (
          <li key={fixture.fixtureId} className={styles.fixture}>
            <ClubForm club={fixture.home} />
            <ClubForm club={fixture.away} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ClubForm({ club }: { club: MatchweekFormClub }) {
  const { name, summary, table } = club
  return (
    <div className={styles.club}>
      <span className={styles.clubName}>{name}</span>
      {summary.record === null ? (
        <span className={styles.none}>No settled matches yet</span>
      ) : (
        <>
          <span className={styles.letters} aria-hidden="true">
            {summary.letters.map((letter, index) => (
              <span
                // Positional: a club can have two identical results, so the
                // index IS the identity here.
                key={index}
                className={styles.letter}
                data-outcome={letter}
              >
                {letter}
              </span>
            ))}
          </span>
          <span className={styles.record}>
            {summary.record}
            {summary.goalDifference ? ` · ${summary.goalDifference} goals` : ''}
          </span>
        </>
      )}
      {/* Absent rather than defaulted where the competition has no table or
          does not contain this club. Rendered even when the club has no
          settled form, because a newly promoted side with no run still has a
          position and that is the more useful of the two. */}
      {table ? (
        <span className={styles.standing}>
          {ordinalPosition(table.position)} · {table.points} pts from {table.played}
        </span>
      ) : null}
    </div>
  )
}

/**
 * A position as an ordinal. Local and deliberately tiny, for the reason the
 * Match Centre's copy of it records: the league ordinal helper lives under the
 * tournament's own feature folder, and a season surface importing from there
 * would cross a boundary for four lines of string handling.
 */
function ordinalPosition(position: number): string {
  const tens = position % 100
  if (tens >= 11 && tens <= 13) return `${position}th`
  const suffix = ['th', 'st', 'nd', 'rd'][position % 10] ?? 'th'
  return `${position}${suffix}`
}
