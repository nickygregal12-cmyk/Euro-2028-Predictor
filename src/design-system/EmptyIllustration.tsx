import styles from './EmptyIllustration.module.css'

export type EmptyIllustrationProps = {
  /**
   * `list` — a table or list with nothing in it (no competitions joined, no
   * game available). `complete` — nothing left to do rather than nothing there
   * (all competitions joined).
   */
  variant?: 'list' | 'complete'
}

/**
 * The reusable empty-state mark (design-system §11.9).
 *
 * Geometric and drawn from the same Broadcast Grid vocabulary as the masthead,
 * from tokens, as inline SVG. It is decorative: the heading and description
 * carry the meaning per §8, and this never carries it alone — so it is
 * `aria-hidden` and exposes no text.
 */
export function EmptyIllustration({ variant = 'list' }: EmptyIllustrationProps) {
  return (
    <svg
      className={styles.illustration}
      viewBox="0 0 120 76"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Framing corners — the masthead's alignment mark, opened out. */}
      <path className={styles.mark} d="M1 13V1H13" />
      <path className={styles.mark} d="M107 1H119V13" />
      <path className={styles.mark} d="M119 63V75H107" />
      <path className={styles.mark} d="M13 75H1V63" />

      {/* Halfway line and centre circle — football-adjacent, not a pitch. */}
      <path className={styles.line} d="M60 16V60" />
      <circle className={styles.line} cx="60" cy="38" r="11" />

      {variant === 'list' ? (
        <>
          {/* Empty rows, thinning outward. */}
          <path className={styles.row} d="M22 28H44" />
          <path className={styles.row} d="M22 38H44" />
          <path className={styles.rowFaint} d="M22 48H44" />
          <path className={styles.row} d="M76 28H98" />
          <path className={styles.row} d="M76 38H98" />
          <path className={styles.rowFaint} d="M76 48H98" />
        </>
      ) : (
        <>
          {/* Filled rows — the same structure, complete. */}
          <path className={styles.rowDone} d="M22 28H44" />
          <path className={styles.rowDone} d="M22 38H44" />
          <path className={styles.rowDone} d="M22 48H44" />
          <path className={styles.rowDone} d="M76 28H98" />
          <path className={styles.rowDone} d="M76 38H98" />
          <path className={styles.rowDone} d="M76 48H98" />
        </>
      )}
    </svg>
  )
}
