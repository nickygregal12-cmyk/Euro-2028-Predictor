import { describe, expect, it } from 'vitest'

import {
  roundRobin,
  SEASONS,
  seedSql,
  singleRoundRobin,
} from '../../scripts/seed-dev/seed-league-seasons'

/**
 * The seed generator's one hard job is the schedule, and a wrong one fails in
 * two very different ways.
 *
 * The loud way is `assert_season_fixture_shape`, which refuses a club playing
 * twice in the same matchweek — a bad generator would be rejected outright.
 *
 * The quiet way is worse and is what these assertions are really for: a
 * schedule that inserts perfectly well while some pair never meets, or meets at
 * the wrong grounds. Nothing in the database objects. The season simply plays
 * out slightly wrong, and it would be found — if at all — by somebody noticing
 * a table that does not add up in March.
 */

describe.each([
  { clubs: 4, meetings: 2 },
  { clubs: 20, meetings: 2 },
  // Twelve clubs meeting three times is the Scottish Premiership's 33
  // matchweeks before its split, and an odd number of meetings behaves
  // differently enough to be worth its own case.
  { clubs: 12, meetings: 3 },
  { clubs: 6, meetings: 3 },
])('$clubs clubs meeting $meetings times', ({ clubs, meetings }) => {
  const schedule = roundRobin(clubs, meetings)

  it('plays one full round-robin per meeting', () => {
    expect(schedule).toHaveLength(meetings * (clubs - 1))
  })

  it('gives every club exactly one fixture in every matchweek', () => {
    for (const [index, round] of schedule.entries()) {
      expect(round, `matchweek ${index + 1} is not a full round`).toHaveLength(clubs / 2)
      expect(
        new Set(round.flat()).size,
        `a club plays twice in matchweek ${index + 1}`,
      ).toBe(clubs)
    }
  })

  it('makes every pair meet exactly the configured number of times', () => {
    const met = new Map<string, number>()
    for (const round of schedule) {
      for (const [home, away] of round) {
        const key = [home, away].sort((a, b) => a - b).join('-')
        met.set(key, (met.get(key) ?? 0) + 1)
      }
    }
    expect(met.size, 'a pair never meets').toBe((clubs * (clubs - 1)) / 2)
    for (const [pair, count] of met) {
      expect(count, `pair ${pair} meets ${count} times`).toBe(meetings)
    }
  })

  it('splits each pair between the two grounds as evenly as the meetings allow', () => {
    // The silent one. With an EVEN number of meetings every pair must be
    // exactly balanced. With an odd number it cannot be — somebody hosts the
    // extra game — but it must still be as close as arithmetic permits, so
    // ceil/floor and never 3-0.
    const ordered = new Map<string, number>()
    for (const round of schedule) {
      for (const [home, away] of round) {
        ordered.set(`${home}>${away}`, (ordered.get(`${home}>${away}`) ?? 0) + 1)
      }
    }
    const high = Math.ceil(meetings / 2)
    const low = Math.floor(meetings / 2)
    for (const [pair, count] of ordered) {
      expect(
        [high, low],
        `${pair} is hosted ${count} times, which is not a ${high}-${low} split`,
      ).toContain(count)
    }
  })

  it('gives every club the same number of fixtures', () => {
    const played = new Array<number>(clubs).fill(0)
    for (const round of schedule) {
      for (const [home, away] of round) {
        played[home] += 1
        played[away] += 1
      }
    }
    for (const [club, count] of played.entries()) {
      expect(count, `club ${club} plays ${count}`).toBe(meetings * (clubs - 1))
    }
  })

  it('keeps home and away within one fixture of each other for every club', () => {
    // With three meetings a club ends on (n-1) + h home games, so the spread
    // across the league is real and expected — but no club may be stranded
    // with a wildly lopsided season.
    const home = new Array<number>(clubs).fill(0)
    for (const round of schedule) {
      for (const [homeClub] of round) home[homeClub] += 1
    }
    const total = meetings * (clubs - 1)
    for (const [club, count] of home.entries()) {
      const away = total - count
      expect(
        Math.abs(count - away),
        `club ${club} plays ${count} home and ${away} away`,
      ).toBeLessThanOrEqual(meetings % 2 === 0 ? 0 : clubs - 1)
    }
    if (meetings % 2 === 0) {
      for (const count of home) expect(count).toBe(total / 2)
    }
  })
})

