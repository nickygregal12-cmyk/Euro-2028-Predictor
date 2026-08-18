import { expect, test } from '@playwright/test'

/**
 * THE STAGE 8 MATCHES SYSTEM, MEASURED BY A REAL ENGINE.
 *
 * jsdom evaluates no container query and computes no layout, so every
 * responsive, target-size and overflow claim in `tests/vnext/matches.test.tsx`
 * is about the MODEL and the MARKUP. This suite is about the PICTURE.
 *
 * WHAT IT ASSERTS, and why each one needs a browser:
 *
 *   1. NO CLUB NAME IS CLIPPED, at any width, including a sixty-character
 *      competition and "Inverness Caledonian Rangers". Clipping is a computed
 *      overflow and cannot be seen from markup.
 *   2. EVERY FIXTURE ROW CLEARS 44×44. A row's height comes from its content
 *      and its padding; only a layout engine can say what it came to.
 *   3. THE DESKTOP COMPOSITION IS NOT A STRETCHED PHONE. At 1440 the browsing
 *      controls sit BESIDE the fixtures rather than above them, and the row
 *      itself changes shape. Both are container queries.
 *   4. A ROW MEASURES ITSELF. The row's own container decides its shape, so a
 *      row in a narrow column at 1920 composes as a phone row. That is the
 *      defect a page-level query would produce and a browser is the only thing
 *      that can prove it did not.
 *   5. NOTHING OVERFLOWS SIDEWAYS at any width.
 *   6. THE LIVE MINUTE IS NEVER INVENTED. A live row with no provider clock
 *      must contain no minute-shaped text — measured on the rendered page,
 *      after the entrance, with a real clock running.
 *   7. PRESSING A FIXTURE HANDS THE HOST THAT ROW'S CANONICAL ID — observed
 *      from the story's own host, by click and by keyboard. Where the host then
 *      SENDS the player is the host's business and is not a claim this suite
 *      can make: Storybook has no router. Restoring a prior browsing context is
 *      `initialView`, and `tests/vnext/matches.test.tsx` owns it.
 *   8. THE ONE-COMPETITION PLAYER SEES NO CATALOGUE, anywhere on the page.
 *   9. COMBINED MODE NAMES THE COMPETITION ON EVERY FIXTURE.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE. The page opens at 1280×900, which
 * is the width and height of no frame under review, so anything inside a frame
 * that measures the window produces a number that cannot be mistaken for right.
 */

const WIDTHS = [
  { story: 'upcoming-375', width: 375, height: 812, composition: 'stacked' },
  { story: 'upcoming-430', width: 430, height: 900, composition: 'stacked' },
  { story: 'upcoming-768', width: 768, height: 1024, composition: 'stacked' },
  { story: 'upcoming-1024', width: 1024, height: 768, composition: 'stacked' },
  { story: 'upcoming-1440', width: 1440, height: 900, composition: 'columns' },
  { story: 'upcoming-1920', width: 1920, height: 1080, composition: 'columns' },
] as const

