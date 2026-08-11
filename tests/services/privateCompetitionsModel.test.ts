import { describe, expect, it } from 'vitest'
import {
  mapCreatedPrivateCompetition,
  mapCupLaunchResult,
} from '../../src/services/supabase/privateCompetitionsModel'

describe('mapCreatedPrivateCompetition', () => {
  it('decodes a Last Man Standing that opened with rounds to play', () => {
    expect(
      mapCreatedPrivateCompetition({
        competition_id: 'comp-1',
        name: 'Sunday Survivors',
        invite_code: 'ABC123DEF456',
        windows: 3,
        outcome: 'opened',
      }),
    ).toEqual({
      competitionId: 'comp-1',
      name: 'Sunday Survivors',
      inviteCode: 'ABC123DEF456',
      windows: 3,
      outcome: 'opened',
      launched: false,
    })
  })

  it('keeps "created with no round left in the season" as its own honest outcome', () => {
    const created = mapCreatedPrivateCompetition({
      competition_id: 'comp-2',
      name: 'Too Late',
      invite_code: 'ZZZ999',
      windows: 0,
      outcome: 'no_schedulable_round',
    })

    expect(created.outcome).toBe('no_schedulable_round')
    expect(created.windows).toBe(0)
  })

  it('decodes a Championship as created and explicitly not launched', () => {
    const created = mapCreatedPrivateCompetition({
      competition_id: 'comp-3',
      name: 'Office Cup',
      invite_code: 'CUP123',
      outcome: 'created',
      launched: false,
    })

    expect(created).toMatchObject({ outcome: 'created', launched: false, windows: 0 })
  })

  it('throws when the server returned no id or no code, rather than showing a dead end', () => {
    expect(() =>
      mapCreatedPrivateCompetition({ name: 'Nameless', invite_code: 'ABC123' }),
    ).toThrow(/no id or code/)
    expect(() =>
      mapCreatedPrivateCompetition({ competition_id: 'comp-4', name: 'No code' }),
    ).toThrow(/no id or code/)
  })
})

describe('mapCupLaunchResult', () => {
  it('decodes a launch that happened', () => {
    expect(
      mapCupLaunchResult({
        outcome: 'launched',
        entrants: 6,
        meetings: 2,
        leagueRounds: 10,
        windows: 10,
        fixtures: 30,
      }),
    ).toEqual({ outcome: 'launched', entrants: 6, leagueRounds: 10, fixtures: 30 })
  })

  it('decodes idempotent re-launch as already launched', () => {
    expect(mapCupLaunchResult({ outcome: 'already_launched', fixtures: 0 })).toEqual({
      outcome: 'already_launched',
    })
  })

  it('reads contract 166’s already_drawn as the same state, not as unknown', () => {
    // Two names for one fact -- it has run and refuses to run again, and it has
    // not reshuffled anybody. Falling through to `unknown` would have made a
    // second press look like a failure.
    expect(mapCupLaunchResult({ outcome: 'already_drawn', groups: 4 })).toEqual({
      outcome: 'already_launched',
    })
  })

  it('decodes a field too small or a calendar too short as no viable format', () => {
    expect(
      mapCupLaunchResult({
        outcome: 'no_viable_format',
        reason: 'field_below_minimum',
        entrants: 3,
      }),
    ).toEqual({ outcome: 'no_viable_format', entrants: 3, reason: 'field_below_minimum' })
  })

  it('maps the public threshold refusal onto the same not-launchable-yet answer', () => {
    expect(mapCupLaunchResult({ outcome: 'not_open', reason: 'below_threshold', entrants: 4 })).toMatchObject(
      { outcome: 'no_viable_format', entrants: 4 },
    )
  })

  it('decodes a finished competition as refused, with the server reason', () => {
    expect(mapCupLaunchResult({ outcome: 'refused', reason: 'already_completed' })).toEqual({
      outcome: 'refused',
      reason: 'already_completed',
    })
  })

  it('reports an outcome this build does not model as unknown rather than as success', () => {
    expect(mapCupLaunchResult({ outcome: 'split' })).toEqual({
      outcome: 'unknown',
      reason: 'split',
    })
    expect(mapCupLaunchResult(null)).toEqual({ outcome: 'unknown', reason: null })
  })
})
