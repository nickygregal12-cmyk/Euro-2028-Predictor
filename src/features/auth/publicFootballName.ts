// Not exported: the neutral fallback is an implementation detail of the question
// below, and callers ask `needsPublicFootballName` rather than comparing strings
// themselves. Exporting it added a name nothing referenced, which the dead-code
// gate reports rather than forgives, and it invited exactly the duplicated
// comparison this module exists to hold in one place.
const UNCHOSEN_PUBLIC_NAME = 'Player'

/**
 * OAuth identity is private authentication data. A profile with the neutral
 * server fallback has not yet chosen the public football name that leaderboards,
 * rivals and leagues are allowed to show.
 */
export function needsPublicFootballName(displayName: string | null): boolean {
  const name = displayName?.trim() ?? ''
  return name.length === 0 || name === UNCHOSEN_PUBLIC_NAME
}
