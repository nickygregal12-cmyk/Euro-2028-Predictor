import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  autoAssignLmsTeam,
  resolveLmsEligibility,
  type LmsEligibilityInput,
} from '../../../src/domain/season/lmsEligibility'

/**
 * ADR 0013 season LMS eligibility: teams actually playing, once per round;
 * the used list excludes; the mandatory reset means availability never
 * eliminates; auto-assignment is the alphabetically first eligible team.
 */

const TEAMS = [
  { teamId: 'ARS', name: 'Arsenal' },
  { teamId: 'AVL', name: 'Aston Villa' },
  { teamId: 'CHE', name: 'Chelsea' },
  { teamId: 'EVE', name: 'Everton' },
  { teamId: 'LIV', name: 'Liverpool' },
  { teamId: 'MCI', name: 'Manchester City' },
]

function input(overrides: Partial<LmsEligibilityInput> = {}): LmsEligibilityInput {
  return {
    fixtures: [
      { fixtureId: 'f1', homeTeamId: 'ARS', awayTeamId: 'CHE' },
      { fixtureId: 'f2', homeTeamId: 'LIV', awayTeamId: 'MCI' },
    ],
    teams: TEAMS,
    usedTeamIds: [],
    ...overrides,
  }
}

describe('eligibility is restricted to teams actually playing', () => {
  it('offers every playing team alphabetically when nothing is used', () => {
    expect(resolveLmsEligibility(input())).toEqual({
      ok: true,
      eligibleTeamIds: ['ARS', 'CHE', 'LIV', 'MCI'],
      usedListReset: false,
      doubleFixtureTeamIds: [],
    })
  })

  it('excludes used teams without resetting while options remain', () => {
    const result = resolveLmsEligibility(input({ usedTeamIds: ['ARS', 'LIV'] }))
    expect(result).toEqual({
      ok: true,
      eligibleTeamIds: ['CHE', 'MCI'],
      usedListReset: false,
      doubleFixtureTeamIds: [],
    })
  })

  it('never offers a team not playing this round', () => {
    const result = resolveLmsEligibility(input())
    expect(result.ok && result.eligibleTeamIds).not.toContain('EVE')
    expect(result.ok && result.eligibleTeamIds).not.toContain('AVL')
  })

  it('rules out a team appearing twice in one designated round', () => {
    const result = resolveLmsEligibility(
      input({
        fixtures: [
          { fixtureId: 'f1', homeTeamId: 'ARS', awayTeamId: 'CHE' },
          { fixtureId: 'f2', homeTeamId: 'EVE', awayTeamId: 'ARS' },
        ],
      }),
    )
    expect(result).toEqual({
      ok: true,
      eligibleTeamIds: ['CHE', 'EVE'],
      usedListReset: false,
      doubleFixtureTeamIds: ['ARS'],
    })
  })
})

describe('the mandatory used-team reset', () => {
  it('resets when the used list covers every playing team — availability never eliminates', () => {
    const result = resolveLmsEligibility(
      input({ usedTeamIds: ['ARS', 'CHE', 'LIV', 'MCI'] }),
    )
    expect(result).toEqual({
      ok: true,
      eligibleTeamIds: ['ARS', 'CHE', 'LIV', 'MCI'],
      usedListReset: true,
      doubleFixtureTeamIds: [],
    })
  })

  it('does not reset while even one playing team remains unused', () => {
    const result = resolveLmsEligibility(input({ usedTeamIds: ['ARS', 'CHE', 'LIV'] }))
    expect(result).toEqual({
      ok: true,
      eligibleTeamIds: ['MCI'],
      usedListReset: false,
      doubleFixtureTeamIds: [],
    })
  })
})

describe('auto-assignment for a missed selection', () => {
  it('assigns the alphabetically first eligible unused team', () => {
    expect(autoAssignLmsTeam(input({ usedTeamIds: ['ARS'] }))).toBe('CHE')
  })

  it('applies the mandatory reset before assigning', () => {
    expect(autoAssignLmsTeam(input({ usedTeamIds: ['ARS', 'CHE', 'LIV', 'MCI'] }))).toBe('ARS')
  })

  it('returns null rather than inventing a pick when the round offers nothing', () => {
    expect(autoAssignLmsTeam(input({ fixtures: [] }))).toBeNull()
    expect(autoAssignLmsTeam(input({ teams: [] }))).toBeNull()
  })
})

describe('contradictory data refuses', () => {
  it('refuses duplicate fixtures, unknown teams and a team against itself', () => {
    expect(
      resolveLmsEligibility(
        input({
          fixtures: [
            { fixtureId: 'f1', homeTeamId: 'ARS', awayTeamId: 'CHE' },
            { fixtureId: 'f1', homeTeamId: 'LIV', awayTeamId: 'MCI' },
          ],
        }),
      ),
    ).toEqual({ ok: false, reason: 'duplicate_fixture' })
    expect(
      resolveLmsEligibility(
        input({ fixtures: [{ fixtureId: 'f1', homeTeamId: 'ARS', awayTeamId: 'XXX' }] }),
      ),
    ).toEqual({ ok: false, reason: 'unknown_team' })
    expect(resolveLmsEligibility(input({ usedTeamIds: ['XXX'] }))).toEqual({
      ok: false,
      reason: 'unknown_team',
    })
    expect(
      resolveLmsEligibility(
        input({ fixtures: [{ fixtureId: 'f1', homeTeamId: 'ARS', awayTeamId: 'ARS' }] }),
      ),
    ).toEqual({ ok: false, reason: 'team_against_itself' })
  })

  it('refuses blank and duplicated identifiers', () => {
    expect(
      resolveLmsEligibility(input({ teams: [...TEAMS, { teamId: 'ARS', name: 'Arsenal FC' }] })),
    ).toEqual({ ok: false, reason: 'invalid_input' })
    expect(
      resolveLmsEligibility(input({ teams: [{ teamId: '  ', name: 'Ghost' }] })),
    ).toEqual({ ok: false, reason: 'invalid_input' })
  })
})

describe('authority separation', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/domain/season/lmsEligibility.ts'),
    'utf8',
  )

  it('imports nothing from the tournament implementation or its LMS helper', () => {
    expect(source).not.toMatch(/from '.*tournament/)
    expect(source).not.toMatch(/from '.*competitions\/lmsSelection/)
  })

  it('reads no ambient clock or zone', () => {
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })
})
