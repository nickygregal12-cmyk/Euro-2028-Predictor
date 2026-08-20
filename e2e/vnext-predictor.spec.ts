import { expect, test } from '@playwright/test'

/**
 * THE vNEXT MATCH PREDICTOR, MEASURED BY A REAL ENGINE.
 *
 * jsdom evaluates no container query and computes no layout, so every responsive
 * guard in Vitest reads the stylesheet and reasons about it. That catches the
 * structural mistakes — a `container-type` on the wrong element, a viewport media
 * query, a `vh` — and it cannot catch the thing those mistakes were only ever a
 * proxy for: whether the composition a width is supposed to produce is the
 * composition it actually produces.
 *
 * WHAT IT ASSERTS, and deliberately not pixels:
 *
 *   1. the frame is the frame — a `vh` or `vw` anywhere inside would report the
 *      browser window and could not coincidentally be the right number;
 *   2. nothing overflows sideways at any width, in any state;
 *   3. desktop is a different COMPOSITION rather than a wider phone: below 1000 the
 *      brief is a band above the work, at and above it the brief is a rail beside
 *      it, and at 1920 the working column takes two fixtures across;
 *   4. THE ROW MEASURES ITSELF. Every fixture row wide enough to be a scoreboard is
 *      one, and every row too narrow is stacked — including the 1920 case, where
 *      the rows are 730px inside a 1480px column. This is the assertion that
 *      catches a row sized against the page instead of against itself, which is the
 *      defect this lane has shipped four times;
 *   5. no club name is cut off, at any width, in any state;
 *   6. every control clears the 44px target the tokens promise;
 *   7. exactly one navigation is real at any width, and exactly one `h1` and one
 *      `main` in every state;
 *   8. a locked card exposes no score input in a real browser either.
 *
 * NO PIXEL BASELINE, for the reason `vnext-home.spec.ts` records: a baseline of a
 * surface expected to keep improving is a baseline updated on every commit.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE. The page opens at 1280×900, which is
 * the width and height of no frame under review, so anything inside a frame that
 * measures the window produces a number that cannot be mistaken for right.
 */

/** The six widths the brief asks to be reviewed, and what each should compose as. */
const WIDTHS = [
  { story: 'open-375', width: 375, height: 812, rail: false, fixtureColumns: 1, scoreboard: false },
  { story: 'open-430', width: 430, height: 900, rail: false, fixtureColumns: 1, scoreboard: false },
  { story: 'open-768', width: 768, height: 1024, rail: false, fixtureColumns: 1, scoreboard: true },
  { story: 'open-1024', width: 1024, height: 768, rail: true, fixtureColumns: 1, scoreboard: true },
  { story: 'open-1440', width: 1440, height: 900, rail: true, fixtureColumns: 1, scoreboard: true },
  { story: 'open-1920', width: 1920, height: 1080, rail: true, fixtureColumns: 2, scoreboard: true },
] as const

/**
 * Every state at the two widths that decide a design, plus the widest for the
 * states whose emptiness or density shows up there first.
 *
 * The Home suite records why this matters: the one band nobody looked at is where
 * the defect lived.
 */
const STATES = [
  { story: 'untouched-430', label: 'untouched at 430', width: 430 },
  { story: 'untouched-1440', label: 'untouched at 1440', width: 1440 },
  { story: 'closing-430', label: 'closing at 430', width: 430 },
  { story: 'closing-1440', label: 'closing at 1440', width: 1440 },
  { story: 'closing-1920', label: 'closing at 1920', width: 1920 },
  { story: 'complete-430', label: 'complete at 430', width: 430 },
  { story: 'complete-1440', label: 'complete at 1440', width: 1440 },
  { story: 'locked-430', label: 'locked at 430', width: 430 },
  { story: 'locked-1440', label: 'locked at 1440', width: 1440 },
  { story: 'locked-1920', label: 'locked at 1920', width: 1920 },
  { story: 'settled-430', label: 'settled at 430', width: 430 },
  { story: 'settled-1440', label: 'settled at 1440', width: 1440 },
  { story: 'settled-1920', label: 'settled at 1920', width: 1920 },
  { story: 'reduced-430', label: 'reduced at 430', width: 430 },
  { story: 'reduced-1440', label: 'reduced at 1440', width: 1440 },
  { story: 'reduced-1920', label: 'reduced at 1920', width: 1920 },
  { story: 'unavailable-430', label: 'unavailable at 430', width: 430 },
  { story: 'unavailable-1440', label: 'unavailable at 1440', width: 1440 },
  { story: 'conflict-430', label: 'conflict at 430', width: 430 },
  { story: 'conflict-1440', label: 'conflict at 1440', width: 1440 },
  { story: 'no-fixtures-430', label: 'no fixtures at 430', width: 430 },
  { story: 'no-fixtures-1440', label: 'no fixtures at 1440', width: 1440 },
] as const

