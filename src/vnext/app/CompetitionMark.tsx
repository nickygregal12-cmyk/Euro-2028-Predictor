import type { CSSProperties } from 'react'
import type { ShellCompetition } from '../models/shell'
import styles from './CompetitionMark.module.css'

/**
 * A competition's two-letter mark, in its own colours.
 *
 * DECORATIVE, AND `aria-hidden` FOR A REASON. "PL" is not a name and a screen
 * reader announcing it before "Premier League" says the competition twice, the
 * second time badly. Every place this appears, the competition's real name is
 * in the same control's accessible name — so the mark is a picture of a thing
 * that is already said.
 *
 * NO CREST AND NO IMAGE. The platform holds no competition badge asset, and a
 * shell that reached for one would either ship a placeholder that looks broken
 * or invent a URL. Two letters and the competition's own colours are honest and
 * cost no request.
 */
export function CompetitionMark({
  competition,
  size = 'sm',
}: {
  readonly competition: ShellCompetition
  readonly size?: 'sm' | 'md'
}) {
  return (
    <span
      className={`${styles.mark} ${styles[size]}`}
      aria-hidden="true"
      style={{
        '--mark-primary': competition.colours.primary,
        '--mark-accent': competition.colours.accent,
      } as CSSProperties}
    >
      {competition.monogram}
    </span>
  )
}
