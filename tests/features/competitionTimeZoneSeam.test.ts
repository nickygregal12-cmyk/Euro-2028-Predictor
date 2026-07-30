import { describe, expect, it } from 'vitest'
import { resolveTournamentCompetitionContext } from '../../src/features/shared/tournamentCompetitionContext'
import type { Match, TournamentData } from '../../src/services/supabase/tournamentData'

/**
 * The seam between the competition's calendar zone and the viewer's device zone.
 *
 * `tests/domain/competition/timeZoneAuthority.test.ts` records the consequence
 * of not having one: day grouping follows whoever is looking. This file asserts
 * the seam itself — that `competitionTimeZone` is a real insertion point and not
 * a rename, and that omitting it preserves the previous behaviour exactly.
 *
 * Nothing supplies `competitionTimeZone` yet. The value belongs on the season
 * row (Stage C `display_timezone`, `Europe/London` for the Euro backfill), and
 * authoring that column needs migration evidence this environment cannot
 * currently produce. So the seam ships unwired, on purpose: the fallback keeps
 * today's behaviour byte-for-byte, and the day the column exists, one supplied
 * value at each call site ends the divergence with these tests as the proof.
 */

function match(id: string, kickoffAt: string, scored: boolean): Match {
  return {
    id,
    matchRef: id,
    round: 'group',
    groupId: 'group-a',
    matchday: 1,
    homeSource: '',
    awaySource: '',
    homeTeamId: null,
    awayTeamId: null,
    matchDate: kickoffAt.slice(0, 10),
    kickoffAt,
    venue: '',
    homeScore: scored ? 1 : null,
    awayScore: scored ? 0 : null,
  }
}

/** One scored fixture at 11:00Z on 10 June. */
const KICKOFF = '2028-06-10T11:00:00.000Z'

/**
 * Observed at 21:00Z the same UTC day. Chosen to straddle a calendar boundary in
 * one zone and not the other: at `Pacific/Auckland` (UTC+12 in June, no DST) the
 * observation has already rolled over to 11 June while the kickoff is still on
 * the 10th.
 */
const OBSERVED_AT = new Date('2028-06-10T21:00:00.000Z')

const data: TournamentData = {
  tournament: {
    id: 'euro-2028',
    name: 'EURO 2028',
    year: 2028,
    startsOn: '2028-06-09',
    endsOn: '2028-07-09',
    lockAt: '2028-06-09T18:00:00.000Z',
  },
  groups: [{ id: 'group-a', letter: 'A' }],
  teams: [],
  matches: [match('M01', KICKOFF, true)],
}

function resolve(zones: { viewerTimeZone: string; competitionTimeZone?: string }) {
  return resolveTournamentCompetitionContext({
    data,
    submitted: true,
    entryComplete: true,
    nowServer: OBSERVED_AT,
    ...zones,
  })
}

describe('competition timezone seam', () => {
  it('follows the viewer when no competition zone is supplied', () => {
    // The preserved behaviour. Not an endorsement of it — this is what every
    // call site does today, and what the seam must not change until a season
    // row carries a value.
    expect(resolve({ viewerTimeZone: 'UTC' }).todayISO).toBe('2028-06-10')
    expect(resolve({ viewerTimeZone: 'Pacific/Auckland' }).todayISO).toBe('2028-06-11')
  })

  it('lets the competition zone override the viewer', () => {
    // The point of the seam: same viewer, same instant, same data — the
    // competition's own calendar decides the day.
    const resolved = resolve({
      viewerTimeZone: 'Pacific/Auckland',
      competitionTimeZone: 'UTC',
    })

    expect(resolved.todayISO).toBe('2028-06-10')
    expect(resolved.context.completedToday.map((item) => item.id)).toEqual(['M01'])
    expect(resolved.context.dayState).toBe('day_complete')
  })

  it('makes the day independent of the viewer once supplied', () => {
    // The invariant the season column buys: two viewers anywhere in the world
    // agree about which fixtures belong to the competition day.
    const london = resolve({ viewerTimeZone: 'Europe/London', competitionTimeZone: 'UTC' })
    const auckland = resolve({ viewerTimeZone: 'Pacific/Auckland', competitionTimeZone: 'UTC' })

    expect(auckland.todayISO).toBe(london.todayISO)
    expect(auckland.context.dayState).toBe(london.context.dayState)
    expect(auckland.context.completedToday.map((item) => item.id)).toEqual(
      london.context.completedToday.map((item) => item.id),
    )
  })

  it('still diverges by viewer while the competition zone is unset', () => {
    // Guards against a false sense of completion: the seam existing does not by
    // itself fix anything, and this fails the day a call site starts supplying
    // a value — which is the change that should be visible and evidenced.
    const utc = resolve({ viewerTimeZone: 'UTC' })
    const auckland = resolve({ viewerTimeZone: 'Pacific/Auckland' })

    expect(utc.context.dayState).toBe('day_complete')
    expect(auckland.context.dayState).toBe('no_matches_today')
  })

  it('falls back to UTC rather than throwing on an unusable competition zone', () => {
    // A season row is data, and data can be wrong. `safeTimeZone` already
    // guards the viewer zone; this pins that the same guard covers the new
    // input, so a bad column value degrades instead of breaking the page.
    const resolved = resolve({ viewerTimeZone: 'Europe/London', competitionTimeZone: 'Not/AZone' })

    expect(resolved.todayISO).toBe('2028-06-10')
    expect(resolved.context.dayState).toBe('day_complete')
  })
})
