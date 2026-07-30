import { describe, expect, it } from 'vitest'
import {
  resolveLockState,
  type FixtureDataSnapshot,
  type LockScope,
  type LockScopeKind,
} from '../../../src/domain/competition/lockState'

const NOW = new Date('2028-08-12T10:45:00Z')

function snapshot(fixtures: FixtureDataSnapshot['fixtures'], overrides: Partial<FixtureDataSnapshot> = {}): FixtureDataSnapshot {
  return {
    observedAt: '2028-08-12T10:00:00Z',
    validUntil: '2028-08-12T14:00:00Z',
    fixtures,
    ...overrides,
  }
}

function scope(overrides: Partial<LockScope> = {}): LockScope {
  return {
    id: 'mw-1',
    type: 'matchweek',
    fixtureData: snapshot([
      { id: 'match-1', kickoffAt: '2028-08-12T12:00:00Z' },
      { id: 'match-2', kickoffAt: '2028-08-12T15:00:00Z' },
    ]),
    bufferMinutes: 30,
    previouslyLocked: false,
    ...overrides,
  }
}

describe('resolveLockState', () => {
  it('moves a round lock earlier when a currently assigned fixture moves earlier', () => {
    const original = resolveLockState(scope(), NOW)
    const movedEarlier = resolveLockState(
      scope({
        fixtureData: snapshot([
          { id: 'match-1', kickoffAt: '2028-08-12T11:00:00Z' },
          { id: 'match-2', kickoffAt: '2028-08-12T15:00:00Z' },
        ]),
      }),
      NOW,
    )

    expect(original).toMatchObject({ status: 'open', lockAt: '2028-08-12T11:30:00.000Z' })
    expect(movedEarlier).toMatchObject({ status: 'locked', lockAt: '2028-08-12T10:30:00.000Z' })
  })

  it('enforces the per-match guard when the parent round still reads open', () => {
    const result = resolveLockState(
      scope({
        fixtureData: snapshot([{ id: 'round-fixture', kickoffAt: '2028-08-12T13:00:00Z' }]),
        matchGuard: { matchId: 'match-1', kickoffAt: '2028-08-12T10:30:00Z' },
      }),
      NOW,
    )

    expect(result).toMatchObject({ status: 'locked', reason: 'match_kickoff_reached' })
  })

  it('keeps a scope locked after its first fixture is postponed to a later date', () => {
    const originallyLocked = resolveLockState(
      scope({
        bufferMinutes: 0,
        fixtureData: snapshot([{ id: 'match-1', kickoffAt: '2028-08-12T10:30:00Z' }]),
      }),
      NOW,
    )
    const afterPostponement = resolveLockState(
      scope({
        bufferMinutes: 0,
        previouslyLocked: originallyLocked.locked,
        fixtureData: snapshot([{ id: 'match-2', kickoffAt: '2028-08-13T15:00:00Z' }]),
      }),
      new Date('2028-08-12T11:00:00Z'),
    )

    expect(originallyLocked.locked).toBe(true)
    expect(afterPostponement).toMatchObject({ status: 'locked', reason: 'already_locked' })
  })

  it('fails closed when fixture data is missing', () => {
    expect(resolveLockState(scope({ fixtureData: null }), NOW)).toMatchObject({
      status: 'locked',
      reason: 'missing_fixture_data',
    })
  })

  it('fails closed when fixture data is malformed', () => {
    expect(
      resolveLockState(
        scope({ fixtureData: snapshot([{ id: 'match-1', kickoffAt: 'not-an-instant' }]) }),
        NOW,
      ),
    ).toMatchObject({ status: 'locked', reason: 'invalid_fixture_data' })
  })

  it('fails closed when fixture data is stale', () => {
    expect(
      resolveLockState(
        scope({
          fixtureData: snapshot([{ id: 'match-1', kickoffAt: '2028-08-12T12:00:00Z' }], {
            validUntil: '2028-08-12T10:30:00Z',
          }),
        }),
        NOW,
      ),
    ).toMatchObject({ status: 'locked', reason: 'stale_fixture_data' })
  })

  it('applies the season buffer and leaves the tournament single scope unbuffered', () => {
    const season = resolveLockState(scope(), new Date('2028-08-12T11:45:00Z'))
    const tournament = resolveLockState(
      scope({ type: 'entry', bufferMinutes: 0 }),
      new Date('2028-08-12T11:45:00Z'),
    )

    expect(season).toMatchObject({ status: 'locked', lockAt: '2028-08-12T11:30:00.000Z' })
    expect(tournament).toMatchObject({ status: 'open', lockAt: '2028-08-12T12:00:00.000Z' })
  })

  it.each<LockScopeKind>(['entry', 'round', 'matchweek', 'match'])('supports the %s scope', (type) => {
    const result = resolveLockState(
      scope({
        type,
        bufferMinutes: 0,
        matchGuard: type === 'match' ? { matchId: 'match-1', kickoffAt: '2028-08-12T12:00:00Z' } : undefined,
      }),
      NOW,
    )

    expect(result.status).toBe('open')
  })
})