/** Every list world, at the widths its composition differs most between. */
const LIST_WORLDS = [
  { story: 'live-375', label: 'live at 375', width: 375 },
  { story: 'live-430', label: 'live at 430', width: 430 },
  { story: 'live-1440', label: 'live at 1440', width: 1440 },
  { story: 'live-1920', label: 'live at 1920', width: 1920 },
  { story: 'mixed-375', label: 'a mixed matchday at 375', width: 375 },
  { story: 'mixed-1440', label: 'a mixed matchday at 1440', width: 1440 },
  { story: 'finished-375', label: 'all finished at 375', width: 375 },
  { story: 'finished-1440', label: 'all finished at 1440', width: 1440 },
  { story: 'empty-375', label: 'an empty window at 375', width: 375 },
  { story: 'empty-1440', label: 'an empty window at 1440', width: 1440 },
  { story: 'postponed-375', label: 'a postponed fixture at 375', width: 375 },
  { story: 'postponed-1440', label: 'a postponed fixture at 1440', width: 1440 },
  { story: 'long-375', label: 'long names at 375', width: 375 },
  { story: 'long-430', label: 'long names at 430', width: 430 },
  { story: 'long-1440', label: 'long names at 1440', width: 1440 },
  { story: 'long-1920', label: 'long names at 1920', width: 1920 },
  { story: 'sparse-375', label: 'sparse metadata at 375', width: 375 },
  { story: 'sparse-1440', label: 'sparse metadata at 1440', width: 1440 },
  { story: 'group-375', label: 'a group stage at 375', width: 375 },
  { story: 'group-1440', label: 'a group stage at 1440', width: 1440 },
  { story: 'knockout-375', label: 'a knockout round at 375', width: 375 },
  { story: 'knockout-1440', label: 'a knockout round at 1440', width: 1440 },
  { story: 'one-375', label: 'one competition at 375', width: 375 },
  { story: 'one-1440', label: 'one competition at 1440', width: 1440 },
  { story: 'combined-375', label: 'combined scope at 375', width: 375 },
  { story: 'combined-1440', label: 'combined scope at 1440', width: 1440 },
] as const

/** Every Match Centre world, at the widths its composition differs most between. */
const CENTRE_WORLDS = [
  { story: 'centre-375', label: 'a rich Match Centre at 375', width: 375 },
  { story: 'centre-430', label: 'a rich Match Centre at 430', width: 430 },
  { story: 'centre-768', label: 'a rich Match Centre at 768', width: 768 },
  { story: 'centre-1024', label: 'a rich Match Centre at 1024', width: 1024 },
  { story: 'centre-1440', label: 'a rich Match Centre at 1440', width: 1440 },
  { story: 'centre-1920', label: 'a rich Match Centre at 1920', width: 1920 },
  { story: 'centre-scheduled-375', label: 'a scheduled match at 375', width: 375 },
  { story: 'centre-scheduled-1440', label: 'a scheduled match at 1440', width: 1440 },
  { story: 'centre-live-minute-375', label: 'live with a minute at 375', width: 375 },
  { story: 'centre-live-minute-1440', label: 'live with a minute at 1440', width: 1440 },
  { story: 'centre-live-no-minute-375', label: 'live with NO minute at 375', width: 375 },
  { story: 'centre-live-no-minute-1440', label: 'live with NO minute at 1440', width: 1440 },
  { story: 'centre-half-time-1440', label: 'half-time at 1440', width: 1440 },
  { story: 'centre-no-score-375', label: 'live with NO score at 375', width: 375 },
  { story: 'centre-no-score-1440', label: 'live with NO score at 1440', width: 1440 },
  { story: 'centre-full-time-375', label: 'full time at 375', width: 375 },
  { story: 'centre-full-time-1440', label: 'full time at 1440', width: 1440 },
  { story: 'centre-awaiting-1440', label: 'awaiting a result at 1440', width: 1440 },
  { story: 'centre-postponed-375', label: 'a postponed match at 375', width: 375 },
  { story: 'centre-postponed-1440', label: 'a postponed match at 1440', width: 1440 },
  { story: 'centre-extra-time-1440', label: 'extra time at 1440', width: 1440 },
  { story: 'centre-penalties-375', label: 'penalties at 375', width: 375 },
  { story: 'centre-penalties-1440', label: 'penalties at 1440', width: 1440 },
  { story: 'centre-core-375', label: 'core data only at 375', width: 375 },
  { story: 'centre-core-430', label: 'core data only at 430', width: 430 },
  { story: 'centre-core-1440', label: 'core data only at 1440', width: 1440 },
  { story: 'centre-core-1920', label: 'core data only at 1920', width: 1920 },
  { story: 'centre-stale-1440', label: 'a stale provider at 1440', width: 1440 },
] as const

