import { describe, expect, it } from 'vitest'
import { presentMatches } from '../../../src/features/season/matchesModel'
import type { SeasonFixture } from '../../../src/services/supabase/seasonFixtures'

function fixture(overrides: Partial<SeasonFixture> = {}): SeasonFixture {
  return {
    id: 'fixture-1',
    kickoffAt: '2026-08-08T14:00:00+00:00',
    status: 'scheduled',
    homeName: 'Dundee',
    awayName: 'Aberdeen',
    homeScore: null,
    awayScore: null,
    ...overrides,
  }
}

function page(fixtures: SeasonFixture[], matchweek = 2, matchweekCount = 38) {
  return { matchweek, matchweekCount, fixtures }
}

describe('presentMatches', () => {
  it('groups fixtures by day in the competition’s own timezone', () => {
    // A Saturday 15:00 kickoff is a Saturday fixture to everyone who follows
    // the league. 14:00 UTC is 15:00 in Europe/London during August.
    const view = presentMatches(
      page([
        fixture({ id: 'a', kickoffAt: '2026-08-08T14:00:00+00:00' }),
        fixture({ id: 'b', kickoffAt: '2026-08-09T12:30:00+00:00' }),
        fixture({ id: 'c', kickoffAt: '2026-08-09T15:00:00+00:00' }),
      ]),
      'Europe/London',
    )

    expect(view.days.map((day) => day.key)).toEqual(['2026-08-08', '2026-08-09'])
    expect(view.days[0].matches).toHaveLength(1)
    expect(view.days[1].matches).toHaveLength(2)
  })

  it('resolves the time of day in the competition’s zone, not in UTC', () => {
    // Asserted as a difference rather than as a literal: the 12-or-24-hour
    // FORMAT follows the viewer's locale, which is a reading preference, while
    // the ZONE is a fact about the competition. Pinning a literal here would
    // pin the test runner's locale instead of the behaviour.
    const kickoff = (zone: string) =>
      presentMatches(page([fixture({ kickoffAt: '2026-08-08T14:00:00+00:00' })]), zone)
        .days[0].matches[0].kickoff

    // Europe/London is BST in August, so the same instant reads an hour later
    // there than in UTC. That difference is the zone being applied; the day
    // grouping below pins it again, across the date boundary.
    expect(kickoff('Europe/London')).not.toBe(kickoff('UTC'))
  })

  it('does not let the viewer’s zone move a fixture to another day', () => {
    // The same fixture read in Auckland must still be the league's Saturday,
    // not the viewer's Sunday.
    const late = page([fixture({ kickoffAt: '2026-08-08T19:00:00+00:00' })])

    expect(presentMatches(late, 'Europe/London').days[0].key).toBe('2026-08-08')
    expect(presentMatches(late, 'Pacific/Auckland').days[0].key).toBe('2026-08-09')
  })

  it('shows a confirmed result as a scoreline', () => {
    const view = presentMatches(
      page([fixture({ status: 'played', homeScore: 2, awayScore: 1 })]),
      'Europe/London',
    )

    expect(view.days[0].matches[0].score).toBe('2 - 1')
    expect(view.days[0].matches[0].played).toBe(true)
  })

  it('shows a kickoff time and no score for a fixture with no result', () => {
    const view = presentMatches(page([fixture()]), 'Europe/London')

    expect(view.days[0].matches[0].score).toBeNull()
    expect(view.days[0].matches[0].kickoff).toBeTruthy()
  })

  it('never infers a result from a kickoff that has passed', () => {
    // The clock is not an authority on whether a match finished. A fixture is
    // played because the server said so; a delayed or abandoned match would
    // otherwise be shown as having a result it does not have.
    const view = presentMatches(
      page([fixture({ kickoffAt: '2020-01-01T12:00:00+00:00' })]),
      'Europe/London',
    )

    expect(view.days[0].matches[0].played).toBe(false)
    expect(view.days[0].matches[0].score).toBeNull()
  })

  it('explains an entirely blank score column rather than leaving it looking broken', () => {
    const view = presentMatches(page([fixture(), fixture({ id: 'b' })]), 'Europe/London')

    expect(view.resultsNote).toMatch(/No results yet/)
  })

  it('says how far through a part-settled matchweek is', () => {
    const view = presentMatches(
      page([fixture({ status: 'played', homeScore: 1, awayScore: 0 }), fixture({ id: 'b' })]),
      'Europe/London',
    )

    expect(view.resultsNote).toBe('1 of 2 results are in. The rest appear once confirmed.')
  })

  it('says nothing once every result is in', () => {
    const view = presentMatches(
      page([fixture({ status: 'played', homeScore: 1, awayScore: 0 })]),
      'Europe/London',
    )

    expect(view.resultsNote).toBeNull()
  })

  it('collects a fixture with no kickoff under its own heading rather than dropping it', () => {
    const view = presentMatches(
      page([fixture({ id: 'a' }), fixture({ id: 'b', kickoffAt: null })]),
      'Europe/London',
    )

    const undated = view.days.find((day) => day.key === 'undated')
    expect(undated?.matches.map((match) => match.id)).toEqual(['b'])
    // Last, so the dated fixtures are not pushed down by an unscheduled one.
    expect(view.days[view.days.length - 1].key).toBe('undated')
  })

  it('bounds the stepper by the season the server described', () => {
    expect(presentMatches(page([], 1, 38), 'Europe/London').hasPrevious).toBe(false)
    expect(presentMatches(page([], 38, 38), 'Europe/London').hasNext).toBe(false)
    const middle = presentMatches(page([], 20, 38), 'Europe/London')
    expect([middle.hasPrevious, middle.hasNext]).toEqual([true, true])
  })

  it('reports an empty matchweek as empty', () => {
    const view = presentMatches(page([]), 'Europe/London')

    expect(view.empty).toBe(true)
    expect(view.resultsNote).toBeNull()
  })

  it('reads a scoreline out for assistive technology, not a dash', () => {
    const played = presentMatches(
      page([fixture({ status: 'played', homeScore: 2, awayScore: 1 })]),
      'Europe/London',
    )
    expect(played.days[0].matches[0].accessibleSummary).toBe('Dundee 2, Aberdeen 1')

    const upcoming = presentMatches(page([fixture()]), 'Europe/London')
    const summary = upcoming.days[0].matches[0].accessibleSummary
    // The time itself is locale-formatted, so the sentence around it is what
    // this pins: an unplayed fixture reads as a kick-off, never as a score.
    expect(summary).toMatch(/^Dundee against Aberdeen, kick-off /)

    const undated = presentMatches(page([fixture({ kickoffAt: null })]), 'Europe/London')
    expect(undated.days[0].matches[0].accessibleSummary).toBe(
      'Dundee against Aberdeen, kick-off to be confirmed',
    )
  })
})
