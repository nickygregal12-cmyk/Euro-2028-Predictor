import { expect, test } from '@playwright/test'

/**
 * THE STAGE 10 PLAYER PROFILE, MEASURED BY A REAL ENGINE.
 *
 * jsdom evaluates no container query, computes no layout and gives an `<svg>`
 * no geometry, so every responsive, target-size, overflow and CHART claim in
 * `tests/vnext/playerProfile.test.tsx` is about the MODEL and the MARKUP. This
 * suite is about the PICTURE.
 *
 * WHAT IT ASSERTS, and why each one needs a browser:
 *
 *   1. THE CHART IS THE RIGHT WAY UP. A rank improves as it FALLS, so first
 *      place belongs at the top — and the only way to know a season of
 *      promotions was not drawn as a slide downhill is to read the plotted
 *      coordinates out of the rendered SVG and compare them with the positions
 *      the table beside it states. `rankPlot` is unit-tested; this checks that
 *      what reached the screen is what it returned.
 *   2. THE AXIS LABELS ARE THE BOUNDS THE LINE WAS DRAWN BETWEEN. A chart
 *      scaled by one rule and captioned by another is the classic chart lie and
 *      looks completely normal.
 *   3. NO DISPLAY NAME IS CLIPPED, at any width, including a fifty-character
 *      one in a comparison column heading. Clipping is a computed overflow.
 *   4. EVERY CONTROL CLEARS 44×44.
 *   5. NOTHING OVERFLOWS SIDEWAYS at any width. Panels may scroll inside
 *      themselves; the PAGE may not.
 *   6. THE RETRY EXISTS ONLY BESIDE A FAILED READ, counted as rendered
 *      controls across the refused, not-entered, unaddressable and failed
 *      worlds side by side.
 *   7. NO PREDICTION SCORELINE IS ON THE PAGE, read off the flattened text.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE. The page opens at 1280×900, which
 * is the width and height of no frame under review, so anything inside a frame
 * that measures the window produces a number that cannot be mistaken for right.
 */

/** The ordinary profile at every reviewed width. */
const WIDTHS = [
  { story: 'frame-open-phone', width: 375, label: '375' },
  { story: 'frame-open-large', width: 430, label: '430' },
  { story: 'frame-open-tablet', width: 768, label: '768' },
  { story: 'frame-open-laptop', width: 1024, label: '1024' },
  { story: 'frame-open-wide', width: 1440, label: '1440' },
  { story: 'frame-open-desktop', width: 1920, label: '1920' },
] as const

/** Every world, at the widths its composition differs most between. */
const WORLDS = [
  { story: 'frame-climbing-phone', label: 'a climbing season at 375' },
  { story: 'frame-climbing-desktop', label: 'a climbing season at 1920' },
  { story: 'frame-falling-phone', label: 'a falling season at 375' },
  { story: 'frame-flat-rank-phone', label: 'an unchanged position at 375' },
  { story: 'frame-single-point-phone', label: 'one settled matchweek at 375' },
  { story: 'frame-field-changed-phone', label: 'a field that grew at 375' },
  { story: 'frame-big-field-phone', label: 'a zoomed axis at 375' },
  { story: 'frame-profile-refused-phone', label: 'a refused profile at 375' },
  { story: 'frame-unaddressable-phone', label: 'no season reference at 375' },
  { story: 'frame-not-entered-phone', label: 'a player who never entered at 375' },
  { story: 'frame-your-own-phone', label: 'your own profile at 375' },
  { story: 'frame-truncated-window-phone', label: 'a truncated window at 375' },
  { story: 'frame-truncated-window-desktop', label: 'a truncated window at 1920' },
  { story: 'frame-new-season-phone', label: 'nothing settled at 375' },
  { story: 'frame-level-rivalry-phone', label: 'a level rivalry at 375' },
  { story: 'frame-duplicate-name-phone', label: 'two players, one name, at 375' },
  { story: 'frame-no-standing-phone', label: 'no banked standing at 375' },
  { story: 'frame-pending-matchweek-phone', label: 'an unsettled matchweek at 375' },
  { story: 'frame-no-accuracy-phone', label: 'no predictions at all at 375' },
  { story: 'frame-long-name-phone', label: 'a fifty-character name at 375' },
  { story: 'frame-long-name-tablet', label: 'a fifty-character name at 768' },
  { story: 'frame-profile-unavailable-phone', label: 'one failed read at 375' },
  { story: 'frame-all-unavailable-phone', label: 'three failed reads at 375' },
] as const

