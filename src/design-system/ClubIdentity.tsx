import type { ClubIdentityTokens } from '../domain/clubIdentity/clubIdentityTypes'
import styles from './ClubIdentity.module.css'

export type {
  ClubIdentityTokens,
  ClubKitPattern,
} from '../domain/clubIdentity/clubIdentityTypes'

export type ClubIdentitySize = 'card' | 'table' | 'venue' | 'champion'

export type ClubIdentityProps = {
  name: string
  tokens: ClubIdentityTokens
  size?: ClubIdentitySize
  hideMonogram?: boolean
}

/**
 * The single path by which a club is represented visually (ADR 0017 / DFA-003).
 * The fixed outer box becomes a shirt silhouette in CSS, so every adopter gets
 * the same badge-free identity without adding layout or React-tree weight.
 */
export function ClubIdentity({
  name,
  tokens,
  size = 'card',
  hideMonogram = false,
}: ClubIdentityProps) {
  const { monogram, primary, secondary, pattern = 'solid', onPrimary } = tokens
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
