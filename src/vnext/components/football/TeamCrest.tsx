import type { CSSProperties } from 'react'
import type { Team } from '../../models/football'
import styles from './TeamCrest.module.css'

export type TeamCrestSize = 'sm' | 'md' | 'lg'

export type TeamCrestProps = {
  team: Team
  size?: TeamCrestSize
  /** Decorative use, when the team name is already written beside it. */
  decorative?: boolean
}

/**
 * A club's visual identity, drawn from colour rather than fetched.
 *
 * WHY NOT A CREST IMAGE. No crest source is agreed, `Team.crestUrl` is null
 * everywhere, and this PR calls no provider. So the mark is a shirt shape in the
 * club's own colours carrying its three-letter code — enough for a fixture list
 * to be scannable, and honest about what the product can actually get today. If
 * a crest source arrives later, the `<img>` slots in behind the same component
 * and every caller keeps working.
 *
 * WHY THE COLOURS ARE INLINE. A club colour comes from football, not from the
 * theme, so it cannot be a design token — the same idiom the legacy
 * `ClubIdentity` settled on. `onPrimary` decides the text colour because it is
 * a contrast decision the fixture states rather than one this component guesses.
 *
 * The code is never the only identifier: every crest carries the full club name
 * for assistive technology, and callers show the name in text beside it.
 */
export function TeamCrest({
  team,
  size = 'md',
  decorative = false,
}: TeamCrestProps) {
  const { colours, kitPattern } = team

  return (
    <span
      className={`${styles.crest} ${styles[size]} ${styles[kitPattern]} ${
        colours.onPrimary === 'dark' ? styles.onDark : ''
      }`}
      style={
        {
          '--vnext-team-primary': colours.primary,
          '--vnext-team-secondary': colours.secondary,
          '--vnext-team-accent': colours.accent,
        } as CSSProperties
      }
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': team.name })}
    >
      <span className={styles.code} aria-hidden="true">
        {team.abbreviation}
      </span>
    </span>
  )
}
