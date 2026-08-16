import type { FormResult } from '../../models/football'
import typography from '../../foundations/typography.module.css'
import styles from './FormRun.module.css'

export type FormRunProps = {
  /** Most recent first, which is how the run is drawn: newest on the right. */
  form: readonly FormResult[]
  /** Named in the accessible label so two runs side by side are distinguishable. */
  teamName: string
}

const LETTER: Record<FormResult, string> = {
  win: 'W',
  draw: 'D',
  loss: 'L',
}

const WORD: Record<FormResult, string> = {
  win: 'won',
  draw: 'drew',
  loss: 'lost',
}

/**
 * The last five results.
 *
 * Colour is never the only signal: each pill carries its letter, so the run is
 * readable in greyscale and by anyone who cannot separate the green from the
 * red. The whole run is one image to assistive technology with a sentence
 * label, because five separate "W" announcements are noise.
 *
 * A promoted side with three results shows three pills. Padding a run to five
 * with blanks would invent matches that were never played.
 */
export function FormRun({ form, teamName }: FormRunProps) {
  if (form.length === 0) return null

  // Oldest first for reading, matching the left-to-right order on screen.
  const chronological = [...form].reverse()
  const label = `${teamName} recent form, oldest first: ${chronological
    .map((result) => WORD[result])
    .join(', ')}`

  return (
    <span className={styles.run} role="img" aria-label={label}>
      {chronological.map((result, index) => (
        <span
          // Results repeat and carry no identity of their own, so position is
          // the only stable key available here.
          key={`${result}-${index}`}
          className={`${styles.pill} ${styles[result]} ${typography.numeric}`}
          aria-hidden="true"
        >
          {LETTER[result]}
        </span>
      ))}
    </span>
  )
}
