import { describe, expect, it } from 'vitest'
import { presentFixtureList } from '../../../src/features/season/fixtureListModel'
import { mapSeasonFixtureList } from '../../../src/services/supabase/seasonFixtureListModel'

const ZONE = 'Europe/London'

function raw(overrides: Record<string, unknown> = {}) {
  return {
    competition: {
      id: 'season-1',
      name: 'Scottish Premiership',
      season_key: '2026-27',
      time_zone: ZONE,
    },
    window: { from: '2026-08-01T00:00:00Z', to: '2026-08-22T00:00:00Z' },
    server_now: '2026-08-08T09:00:00Z',
    fixtures: [],
    ...overrides,
  }
}

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    kickoff_at: '2026-08-08T14:00:00Z',
    status: 'scheduled',
    round: { id: 'r5', ordinal: 5, label: 'Matchweek 5' },
    home: { name: 'Dundee', short_code: 'DUN', club_colours: 'Navy / White' },
    away: { name: 'Aberdeen', short_code: 'ABE', club_colours: 'Red / White' },
    result: null,
    live: null,
    ...overrides,
  }
}

function present(fixtures: Record<string, unknown>[]) {
  return presentFixtureList(mapSeasonFixtureList(raw({ fixtures })), ZONE)
}

describe('decoding a season fixture list', () => {
  it('keeps the server order rather than re-sorting it', () => {
    // Kickoff order is the read's answer. Re-deriving it here would be a second
    // opinion about when a match is played.
    const page = mapSeasonFixtureList(
      raw({
        fixtures: [
          fixture({ id: 'late', kickoff_at: '2026-08-08T17:00:00Z' }),
          fixture({ id: 'early', kickoff_at: '2026-08-08T12:00:00Z' }),
        ],
      }),
    )
    expect(page.fixtures.map((entry) => entry.id)).toEqual(['late', 'early'])
  })

  it('resolves club identity from the stored code and colours', () => {
    const page = mapSeasonFixtureList(raw({ fixtures: [fixture()] }))
    expect(page.fixtures[0]?.home.tokens.monogram).toBe('DUN')
  })

  it('drops a fixture with no round, because the label is not optional', () => {
    expect(
      mapSeasonFixtureList(raw({ fixtures: [fixture({ round: null })] })).fixtures,
    ).toHaveLength(0)
  })

  it('refuses a payload it cannot identify rather than rendering an empty season', () => {
    expect(() => mapSeasonFixtureList({ fixtures: [] })).toThrow()
  })

  it('falls back to UTC rather than the device when the season names no zone', () => {
    const page = mapSeasonFixtureList(
      raw({ competition: { id: 's', name: 'X', season_key: '2026-27', time_zone: null } }),
    )
    expect(page.competition.timeZone).toBe('UTC')
  })
})

describe('a rescheduled fixture', () => {
  it('is listed on the day it is played, not under its matchweek', () => {
    // THE DEFECT THIS WHOLE READ EXISTS FOR. A fixture postponed out of
    // matchweek 5 into November keeps `competition_round_id = 5` deliberately,
    // so a by-round list files it under a September heading.
    const view = present([
      fixture({ id: 'ordinary', kickoff_at: '2026-11-07T15:00:00Z' }),
      fixture({
        id: 'postponed',
        kickoff_at: '2026-11-07T17:30:00Z',
        round: { id: 'r2', ordinal: 2, label: 'Matchweek 2' },
      }),
    ])

    expect(view.days).toHaveLength(1)
    expect(view.days[0]?.rows.map((row) => row.id)).toEqual(['ordinary', 'postponed'])
  })

  it('is labelled with its own matchweek, because the day carries two', () => {
    const view = present([
      fixture({ id: 'ordinary' }),
      fixture({
        id: 'postponed',
        kickoff_at: '2026-08-08T17:00:00Z',
        round: { id: 'r2', ordinal: 2, label: 'Matchweek 2' },
      }),
    ])

    expect(view.hasRescheduled).toBe(true)
    expect(view.days[0]?.rows.map((row) => row.roundLabel)).toEqual([
      'Matchweek 5',
      'Matchweek 2',
    ])
  })

  it('leaves an ordinary day unlabelled, because repeating one matchweek is noise', () => {
    const view = present([fixture({ id: 'a' }), fixture({ id: 'b' })])
    expect(view.hasRescheduled).toBe(false)
    expect(view.days[0]?.rows.every((row) => row.roundLabel === null)).toBe(true)
  })
})

describe('what a row shows', () => {
  it('shows the settled result once there is one', () => {
    const view = present([fixture({ status: 'played', result: { home: 2, away: 1 } })])
    expect(view.days[0]?.rows[0]?.score).toBe('2 - 1')
    expect(view.days[0]?.rows[0]?.played).toBe(true)
  })

  it('never promotes a provider score to a result', () => {
    // Contract 139 returns settled and provisional in two fields precisely so a
    // surface cannot merge them. The row carries the provisional separately and
    // the view marks it as such.
    const view = present([
      fixture({ live: { kind: 'in_play', home: 1, away: 0, observed_at: '2026-08-08T14:30:00Z' } }),
    ])
    const row = view.days[0]?.rows[0]
    expect(row?.score).toBeNull()
    expect(row?.provisional).toBe('1 - 0')
    expect(row?.played).toBe(false)
  })

  it('ignores a one-sided provisional score, which is not a scoreline', () => {
    const view = present([
      fixture({ live: { kind: 'in_play', home: 1, away: null, observed_at: '2026-08-08T14:30:00Z' } }),
    ])
    expect(view.days[0]?.rows[0]?.provisional).toBeNull()
  })

  it('prefers the official result over a provider still reporting', () => {
    const view = present([
      fixture({
        status: 'played',
        result: { home: 2, away: 1 },
        live: { kind: 'in_play', home: 1, away: 1, observed_at: '2026-08-08T14:30:00Z' },
      }),
    ])
    const row = view.days[0]?.rows[0]
    expect(row?.score).toBe('2 - 1')
    expect(row?.provisional).toBeNull()
  })

  it('reads played from the server, never from the clock', () => {
    // A fixture whose kickoff has long passed but which the server has not
    // settled is not played — that is every delayed or abandoned match.
    const view = present([fixture({ kickoff_at: '2020-01-01T15:00:00Z', status: 'scheduled' })])
    expect(view.days[0]?.rows[0]?.played).toBe(false)
  })

  it('collects an untimed fixture under its own heading rather than dropping it', () => {
    const view = present([fixture({ id: 'tbc', kickoff_at: null })])
    expect(view.days.at(-1)?.label).toBe('Date to be confirmed')
    expect(view.days.at(-1)?.rows[0]?.kickoff).toBeNull()
  })

  it('says why every score is blank, because a list of dashes looks broken', () => {
    expect(present([fixture()]).resultsNote).toMatch(/No results here yet/)
  })

  it('says nothing once every result is in', () => {
    expect(
      present([fixture({ status: 'played', result: { home: 1, away: 0 } })]).resultsNote,
    ).toBeNull()
  })
})

describe('days are the competition’s, not the viewer’s', () => {
  it('places a late kickoff on the competition’s calendar day', () => {
    // 23:30 UTC on 8 August is still 8 August in London and already 9 August in
    // Auckland. A Saturday fixture is Saturday to everyone who follows the
    // league, so the zone is the competition's.
    const view = present([fixture({ kickoff_at: '2026-08-08T22:30:00Z' })])
    expect(view.days[0]?.key).toBe('2026-08-08')
  })
})