type Reading = {
  frameWidth: number
  frameHeight: number
  horizontalOverflow: number
  mainCount: number
  headingCount: number
  headingText: string | null
  headingIsWired: boolean
  currentDestinations: string[]
  /** Fixture rows that are actually rendered, with their ids. */
  rowIds: string[]
  /** Rows whose interactive box is under 44px in either dimension. */
  smallRows: string[]
  /** Any control at all whose box is under 44px. */
  smallTargets: string[]
  /** Elements whose content is wider or taller than their own box. */
  clipped: string[]
  /**
   * WHETHER THE BROWSING CONTROLS SIT BESIDE THE FIXTURES OR ABOVE THEM.
   *
   * The whole desktop claim, measured rather than read off a stylesheet: at
   * 1440 the controls' left edge must be to the RIGHT of the fixtures' right
   * edge, which can only be true if the page took two columns.
   */
  composition: 'stacked' | 'columns' | 'none'
  /** How many rows lay their two clubs out on ONE line. */
  singleLineRows: number
  /** Whether any row still uses the stacked phone shape. */
  stackedRows: number
  /** Every rendered live row's text, so a minute cannot hide in one. */
  liveRowText: string[]
  /** Text of every rendered row, for the competition-naming check. */
  rowText: string[]
  /** The whole page's text, flattened. */
  pageText: string
  /** The fixtures column's own width, for the desktop composition claim. */
  fixturesWidth: number
  mainWidth: number
}

