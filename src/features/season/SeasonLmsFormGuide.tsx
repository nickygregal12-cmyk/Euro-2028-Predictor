import { ClubIdentity } from '../../design-system'
import { resolveClubIdentity } from '../../domain/clubIdentity/clubIdentityTokens'
import type { LmsFormGuide, LmsFormRow } from './lmsFormGuideModel'
import styles from './SeasonLmsFormGuide.module.css'

/**
 * The Last Man Standing contextual panel: how the clubs on offer are playing.
 *
 * IT IS THE DESKTOP SECOND COLUMN AND NOTHING MORE. On a phone it stacks under
 * the pick list, where it is still worth reading and still second — the primary
 * task stays visually dominant at every width, which is the rule the panel
 * exists under rather than an accident of the grid.
 *
 * IT MAKES NO RECOMMENDATION. Form letters, a record and a goal difference, in
 * form order. No "best pick", no score, no arrow: the player picks.
 *
 * FORM LETTERS ARE NEVER COLOUR ALONE. Each carries its letter, and the row's
 * record sentence says the same thing in words for anyone who cannot see the
 * pills at all.
 */

function FormRow({ row }: { row: LmsFormRow }) {
  const identity = resolveClubIdentity({ externalId: row.teamId, name: row.name })
  return (
    <li className={`${styles.row} ${row.used && !row.picked ? styles.rowUsed : ''}`}>
      <span className={styles.srOnly}>
        {row.name}
        {row.opponent ? `, against ${row.opponent}` : ''}
        {row.picked ? ', your pick' : ''}
        {row.used && !row.picked ? ', already used' : ''}. {row.summary.record ?? 'No settled matches yet'}
        {row.summary.goalDifference ? `, goal difference ${row.summary.goalDifference}` : ''}.
      </span>

      <span className={styles.club} aria-hidden="true">
        <ClubIdentity name={row.name} tokens={identity} size="table" />
        <span className={styles.names}>
          <span className={styles.name}>{row.name}</span>
          {row.opponent ? <span className={styles.opponent}>v {row.opponent}</span> : null}
        </span>
      </span>

      <span className={styles.formCell} aria-hidden="true">
        {row.summary.letters.length === 0 ? (
          // Not an empty row of pills: a club with nothing settled has no form,
          // which is different from a run of losses.
          <span className={styles.noForm}>No form yet</span>
        ) : (
          <span className={styles.letters}>
            {row.summary.letters.map((letter, index) => (
              <span
                key={`${row.teamId}-${index}`}
                className={`${styles.letter} ${styles[`letter${letter}`]}`}
              >
                {letter}
              </span>
            ))}
          </span>
        )}
        {row.picked ? <span className={styles.tag}>Your pick</span> : null}
        {row.used && !row.picked ? <span className={styles.tagMuted}>Used</span> : null}
      </span>
    </li>
  )
}

export function SeasonLmsFormGuide({ guide }: { guide: LmsFormGuide }) {
  return (
    <section className={styles.panel} aria-labelledby="lms-form-guide">
      <h2 className={styles.heading} id="lms-form-guide">
        Form guide
      </h2>
      <p className={styles.note}>
        {guide.empty
          ? 'No club in this round has a settled match behind it yet.'
          : 'How the clubs in this round have been playing. Recent results first.'}
      </p>
      {guide.empty ? null : (
        <ul className={styles.list}>
          {guide.rows.map((row) => (
            <FormRow key={row.teamId} row={row} />
          ))}
        </ul>
      )}
    </section>
  )
}