describe('a single round-robin does not seat one club at home all season', () => {
  it('alternates the fixed pairing', () => {
    // The circle method pins club 0 and rotates the rest around it. Without the
    // alternation, club 0 plays every first-meeting fixture at home — which
    // passes every "each pair meets once" check and is obviously not a fixture
    // list.
    const rounds = singleRoundRobin(20)
    const homeForZero = rounds.filter((round) => round.some(([home]) => home === 0)).length
    expect(homeForZero).toBeGreaterThan(1)
    expect(homeForZero).toBeLessThan(rounds.length)
  })
})

describe('the configured seasons', () => {
  it('declare one kickoff slot per fixture in a matchweek', () => {
    for (const season of SEASONS) {
      expect(season.clubs.length % 2, `${season.seasonRow} has an odd club count`).toBe(0)
      expect(season.slots, `${season.seasonRow} slot count`).toHaveLength(
        season.clubs.length / 2,
      )
    }
  })

  it('name every club exactly once', () => {
    for (const season of SEASONS) {
      expect(new Set(season.clubs).size, `${season.seasonRow} repeats a club`).toBe(
        season.clubs.length,
      )
    }
  })

  it('starts each season on a Saturday', () => {
    for (const season of SEASONS) {
      const day = new Date(`${season.firstSaturday}T12:00:00Z`).getUTCDay()
      expect(day, `${season.seasonRow} does not start on a Saturday`).toBe(6)
    }
  })

  it('reaches a 38 matchweek calendar by each competition’s own route', () => {
    // The two seasons arrive at the same length differently, and this is the
    // assertion that would have caught the Scottish season being seeded as a
    // 22 matchweek double round-robin: twenty clubs meeting twice is 38 with
    // nothing after it, twelve clubs meeting three times is 33 and then five
    // post-split rounds whose fixtures are not yet decidable.
    const totals = Object.fromEntries(
      SEASONS.map((season) => [
        season.seasonRow,
        {
          played: season.meetings * (season.clubs.length - 1),
          postSplit: season.postSplitRounds,
        },
      ]),
    )
    expect(totals['Premier League 2026/27']).toEqual({ played: 38, postSplit: 0 })
    expect(totals['Scottish Premiership 2026/27']).toEqual({ played: 33, postSplit: 5 })
    for (const season of SEASONS) {
      const entry = totals[season.seasonRow]
      expect(
        entry.played + entry.postSplit,
        `${season.seasonRow} is not a 38 matchweek season`,
      ).toBe(38)
    }
  })

  it('never schedules a fixture into a post-split matchweek', () => {
    for (const season of SEASONS) {
      const schedule = roundRobin(season.clubs.length, season.meetings)
      expect(
        schedule.length,
        `${season.seasonRow} generates fixtures for a round it cannot know`,
      ).toBe(season.meetings * (season.clubs.length - 1))
      expect(schedule.length + season.postSplitRounds).toBe(38)
    }
  })
})

/**
 * The synthetic seed and real provider data now coexist. CI and Browser E2E
 * need a deterministic calendar that never calls a provider; development holds
 * real football since 5 August 2026. The boundary between them is enforced in
 * the emitted SQL rather than remembered, so it is pinned here.
 */
describe('the synthetic seed refuses a season that holds provider data', () => {
  const sql = seedSql()

  it('checks for provider-mapped clubs, not merely for fixtures', () => {
    expect(sql).toContain('from public.provider_entity_map m')
    expect(sql).toContain("m.entity_kind = 'team'")
    expect(sql).toContain('left untouched by the synthetic seed')
  })

  it('checks that BEFORE the fixture guard, because they protect different things', () => {
    // The fixture guard stops a calendar being doubled. The provider guard
    // stops invented clubs landing alongside real ones when fixtures were
    // cleared but the clubs survived — `on conflict (tournament_id, name) do
    // nothing` does not help there, because no invented name collides with a
    // real one. Ordering matters: reached second, the provider guard would be
    // skipped in exactly the case it exists for.
    const providerGuard = sql.indexOf('public.provider_entity_map m')
    const fixtureGuard = sql.indexOf('from public.season_fixtures where tournament_id = v_season')
    expect(providerGuard).toBeGreaterThan(-1)
    expect(fixtureGuard).toBeGreaterThan(-1)
    expect(providerGuard).toBeLessThan(fixtureGuard)
  })

  it('still deletes nothing, so neither guard can be the only thing standing between it and real data', () => {
    expect(sql).not.toMatch(/\bdelete\s+from\b/i)
    expect(sql).not.toMatch(/\btruncate\b/i)
  })
})