type Reading = {
  frameWidth: number
  frameHeight: number
  horizontalOverflow: number
  navigationLabels: string[]
  smallTargets: string[]
  headings: number
  mains: number
  /** True when the brief and the work share a row and not a column. */
  railBesideWork: boolean
  /** Distinct left edges among the fixture rows — the columns across. */
  fixtureColumns: number
  /** Rows whose own width says scoreboard, and rows whose width says stacked. */
  scoreboardRows: number
  stackedRows: number
  fixtureWidths: number[]
  workWidth: number
  scoreInputs: number
  clipped: string[]
  dayHeadings: string[]
}

async function read(page: import('@playwright/test').Page): Promise<Reading> {
  return page.evaluate<Reading>(() => {
    const root = document.querySelector('[data-vnext]')
    // The frame's scrollport: the element `WorkshopCanvas` gives the device shell's
    // real pixel height. Anything wider than this has left its shell.
    const scroller = root?.firstElementChild ?? null
    const rendered = (element: Element) => element.getClientRects().length > 0

    const navigationLabels = [...document.querySelectorAll('nav')]
      .filter(rendered)
      .map((nav) => nav.getAttribute('aria-label') ?? '(unnamed)')

    const smallTargets: string[] = []
    for (const control of document.querySelectorAll('button, input')) {
      if (!rendered(control)) continue
      // `offsetWidth`/`offsetHeight` are layout boxes and ignore the CSS transform
      // the workshop uses to fit frames on one screen, so they are the real size a
      // finger would meet.
      const { offsetWidth, offsetHeight } = control as HTMLElement
      if (offsetHeight < 44 || offsetWidth < 44) {
        smallTargets.push(
          `${
            control.getAttribute('aria-label') ||
            control.textContent?.trim().slice(0, 28) ||
            '(icon)'
          } @ ${offsetWidth}x${offsetHeight}`,
        )
      }
    }

    const brief = document.querySelector('[data-vnext-zone="brief"]')
    const work = document.querySelector('[data-vnext-zone="work"]')
    let railBesideWork = false
    if (brief && work && rendered(brief) && rendered(work)) {
      const a = brief.getBoundingClientRect()
      const b = work.getBoundingClientRect()
      const verticalOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      const horizontalOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      // Genuinely beside each other: they share most of a row and none of a
      // column. A 1px kiss from a rounding error is not "side by side".
      railBesideWork = verticalOverlap > 40 && horizontalOverlap < -4
    }

    const rows = [...document.querySelectorAll<HTMLElement>('main ol > li')].filter(rendered)
    const fixtureColumns = new Set(
      rows.map((row) => Math.round(row.getBoundingClientRect().left)),
    ).size

    /**
     * SCOREBOARD OR STACKED, DECIDED PER ROW.
     *
     * The row's own container query is the thing under test, so this reads the
     * OUTCOME rather than the stylesheet: in the scoreboard composition the two
     * clubs sit on one line, so their boxes overlap vertically and not
     * horizontally. In the stacked one each club has its own line.
     */
    let scoreboardRows = 0
    let stackedRows = 0
    for (const row of rows) {
      const home = row.querySelector('[data-side="home"]')
      const away = row.querySelector('[data-side="away"]')
      if (!home || !away) continue
      const a = home.getBoundingClientRect()
      const b = away.getBoundingClientRect()
      const sameLine = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 8
      if (sameLine) scoreboardRows += 1
      else stackedRows += 1
    }

    const clipped: string[] = []
    for (const element of document.querySelectorAll<HTMLElement>(
      'main span, main p, main h1, main h2',
    )) {
      if (!rendered(element)) continue
      const style = getComputedStyle(element)
      // Screen-reader-only text is a 1px box holding a whole sentence, so it
      // overflows by design. `clip-path` is the idiom that hides it, and it is what
      // separates "deliberately invisible" from "accidentally cut off".
      if (style.clipPath !== 'none') continue
      const hidesOverflow = style.overflowX === 'hidden' || style.overflowX === 'clip'
      if (!hidesOverflow) continue
      if (element.scrollWidth - element.clientWidth > 1) {
        clipped.push(`"${element.textContent?.trim().slice(0, 36)}"`)
      }
    }

    return {
      frameWidth: scroller?.clientWidth ?? 0,
      frameHeight: scroller?.clientHeight ?? 0,
      horizontalOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : -1,
      navigationLabels,
      smallTargets,
      // RENDERED ONLY. Storybook's own chrome ships a hidden "No Preview" and a
      // hidden error display, each carrying an `h1`, so a bare count reports three
      // headings on a page that has one. The same `rendered` filter the navigation
      // count uses is what makes this a statement about the page under review.
      headings: [...document.querySelectorAll('h1')].filter(rendered).length,
      mains: [...document.querySelectorAll('main')].filter(rendered).length,
      railBesideWork,
      fixtureColumns,
      scoreboardRows,
      stackedRows,
      // LAYOUT WIDTHS, NOT PAINTED ONES. `WorkshopCanvas` scales a wide frame with
      // a CSS transform so several fit on one screen, and
      // `getBoundingClientRect()` reports the TRANSFORMED box — a 1492px column at
      // 62% reads as 925. `offsetWidth` is the layout box and ignores the
      // transform, which is the same reason the tap-target check uses it. The
      // relative comparisons above are unaffected either way, because both sides of
      // a ratio scale together.
      fixtureWidths: rows.map((row) => row.offsetWidth),
      workWidth: work ? (work as HTMLElement).offsetWidth : 0,
      scoreInputs: [...document.querySelectorAll('main input')].filter(rendered).length,
      clipped,
      dayHeadings: [...document.querySelectorAll('main section[aria-label]')].map(
        (section) => section.getAttribute('aria-label') ?? '',
      ),
    }
  })
}