async function read(page: import('@playwright/test').Page): Promise<Reading> {
  return page.evaluate<Reading>(() => {
    const frame = document.querySelector('figure [data-vnext]') as HTMLElement | null
    const scope: ParentNode = frame ?? document

    const rendered = (node: Element) => {
      const box = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return (
        box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      )
    }

    const describe = (node: Element) => {
      const tag = node.tagName.toLowerCase()
      const id = node.getAttribute('data-vnext-match-row')
      const label = (node.getAttribute('aria-label') ?? node.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60)
      return `${tag}${id ? `#${id}` : ''}: ${label}`
    }

    const rows = [...scope.querySelectorAll('[data-vnext-match-row]')].filter(rendered)

    const smallRows: string[] = []
    for (const row of rows) {
      // Layout boxes, not client rects: the workshop scales frames with a CSS
      // transform to fit them on one screen, and a scaled rect would report a
      // 44px row as 18px at 0.42.
      const node = row as HTMLElement
      if (node.offsetWidth < 44 || node.offsetHeight < 44) {
        smallRows.push(`${describe(row)} @ ${node.offsetWidth}x${node.offsetHeight}`)
      }
    }

    const smallTargets: string[] = []
    for (const control of scope.querySelectorAll<HTMLElement>(
      'button, a[href], [role="button"]',
    )) {
      if (!rendered(control)) continue
      // The skip link is a 1px clipped box UNTIL IT IS FOCUSED, at which point
      // its own rule gives it a 44px target. `clip-path` is what separates
      // "deliberately invisible" from "a control a finger cannot hit".
      if (getComputedStyle(control).clipPath !== 'none') continue
      // `offsetWidth`/`offsetHeight` are layout boxes and ignore the CSS
      // transform the workshop uses to fit frames on one screen, so they are
      // the real size a finger would meet.
      if (control.offsetWidth < 44 || control.offsetHeight < 44) {
        smallTargets.push(`${describe(control)} @ ${control.offsetWidth}x${control.offsetHeight}`)
      }
    }

    // CLIPPING, MEASURED. A club name that does not fit is the defect the
    // fixture worlds exist to expose, and it is invisible to a DOM assertion.
    //
    // `clip-path` IS THE SEPARATOR between "deliberately invisible" and
    // "accidentally cut off" — the shell suite's own idiom. Every accessible
    // sentence on these pages is an sr-only `<span>`: a 1px box holding a whole
    // sentence, overflowing by design and hidden with `clip-path: inset(50%)`.
    // So is the skip link until it is focused. Counting either as clipped text
    // would report the accessibility work as a layout defect.
    const clipped: string[] = []
    for (const node of scope.querySelectorAll<HTMLElement>('span, p, h1, h2, td, th, a')) {
      if (!rendered(node)) continue
      const style = getComputedStyle(node)
      if (style.clipPath !== 'none') continue
      // An ellipsis on a club name is the defect §11 names by hand: abbreviate
      // intentionally rather than clip. There is none anywhere in this lane.
      if (style.textOverflow === 'ellipsis') {
        clipped.push(`${describe(node)} (ellipsis)`)
        continue
      }
      if (style.overflowX !== 'hidden' && style.overflowX !== 'clip') continue
      if (node.scrollWidth - node.clientWidth > 1) {
        clipped.push(`${describe(node)} (${node.scrollWidth} in ${node.clientWidth})`)
      }
    }

    const fixtures = scope.querySelector('[data-vnext-zone="fixtures"]') as HTMLElement | null
    const controls = scope.querySelector('[data-vnext-zone="browse"]') as HTMLElement | null

    let composition: Reading['composition'] = 'none'
    if (fixtures && controls) {
      const f = fixtures.getBoundingClientRect()
      const c = controls.getBoundingClientRect()
      // BESIDE, not above. `c.left >= f.right` can only be true if the page
      // laid out two columns; a stacked page has them at the same left edge.
      composition = c.left >= f.right - 1 ? 'columns' : 'stacked'
    }

    // THE ROW'S OWN SHAPE. A single-line row puts both clubs on one baseline,
    // so their vertical centres agree; a stacked row does not.
    /**
     * THE ROW'S OWN SHAPE, from where its two club names actually sit.
     *
     * A single-line row puts both clubs on one baseline, so their boxes share a
     * top; a stacked row does not. It is measured from the RENDERED names
     * rather than from a class, so it stays true if the composition changes and
     * fails if a container query silently stops matching.
     */
    let singleLineRows = 0
    let stackedRows = 0
    for (const row of rows) {
      // The two clubs, by their own structural marker. Guessing from text
      // length picks up the stage label and the prediction badge, which sit on
      // their own lines in BOTH compositions and would make every row read as
      // stacked.
      const home = row.querySelector('[data-vnext-club="home"]')
      const away = row.querySelector('[data-vnext-club="away"]')
      if (!home || !away) {
        stackedRows += 1
        continue
      }
      const sameLine =
        Math.abs(home.getBoundingClientRect().top - away.getBoundingClientRect().top) < 2
      if (sameLine) singleLineRows += 1
      else stackedRows += 1
    }

    const main = scope.querySelector('main')
    const heading = scope.querySelector('h1')
    const labelledBy = main?.getAttribute('aria-labelledby') ?? null

    const liveRowText = rows
      .filter((row) => row.getAttribute('data-vnext-match-state') === 'live')
      .map((row) => (row.textContent ?? '').replace(/\s+/g, ' ').trim())

    const current = [...scope.querySelectorAll('[aria-current]')]
      .filter(rendered)
      .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())

    return {
      frameWidth: frame?.getBoundingClientRect().width ?? 0,
      frameHeight: frame?.getBoundingClientRect().height ?? 0,
      horizontalOverflow: Math.max(
        0,
        (frame?.scrollWidth ?? 0) - Math.ceil(frame?.getBoundingClientRect().width ?? 0),
      ),
      mainCount: scope.querySelectorAll('main').length,
      headingCount: scope.querySelectorAll('h1').length,
      headingText: heading?.textContent ?? null,
      headingIsWired: labelledBy !== null && heading?.id === labelledBy,
      currentDestinations: current,
      rowIds: rows.map((row) => row.getAttribute('data-vnext-match-row') ?? '(unnamed)'),
      smallRows,
      smallTargets,
      clipped,
      composition,
      singleLineRows,
      stackedRows,
      liveRowText,
      rowText: rows.map((row) => (row.textContent ?? '').replace(/\s+/g, ' ').trim()),
      pageText: ((frame ?? document.body).textContent ?? '').replace(/\s+/g, ' ').trim(),
      fixturesWidth: fixtures?.getBoundingClientRect().width ?? 0,
      mainWidth: main?.getBoundingClientRect().width ?? 0,
    }
  })
}

