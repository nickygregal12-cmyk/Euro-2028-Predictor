import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MATCHDAY_NOW,
  postponedMatch,
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
    expect(formatCountdown(needsAction[0]?.lockAt ?? '', MATCHDAY_NOW)).toBe('38 min')

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

  it('keeps the postponed fixture out of the matchday and off the clock', () => {
    // It reuses two of the matchday's clubs, so including it would break the
    // "one club, one match" rule the scenario depends on. It exists only so the
    // `postponed` status has something to render.
    expect(workshopMatchday.map((match) => match.id)).not.toContain(
      postponedMatch.id,
    )
    expect(postponedMatch.status).toBe('postponed')
    expect(postponedMatch.clock).toBeNull()
    expect(postponedMatch.score).toBeNull()
    // No deadline: the one it had belonged to a kick-off that is not happening,
    // and inventing a replacement would be inventing a game rule.
    expect(postponedMatch.lockAt).toBeNull()
  })

  it('states a contrast decision for every club colour pair', () => {
    for (const team of workshopTeamList) {
      expect(['light', 'dark'], team.name).toContain(team.colours.onPrimary)
      expect(team.abbreviation, team.name).toHaveLength(3)
      // No crest source exists yet, and the workshop must not pretend one does.
      expect(team.officialBadge, team.name).toBeNull()
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
 * THE CONTAINER-QUERY STRUCTURE OF THE SHELL AND OF HOME.
 *
 * `container-type` applies to an element's DESCENDANTS. A grid that declares
 * itself the container can never respond to its own width, so every composition
 * above the smallest silently never fires — which is exactly what happened on
 * the first build of the Stage 2 frame: 1440px rendered the phone layout and
 * looked entirely plausible. jsdom evaluates no container query, so the
 * structure is asserted from the stylesheet and the RESULT is measured in
 * Chromium by `e2e/vnext-home.spec.ts` and `e2e/vnext-shell.spec.ts`.
 *
 * THERE ARE NOW TWO STYLESHEETS AND TWO CONTAINERS, and the split is the point
 * of Stage 5. The shell declares `vnext-shell` and changes the page bounds and
 * the navigation at 760 and 1120 — the widths at which the APPLICATION changes.
 * Its `<main>` declares `vnext-page`, and Home changes its football columns at
 * 760 and 1560 against that. Same assertions as before the extraction, pointed
 * at whichever file now owns each claim; nothing was dropped for having moved.
 *
 * Home's thresholds are still Stage 3's, and they were measured rather than
 * chosen: each is the width at which the club NAMES in a zone fit, not the
 * width at which the tracks fit.
 */
describe('container-query structure', () => {
  const read = (path: string) =>
    readFileSync(resolve(import.meta.dirname, '../../src/vnext', path), 'utf8')

  const shellCss = read('app/VNextShell.module.css')
  const homeCss = read('home/home.module.css')

  function ruleBody(css: string, selector: string): string {
    const match = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))
    expect(match, `no rule for ${selector}`).not.toBeNull()
    return match?.[1] ?? ''
  }

  it('declares the shell container on the shell and the page container on main', () => {
    expect(ruleBody(shellCss, '.shell')).toContain('container-type: inline-size')
    expect(ruleBody(shellCss, '.shell')).toContain('container-name: vnext-shell')

    // The content region is the container a PAGE answers, which is what lets a
    // page keep its own thresholds without knowing the shell's.
    expect(ruleBody(shellCss, '.main')).toContain('container-type: inline-size')
    expect(ruleBody(shellCss, '.main')).toContain('container-name: vnext-page')

    // The grid is a descendant of the container, never the container itself.
    expect(ruleBody(homeCss, '.body')).not.toContain('container-type')
    expect(ruleBody(homeCss, '.body')).toContain('grid-template-areas')
  })

  it('leaves the page bounds a property to read, not padding on the region', () => {
    // Padding on `<main>` would inset EVERY page — including a standings table
    // that wants the bounds — and would shrink the container a page measures
    // itself against, so a page's own thresholds would stop meaning the width
    // they say. The shell states the inset and the page spends it.
    expect(ruleBody(shellCss, '.main')).not.toContain('padding')
    expect(ruleBody(shellCss, '.main')).not.toContain('max-width')
    expect(shellCss).toContain('--vnext-page-inset: var(--vnext-space-4)')
    for (const zone of ['.ticker', '.banner', '.body']) {
      expect(
        ruleBody(homeCss, zone),
        `${zone} should take the page bounds from the shell`,
      ).toContain('var(--vnext-page-inset)')
    }
  })

  it('sizes every composition against a container, never the viewport', () => {
    for (const css of [shellCss, homeCss]) {
      expect(css).not.toMatch(/@media[^{]*\((min|max)-width/)
    }
    for (const width of [760, 1120]) {
      expect(shellCss).toContain(`@container vnext-shell (min-width: ${width}px)`)
    }
    for (const width of [760, 1120, 1560]) {
      expect(homeCss).toContain(`@container vnext-page (min-width: ${width}px)`)
    }
  })

  it('reorders the body for each emphasis rather than restyling a new page', () => {
    // The three emphases differ by grid area order inside ONE grid. A second
    // `.body`-shaped rule under a different class would be a second page. The
    // flag now sits ON the grid rather than on an ancestor, because the only
    // ancestor left is the application shell and an emphasis is not its
    // business.
    for (const emphasis of ['decision', 'competition']) {
      expect(homeCss).toContain(`.body[data-vnext-emphasis='${emphasis}']`)
    }
    expect(shellCss, 'the shell must not know what an emphasis is').not.toContain(
      'data-vnext-emphasis',
    )
  })

  it('shows exactly one navigation and one league-race shape per width', () => {
    // Both halves of each pair are always rendered and CSS hides one, so the
    // hidden half must be `display: none` — which removes it from the
    // accessibility tree as well as from the page.
    // Stage 7.6: the desktop half is a competition RAIL rather than a masthead
    // band, and the phone half gained a context bar and an attention strip.
    // Every one of them is hidden by `display: none` in the band it is not
    // real in, so none is ever a focus stop nobody can see.
    expect(ruleBody(shellCss, '.rail')).toContain('display: none')
    expect(shellCss).toContain(
      '  .navBar,\n  .contextBar,\n  .attentionBand {\n    display: none;\n  }',
    )
    expect(ruleBody(homeCss, '.socialFull')).toContain('display: none')

    // And the page owns neither of them any more, so it cannot grow a third.
    expect(homeCss).not.toContain('.navBar')
    expect(homeCss).not.toContain('.mastheadNav')
    expect(homeCss).not.toContain('.rail')
  })
})

/**
 * NO vNext LAYOUT MAY MEASURE THE BROWSER WINDOW.
 *
 * The whole workshop rests on one claim: a 375px frame inside a wide desktop
 * browser reviews as a phone. A container query keeps that claim; a viewport
 * UNIT breaks it silently, because `82vw` and `100vh` inside a device shell are
 * the height and width of the window showing the workshop, and the number they
 * produce is plausible enough that nothing looks wrong.
 *
 * The original guard only caught viewport MEDIA QUERIES, which is why both
 * surviving units — `max-width: 82vw` on a rail card and
 * `max-height: calc(100vh - …)` on the desktop personal rail — sat inside a
 * frame that the same test declared honest.
 *
 * SCOPED TO `src/vnext/` ON PURPOSE. The legacy UI uses `clamp(…, 5vw, …)` and
 * viewport-height panels legitimately in a dozen places — it renders in the
 * browser window, so the browser window is the right thing for it to measure.
 * A repository-wide ban would be a rule about the wrong lane, and the first
 * legitimate use would get it deleted.
 */
describe('vNext responsive isolation', () => {
  const vnextRoot = resolve(import.meta.dirname, '../../src/vnext')

  function stylesheets(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return stylesheets(path)
      return entry.name.endsWith('.css') ? [path] : []
    })
  }

  /** Comments explain why these units are banned and must not trip the ban. */
  const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, ' ')

  const files = stylesheets(vnextRoot)

  /**
   * Every viewport-relative length, including the dynamic/small/large variants.
   * `svh` is no better than `vh` here: a device shell is not a viewport at all,
   * so every one of them measures the wrong box.
   */
  const VIEWPORT_UNIT =
    /(?<![\w-])\d*\.?\d+(?:vh|vw|vmin|vmax|vb|vi|dvh|dvw|svh|svw|lvh|lvw)(?![\w-])/g

  it('reads the vNext stylesheets at all', () => {
    // Without this a broken walk would pass the ban below having read nothing.
    expect(files.length).toBeGreaterThan(10)
  })

  it('uses no viewport-relative unit in any vNext stylesheet', () => {
    const offenders: string[] = []

    for (const file of files) {
      const source = withoutComments(readFileSync(file, 'utf8'))
      source.split('\n').forEach((line, index) => {
        for (const match of line.matchAll(VIEWPORT_UNIT)) {
          offenders.push(
            `${relative(vnextRoot, file)}:${index + 1} ${match[0]} — ${line.trim()}`,
          )
        }
      })
    }

    expect(
      offenders,
      'vNext layout must measure its own container, never the host browser:\n' +
        offenders.join('\n'),
    ).toEqual([])
  })

  it('uses no viewport media query for layout in any vNext stylesheet', () => {
    const offenders = files.filter((file) =>
      /@media[^{]*\((min|max)-(width|height)/.test(
        withoutComments(readFileSync(file, 'utf8')),
      ),
    )

    expect(
      offenders.map((file) => relative(vnextRoot, file)),
      'a width media query reports the browser window, not the frame',
    ).toEqual([])
  })

  it('catches a viewport unit when one is present', () => {
    // The ban above passes trivially if the pattern matches nothing, so it is
    // exercised against text that must fail and text that must not.
    expect('max-width: 82vw;'.match(VIEWPORT_UNIT)).not.toBeNull()
    expect('max-height: calc(100vh - 8px);'.match(VIEWPORT_UNIT)).not.toBeNull()
    expect('inline-size: 82cqi;'.match(VIEWPORT_UNIT)).toBeNull()
    // Not a unit: an identifier that merely ends in one.
    expect('var(--review-in-4vh-mode)'.match(VIEWPORT_UNIT)).toBeNull()
  })

  it('declares the frame block token as unbounded by default', () => {
    // `none` is what makes the absent case honest: a frame with no height of
    // its own bounds nothing, rather than falling back to the window.
    const tokens = readFileSync(
      resolve(vnextRoot, 'foundations/tokens.css'),
      'utf8',
    )
    expect(tokens).toMatch(/--vnext-frame-block:\s*none;/)
  })

  it('does not turn the vNext root into a scroll container', () => {
    // `overflow-x: hidden` makes the root a scrollport, and every sticky
    // descendant then sticks to a box that never scrolls — which is the same as
    // not sticking at all. `clip` clips without scrolling.
    const root = readFileSync(
      resolve(vnextRoot, 'foundations/VNextRoot.module.css'),
      'utf8',
    )
    expect(withoutComments(root)).toContain('overflow-x: clip')
    expect(withoutComments(root)).not.toContain('overflow-x: hidden')
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
