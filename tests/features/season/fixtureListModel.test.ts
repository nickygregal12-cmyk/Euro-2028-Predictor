import { describe, expect, it } from 'vitest'
import {
  presentFixtureList,
  previewFixtures,
} from '../../../src/features/season/fixtureListModel'
import { mapSeasonFixtureList } from '../../../src/services/supabase/seasonFixtureListModel'
import { postponedScheduleNote } from '../../../src/shared/fixtures/scheduleNote'

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

describe('the Overview preview', () => {
  function preview(fixtures: Record<string, unknown>[], limit = 3) {
    return previewFixtures(present(fixtures), limit)
  }

  const played = (id: string, at: string) =>
    fixture({ id, kickoff_at: at, status: 'played', result: { home: 1, away: 0 } })
  const upcoming = (id: string, at: string) => fixture({ id, kickoff_at: at })

  it('starts at the next fixture the server has not marked played', () => {
    const view = preview([
      played('done-1', '2026-08-01T14:00:00Z'),
      played('done-2', '2026-08-02T14:00:00Z'),
      upcoming('next', '2026-08-08T14:00:00Z'),
      upcoming('after', '2026-08-09T14:00:00Z'),
    ])

    expect(view.kind).toBe('upcoming')
    expect(view.rows.map((row) => row.id)).toEqual(['next', 'after'])
  })

  it('uses the server status rather than the clock, so a delayed match is not finished', () => {
    // Its kickoff is the earliest in the window and long past the read's
    // `server_now`. A clock comparison would call it played and skip it; the
    // server has not, so it is still what is next.
    const view = preview([
      upcoming('delayed', '2026-08-01T14:00:00Z'),
      upcoming('later', '2026-08-09T14:00:00Z'),
    ])

    expect(view.rows.map((row) => row.id)).toEqual(['delayed', 'later'])
  })

  it('shows the most recent results when the window holds nothing to come', () => {
    // The last few, not the first few: a finished window's useful end is the
    // recent one.
    const view = preview(
      [
        played('a', '2026-08-01T14:00:00Z'),
        played('b', '2026-08-02T14:00:00Z'),
        played('c', '2026-08-03T14:00:00Z'),
      ],
      2,
    )

    expect(view.kind).toBe('results')
    expect(view.rows.map((row) => row.id)).toEqual(['b', 'c'])
  })

  it('says how many of the window it is not showing', () => {
    const view = preview([
      upcoming('one', '2026-08-08T12:00:00Z'),
      upcoming('two', '2026-08-08T14:00:00Z'),
      upcoming('three', '2026-08-08T17:00:00Z'),
      upcoming('four', '2026-08-09T14:00:00Z'),
    ], 2)

    expect(view.rows).toHaveLength(2)
    expect(view.hidden).toBe(2)
  })

  it('carries the day on the row, because a preview has no day headings', () => {
    // Compared against the list's own heading rather than a literal: the day
    // is formatted in the VIEWER's locale by design, so a literal would assert
    // the test runner's locale rather than the model's behaviour.
    const list = present([upcoming('one', '2026-08-08T14:00:00Z')])
    expect(previewFixtures(list, 3).rows[0]?.dayLabel).toBe(list.days[0]?.label)
  })

  it('is empty for an empty window rather than pretending to a fixture', () => {
    const view = preview([])
    expect(view.empty).toBe(true)
    expect(view.rows).toEqual([])
    expect(view.hidden).toBe(0)
  })

  it('never promotes a provisional score to a result', () => {
    // The same rule as the full list, and it holds here because it is the same
    // model — not because it was written twice.
    const view = preview([
      fixture({
        id: 'live-now',
        kickoff_at: '2026-08-08T14:00:00Z',
        status: 'live',
        live: { kind: 'in_play', home: 2, away: 1, observed_at: '2026-08-08T15:00:00Z' },
      }),
    ])

    expect(view.rows[0]?.score).toBeNull()
    expect(view.rows[0]?.provisional).toBe('2 - 1')
    expect(view.rows[0]?.played).toBe(false)
  })
})

/**
 * Contract 209. The two facts a surface used to have to infer from a date.
 *
 * They are decoded here rather than derived anywhere downstream, so every
 * surface reading a fixture gets the SAME answer to "is this time still real?"
 * — which is the property `FINDING G §E` asks for and the property a per-screen
 * inference cannot have.
 */