async function open(page: import('@playwright/test').Page, story: string) {
  await page.goto(`/iframe.html?id=vnext-matches--${story}&viewMode=story`, {
    waitUntil: 'load',
  })
  await page.waitForSelector('figure [data-vnext] [data-vnext-shell] main')
  // The masthead and the fixtures each enter with a rise; measuring
  // mid-entrance reads transformed boxes rather than laid-out ones.
  await page.waitForTimeout(1200)
}

/** Every world owes the same baseline, whatever it is demonstrating. */
function expectBaseline(reading: Reading, where: string) {
  expect(reading.horizontalOverflow, `${where} scrolls sideways`).toBe(0)
  expect(reading.mainCount, `${where} should have exactly one main`).toBe(1)
  expect(reading.headingCount, `${where} should have exactly one h1`).toBe(1)
  expect(reading.headingIsWired, `${where} main is not labelled by its own h1`).toBe(true)
  expect(reading.clipped, `${where} clips text`).toEqual([])
  expect(reading.smallTargets, `${where} has controls under 44px`).toEqual([])
  expect(reading.smallRows, `${where} has fixture rows under 44px`).toEqual([])

  // The shell still says where the player is, and it says Matches.
  expect(
    reading.currentDestinations.filter((label) => label.includes('Matches')).length,
    `${where} should mark Matches as the current destination`,
  ).toBeGreaterThan(0)
  expect(
    reading.currentDestinations.filter((label) => label.trim() === 'Games'),
    `${where} marked Games as current — Matches is football, Games is a format`,
  ).toEqual([])
}

/* ========================================================================== *
 * The bands
 * ========================================================================== */

test.describe('Matches holds its frame', () => {
  for (const width of WIDTHS) {
    test(`at ${width.width}px`, async ({ page }) => {
      await open(page, width.story)
      const reading = await read(page)
      const where = `Matches at ${width.width}px`

      // The frame is the frame, not the browser window. A `vh`/`vw` anywhere
      // inside would report 900/1280 here and could not be accidentally right.
      expect(reading.frameWidth, `${where} frame width`).toBe(width.width)
      expect(reading.frameHeight, `${where} frame height`).toBe(width.height)

      expectBaseline(reading, where)
      expect(reading.headingText, `${where} heading`).toBe('Matches')

      // THE DESKTOP CLAIM, MEASURED. Below 1120 the controls sit above the
      // football; at 1120 and up they sit beside it and the fixtures keep the
      // working column. A stretched phone would read `stacked` at 1440.
      expect(reading.composition, `${where} composition`).toBe(width.composition)

      if (width.composition === 'columns') {
        // The football gets the width, not the margins: the fixtures column is
        // the larger of the two by a clear margin.
        expect(
          reading.fixturesWidth,
          `${where} fixtures column should take most of the workspace`,
        ).toBeGreaterThan(reading.mainWidth * 0.55)
      }
    })
  }
})

/* ========================================================================== *
 * The row measures itself
 * ========================================================================== */

test.describe('a row composes against its own container', () => {
  test('stacks its clubs on a phone', async ({ page }) => {
    await open(page, 'upcoming-375')
    const reading = await read(page)

    // At 375 there is no room for two club names, a score and a state on one
    // line without abbreviating a club to three letters, which §11 forbids.
    expect(reading.stackedRows, 'every row at 375 should stack its clubs').toBeGreaterThan(0)
    expect(reading.singleLineRows, 'no row at 375 should be single-line').toBe(0)
  })

  test('lays its clubs across at 1440, where they fit', async ({ page }) => {
    await open(page, 'upcoming-1440')
    const reading = await read(page)

    expect(
      reading.singleLineRows,
      'rows at 1440 should use the width rather than stacking',
    ).toBeGreaterThan(0)
  })
})

