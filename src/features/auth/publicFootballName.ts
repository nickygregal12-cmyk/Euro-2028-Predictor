export const UNCHOSEN_PUBLIC_NAME = 'Player'

/**
 * OAuth identity is private authentication data. A profile with the neutral
 * server fallback has not yet chosen the public football name that leaderboards,
 * rivals and leagues are allowed to show.
 */
export function needsPublicFootballName(displayName: string | null): boolean {
  const name = displayName?.trim() ?? ''
  return name.length === 0 || name === UNCHOSEN_PUBLIC_NAME
}
