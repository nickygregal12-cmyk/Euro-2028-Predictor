export type LockScopeKind = 'entry' | 'round' | 'matchweek' | 'match'

export type FixtureKickoff = {
  id: string
  kickoffAt: string | null
}

export type FixtureDataSnapshot = {
  observedAt: string
  validUntil: string
  fixtures: readonly FixtureKickoff[]
}

export type MatchKickoffGuard = {
  matchId: string
  kickoffAt: string | null
}

export type LockScope = {
  id: string
  type: LockScopeKind
  fixtureData: FixtureDataSnapshot | null
  bufferMinutes: number
  previouslyLocked: boolean
  matchGuard?: MatchKickoffGuard
}

export type LockStateReason =
  | 'before_scope_lock'
  | 'scope_lock_reached'
  | 'match_kickoff_reached'
  | 'already_locked'
  | 'missing_fixture_data'
  | 'stale_fixture_data'
  | 'invalid_fixture_data'
  | 'invalid_time'

export type ResolvedLockState = {
  status: 'open' | 'locked'
  locked: boolean
  lockAt: string | null
  reason: LockStateReason
}

function locked(reason: LockStateReason, lockAt: string | null = null): ResolvedLockState {
  return { status: 'locked', locked: true, lockAt, reason }
}

function parseInstant(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toIso(value: number): string {
  return new Date(value).toISOString()
}

function deriveScopeLockAt(scope: LockScope, nowMs: number): ResolvedLockState | number {
  if (!Number.isInteger(scope.bufferMinutes) || scope.bufferMinutes < 0) {
    return locked('invalid_fixture_data')
  }

  const snapshot = scope.fixtureData
  if (snapshot === null || snapshot.fixtures.length === 0) {
    return locked('missing_fixture_data')
  }

  const observedAt = parseInstant(snapshot.observedAt)
  const validUntil = parseInstant(snapshot.validUntil)
  if (observedAt === null || validUntil === null || observedAt > nowMs || validUntil < observedAt) {
    return locked('invalid_fixture_data')
  }
  if (nowMs > validUntil) {
    return locked('stale_fixture_data')
  }

  const ids = new Set<string>()
  let earliestKickoff = Number.POSITIVE_INFINITY
  for (const fixture of snapshot.fixtures) {
    if (fixture.id.trim().length === 0 || ids.has(fixture.id)) return locked('invalid_fixture_data')
    ids.add(fixture.id)
    const kickoff = parseInstant(fixture.kickoffAt)
    if (kickoff === null) return locked('invalid_fixture_data')
    earliestKickoff = Math.min(earliestKickoff, kickoff)
  }

  return earliestKickoff - scope.bufferMinutes * 60_000
}

/**
 * Resolves a lock from current fixture data only. The caller supplies prior
 * locked state so a pure function can enforce the monotonic no-reopen rule.
 */
export function resolveLockState(scope: LockScope, now: Date): ResolvedLockState {
  const nowMs = now.getTime()
  if (!Number.isFinite(nowMs)) return locked('invalid_time')
  if (scope.previouslyLocked) return locked('already_locked')

  const derived = deriveScopeLockAt(scope, nowMs)
  if (typeof derived !== 'number') return derived
  const lockAt = toIso(derived)

  if (scope.type === 'match' && scope.matchGuard === undefined) {
    return locked('missing_fixture_data', lockAt)
  }

  if (scope.matchGuard !== undefined) {
    if (scope.matchGuard.matchId.trim().length === 0) return locked('invalid_fixture_data', lockAt)
    const matchKickoff = parseInstant(scope.matchGuard.kickoffAt)
    if (matchKickoff === null) return locked('invalid_fixture_data', lockAt)
    if (nowMs >= matchKickoff) return locked('match_kickoff_reached', lockAt)
  }

  if (nowMs >= derived) return locked('scope_lock_reached', lockAt)
  return { status: 'open', locked: false, lockAt, reason: 'before_scope_lock' }
}