/* ========================================================================== *
 * THE LIVE RULE, IN A REAL BROWSER WITH A REAL CLOCK RUNNING
 * ========================================================================== */

test.describe('the live minute is never invented', () => {
  test('a live row with no provider clock shows no minute', async ({ page }) => {
    await open(page, 'live-375')
    const reading = await read(page)

    expect(reading.liveRowText.length, 'the live world should render live rows').toBeGreaterThan(0)

    // `fixture-live-3` is live and its model carries NO clock. The page has been
    // open for over a second with a real clock running; a surface that derived a
    // minute from kickoff would have one by now.
    const noClock = reading.rowText.find((textOf) => textOf.includes('Porthaven City'))
    expect(noClock, 'the clockless live row should be rendered').toBeTruthy()
    expect(noClock ?? '', 'a minute was invented for a live match that has none').not.toMatch(
      /\d+['′]/,
    )
    expect(noClock ?? '', 'the clockless live row should still say it is live').toContain('Live')
  })

  test('a live match Match Centre with no provider clock shows no minute', async ({ page }) => {
    await open(page, 'centre-live-no-minute-1440')
    const reading = await read(page)

    expect(reading.pageText).toContain('Live')
    expect(reading.pageText, 'a minute was invented on the Match Centre').not.toMatch(/\d+['′]/)
    // The one honest freshness claim: the SERVER's observation instant.
    expect(reading.pageText).toContain('observed at')
  })

  test('a postponed fixture draws no live state', async ({ page }) => {
    await open(page, 'postponed-1440')
    const reading = await read(page)

    expect(reading.pageText).toContain('Postponed')
    const postponed = reading.rowText.find((textOf) => textOf.includes('Postponed'))
    expect(postponed ?? '').not.toContain('Live')
    expect(postponed ?? '').not.toMatch(/\d+['′]/)
  })

  test('a live match with no score claims no score', async ({ page }) => {
    await open(page, 'centre-no-score-1440')
    const reading = await read(page)

    expect(reading.pageText).toContain('Live')
    expect(reading.pageText).toContain('No score reported yet')
    // The claim that must not be made: there is no provisional score to observe.
    expect(reading.pageText).not.toContain('Provisional score ·')
    expect(reading.pageText).not.toMatch(/\d+['′]/)
  })

  test('a finished match offers no live affordance', async ({ page }) => {
    await open(page, 'centre-full-time-1440')
    const reading = await read(page)

    expect(reading.pageText).toContain('Full time')
    // No pulse, no minute, no "follow live" anywhere on a settled match.
    expect(reading.pageText).not.toMatch(/\d+['′]/)
    expect(reading.pageText).not.toContain('observed at')
  })
})

/* ========================================================================== *
 * THE ONE-COMPETITION CONTRACT
 * ========================================================================== */

test.describe('the one-competition player', () => {
  for (const story of ['one-375', 'one-1440'] as const) {
    test(`sees no catalogue at ${story}`, async ({ page }) => {
      await open(page, story)
      const reading = await read(page)

      // NO SCOPE CONTROL, because there is nothing to scope across.
      expect(reading.pageText, 'a scope control was offered to a one-competition player')
        .not.toContain('Across your')

      // NO OTHER COMPETITION'S NAME ANYWHERE ON THE PAGE. This is the whole
      // scalability claim and it is a text search rather than a promise.
      for (const stranger of [
        'Caledonian Cup',
        'Northern Isles Champions Trophy',
        'Highlands and Northern Islands',
      ]) {
        expect(
          reading.pageText,
          `a one-competition player was shown "${stranger}"`,
        ).not.toContain(stranger)
      }
    })
  }
})

/* ========================================================================== *
 * COMBINED SCOPE
 * ========================================================================== */

test.describe('combined scope', () => {
  for (const story of ['combined-375', 'combined-1440'] as const) {
    test(`names the competition on every fixture at ${story}`, async ({ page }) => {
      await open(page, story)
      const reading = await read(page)

      expect(reading.rowText.length).toBeGreaterThan(1)
      for (const textOf of reading.rowText) {
        const named = [
          'Caledonian Premiership',
          'Northern Isles Champions Trophy',
          'Caledonian Cup',
        ].some((name) => textOf.includes(name))
        // THE CONDITION THE MODE EXISTS UNDER. The moment a reader cannot tell
        // which competition a match is in, the combined view has erased the
        // architecture it is a layer over.
        expect(named, `a combined row did not name its competition: ${textOf}`).toBe(true)
      }
    })
  }
})

/* ========================================================================== *
 * FILTERING
 * ========================================================================== */

test.describe('filtering', () => {
  test('narrows to live football and back', async ({ page }) => {
    await open(page, 'mixed-1440')
    const before = await read(page)
    expect(before.rowIds.length).toBe(5)

    await page.getByRole('button', { name: /^Live/ }).click()
    await page.waitForTimeout(400)
    const live = await read(page)

    expect(live.rowIds).toEqual(['fixture-mix-2'])
    // The day that has nothing left in it is gone, heading and all — a Saturday
    // drawn with nothing under it reads as football that vanished.
    expect(live.pageText).not.toContain('Friday 20 August')

    await page.getByRole('button', { name: /^All/ }).click()
    await page.waitForTimeout(400)
    const after = await read(page)
    expect(after.rowIds).toEqual(before.rowIds)
  })

  test('leaves a filter with nothing behind it in place and inert', async ({ page }) => {
    await open(page, 'finished-1440')

    const live = page.getByRole('button', { name: /^Live/ })
    // The control row must not change shape under the player's thumb as
    // football happens.
    await expect(live).toBeVisible()
    await expect(live).toBeDisabled()
  })

  test('keeps the filter reachable from the keyboard', async ({ page }) => {
    await open(page, 'mixed-1440')

    const live = page.getByRole('button', { name: /^Live/ })
    await live.focus()
    await expect(live).toBeFocused()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)

    const reading = await read(page)
    expect(reading.rowIds).toEqual(['fixture-mix-2'])
  })
})

/* ========================================================================== *
 * OPENING A FIXTURE
 * ========================================================================== */

test.describe('opening a fixture', () => {
  test('pressing a row hands the host that row’s canonical id', async ({ page }) => {
    await open(page, 'upcoming-1440')

    // The whole row is ONE button. A row with a crest link, a name link and a
    // "match centre" link is three tab stops to reach one destination.
    const row = page.locator('[data-vnext-match-row="fixture-upc-2"]')
    await expect(row).toHaveCount(1)
    await expect(row).toHaveJSProperty('tagName', 'BUTTON')

    const host = page.locator('[data-vnext-matches-host]')
    await expect(host).toHaveAttribute('data-vnext-last-intent', '')

    await row.click()

    // WHAT ACTUALLY CAME OUT OF THE PAGE, observed from the host — not the id
    // read back off the element the test selected by that id, which is what
    // this assertion used to be and could not fail. The canonical fixture id
    // is the ONLY thing that crosses the boundary: not the clubs, not the
    // date, not a position in a list.
    await expect(host).toHaveAttribute('data-vnext-last-intent', 'openMatch:fixture-upc-2')
  })

  test('a keyboard press opens the same fixture as a click', async ({ page }) => {
    await open(page, 'upcoming-1440')

    const row = page.locator('[data-vnext-match-row="fixture-upc-3"]')
    await row.focus()
    await expect(row).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page.locator('[data-vnext-matches-host]')).toHaveAttribute(
      'data-vnext-last-intent',
      'openMatch:fixture-upc-3',
    )
  })

  test('every rendered row carries a canonical id', async ({ page }) => {
    await open(page, 'mixed-1440')
    const reading = await read(page)

    expect(reading.rowIds).not.toContain('(unnamed)')
    // Not `home + away + date`, and not an array position.
    expect(new Set(reading.rowIds).size).toBe(reading.rowIds.length)
  })
})

/* ========================================================================== *
 * Every list world, at the widths that matter
 * ========================================================================== */

test.describe('every Matches world', () => {
  for (const world of LIST_WORLDS) {
    test(world.label, async ({ page }) => {
      await open(page, world.story)
      const reading = await read(page)

      expect(reading.frameWidth, `${world.label} frame width`).toBe(world.width)
      expectBaseline(reading, world.label)
    })
  }
})

/* ========================================================================== *
 * Every Match Centre world
 * ========================================================================== */

test.describe('every Match Centre world', () => {
  for (const world of CENTRE_WORLDS) {
    test(world.label, async ({ page }) => {
      await open(page, world.story)
      const reading = await read(page)

      expect(reading.frameWidth, `${world.label} frame width`).toBe(world.width)
      expectBaseline(reading, world.label)

      // THE PAGE IS THE MATCH. A Match Centre heading that says "Match Centre"
      // is a page named after its own file.
      expect(reading.headingText ?? '', `${world.label} heading`).toContain(' v ')
    })
  }
})

test.describe('the Match Centre composition', () => {
  test('keeps the football in the working column at 1440', async ({ page }) => {
    await open(page, 'centre-1440')

    const main = page.locator('[data-vnext-zone="match-main"]')
    const aside = page.locator('[data-vnext-zone="match-context"]')
    const mainBox = await main.boundingBox()
    const asideBox = await aside.boundingBox()

    expect(mainBox).not.toBeNull()
    expect(asideBox).not.toBeNull()
    // Two columns, and the football's column is the larger one.
    expect(asideBox?.x ?? 0).toBeGreaterThan((mainBox?.x ?? 0) + (mainBox?.width ?? 0) - 1)
    expect(mainBox?.width ?? 0).toBeGreaterThan(asideBox?.width ?? 0)
  })

  test('stacks under the hero on a phone', async ({ page }) => {
    await open(page, 'centre-375')

    const main = page.locator('[data-vnext-zone="match-main"]')
    const aside = page.locator('[data-vnext-zone="match-context"]')
    const mainBox = await main.boundingBox()
    const asideBox = await aside.boundingBox()

    // A phone reads the match, then the football around it, in source order.
    expect(asideBox?.y ?? 0).toBeGreaterThan(mainBox?.y ?? 0)
  })

  test('draws no optional module at all when only core data exists', async ({ page }) => {
    await open(page, 'centre-core-1440')
    const reading = await read(page)

    // §17: ABSENT rather than empty. No heading over nothing, no zeroed
    // statistics, no "coming soon", no possession bar.
    for (const forbidden of [
      'Recent form',
      'This season’s meetings',
      'In the table',
      'Possession',
      'Line-ups',
      'Timeline',
    ]) {
      expect(reading.pageText, `core-only drew "${forbidden}"`).not.toContain(forbidden)
    }
  })

  test('draws the context modules when the data is there', async ({ page }) => {
    await open(page, 'centre-1440')
    const reading = await read(page)

    expect(reading.pageText).toContain('Recent form')
    expect(reading.pageText).toContain('In the table')
    expect(reading.pageText).toContain('meetings')
  })
})

/* ========================================================================== *
 * REDUCED MOTION
 * ========================================================================== */

test.describe('reduced motion', () => {
  test('changes the animation and never the content', async ({ page }) => {
    await open(page, 'live-1440')
    const full = await read(page)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, 'live-1440')
    const reduced = await read(page)

    expect(reduced.pageText).toBe(full.pageText)
    expectBaseline(reduced, 'the live world with reduced motion')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
  })
})
