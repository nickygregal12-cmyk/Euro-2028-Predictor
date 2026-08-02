import type { CompetitionConfig } from './kinds'
import type { LockScopeKind } from './lockState'

/**
 * The games a competition season can host. A game is the thing a user joins
 * and plays; the competition supplies identity, calendar and structure. Lock
 * behaviour belongs here, not on the competition: the same Premier League
 * season must support a zero-buffer Main Predictor and a 30-minute-buffer
 * Last Man Standing at the same time, so no single competition-wide lock
 * policy can be correct.
 */
export type GameKind =
  | 'original_predictor'
  | 'main_predictor'
  | 'last_man_standing'
  | 'predictor_championship'

export type GameLockPolicy = {
  /** Which unit of play one lock closes over. */
  scope: LockScopeKind
  /**
   * How many lock scopes the competition must present for this game. Declared
   * by the game rather than inferred, so a season that presents the wrong
   * number of matchweeks is detected instead of silently accepted.
   */
  scopeCount: number
  /** Minutes before the scope's earliest kickoff that the lock lands. */
  bufferMinutes: number
}

export type GameConfig = {
  id: string
  name: string
  kind: GameKind
  lockPolicy: GameLockPolicy
}

const GAME_KINDS: readonly GameKind[] = [
  'original_predictor',
  'main_predictor',
  'last_man_standing',
  'predictor_championship',
]

const LOCK_SCOPE_KINDS: readonly LockScopeKind[] = ['entry', 'round', 'matchweek', 'match']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export function isGameLockPolicy(value: unknown): value is GameLockPolicy {
  if (!isRecord(value)) return false
  return (
    LOCK_SCOPE_KINDS.includes(value.scope as LockScopeKind) &&
    isPositiveInteger(value.scopeCount) &&
    typeof value.bufferMinutes === 'number' &&
    Number.isInteger(value.bufferMinutes) &&
    value.bufferMinutes >= 0
  )
}

export function isGameConfig(value: unknown): value is GameConfig {
  if (!isRecord(value)) return false
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    GAME_KINDS.includes(value.kind as GameKind) &&
    isGameLockPolicy(value.lockPolicy)
  )
}

/**
 * The number of lock scopes a competition must present for a game's policy,
 * or `null` when the pairing is not supported — in which case every lock
 * fails closed. There is deliberately no fallback arm: a scope kind this
 * table does not name is an unsupported pairing, not a default.
 */
export function expectedLockScopeCount(
  config: CompetitionConfig,
  policy: GameLockPolicy,
): number | null {
  switch (policy.scope) {
    case 'entry':
      // One lock over the whole entry: the tournament Original Predictor.
      return config.kind === 'tournament' && policy.scopeCount === 1 ? 1 : null
    case 'matchweek':
      // One lock per matchweek: domestic Main Predictor and Last Man
      // Standing. The game must declare the same matchweek count the season
      // is configured with; a mismatch is a stale game, and stale fails closed.
      return config.kind === 'league_season' && policy.scopeCount === config.matchweeks.count
        ? config.matchweeks.count
        : null
    case 'match':
      // Per-fixture locks, for games that close fixture by fixture. Only a
      // league season supports them, and the game must say how many.
      return config.kind === 'league_season' ? policy.scopeCount : null
    case 'round':
      // No current game locks by knockout round through this engine.
      return null
  }
}

/** Original Predictor: locks once, at the tournament's opening kickoff. */
export function originalPredictorLockPolicy(): GameLockPolicy {
  return { scope: 'entry', scopeCount: 1, bufferMinutes: 0 }
}

/** Main Predictor: each matchweek locks exactly at its earliest kickoff. */
export function mainPredictorLockPolicy(matchweekCount: number): GameLockPolicy {
  return { scope: 'matchweek', scopeCount: matchweekCount, bufferMinutes: 0 }
}

/** Last Man Standing: locks 30 minutes before the round's first kickoff. */
export function lastManStandingLockPolicy(matchweekCount: number): GameLockPolicy {
  return { scope: 'matchweek', scopeCount: matchweekCount, bufferMinutes: 30 }
}