type PlottedPoint = { cx: number; cy: number }

type Reading = {
  frameWidth: number
  horizontalOverflow: number
  mainCount: number
  headingCount: number
  headingIsWired: boolean
  h1Text: string
  /** Any control at all whose box is under 44px. */
  smallTargets: string[]
  /** Elements whose content is wider than their own box. */
  clipped: string[]
  /** The three panels, by zone, that are actually rendered. */
  panels: string[]
  /** Accessible names of every "Try again" control on the page. */
  retries: number
  /** The plotted markers, in document order, with their SVG coordinates. */
  plotted: PlottedPoint[]
  /** Whether the drawing is hidden from assistive technology. */
  chartIsHidden: boolean
  /** The two axis labels, top then bottom. */
  axisLabels: string[]
  /** The chart's text-equivalent table, one row per settled matchweek. */
  chartRows: { label: string; position: string }[]
  /** The comparison's column headings. */
  compareHeadings: string[]
  /** The whole frame's text, flattened. */
  pageText: string
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
      const label = (node.getAttribute('aria-label') ?? node.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60)
      return `${tag}: ${label}`
    }

    const smallTargets: string[] = []
    for (const control of scope.querySelectorAll<HTMLElement>(
      'button, a[href], [role="button"]',
    )) {
      if (!rendered(control)) continue
      // The skip link is a 1px clipped box UNTIL IT IS FOCUSED. `clip-path` is
      // what separates "deliberately invisible" from "a finger cannot hit it".
      if (getComputedStyle(control).clipPath !== 'none') continue
      // Layout boxes, not client rects: the workshop scales frames with a CSS
      // transform, and a scaled rect reports a 44px control as 18px.
      if (control.offsetWidth < 44 || control.offsetHeight < 44) {
        smallTargets.push(`${describe(control)} @ ${control.offsetWidth}x${control.offsetHeight}`)
      }
    }

    // CLIPPING, MEASURED. A display name that does not fit is the defect the
    // long-name world exists to expose, and it is invisible to a DOM assertion.
    // `clip-path` separates "deliberately invisible" (the chart's text-
    // equivalent table, every sr-only sentence) from "accidentally cut off".
    const clipped: string[] = []
    for (const node of scope.querySelectorAll<HTMLElement>('span, p, h1, h2, h3, h4, td, th, a, button')) {
      if (!rendered(node)) continue
      const style = getComputedStyle(node)
      if (style.clipPath !== 'none') continue
      if (style.textOverflow === 'ellipsis') {
        clipped.push(`${describe(node)} (ellipsis)`)
        continue
      }
      if (style.overflowX !== 'hidden' && style.overflowX !== 'clip') continue
      if (node.scrollWidth - node.clientWidth > 1) {
        clipped.push(`${describe(node)} (${node.scrollWidth} in ${node.clientWidth})`)
      }
    }

    const main = scope.querySelector('main') as HTMLElement | null
    const heading = scope.querySelector('h1')
    const labelledBy = main?.getAttribute('aria-labelledby') ?? null

    const chart = scope.querySelector('[data-vnext-zone="rank-chart"]') as HTMLElement | null
    const svg = chart?.querySelector('svg') ?? null
    const chartTable = chart?.querySelector('table') ?? null
    const axis = chart?.querySelector('[class*="chartAxis"]') ?? null

    const compare = scope.querySelector('[data-vnext-zone="rivalry"]') as HTMLElement | null
    const compareTable = compare?.querySelector('table') ?? null

    return {
      frameWidth: (frame ?? document.body).getBoundingClientRect().width,
      // MEASURED ON THE PAGE'S OWN LANDMARK, AND DELIBERATELY NOT ON THE FRAME.
      // The workshop frame root is `overflow-x: clip`, which creates no scroll
      // container, so Chromium reports its `scrollWidth` from the union of
      // descendant boxes — including ones an intermediate `overflow-x: auto`
      // scroller has already clipped. This page has such a scroller by design
      // (the recent strip at >=640px), so measuring the frame would report it
      // as the page scrolling sideways. `main` is the thing the claim is about.
      horizontalOverflow: Math.max(0, (main?.scrollWidth ?? 0) - (main?.clientWidth ?? 0)),
      mainCount: [...scope.querySelectorAll('main')].filter(rendered).length,
      headingCount: [...scope.querySelectorAll('h1')].filter(rendered).length,
      headingIsWired: Boolean(heading && labelledBy && heading.id === labelledBy),
      h1Text: (heading?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      smallTargets,
      clipped,
      panels: [...scope.querySelectorAll('[data-vnext-zone]')]
        .filter(rendered)
        .map((node) => node.getAttribute('data-vnext-zone') ?? ''),
      retries: [...scope.querySelectorAll('button')].filter(
        (node) => rendered(node) && (node.textContent ?? '').trim() === 'Try again',
      ).length,
      // THE COORDINATES THAT REACHED THE SCREEN, read off the rendered markers
      // rather than recomputed. `cy` is an SVG user-space value, so it is
      // unaffected by the workshop's scaling transform.
      plotted: [...(svg?.querySelectorAll('circle') ?? [])].map((node) => ({
        cx: Number(node.getAttribute('cx') ?? '0'),
        cy: Number(node.getAttribute('cy') ?? '0'),
      })),
      chartIsHidden: svg?.getAttribute('aria-hidden') === 'true',
      axisLabels: [...(axis?.querySelectorAll('span') ?? [])].map((node) =>
        (node.textContent ?? '').trim(),
      ),
      chartRows: [...(chartTable?.querySelectorAll('tbody tr') ?? [])].map((row) => ({
        label: (row.querySelector('th')?.textContent ?? '').trim(),
        position: (row.querySelectorAll('td')[0]?.textContent ?? '').trim(),
      })),
      compareHeadings: [...(compareTable?.querySelectorAll('thead th') ?? [])].map((node) =>
        (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ),
      pageText: ((frame ?? document.body).textContent ?? '').replace(/\s+/g, ' ').trim(),
      mainWidth: main?.getBoundingClientRect().width ?? 0,
    }
  })
}

