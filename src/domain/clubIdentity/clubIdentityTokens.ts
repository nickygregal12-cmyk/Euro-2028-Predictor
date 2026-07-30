// Resolves provider club data into ClubIdentityTokens (ADR 0017).
//
// Pure. No storage, no network, no clock. Providers supply the roster, short
// name, three-letter code and a colour string; this module turns those into
// the tokens the ClubIdentity component renders, applying a small curated
// overlay for the two things no provider supplies.

import type {
  ClubIdentityTokens,
  ClubKitPattern,
} from '../../design-system/ClubIdentity'

/**
 * What a provider gives us, normalised. Both current providers expose these:
 * football-data.org as `shortName` / `tla` / `clubColors`, Sportmonks under its
 * own names. The adapter maps onto this shape; this module never sees a
 * provider payload.
 */
export type ProviderClub = {
  // Provider's stable identifier, for keying and diagnostics.
  externalId: string
  // Full registered name, e.g. 'Wolverhampton Wanderers FC'.
  name: string
  // Provider short name, e.g. 'Wolves'. Absent for some clubs.
  shortName?: string
  // Three-letter code, e.g. 'WOL'. Absent for some clubs.
  tla?: string
  // Free text, e.g. 'Gold / Black'. Ordering is meaningful; hex is not given.
  clubColors?: string
}

/**
 * The only curated data in this module: what a provider cannot supply.
 *
 * - `pattern` — nothing in a colour string says Newcastle is stripes.
 * - `onPrimary` — nothing says a gold shirt needs a dark monogram.
 * - `primary` / `secondary` — override where the colour string is ambiguous,
 *   wrong, or names a shade the map cannot resolve.
 * - `monogram` — override where the provider's code is absent or unhelpful.
 *
 * Keyed by three-letter code. **A club with no entry is not a defect.** It
 * renders solid, in its provider colour, with a light monogram — which is
 * correct for most clubs. Promoted clubs work on day one without a code change.
 */
export type ClubOverlay = {
  pattern?: ClubKitPattern
  onPrimary?: 'light' | 'dark'
  primary?: string
  secondary?: string
  monogram?: string
}

export const clubOverlay: Record<string, ClubOverlay> = {
  // Patterned kits.
  NEW: { pattern: 'stripes' },
  BRE: { pattern: 'stripes' },
  CEL: { pattern: 'hoops' },
  CRY: { pattern: 'sash' },

  // Light primaries needing a dark monogram.
  MCI: { onPrimary: 'dark' },
  WOL: { onPrimary: 'dark' },
  TOT: { onPrimary: 'dark' },
  FUL: { onPrimary: 'dark' },

  // Every other club: solid, provider colour, light monogram.
}

/**
 * Named colours seen in provider colour strings, mapped to hex.
 *
 * Deliberately conservative. An unrecognised name resolves to the fallback
 * rather than to a guess, and the overlay exists to correct anything this gets
 * wrong. Guessing a shade is worse than rendering a neutral mark.
 */
const namedColours: Record<string, string> = {
  red: '#C8102E',
  'claret': '#670E36',
  maroon: '#7B1122',
  blue: '#003399',
  'sky blue': '#6CABDD',
  'light blue': '#6CABDD',
  navy: '#132257',
  'royal blue': '#034694',
  green: '#018749',
  white: '#FFFFFF',
  black: '#241F20',
  gold: '#FDB913',
  yellow: '#FDB913',
  amber: '#FDB913',
  orange: '#F26522',
  purple: '#4B2E83',
  pink: '#E5A0C4',
  grey: '#8B95A3',
  gray: '#8B95A3',
  silver: '#C0C4C8',
}

const FALLBACK_PRIMARY = '#3A4250'

/**
 * Splits a provider colour string into ordered hex values.
 *
 * 'Gold / Black' → ['#FDB913', '#241F20']. Order is preserved because it is
 * meaningful: the first colour is the shirt.
 */
export function parseClubColours(clubColors?: string): string[] {
  if (!clubColors) return []
  return clubColors
    .split('/')
    .map((part) => part.trim().toLowerCase())
    .map((part) => namedColours[part])
    .filter((hex): hex is string => Boolean(hex))
}

/**
 * Derives a three-letter monogram where the provider supplies none.
 *
 * Single word: first three letters. Multiple words: first letter of the first
 * three significant words. 'FC', 'AFC' and 'United' style suffixes are dropped
 * because they carry no distinguishing information.
 */
export function deriveMonogram(name: string): string {
  const noise = new Set(['fc', 'afc', 'cf', 'the', 'and', '&'])
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ''))
    .filter((w) => w.length > 0 && !noise.has(w.toLowerCase()))

  if (words.length === 0) return '???'
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/**
 * The display name used in the interface and in the accessible label.
 *
 * Prefers the provider's short name. A football audience knows the club as
 * 'Wolves', not 'Wolverhampton Wanderers FC', and a screen reader repeating the
 * registered name on every row of a league table is worse, not better.
 */
export function resolveClubName(club: ProviderClub): string {
  return club.shortName?.trim() || club.name.trim()
}

/**
 * Provider club plus overlay in, ClubIdentityTokens out.
 *
 * Precedence, highest first: overlay, then provider, then derived, then
 * fallback. Never throws — an unusable club renders as a neutral mark with a
 * derived monogram rather than breaking a fixture list.
 */
export function resolveClubIdentity(
  club: ProviderClub,
  overlay: Record<string, ClubOverlay> = clubOverlay,
): ClubIdentityTokens {
  const providerCode = club.tla?.trim().toUpperCase()
  const derivedCode = deriveMonogram(resolveClubName(club))
  const entry = (providerCode && overlay[providerCode]) || {}

  const parsed = parseClubColours(club.clubColors)
  const primary = entry.primary ?? parsed[0] ?? FALLBACK_PRIMARY
  const secondary = entry.secondary ?? parsed[1]
  const pattern = entry.pattern ?? 'solid'

  return {
    monogram: entry.monogram ?? providerCode ?? derivedCode,
    primary,
    // Only carried when a pattern needs it; the component falls back to solid
    // if a pattern is set without a second colour, but not sending one keeps
    // the token object honest about what is known.
    secondary: pattern === 'solid' ? undefined : secondary,
    pattern,
    onPrimary: entry.onPrimary,
  }
}
