import { describe, expect, it } from 'vitest'
import { mapSeasonMatchweekFixtures } from '../../src/services/supabase/seasonFixturesModel'

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fixture-1',
    status: 'scheduled',
    home_name: 'Rangers',
    away_name: 'Hibernian',
    kickoff_at: '2026-08-09T15:00:00+00:00',
    prediction: null,
    result_home: null,
    result_away: null,
    ...overrides,
  }
}

function card(fixtures: unknown[] = [fixture()], overrides: Record<string, unknown> = {}) {
  return {
    matchweek: { number: 2, of: 38 },
    fixtures,
    joker: { played: false, matchweek_count: 38, used_first_half: 0, used_second_half: 0 },
    card_status: 'no_submission',
    settled_points: null,
    ...overrides,
  }
}

describe('mapSeasonMatchweekFixtures', () => {
  it('reads the fixtures and where the matchweek sits in the season', () => {
    const page = mapSeasonMatchweekFixtures(card())

    expect(page.matchweek).toBe(2)
    expect(page.matchweekCount).toBe(38)
    expect(page.fixtures[0]).toEqual({
      id: 'fixture-1',
      kickoffAt: '2026-08-09T15:00:00+00:00',
      status: 'scheduled',
      homeName: 'Rangers',
      awayName: 'Hibernian',
      homeScore: null,
      awayScore: null,
    })
  })

  it('keeps a result the server sent', () => {
    const page = mapSeasonMatchweekFixtures(
      card([fixture({ status: 'played', result_home: 2, result_away: 1 })]),
    )

    expect(page.fixtures[0].homeScore).toBe(2)
    expect(page.fixtures[0].awayScore).toBe(1)
  })

  it('keeps a nil-nil draw, which is a result rather than an absent one', () => {
    // The obvious falsy-check bug: `result_home || null` turns 0 into null and
    // a genuine 0-0 renders as "not played yet".
    const page = mapSeasonMatchweekFixtures(
      card([fixture({ status: 'played', result_home: 0, result_away: 0 })]),
    )

    expect(page.fixtures[0].homeScore).toBe(0)
    expect(page.fixtures[0].awayScore).toBe(0)
  })

  it('refuses half a scoreline rather than showing one side of it', () => {
    const page = mapSeasonMatchweekFixtures(
      card([fixture({ status: 'played', result_home: 2, result_away: null })]),
    )

    expect(page.fixtures[0].homeScore).toBeNull()
    expect(page.fixtures[0].awayScore).toBeNull()
  })

  it('drops the caller’s prediction, which belongs to the game and not to the fixture list', () => {
    // §7.3 separates Matches ("fixtures/results") from Play ("actions for all
    // games joined"). A fixture list carrying predictions would be a second
    // entry surface with none of the lock rules that govern the first.
    const page = mapSeasonMatchweekFixtures(
      card([fixture({ prediction: { home: 3, away: 0, version: 4 } })]),
    )

    expect(JSON.stringify(page)).not.toContain('version')
    expect(Object.keys(page.fixtures[0])).not.toContain('prediction')
  })

  it('keeps a fixture with no kickoff, rather than dropping it', () => {
    // A scheduled fixture the league has not timed yet is still a fixture.
    const page = mapSeasonMatchweekFixtures(card([fixture({ kickoff_at: null })]))

    expect(page.fixtures).toHaveLength(1)
    expect(page.fixtures[0].kickoffAt).toBeNull()
  })

  it('refuses a fixture missing a club, because half a fixture is not one', () => {
    expect(() => mapSeasonMatchweekFixtures(card([fixture({ away_name: null })]))).toThrow(
      /malformed fixture/,
    )
  })

  it('refuses a payload with no matchweek position', () => {
    expect(() => mapSeasonMatchweekFixtures(card([], { matchweek: {} }))).toThrow(
      /expected shape/,
    )
  })

  it('accepts a matchweek with no fixtures', () => {
    // Contract 113 derives a window only for a round that has fixtures, so a
    // matchweek with none is a real state rather than a broken payload.
    expect(mapSeasonMatchweekFixtures(card([])).fixtures).toEqual([])
  })
})