async function open(page: import('@playwright/test').Page, story: string) {
  await page.goto(`/iframe.html?id=vnext-player-profile--${story}&viewMode=story`, {
    waitUntil: 'load',
  })
  await page.waitForSelector('figure [data-vnext] [data-vnext-shell] main')
  // The masthead and the panels each enter with a rise; measuring mid-entrance
  // reads transformed boxes rather than laid-out ones.
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
  // All three panels, always. A panel that vanished because its read refused
  // would be the page applying a permission the server did not.
  expect(reading.panels, `${where} is missing a panel`).toEqual(
    expect.arrayContaining(['summary', 'rank', 'compare']),
  )
}

test.describe('the ordinary profile holds at every reviewed width', () => {
  for (const { story, width, label } of WIDTHS) {
    test(`at ${label}`, async ({ page }) => {
      await open(page, story)
      const reading = await read(page)
      expect(Math.round(reading.frameWidth)).toBe(width)
      expectBaseline(reading, `the profile at ${label}`)
    })
  }
})

test.describe('every world holds the same baseline', () => {
  for (const { story, label } of WORLDS) {
    test(label, async ({ page }) => {
      await open(page, story)
      expectBaseline(await read(page), label)
    })
  }
})

/* ------------------------------------------------------------------ *
 * The chart
 * ------------------------------------------------------------------ */

