import { describe, expect, it } from 'vitest'

import {
  doubleRoundRobin,
  SEASONS,
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
 * schedule that inserts perfectly well while some pair never meets, or meets
 * twice at the same ground. Nothing in the database objects. The season simply
 * plays out slightly wrong, and it would be found — if at all — by somebody
 * noticing a table that does not add up in March.
 */

describe.each([
  { clubs: 4 },
  { clubs: 12 },
  { clubs: 20 },
])('a double round-robin for $clubs clubs', ({ clubs }) => {
  const schedule = doubleRoundRobin(clubs)

  it('plays two full halves', () => {
    expect(schedule).toHaveLength(2 * (clubs - 1))
  })

  it('gives every club exactly one fixture in every matchweek', () => {
    // This is the property the database enforces, so getting it wrong is
    // caught either way — but being caught here costs nothing.
    for (const [index, round] of schedule.entries()) {
      expect(round, `matchweek ${index + 1} is not a full round`).toHaveLength(clubs / 2)
      const appearing = round.flat()
      expect(new Set(appearing).size, `a club plays twice in matchweek ${index + 1}`).toBe(
        clubs,
      )
    }
  })

  it('makes every pair meet exactly twice', () => {
    const meetings = new Map<string, number>()
    for (const round of schedule) {
      for (const [home, away] of round) {
        const key = [home, away].sort((a, b) => a - b).join('-')
        meetings.set(key, (meetings.get(key) ?? 0) + 1)
      }
    }
    // Every unordered pair, and no pair missing.
    expect(meetings.size).toBe((clubs * (clubs - 1)) / 2)
    for (const [pair, count] of meetings) {
      expect(count, `pair ${pair} meets ${count} times`).toBe(2)
    }
  })

  it('gives every pair one fixture at each ground', () => {
    // The silent one. Two meetings both at the same ground would satisfy every
    // assertion above and still be a broken fixture list.
    const ordered = new Map<string, number>()
    for (const round of schedule) {
      for (const [home, away] of round) {
        const key = `${home}>${away}`
        ordered.set(key, (ordered.get(key) ?? 0) + 1)
      }
    }
    for (const [pair, count] of ordered) {
      expect(count, `${pair} is played ${count} times`).toBe(1)
    }
  })

  it('gives every club an equal split of home and away fixtures', () => {
    const home = new Array<number>(clubs).fill(0)
    for (const round of schedule) {
      for (const [homeClub] of round) home[homeClub] += 1
    }
    for (const [club, played] of home.entries()) {
      expect(played, `club ${club} has ${played} home fixtures`).toBe(clubs - 1)
    }
  })
})

describe('a single round-robin does not seat one club at home all season', () => {
  it('alternates the fixed pairing', () => {
    // The circle method pins club 0 and rotates the rest around it. Without the
    // alternation, club 0 plays every first-half fixture at home — which passes
    // every "each pair meets once" check and is obviously not a fixture list.
    const rounds = singleRoundRobin(20)
    const homeForZero = rounds.filter((round) =>
      round.some(([home]) => home === 0),
    ).length
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
})
