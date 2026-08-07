import type { ClubIdentityTokens } from '../domain/clubIdentity/clubIdentityTypes'
import styles from './ClubIdentity.module.css'

export type {
  ClubIdentityTokens,
  ClubKitPattern,
} from '../domain/clubIdentity/clubIdentityTypes'

export type ClubIdentitySize = 'card' | 'table' | 'venue' | 'champion'

export type ClubIdentityProps = {
  // Full club name. Always the accessible name; never abbreviated for a11y.
  name: string
  tokens: ClubIdentityTokens
  size?: ClubIdentitySize
  // Suppresses the monogram where the adjacent text already names the club and
  // repetition would be noise — a fixture row, for example. The accessible
  // label is unaffected.
  hideMonogram?: boolean
}

/**
 * The single path by which a club is represented visually (ADR 0017 / DFA-003).
 *
 * Clubs are rendered as a compact shirt-style identity from colour, a generic
 * kit pattern and a three-letter monogram — never a crest. The outer box stays
 * layout-stable across all variants; only the clipped shirt inside it changes.
 * That lets dense league tables, fixture cards and future licensed-crest work
 * share one predictable footprint.
 *
 * Accessibility: colour is never the only carrier. Every instance exposes the
 * full club name to assistive technology and, where space permits, renders the
 * monogram visually as a second differentiator. Adjacent visible club text is
 * still required by consuming surfaces; this mark is never the sole identifier.
 */
export function ClubIdentity({
  name,
  tokens,
  size = 'card',
  hideMonogram = false,
}: ClubIdentityProps) {
  const { monogram, primary, secondary, pattern = 'solid', onPrimary } = tokens

  // Every pattern except 'solid' needs two colours. Falling back to solid is
  // preferable to rendering a pattern against `undefined`.
  const resolved = pattern !== 'solid' && !secondary ? 'solid' : pattern

  return (
    <span
      className={`${styles.club} ${styles[size]}`}
      style={
        {
          '--club-primary': primary,
          '--club-secondary': secondary ?? primary,
        } as React.CSSProperties
      }
      role="img"
      aria-label={name}
      data-club-shape="shirt"
    >
      <span
        className={`${styles.shirt} ${styles[resolved]} ${
          onPrimary === 'dark' ? styles.onDark : ''
        }`}
        aria-hidden="true"
        data-club-shirt="true"
      >
        {hideMonogram ? null : (
          <span className={styles.monogram} aria-hidden="true">
            {monogram.toUpperCase()}
          </span>
        )}
      </span>
    </span>
  )
}
