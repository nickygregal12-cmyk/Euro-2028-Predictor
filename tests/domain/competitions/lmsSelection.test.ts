import { describe, expect, it } from 'vitest'
import {
  deriveLmsSelectionOutcome,
  type LmsFixtureRead,
} from '../../../src/domain/competitions/lmsSelection'

function fixture(overrides: Partial<LmsFixtureRead> = {}): LmsFixtureRead {
  return {
    matchId: 'match-1',
    round: 'group',
    kickoffAt: '2028-06-09T14:00:00Z',
    homeTeamId: 'team-home',
    awayTeamId: 'team-away',
    resultState: 'confirmed',
    homeScore: 2,
    awayScore: 0,
    winnerTeamId: null,
    ...overrides,
  }
}

describe('deriveLmsSelectionOutcome', () => {
  it('survives a group win and falls to a group defeat', () => {
    expect(deriveLmsSelectionOutcome([fixture()], 'team-home')).toBe('survived')
    expect(deriveLmsSelectionOutcome([fixture()], 'team-away')).toBe('out')
  })

  it('a group draw is out — tournament format, not EPL', () => {
    expect(
      deriveLmsSelectionOutcome([fixture({ homeScore: 1, awayScore: 1 })], 'team-home'),
    ).toBe('out')
  })

  it('knockout picks survive by advancing, whatever the method', () => {
    const tie = fixture({
      round: 'r16',
      homeScore: 1,
      awayScore: 1,
      winnerTeamId: 'team-away',
    })
    expect(deriveLmsSelectionOutcome([tie], 'team-away')).toBe('survived')
    expect(deriveLmsSelectionOutcome([tie], 'team-home')).toBe('out')
  })

  it('stays pending before an official result', () => {
    expect(
      deriveLmsSelectionOutcome([fixture({ resultState: 'scheduled' })], 'team-home'),
    ).toBe('pending')
    expect(
      deriveLmsSelectionOutcome(
        [fixture({ round: 'r16', winnerTeamId: null })],
        'team-home',
      ),
    ).toBe('pending')
  })

  it('never invents an outcome for a team outside the round', () => {
    expect(deriveLmsSelectionOutcome([fixture()], 'team-elsewhere')).toBe('pending')
  })
})