describe('the schedule block', () => {
  it('carries what the server said about the slot', () => {
    const list = mapSeasonFixtureList(
      raw({
        fixtures: [
          fixture({
            status: 'postponed',
            schedule: {
              kickoff_confirmed: false,
              rescheduled: true,
              original_kickoff_at: '2026-08-08T14:00:00Z',
            },
          }),
        ],
      }),
    )

    expect(list.fixtures[0]?.schedule).toEqual({
      kickoffConfirmed: false,
      rescheduled: true,
      originalKickoffAt: '2026-08-08T14:00:00Z',
    })
  })

  it('fails closed to an ordinary fixture when the server is older than the block', () => {
    // A deploy that runs the browser ahead of the database must not draw every
    // fixture in the calendar as abnormal. An absent block is "nothing unusual
    // here", which is true of every fixture such a server holds.
    const list = mapSeasonFixtureList(raw({ fixtures: [fixture()] }))

    expect(list.fixtures[0]?.schedule).toEqual({
      kickoffConfirmed: true,
      rescheduled: false,
      originalKickoffAt: null,
    })
  })

  it('still says a postponed fixture is unconfirmed when only the block is missing', () => {
    // The status is the fallback, not `true`. Reading "confirmed" off a fixture
    // the platform itself calls postponed would be the browser contradicting
    // the field beside it.
    const list = mapSeasonFixtureList(raw({ fixtures: [fixture({ status: 'postponed' })] }))

    expect(list.fixtures[0]?.schedule.kickoffConfirmed).toBe(false)
  })
})

/**
 * Contract 209, on the surface production is actually serving.
 *
 * The vNext lane draws the same fixture from the same fields, and its tests are
 * in `tests/vnext/matchesIntegration.test.ts`. These are here because the two
 * generations have separate presenters and a rule proved in one is not proved in
 * the other — which is exactly how a player ends up being told two things about
 * one match.
 */
describe('a fixture that is not going ahead as printed', () => {
  it('refuses to print a kick-off that is only a memory', () => {
    const view = present([
      fixture({
        status: 'postponed',
        schedule: { kickoff_confirmed: false, rescheduled: false, original_kickoff_at: null },
      }),
    ])
    const row = view.days[0]?.rows[0]

    // The defect this contract exists to remove: "Rangers v Opponent, Sat
    // 15:00" against a kickoff that will not happen.
    expect(row?.kickoff).toBeNull()
    expect(row?.abnormal).toBe('Postponed')
    expect(row?.scheduleNote).toBe('New date to be confirmed')
    // The instant itself is untouched: it is still the ordering fact every day
    // heading is built from.
    expect(row?.kickoffAt).toBe('2026-08-08T14:00:00Z')
  })

  it('prints the replacement date once there is one, and says it is a replacement', () => {
    const view = present([
      fixture({
        status: 'postponed',
        kickoff_at: '2026-09-15T18:45:00Z',
        schedule: {
          kickoff_confirmed: false,
          rescheduled: true,
          original_kickoff_at: '2026-08-08T14:00:00Z',
        },
      }),
    ])
    const row = view.days[0]?.rows[0]

    expect(row?.kickoff).not.toBeNull()
    expect(row?.abnormal).toBe('Postponed')
    expect(row?.scheduleNote?.startsWith('Now due ')).toBe(true)
  })

  it('marks a fixture that was moved into this day and is going ahead', () => {
    const view = present([
      fixture({
        schedule: {
          kickoff_confirmed: true,
          rescheduled: true,
          original_kickoff_at: '2026-07-25T14:00:00Z',
        },
      }),
    ])
    const row = view.days[0]?.rows[0]

    expect(row?.abnormal).toBeNull()
    expect(row?.scheduleNote).toBe('Rescheduled')
    expect(row?.kickoff).toBe('15:00')
  })

  it('says nothing at all about an ordinary fixture', () => {
    const row = present([fixture()]).days[0]?.rows[0]

    expect(row?.abnormal).toBeNull()
    expect(row?.scheduleNote).toBeNull()
  })

  it('names each abnormal state differently in the accessible sentence', () => {
    const summaries = (['postponed', 'abandoned', 'void'] as const).map(
      (status) => present([fixture({ status })]).days[0]?.rows[0]?.accessibleSummary,
    )

    // A postponed match must not read the same as a cancelled or an abandoned
    // one, and none of them may read as a fixture with a kick-off.
    expect(new Set(summaries).size).toBe(3)
    for (const summary of summaries) expect(summary).not.toContain('kick-off')
  })

  it('keeps the same words the vNext lane uses for the same fixture', () => {
    // Both presenters call `postponedScheduleNote`. This asserts the OUTPUT
    // rather than the call, because a shared helper that one of them stops
    // using still compiles.
    const legacy = present([
      fixture({
        status: 'postponed',
        schedule: { kickoff_confirmed: false, rescheduled: false, original_kickoff_at: null },
      }),
    ]).days[0]?.rows[0]?.scheduleNote

    expect(legacy).toBe(postponedScheduleNote(null, false))
  })
})
