import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveFixtureReassignment,
  type FixtureReassignmentInput,
} from '../../../src/domain/season/fixtureReassignment'

/**
 * ADR 0020 fixture exceptions: reassignment, not unlocking. The decision
 * this module produces moves a fixture to the round containing its new
 * kickoff; nothing it produces can reopen a locked round or touch a
 * completed fixture.
 */

const ROUNDS = [
  { id: 'mw-07', windowStartsAt: '2026-10-02T00:00:00Z', windowEndsAt: '2026-10-05T23:59:59Z' },
  { id: 'mw-08', windowStartsAt: '2026-10-16T00:00:00Z', windowEndsAt: '2026-10-19T23:59:59Z' },
  { id: 'mw-25', windowStartsAt: '2027-02-05T00:00:00Z', windowEndsAt: '2027-02-08T23:59:59Z' },
]

function input(overrides: Partial<FixtureReassignmentInput> = {}): FixtureReassignmentInput {
  return {
    fixture: {
      id: 'mw7-ARS-CHE',
      roundId: 'mw-07',
      kickoffAt: '2026-10-03T14:00:00Z',
      completed: false,
    },
    newKickoffAt: '2027-02-06T15:00:00Z',
    rounds: ROUNDS,
    reason: 'postponed',
    evidenceRef: 'provider:fixture-revision:8841',
    decidedAt: '2026-10-01T09:00:00Z',
    ...overrides,
  }
}

describe('reassignment to the round containing the new kickoff', () => {
  it('moves a postponed incomplete fixture and audits every field', () => {
    const decision = resolveFixtureReassignment(input())
    expect(decision).toEqual({
      kind: 'reassign',
      toRoundId: 'mw-25',
      audit: {
        fixtureId: 'mw7-ARS-CHE',
        fromRoundId: 'mw-07',
        toRoundId: 'mw-25',
        oldKickoffAt: '2026-10-03T14:00:00Z',
        newKickoffAt: '2027-02-06T15:00:00Z',
        reason: 'postponed',
        evidenceRef: 'provider:fixture-revision:8841',
        decidedAt: '2026-10-01T09:00:00Z',
      },
    })
  })

  it('produces no unlock instruction of any kind', () => {
    // The decision's whole shape is the guarantee: a destination and an
    // audit record. There is no field that could name the original round as
    // reopened, so persistence cannot be instructed to reopen it.
    const decision = resolveFixtureReassignment(input())
    expect(Object.keys(decision).sort()).toEqual(['audit', 'kind', 'toRoundId'])
  })

  it('treats a new kickoff inside the same round as a kickoff revision, not a move', () => {
    const decision = resolveFixtureReassignment(
      input({ newKickoffAt: '2026-10-05T19:00:00Z', reason: 'rescheduled' }),
    )
    expect(decision.kind).toBe('kickoff_revision')
    if (decision.kind === 'kickoff_revision') {
      expect(decision.audit.toRoundId).toBe('mw-07')
      expect(decision.audit.newKickoffAt).toBe('2026-10-05T19:00:00Z')
    }
  })
})

describe('refusals fail closed', () => {
  it('never moves a completed fixture', () => {
    const decision = resolveFixtureReassignment(
      input({
        fixture: { id: 'mw7-ARS-CHE', roundId: 'mw-07', kickoffAt: '2026-10-03T14:00:00Z', completed: true },
      }),
    )
    expect(decision).toEqual({ kind: 'refused', reason: 'completed_fixture_never_moves' })
  })

  it('refuses a kickoff no round contains rather than guessing', () => {
    expect(resolveFixtureReassignment(input({ newKickoffAt: '2026-11-01T15:00:00Z' }))).toEqual({
      kind: 'refused',
      reason: 'no_destination_round',
    })
  })

  it('refuses overlapping candidate rounds rather than picking one', () => {
    const overlapping = [
      ...ROUNDS,
      { id: 'mw-25b', windowStartsAt: '2027-02-06T00:00:00Z', windowEndsAt: '2027-02-09T23:59:59Z' },
    ]
    expect(resolveFixtureReassignment(input({ rounds: overlapping }))).toEqual({
      kind: 'refused',
      reason: 'ambiguous_destination_round',
    })
  })

  it('refuses malformed input outright', () => {
    expect(resolveFixtureReassignment(input({ newKickoffAt: 'not-a-kickoff' })).kind).toBe('refused')
    expect(resolveFixtureReassignment(input({ evidenceRef: '  ' })).kind).toBe('refused')
    expect(resolveFixtureReassignment(input({ decidedAt: '' })).kind).toBe('refused')
    expect(
      resolveFixtureReassignment(
        input({ rounds: [{ id: 'mw-07', windowStartsAt: '2026-10-05T00:00:00Z', windowEndsAt: '2026-10-02T00:00:00Z' }] }),
      ).kind,
    ).toBe('refused')
    expect(
      resolveFixtureReassignment(input({ rounds: [...ROUNDS, { ...ROUNDS[0] }] })).kind,
    ).toBe('refused')
  })
})

describe('authority separation', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/domain/season/fixtureReassignment.ts'),
    'utf8',
  )

  it('imports nothing from the tournament implementation', () => {
    expect(source).not.toMatch(/from '.*tournament/)
  })

  it('reads no ambient clock or zone — decidedAt is an input', () => {
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })
})
