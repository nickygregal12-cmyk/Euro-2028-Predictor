import styles from './ClubIdentity.module.css'

export type ClubIdentitySize = 'card' | 'table' | 'venue' | 'champion'

export type ClubKitPattern =
  | 'solid'
  | 'stripes'
  | 'hoops'
  | 'halves'
  | 'sash'

export type ClubIdentityTokens = {
  // Three-letter code, e.g. 'NEW'. Uppercased on render.
  monogram: string
  // Primary kit colour as a CSS colour value.
  primary: string
  // Secondary kit colour. Required for every pattern except 'solid'.
  secondary?: string
  pattern?: ClubKitPattern
  // Set when the monogram is illegible on `primary` — e.g. sky blue, yellow.
  onPrimary?: 'light' | 'dark'
}

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
 * The single path by which a club is represented visually (ADR 0017).
 *
 * Clubs are rendered from colour, a generic kit pattern and a three-letter
 * monogram — never a crest. Crests are simultaneously registered trade marks
 * and original artistic works, and no descriptive-use defence exists in
 * copyright. Because this component is the only rendering path, adding licensed
 * crests later is one change here rather than a redesign.
 *
 * Sizes mirror TeamFlag so the two are interchangeable in shared layouts, but
 * the box is square rather than 3:2 — a club mark is not a flag.
 *
 * Accessibility: colour is never the only carrier. Every instance renders a
 * monogram (unless the adjacent text already names the club) and always exposes
 * the full club name to assistive technology. This is also what resolves
 * collisions — Liverpool and Manchester United are both red; Chelsea, Everton
 * and Leicester are all blue.
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
      className={`${styles.club} ${styles[size]} ${styles[resolved]} ${
        onPrimary === 'dark' ? styles.onDark : ''
      }`}
      style={
        {
          '--club-primary': primary,
          '--club-secondary': secondary ?? primary,
        } as React.CSSProperties
      }
      role="img"
      aria-label={name}
    >
      {hideMonogram ? null : (
        <span className={styles.monogram} aria-hidden="true">
          {monogram.toUpperCase()}
        </span>
      )}
    </span>
  )
}