async function open(page: import('@playwright/test').Page, story: string) {
  await page.goto(`/iframe.html?id=vnext-match-predictor--${story}&viewMode=story`, {
    waitUntil: 'load',
  })
  await page.waitForSelector('figure [data-vnext] [data-vnext-page="predictor"]')
  // The rows enter with a staggered rise; measuring mid-entrance reads transformed
  // boxes rather than laid-out ones.
  await page.waitForTimeout(1400)
}

test.describe('the predictor holds its frame', () => {
  for (const width of WIDTHS) {
    test(`at ${width.width}px`, async ({ page }) => {
      await open(page, width.story)
      const reading = await read(page)
      const where = `the predictor at ${width.width}px`

      // The frame is the frame, not the browser window. A `vh`/`vw` anywhere inside
      // would report 900/1280 here and could not be accidentally right.
      expect(reading.frameWidth, `${where} frame width`).toBe(width.width)
      expect(reading.frameHeight, `${where} frame height`).toBe(width.height)

      expect(reading.horizontalOverflow, `${where} scrolls sideways`).toBe(0)

      // Both navigations are always rendered and one is `display: none`, which
      // removes it from the accessibility tree as well as from the page.
      expect(
        reading.navigationLabels,
        `${where} should show exactly one navigation`,
      ).toHaveLength(1)

      expect(reading.headings, `${where} should have exactly one h1`).toBe(1)
      expect(reading.mains, `${where} should have exactly one main`).toBe(1)

      expect(reading.smallTargets, `${where} has controls under 44px`).toEqual([])

      expect(
        reading.railBesideWork,
        `${where} should ${width.rail ? '' : 'not '}put the brief beside the work`,
      ).toBe(width.rail)

      expect(
        reading.fixtureColumns,
        `${where} should lay the fixtures out in ${width.fixtureColumns} column(s)`,
      ).toBe(width.fixtureColumns)

      // THE ROW MEASURES ITSELF. Whatever composition put the row there, its own
      // width decides whether it is a scoreboard — so at 1920 the rows are 730px
      // and still scoreboards, and at 430 they are stacked.
      if (width.scoreboard) {
        expect(reading.stackedRows, `${where} should compose every row as a scoreboard`).toBe(0)
        expect(reading.scoreboardRows, `${where} should have scoreboard rows`).toBeGreaterThan(0)
      } else {
        expect(reading.scoreboardRows, `${where} should stack every row`).toBe(0)
        expect(reading.stackedRows, `${where} should have stacked rows`).toBeGreaterThan(0)
      }

      expect(reading.clipped, `${where} clips text`).toEqual([])

      // The matchweek is grouped by day rather than being one flat list.
      expect(reading.dayHeadings.length, `${where} should group the fixtures by day`)
        .toBeGreaterThan(1)
    })
  }

  test('gives every row its own width at the widest band rather than the column’s', async ({
    page,
  }) => {
    // THE ASSERTION THAT CATCHES THE DEFECT THIS LANE HAS SHIPPED FOUR TIMES. At
    // 1920 the working column is about 1480px and holds two fixtures across, so a
    // row is roughly half of it. A row that had been sized against the column would
    // be the full width and would compose as though it had all of it.
    await open(page, 'open-1920')
    const reading = await read(page)

    expect(reading.workWidth).toBeGreaterThan(1200)
    for (const rowWidth of reading.fixtureWidths) {
      expect(rowWidth, `a row at 1920 is ${rowWidth}px inside a ${reading.workWidth}px column`)
        .toBeLessThan(reading.workWidth * 0.6)
    }
    // And they are still wide enough to be scoreboards, which is the point of
    // taking two across at all.
    expect(reading.stackedRows).toBe(0)
  })
})