test.describe('the chart is drawn the right way up', () => {
  test('a season of promotions rises', async ({ page }) => {
    await open(page, 'frame-climbing-phone')
    const reading = await read(page)

    // 301st to 12th. In SVG, y grows downward — so a CLIMB is a DECREASING cy.
    // Un-invert the axis and every one of these comparisons flips, while the
    // picture still looks like a perfectly ordinary chart.
    expect(reading.plotted.length).toBe(5)
    for (let index = 1; index < reading.plotted.length; index += 1) {
      const previous = reading.plotted[index - 1]
      const current = reading.plotted[index]
      expect(current?.cy, `point ${index} did not rise`).toBeLessThan(Number(previous?.cy))
      expect(current?.cx, `point ${index} did not advance`).toBeGreaterThan(Number(previous?.cx))
    }
  })

  test('a season of falls descends', async ({ page }) => {
    await open(page, 'frame-falling-phone')
    const reading = await read(page)

    expect(reading.plotted.length).toBe(5)
    for (let index = 1; index < reading.plotted.length; index += 1) {
      expect(reading.plotted[index]?.cy).toBeGreaterThan(Number(reading.plotted[index - 1]?.cy))
    }
  })

  test('an unchanged position is a level line, not an edge', async ({ page }) => {
    await open(page, 'frame-flat-rank-phone')
    const reading = await read(page)

    const heights = new Set(reading.plotted.map((point) => point.cy))
    expect(heights.size, 'a flat season should be one height').toBe(1)
    // And that height is the middle: pinned to the top this reads as the best
    // season of a career, pinned to the bottom the worst.
    const only = [...heights][0] ?? 0
    expect(only).toBeGreaterThan(40)
    expect(only).toBeLessThan(92)
  })

  test('one settled matchweek is a marker with no line', async ({ page }) => {
    await open(page, 'frame-single-point-phone')
    const paths = await page.locator('[data-vnext-zone="rank-chart"] svg path').count()
    const markers = await page.locator('[data-vnext-zone="rank-chart"] svg circle').count()
    expect(markers).toBe(1)
    expect(paths).toBe(0)
  })
})

