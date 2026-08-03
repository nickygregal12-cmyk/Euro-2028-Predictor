/**
 * Season Last Man Standing eligibility, used-team reset and auto-assignment.
 *
 * Authority: ADR 0013 as amended by ADR 0020. The rules encoded here:
 *
 * - selection is restricted to teams actually playing in the round;
 * - a team appearing twice within one designated round is ineligible that
 *   round;
 * - a team, once selected, cannot be selected again until the player's used
 *   list resets — and the used-team reset is MANDATORY: a player whose used
 *   list covers every playing team resets rather than being eliminated on
 *   availability grounds;
 * - a missed selection auto-assigns the alphabetically first eligible unused
 *   team — deterministic, confers no advantage;
 * - a postponed pick's team is consumed, never handed back, which is why
 *   nothing here removes a team from a used list except the mandatory reset.
 *
 * This is deliberately NOT the tournament LMS (`competitions/lmsSelection.ts`
 * words a tournament pick's fate for display). Season LMS rules have their
 * own authority and must not inherit tournament assumptions. Pure domain: no
 * storage, network or ambient clock.
 */

export type LmsRoundFixture = {
  fixtureId: string
  homeTeamId: string
  awayTeamId: string
}

export type LmsTeam = {
  teamId: string
  name: string
}

export type LmsEligibilityInput = {
  /** The designated round's full fixture programme. */
  fixtures: readonly LmsRoundFixture[]
  /** Every club in the competition, supplying the alphabetical names. */
  teams: readonly LmsTeam[]
  /** Teams this player has consumed since their last reset. */
  usedTeamIds: readonly string[]
}

export type LmsEligibilityResult =
  | {
      ok: true
      /** Eligible team ids, sorted alphabetically by team name. */
      eligibleTeamIds: readonly string[]
      /**
       * True when the mandatory reset fired: the used list covered every
       * playing-once team, so it cleared and eligibility was recomputed.
       */
      usedListReset: boolean
      /** Playing twice this round — ineligible however fresh the used list. */
      doubleFixtureTeamIds: readonly string[]
    }
  | { ok: false; reason: 'invalid_input' | 'duplicate_fixture' | 'unknown_team' | 'team_against_itself' }

/**
 * Alphabetical order for club names, by code point after trimming. Chosen
 * over locale collation so TypeScript and the future SQL parity implement
 * the same deterministic order regardless of environment locale.
 */
function byName(left: LmsTeam, right: LmsTeam): number {
  const a = left.name.trim()
  const b = right.name.trim()
  return a < b ? -1 : a > b ? 1 : 0
}

export function resolveLmsEligibility(input: LmsEligibilityInput): LmsEligibilityResult {
  const teamsById = new Map<string, LmsTeam>()
  for (const team of input.teams) {
    if (team.teamId.trim().length === 0 || team.name.trim().length === 0) {
      return { ok: false, reason: 'invalid_input' }
    }
    if (teamsById.has(team.teamId)) return { ok: false, reason: 'invalid_input' }
    teamsById.set(team.teamId, team)
  }

  const fixtureIds = new Set<string>()
  const appearances = new Map<string, number>()
  for (const fixture of input.fixtures) {
    if (fixture.fixtureId.trim().length === 0) return { ok: false, reason: 'invalid_input' }
    if (fixtureIds.has(fixture.fixtureId)) return { ok: false, reason: 'duplicate_fixture' }
    fixtureIds.add(fixture.fixtureId)
    if (fixture.homeTeamId === fixture.awayTeamId) {
      return { ok: false, reason: 'team_against_itself' }
    }
    for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
      if (!teamsById.has(teamId)) return { ok: false, reason: 'unknown_team' }
      appearances.set(teamId, (appearances.get(teamId) ?? 0) + 1)
    }
  }

  for (const teamId of input.usedTeamIds) {
    if (!teamsById.has(teamId)) return { ok: false, reason: 'unknown_team' }
  }

  const playingOnce = [...appearances.entries()]
    .filter(([, count]) => count === 1)
    .map(([teamId]) => teamsById.get(teamId) as LmsTeam)
  const doubleFixtureTeamIds = [...appearances.entries()]
    .filter(([, count]) => count > 1)
    .map(([teamId]) => teamId)
    .sort()

  const used = new Set(input.usedTeamIds)
  let eligible = playingOnce.filter((team) => !used.has(team.teamId))
  let usedListReset = false
  if (eligible.length === 0 && playingOnce.length > 0) {
    // The mandatory reset: availability never eliminates.
    usedListReset = true
    eligible = playingOnce
  }

  return {
    ok: true,
    eligibleTeamIds: [...eligible].sort(byName).map((team) => team.teamId),
    usedListReset,
    doubleFixtureTeamIds,
  }
}

/**
 * The auto-assignment for a missed selection: the alphabetically first
 * eligible unused team, with the mandatory reset applied first when the
 * used list left nothing. `null` only when the round itself offers no
 * eligible team (no playing-once team at all) or the input refuses —
 * callers must fail closed on `null`, never invent a pick.
 */
export function autoAssignLmsTeam(input: LmsEligibilityInput): string | null {
  const eligibility = resolveLmsEligibility(input)
  if (!eligibility.ok || eligibility.eligibleTeamIds.length === 0) return null
  return eligibility.eligibleTeamIds[0]
}
