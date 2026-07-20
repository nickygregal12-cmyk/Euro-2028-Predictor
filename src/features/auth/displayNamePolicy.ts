// Display-name moderation — data-driven so it's easy to extend and unit-testable,
// and MIRRORED by the server trigger enforce_display_name_policy
// (20260720200000_display_name_moderation.sql). The server is the real gate;
// this is the friendly first line (a clear error before submit). Keep the two
// lists in sync when either changes.

export const DISPLAY_NAME_MAX = 40

// Whole-name matches (case-insensitive, whitespace-collapsed): impersonation /
// official-sounding identities. Exact match, so real names that merely contain a
// token (e.g. "Modric" vs "mod") are not caught.
export const BANNED_EXACT: readonly string[] = [
  'admin',
  'administrator',
  'moderator',
  'mod',
  'official',
  'staff',
  'support',
  'system',
  'root',
  'owner',
  'help',
  'euro 2028',
  'euro2028',
  'euro 2028 predictor',
]

// Substring matches (case-insensitive): profanity/slur basics, plus a couple of
// high-signal impersonation fragments that don't appear in ordinary names.
// Deliberately small — extend as needed. (Substrings risk false positives, so
// only add fragments unlikely to occur inside real names.)
export const BANNED_SUBSTRINGS: readonly string[] = [
  'fuck',
  'shit',
  'cunt',
  'nigger',
  'faggot',
  'rape',
  'official', // "Euro2028 Official", "Admin (Official)", etc.
]

const GENERIC_REJECT = 'That display name isn’t available. Please choose another.'

/** Normalise for matching: trim, collapse internal whitespace, lowercase. */
export function normaliseDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * The single source of truth for a valid display name: empty/whitespace-only,
 * length, and moderation (impersonation + profanity). Returns an error string,
 * or null when the name is acceptable.
 */
export function checkDisplayName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'Please choose a display name.'
  if (trimmed.length > DISPLAY_NAME_MAX) {
    return `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`
  }

  const norm = normaliseDisplayName(name)
  if (BANNED_EXACT.includes(norm)) return GENERIC_REJECT
  if (BANNED_SUBSTRINGS.some((frag) => norm.includes(frag))) return GENERIC_REJECT

  return null
}