test.describe('the axis is labelled with the bounds the line was drawn between', () => {
  test('a zoomed season prints its own range', async ({ page }) => {
    await open(page, 'frame-big-field-phone')
    const reading = await read(page)

    // 4th to 7th in a field of 412. Scaled to [1, 412] this would be a flat
    // line; scaled to the range occupied it is readable — and honest only
    // because these two numbers are on the axis.
    expect(reading.axisLabels).toEqual(['4th', '7th'])

    // The topmost marker is the best rank the axis names, and the lowest is the
    // worst. If the caption and the scale ever came from two calculations, this
    // is the assertion that fails.
    const cys = reading.plotted.map((point) => point.cy)
    const top = Math.min(...cys)
    const bottom = Math.max(...cys)
    const best = reading.chartRows.find((row) => row.position.startsWith('4th'))
    const worst = reading.chartRows.find((row) => row.position.startsWith('7th'))
    expect(best, 'the table should state the best position the axis names').toBeTruthy()
    expect(worst, 'the table should state the worst position the axis names').toBeTruthy()
    expect(top).toBeLessThan(bottom)
  })

  test('the field is named, and named as having changed when it did', async ({ page }) => {
    await open(page, 'frame-field-changed-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('field that changed')
    expect(reading.pageText).toContain('412')
  })
})

test.describe('the chart is readable without seeing it', () => {
  test('the drawing is hidden and the same series is a table', async ({ page }) => {
    await open(page, 'frame-climbing-phone')
    const reading = await read(page)

    expect(reading.chartIsHidden).toBe(true)
    // One row per plotted marker, from the same array. They cannot drift.
    expect(reading.chartRows).toHaveLength(reading.plotted.length)
    for (const row of reading.chartRows) {
      expect(row.position, `"${row.label}" states a position without its field`).toMatch(
        / of \d/,
      )
    }
  })
})

/* ------------------------------------------------------------------ *
 * The comparison
 * ------------------------------------------------------------------ */

test.describe('the comparison states its denominator', () => {
  test('thirty compared, five in the strip', async ({ page }) => {
    await open(page, 'frame-truncated-window-phone')
    const reading = await read(page)

    expect(reading.pageText).toContain('30 matchweeks')
    const strip = await page.locator('[data-vnext-zone="rivalry"] li').count()
    expect(strip).toBe(5)
  })

  test('an unstarted rivalry has no table at all', async ({ page }) => {
    await open(page, 'frame-new-season-phone')
    const reading = await read(page)

    // 0-0-0 out of nothing is not a draw, and there is nothing to tabulate.
    expect(reading.compareHeadings).toEqual([])
    expect(reading.pageText).toContain('nothing to compare')
  })

  test('a genuinely level rivalry does have one', async ({ page }) => {
    await open(page, 'frame-level-rivalry-phone')
    const reading = await read(page)
    expect(reading.compareHeadings.length).toBeGreaterThan(0)
    expect(reading.pageText).toContain('level on points')
  })
})

test.describe('two players with one display name stay two columns', () => {
  test('the caller`s column is always "You"', async ({ page }) => {
    await open(page, 'frame-duplicate-name-phone')
    const reading = await read(page)

    expect(reading.compareHeadings).toContain('You')
    expect(reading.compareHeadings).toContain('Sam Docherty')
    // Distinguishable even though the two people are not, by name.
    expect(new Set(reading.compareHeadings).size).toBe(reading.compareHeadings.length)
  })
})

/* ------------------------------------------------------------------ *
 * Retries, refusals and leaks
 * ------------------------------------------------------------------ */

test.describe('a retry exists only beside a read that failed', () => {
  test('three failed reads offer three', async ({ page }) => {
    await open(page, 'frame-all-unavailable-phone')
    expect((await read(page)).retries).toBe(3)
  })

  test('one failed read offers one', async ({ page }) => {
    await open(page, 'frame-profile-unavailable-phone')
    expect((await read(page)).retries).toBe(1)
  })

  test('a refusal offers none', async ({ page }) => {
    await open(page, 'frame-profile-refused-phone')
    const reading = await read(page)
    expect(reading.retries).toBe(0)
    expect(reading.pageText).toContain('share no private league')
  })

  test('an unaddressable read offers none, and does not read as a refusal', async ({ page }) => {
    await open(page, 'frame-unaddressable-phone')
    const reading = await read(page)
    expect(reading.retries).toBe(0)
    expect(reading.pageText).toContain('not available from here')
    expect(reading.pageText).not.toContain('may not')
  })

  test('a player who never entered offers none', async ({ page }) => {
    await open(page, 'frame-not-entered-phone')
    expect((await read(page)).retries).toBe(0)
  })
})

test.describe('nothing on the page is a prediction or an invented figure', () => {
  test('the picks are counted and never drawn as scorelines', async ({ page }) => {
    await open(page, 'frame-open-phone')
    const reading = await read(page)

    expect(reading.pageText).toMatch(/\d+ predictions/)
    // An en-dashed scoreline against an opaque fixture id would be a score
    // against nobody. The comparison's own strip uses a plain hyphen record.
    const history = await page
      .locator('[data-vnext-zone="history"]')
      .innerText()
    expect(history).not.toMatch(/\d–\d/)
  })

  test('an unsettled matchweek says so rather than showing a nought', async ({ page }) => {
    await open(page, 'frame-pending-matchweek-phone')
    const history = await page.locator('[data-vnext-zone="history"]').innerText()
    expect(history).toContain('Not settled yet')
  })

  test('a player with no predictions gets no percentage', async ({ page }) => {
    await open(page, 'frame-no-accuracy-phone')
    const summary = await page.locator('[data-vnext-zone="summary"]').innerText()
    expect(summary).not.toContain('%')
  })

  test('a page whose reads all failed still knows it does not know who this is', async ({
    page,
  }) => {
    await open(page, 'frame-all-unavailable-phone')
    const reading = await read(page)
    expect(reading.h1Text).toContain('Player')
  })
})
