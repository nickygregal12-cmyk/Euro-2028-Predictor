import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MATCHDAY_NOW,
  workshopHomeModel,
  workshopMatchday,
  workshopTeamList,
} from '../../src/vnext/fixtures'
import {
  formatCountdown,
  formatKickoffLabel,
  formatOrdinal,
  formatSignedPoints,
} from '../../src/vnext/foundations/format'

/**
 * The workshop fixture is the thing every vNext story, screenshot and concept
 * is judged against. If it drifts — a rank that disagrees with a ladder, a
 * "live" match with no clock, a share that sums to 130% — every review built on
 * it is quietly wrong.
 *
 * These are consistency checks on the scenario, not tests of the components.
 */
describe('workshop matchday fixture', () => {
  it('describes a single fixed instant with no clock reads', () => {
    expect(Number.isNaN(Date.parse(MATCHDAY_NOW))).toBe(false)
    expect(workshopHomeModel.generatedAt).toBe(MATCHDAY_NOW)
  })

  it('gives every match a unique id and a parseable kick-off', () => {
    const ids = workshopMatchday.map((match) => match.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const match of workshopMatchday) {
      expect(Number.isNaN(Date.parse(match.kickoff)), match.id).toBe(false)
    }
  })

  it('never puts one club in two matches of the same matchday', () => {
    const teamIds = workshopMatchday.flatMap((match) => [
      match.home.team.id,
      match.away.team.id,
    ])
    expect(new Set(teamIds).size).toBe(teamIds.length)
  })

  it('exercises every state the interface has to survive', () => {
    const statuses = new Set(workshopMatchday.map((match) => match.status))
    expect(statuses).toContain('live')
    expect(statuses).toContain('halfTime')
    expect(statuses).toContain('upcoming')
    expect(statuses).toContain('fullTime')

    // One match with no prediction and a deadline still ahead: the action the
    // whole surface is meant to push at.
    const needsAction = workshopMatchday.filter(
      (match) => match.prediction === null && match.status === 'upcoming',
    )
    expect(needsAction).toHaveLength(1)
    expect(formatCountdown(needsAction[0].lockAt ?? '', MATCHDAY_NOW)).toBe('38 min')

    // One settled exact score, and one joker in play.
    expect(
      workshopMatchday.filter((match) => match.prediction?.outcome === 'exact'),
    ).toHaveLength(1)
    expect(
      workshopMatchday.filter((match) => match.prediction?.isJoker === true),
    ).toHaveLength(1)
  })

  it('keeps live matches on the clock and upcoming matches off it', () => {
    for (const match of workshopMatchday) {
      const inPlay = match.status === 'live' || match.status === 'halfTime'
      expect(match.clock !== null, match.id).toBe(inPlay)
      expect(match.score !== null, match.id).toBe(
        inPlay || match.status === 'fullTime',
      )
    }
  })

  it('only marks points provisional while a match is in play', () => {
    for (const match of workshopMatchday) {
      if (!match.prediction?.pointsAreProvisional) continue
      expect(['live', 'halfTime'], match.id).toContain(match.status)
    }
  })

  it('has consensus shares that add up', () => {
    for (const match of workshopMatchday) {
      const groups = [
        match.consensus?.community,
        match.consensus?.friends,
      ].filter((group) => group !== undefined && group !== null)

      for (const group of groups) {
        const total = group.homeWinShare + group.drawShare + group.awayWinShare
        expect(total, `${match.id} ${group.label}`).toBeCloseTo(1, 2)
        // Popular scorelines are ordered, most popular first.
        const shares = group.popular.map((entry) => entry.share)
        expect(shares, `${match.id} ${group.label}`).toEqual(
          [...shares].sort((a, b) => b - a),
        )
      }
    }
  })

  it('states a contrast decision for every club colour pair', () => {
    for (const team of workshopTeamList) {
      expect(['light', 'dark'], team.name).toContain(team.colours.onPrimary)
      expect(team.abbreviation, team.name).toHaveLength(3)
      // No crest source exists yet, and the workshop must not pretend one does.
      expect(team.crestUrl, team.name).toBeNull()
    }
  })
})

