/**
 * The player's own non-game preferences (contract 157, `MIG-UI-10`/`MIG-UI-09`).
 *
 * THREE THINGS, KEPT APART. `get_my_preferences` answers three separate
 * questions in one round trip — where the player got to in onboarding, which
 * competitions they FOLLOW (with an optional favourite club per competition),
 * and which co-members they have PINNED as rivals. They are one read because
 * they are one row plus two small tables, and separate fields because the
 * navigation authority forbids deriving any of them from another.
 *
 * FOLLOW IS NOT MEMBERSHIP. Nothing in this file reads or implies a game
 * membership: contract 157's migration asserts it writes none, and the decoder
 * has no field that could be mistaken for one. A player who follows the
 * Premier League and has joined no game is a real, supported state.
 *
 * A FAVOURITE CLUB IS PER COMPETITION, not per account. The server constrains a
 * favourite to a team that plays in the competition being followed, so the
 * shape here is `favourite team ON a follow row` rather than one account-level
 * id that would have to belong to some competition or none.
 *
 * PURE. Server JSON in, presentation model out. No clock, no network, no
 * storage. A malformed row is dropped rather than half-decoded, because half a
 * follow row would render as a competition the player never chose.
 */

export type FollowedCompetition = {
  /** The season row id every season read is addressed by. */
  tournamentId: string
  /** Canonical team id, or null when the player skipped it — and skipping is fine. */
  favouriteTeamId: string | null
  /** ISO instant the follow was recorded. Server order is preserved. */
  followedAt: string | null
}

export type PinnedRival = {
  tournamentId: string
  rivalUserId: string
}

export type OnboardingProgress = {
  /**
   * The step the player last reached, in the journey's own vocabulary. Null
   * when they have never started — which is different from having finished, and
   * also what an unrecognised stored value becomes.
   */
  step: string | null
  /** Set once, the first time onboarding completed. Never rewritten. */
  completedAt: string | null
}

export type PlayerPreferences = {
  onboarding: OnboardingProgress
  follows: readonly FollowedCompetition[]
  pinnedRivals: readonly PinnedRival[]
}

/**
 * What a surface should assume before the read has landed or after it failed.
 *
 * IT IS NOT A DEFAULT ANSWER. `EMPTY_PREFERENCES` says "the player follows
 * nothing", which is a real state; a caller must not substitute it for a read
 * that failed, because "you follow nothing" and "we could not find out" send a
 * player to different screens. The provider models those separately.
 */
export const EMPTY_PREFERENCES: PlayerPreferences = {
  onboarding: { step: null, completedAt: null },
  follows: [],
  pinnedRivals: [],
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * The journey's steps, and what `profiles.onboarding_step` is allowed to hold.
 *
 * WHY A TRANSLATION EXISTS AT ALL. Contract 157 constrains the column to four
 * values — `competition`, `games`, `identity`, `done` — and the journey names
 * its four steps for what the player is doing on them. Only `games` happens to
 * coincide, so writing the journey's own names sent three of every four writes
 * into a CHECK violation: the server answered 400, the step writes are
 * deliberately silent, and Finish surfaced "We could not finish your setup"
 * with no way to tell which call had been refused. Onboarding progress was
 * therefore never saved except on one step, and setup could never complete.
 *
 * IT IS A TRANSLATION, NOT A RENAME. The stored vocabulary is a server rule
 * this session may not change, and the journey's names are the better names for
 * what its steps ARE — so the mapping lives here, at the boundary that already
 * exists to convert between the two, rather than either side bending to the
 * other. `identity` is the accepted value closest to choosing a favourite club.
 *
 * IT ROUND-TRIPS. Every step maps to exactly one stored value and back, so a
 * player who leaves halfway resumes on the step they left rather than one
 * either side of it. An unrecognised stored value reads as null, and the
 * journey starts from the beginning — the same as never having started, which
 * is the only safe reading of a value this map does not know.
 */
const STORED_ONBOARDING_STEP: Readonly<Record<string, string>> = {
  competitions: 'competition',
  clubs: 'identity',
  games: 'games',
  review: 'done',
}

const JOURNEY_ONBOARDING_STEP: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(STORED_ONBOARDING_STEP).map(([journey, stored]) => [stored, journey]),
)

/** A journey step as the column accepts it. Null for anything it does not. */
export function storedOnboardingStep(step: string): string | null {
  return STORED_ONBOARDING_STEP[step] ?? null
}

/** A stored value as the journey names it. Null for anything unrecognised. */
export function journeyOnboardingStep(stored: string | null): string | null {
  return stored === null ? null : (JOURNEY_ONBOARDING_STEP[stored] ?? null)
}

function mapFollow(value: unknown): FollowedCompetition | null {
  const row = objectOf(value)
  const tournamentId = stringOrNull(row.tournament_id)
  // A follow with no competition is not a follow. Dropped rather than defaulted:
  // guessing a competition here would put one on a player's Hub that they never
  // chose.
  if (!tournamentId) return null
  return {
    tournamentId,
    favouriteTeamId: stringOrNull(row.favourite_team_id),
    followedAt: stringOrNull(row.followed_at),
  }
}

function mapRival(value: unknown): PinnedRival | null {
  const row = objectOf(value)
  const tournamentId = stringOrNull(row.tournament_id)
  const rivalUserId = stringOrNull(row.rival_user_id)
  if (!tournamentId || !rivalUserId) return null
  return { tournamentId, rivalUserId }
}

export function mapPlayerPreferences(payload: unknown): PlayerPreferences {
  const root = objectOf(payload)
  const onboarding = objectOf(root.onboarding)

  return {
    onboarding: {
      step: journeyOnboardingStep(stringOrNull(onboarding.step)),
      completedAt: stringOrNull(onboarding.completed_at),
    },
    follows: arrayOf(root.follows)
      .map(mapFollow)
      .filter((entry): entry is FollowedCompetition => entry !== null),
    pinnedRivals: arrayOf(root.pinned_rivals)
      .map(mapRival)
      .filter((entry): entry is PinnedRival => entry !== null),
  }
}

/** Whether the player follows this competition season. */
export function isFollowing(
  preferences: PlayerPreferences,
  tournamentId: string | null,
): boolean {
  if (!tournamentId) return false
  return preferences.follows.some((follow) => follow.tournamentId === tournamentId)
}

/**
 * The favourite club for one competition, or null.
 *
 * Null covers two cases deliberately merged here — not following, and following
 * without a favourite — because both mean "show no club", and a surface that
 * needed to tell them apart would ask `isFollowing` as well.
 */
export function favouriteTeamFor(
  preferences: PlayerPreferences,
  tournamentId: string | null,
): string | null {
  if (!tournamentId) return null
  return (
    preferences.follows.find((follow) => follow.tournamentId === tournamentId)
      ?.favouriteTeamId ?? null
  )
}

/** The rivals pinned in one competition, in the server's order. */
export function pinnedRivalsFor(
  preferences: PlayerPreferences,
  tournamentId: string | null,
): readonly string[] {
  if (!tournamentId) return []
  return preferences.pinnedRivals
    .filter((rival) => rival.tournamentId === tournamentId)
    .map((rival) => rival.rivalUserId)
}