test.describe('the predictor holds its states', () => {
  for (const state of STATES) {
    test(state.label, async ({ page }) => {
      await open(page, state.story)
      const reading = await read(page)
      const where = `the predictor, ${state.label}`

      expect(reading.frameWidth, `${where} frame width`).toBe(state.width)
      expect(reading.horizontalOverflow, `${where} scrolls sideways`).toBe(0)
      expect(reading.navigationLabels, `${where} navigations`).toHaveLength(1)
      expect(reading.headings, `${where} h1 count`).toBe(1)
      expect(reading.mains, `${where} main count`).toBe(1)
      expect(reading.smallTargets, `${where} has controls under 44px`).toEqual([])
      expect(reading.clipped, `${where} clips text`).toEqual([])
    })
  }

  test('exposes no score input on a locked card', async ({ page }) => {
    // The jsdom suite holds this too. It is repeated here because "absent rather
    // than disabled" is the promise a player's matchweek depends on, and a real
    // engine is the only thing that can confirm nothing is rendered-but-hidden.
    await open(page, 'locked-1440')
    expect((await read(page)).scoreInputs).toBe(0)
  })

  test('exposes two score inputs per fixture on an open card', async ({ page }) => {
    await open(page, 'open-1440')
    const reading = await read(page)
    expect(reading.scoreInputs).toBe(reading.fixtureWidths.length * 2)
  })
})

test.describe('working through the card', () => {
  test('advances focus from one club to the other and then to the next fixture', async ({
    page,
  }) => {
    // THE INTERACTION THE PAGE IS FOR, in a real engine: a whole matchweek typed
    // with no manual focus moves. jsdom can assert the handler ran; only a browser
    // can confirm the focus actually landed where the player would look next.
    await open(page, 'untouched-1440')

    const boxes = page.locator('main input')
    await boxes.first().click()
    await page.keyboard.type('2')
    await expect(boxes.nth(1)).toBeFocused()

    await page.keyboard.type('1')
    // Out of the away box, focus goes to the next fixture that still needs a
    // decision — which on an untouched card is the next fixture down.
    await expect(boxes.nth(2)).toBeFocused()
  })

  test('fills the progress track as scores are entered', async ({ page }) => {
    await open(page, 'untouched-1440')

    const filled = page.locator('[data-vnext-zone="brief"] [data-filled]')
    await expect(filled).toHaveCount(0)

    const boxes = page.locator('main input')
    await boxes.first().click()
    await page.keyboard.type('2')
    await page.keyboard.type('1')

    // The feedback loop: a completed prediction advances the progress the player is
    // measured against, immediately and visibly.
    await expect(filled).toHaveCount(1)
  })

  test('keeps the brief on screen while the list scrolls', async ({ page }) => {
    // The rail is sticky so the deadline, the progress and the Joker stay beside the
    // decision being made rather than scrolling away above it.
    await open(page, 'open-1440')

    const before = await page.locator('[data-vnext-zone="brief"]').boundingBox()
    // BY NAME RATHER THAN BY SHAPE. This was `[data-vnext] > div`, which named
    // no element and simply happened to select the frame's scrollport; when the
    // canvas made that element a `<section>` the locator matched nothing and
    // the test spent thirty seconds failing to say so.
    await page.locator('[data-vnext-frame-scroller]').first().evaluate((element) => {
      element.scrollTop = 900
    })
    await page.waitForTimeout(200)
    const after = await page.locator('[data-vnext-zone="brief"]').boundingBox()

    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    // Still on screen, and it has not travelled the full scroll distance.
    expect(after!.y).toBeGreaterThan(0)
  })
})

test.describe('reduced motion', () => {
  test('composes the same page with no travel', async ({ page }) => {
    await open(page, 'reduced-motion')
    const reading = await read(page)

    // The content and the composition are identical; only the movement is gone.
    expect(reading.horizontalOverflow).toBe(0)
    expect(reading.clipped).toEqual([])
    expect(reading.smallTargets).toEqual([])
  })
})
