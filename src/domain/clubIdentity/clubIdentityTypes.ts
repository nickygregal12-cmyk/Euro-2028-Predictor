/**
 * Domain-owned visual identity tokens for a football club.
 *
 * The domain owns the stable data shape. Presentation components may render it,
 * but domain code must never import from the design system.
 */
export type ClubKitPattern =
  | 'solid'
  | 'stripes'
  | 'hoops'
  | 'halves'
  | 'sash'

export type ClubIdentityTokens = {
  /** Three-letter code or derived monogram. */
  monogram: string
  /** Primary kit colour as a CSS colour value. */
  primary: string
  /** Secondary kit colour, required by every non-solid pattern. */
  secondary?: string | undefined
  pattern?: ClubKitPattern
  /** Contrast treatment when a light primary needs a dark monogram. */
  onPrimary?: 'light' | 'dark' | undefined
}
