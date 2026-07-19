import styles from './PlayerChip.module.css'

export type PlayerChipSize = 'sm' | 'md' | 'lg'

export type PlayerChipProps = {
  name: string
  // sm = table rows (26px), md = default (34px), lg = profile header (46px).
  size?: PlayerChipSize
  // The current user: accent-filled avatar + a YOU chip.
  you?: boolean
  // Hide the name, showing just the avatar (e.g. dense stacks).
  avatarOnly?: boolean
}

/**
 * Up to two initials derived from a display name. Handles hostile data: empty,
 * single-word, and multi-word names all resolve to at most two glyphs. Uses
 * Array.from so a leading emoji or astral character counts as one initial rather
 * than a broken half-pair.
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) {
    return Array.from(parts[0]).slice(0, 2).join('').toUpperCase()
  }
  const first = Array.from(parts[0])[0] ?? ''
  const last = Array.from(parts[parts.length - 1])[0] ?? ''
  return (first + last).toUpperCase()
}

/**
 * Avatar initials + display name. The name truncates with an ellipsis so the
 * longest plausible name never pushes siblings out of the row (the chip owns
 * `min-width: 0`). Presentational only.
 */
export function PlayerChip({ name, size = 'md', you = false, avatarOnly = false }: PlayerChipProps) {
  return (
    <span className={`${styles.chip} ${styles[size]}`}>
      <span className={`${styles.avatar} ${you ? styles.avatarYou : ''}`} aria-hidden="true">
        {initialsOf(name)}
      </span>
      {avatarOnly ? (
        // The name still needs to reach assistive tech even when visually hidden.
        <span className={styles.srOnly}>{name}</span>
      ) : (
        <>
          <span className={styles.name}>{name}</span>
          {you ? <span className={styles.youChip}>YOU</span> : null}
        </>
      )}
    </span>
  )
}