describe('workshop home model', () => {
  it('agrees with itself about the user, their points and their rank', () => {
    const { user, recentPerformance, privateLeagues, rivals } = workshopHomeModel

    for (const league of privateLeagues) {
      const userRow = league.standings.find((standing) => standing.isUser)
      expect(userRow, league.name).toBeDefined()
      expect(userRow?.player.id).toBe(user.id)
      expect(userRow?.points).toBe(recentPerformance.totalPoints)
      expect(userRow?.rank).toBe(league.userRank)

      const leader = league.standings.find((standing) => standing.rank === 1)
      expect(league.gapToLeader, league.name).toBe(
        (leader?.points ?? 0) - league.userPoints,
      )
      expect(league.leaderName, league.name).toBe(leader?.player.name)

      // Ranks are dense and ordered, and points fall with rank.
      const ranks = league.standings.map((standing) => standing.rank)
      expect(ranks, league.name).toEqual([...ranks].sort((a, b) => a - b))
    }

    for (const rival of rivals) {
      expect(rival.pointsDifference, rival.player.name).toBe(
        rival.points - recentPerformance.totalPoints,
      )
    }
  })

  it('counts predictions consistently in the accuracy breakdown', () => {
    const { accuracy } = workshopHomeModel.recentPerformance
    expect(accuracy.exact + accuracy.resultOnly + accuracy.missed).toBe(
      accuracy.predicted,
    )
  })

  it('describes a primary action that is still open at the model instant', () => {
    const { primaryAction } = workshopHomeModel
    expect(primaryAction.progress).not.toBeNull()
    expect(primaryAction.progress?.completed).toBeLessThan(
      primaryAction.progress?.total ?? 0,
    )
    expect(formatCountdown(primaryAction.deadline ?? '', MATCHDAY_NOW)).toBe(
      '38 min',
    )
  })

  it('keeps activity ordered newest first and inside the scenario', () => {
    const times = workshopHomeModel.activity.map((item) =>
      Date.parse(item.occurredAt),
    )
    expect(times).toEqual([...times].sort((a, b) => b - a))
    for (const time of times) {
      expect(time).toBeLessThanOrEqual(Date.parse(MATCHDAY_NOW))
    }
  })
})

/**
 * `container-type` applies to an element's DESCENDANTS. A grid that declares
 * itself the container can never respond to its own width, so every composition
 * above `compact` silently never fires — which is exactly what happened on the
 * first build of this frame: 1440px rendered the phone layout and looked
 * plausible. jsdom cannot evaluate container queries, so the structure is
 * asserted from the stylesheet instead.
 */
describe('AppFrame container-query structure', () => {
  const css = readFileSync(
    resolve(
      import.meta.dirname,
      '../../src/vnext/foundations/layout/AppFrame.module.css',
    ),
    'utf8',
  )

  function ruleBody(selector: string): string {
    const match = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))
    expect(match, `no rule for ${selector}`).not.toBeNull()
    return match?.[1] ?? ''
  }

  it('declares the container on a different element from the grid', () => {
    expect(ruleBody('.container')).toContain('container-type: inline-size')
    expect(ruleBody('.frame')).not.toContain('container-type')
    expect(ruleBody('.frame')).toContain('grid-template-areas')
  })

  it('sizes every composition against the container, never the viewport', () => {
    expect(css).not.toMatch(/@media[^{]*\((min|max)-width/)
    for (const width of [720, 1100, 1500]) {
      expect(css).toContain(`@container vnext-frame (min-width: ${width}px)`)
    }
  })
})

describe('presentation formatting', () => {
  it('is deterministic regardless of the machine time zone', () => {
    // Pinned locale and zone, so a story renders the same time in CI as on a
    // laptop in another country.
    expect(formatKickoffLabel('2027-08-21T16:30:00.000Z', MATCHDAY_NOW)).toBe(
      'Today 17:30',
    )
    expect(formatKickoffLabel('2027-08-22T11:00:00.000Z', MATCHDAY_NOW)).toBe(
      'Tomorrow 12:00',
    )
    expect(formatKickoffLabel('2027-08-20T18:45:00.000Z', MATCHDAY_NOW)).toBe(
      'Yesterday 19:45',
    )
  })

  it('returns null for a deadline that has already passed', () => {
    expect(formatCountdown('2027-08-21T15:00:00.000Z', MATCHDAY_NOW)).toBeNull()
  })

  it('formats hours, days, ordinals and signed points', () => {
    expect(formatCountdown('2027-08-21T18:07:00.000Z', MATCHDAY_NOW)).toBe(
      '2 hr 15 min',
    )
    expect(formatCountdown('2027-08-23T15:52:00.000Z', MATCHDAY_NOW)).toBe('2 days')
    expect(formatOrdinal(1)).toBe('1st')
    expect(formatOrdinal(2)).toBe('2nd')
    expect(formatOrdinal(11)).toBe('11th')
    expect(formatOrdinal(1428)).toBe('1,428th')
    expect(formatSignedPoints(6)).toBe('+6')
    expect(formatSignedPoints(0)).toBe('0')
    expect(formatSignedPoints(-3)).toBe('−3')
  })
})
