import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * vNEXT HOME, MEASURED BY A REAL ENGINE.
 *
 * jsdom evaluates no container query and computes no layout, so every vNext
 * responsive guard in Vitest reads the stylesheet and reasons about it. That
 * catches the structural mistakes — a `container-type` on the wrong element, a
 * viewport media query, a `vh` — and it cannot catch the thing those mistakes
 * were only ever a proxy for: whether the composition a width is supposed to
 * produce is the composition it actually produces.
 *
 * This suite replaces `vnext-workshop-layout.spec.ts`, which measured
 * `AppFrame`. That frame has been removed — four out of four real compositions
 * declined it — and the measurement technique it was carrying is the part worth
 * keeping, so it now runs against the surface the product is actually going to
 * ship.
 *
 * WHAT IT ASSERTS is the structural contract, and deliberately not pixels:
 *
 *   1. the frame is the frame — a `vh` or `vw` anywhere inside would report the
 *      browser window and could not coincidentally be the right number;
 *   2. nothing overflows sideways at any width, in any emphasis — the single
 *      most common way a desktop-first composition announces itself;
 *   3. desktop is a different COMPOSITION rather than a wider phone: at 430 the
 *      zones are stacked, at 1440 at least one pair sits side by side, and at
 *      1920 the competitive module has its own column;
 *   4. exactly one navigation is real at any width, so there is never a
 *      duplicate landmark or a focus stop nobody can see;
 *   5. every control clears the 44px target the tokens promise;
 *   6. the three emphases are the SAME shell — same masthead, same score bar,
 *      same navigation — with a different dominant zone.
 *
 * NO PIXEL BASELINE. A baseline of a surface that is expected to keep improving
 * is a baseline updated on every commit, which is a baseline that holds
 * nothing. `visual-gallery.spec.ts` is where images are compared, and it
 * compares the legacy design system, not this.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE. The page opens at 1280×900, which
 * is the width and height of no frame under review, so anything inside a frame
 * that measures the window produces a number that cannot be mistaken for right.
 */

const WIDTHS = [
  { story: 'live-matchday-375', width: 375, height: 812, columns: 1 },
  { story: 'live-matchday-430', width: 430, height: 900, columns: 1 },
  { story: 'live-matchday-768', width: 768, height: 1024, columns: 2 },
  { story: 'live-matchday-1440', width: 1440, height: 900, columns: 2 },
  { story: 'live-matchday-1920', width: 1920, height: 1080, columns: 3 },
] as const

/**
 * Every emphasis at every band that composes differently — INCLUDING the widest.
 *
 * The first version of this matrix stopped at 1440 for everything except live,
 * which meant the >=1560 composition was asserted for one emphasis out of three.
 * That is where competition grew a column it never filled: the defect lived in
 * the one band no test looked at. A composition that is only measured in the
 * state its author happened to review is not measured.
 */
const EMPHASES = [
  { story: 'live-matchday-430', label: 'live at 430', width: 430 },
  { story: 'live-matchday-1440', label: 'live at 1440', width: 1440 },
  { story: 'live-matchday-1920', label: 'live at 1920', width: 1920 },
  { story: 'decision-430', label: 'decision at 430', width: 430 },
  { story: 'decision-1440', label: 'decision at 1440', width: 1440 },
  { story: 'decision-1920', label: 'decision at 1920', width: 1920 },
  { story: 'competition-430', label: 'competition at 430', width: 430 },
  { story: 'competition-1440', label: 'competition at 1440', width: 1440 },
  { story: 'competition-1920', label: 'competition at 1920', width: 1920 },
  { story: 'new-season-430', label: 'new season at 430', width: 430 },
  { story: 'new-season-1440', label: 'new season at 1440', width: 1440 },
  { story: 'new-season-1920', label: 'new season at 1920', width: 1920 },
  // Stage 6's reduced state, where every figure the real application cannot
  // supply is null at once. It is measured at the same three widths as the other
  // edge state, because the place a missing figure breaks a layout is a column
  // that collapsed — and a collapsed column is only visible next to a row that
  // did not collapse.
  { story: 'reduced-430', label: 'reduced at 430', width: 430 },
  { story: 'reduced-1440', label: 'reduced at 1440', width: 1440 },
  { story: 'reduced-1920', label: 'reduced at 1920', width: 1920 },
] as const

type Reading = {
  frameWidth: number
  frameHeight: number
  /** The container Home answers: the frame minus the shell's own rail. */
  mainWidth: number
  horizontalOverflow: number
  navigationLabels: string[]
  smallTargets: string[]
  zones: string[]
  /** Pairs of zones sharing vertical space but not horizontal: `a|b`. */
  sideBySide: string[]
  /** Distinct left edges among the body zones — the column count. */
  bodyColumns: number
  /** Tracks the body grid DECLARES, which is not the same as tracks it fills. */
  declaredColumns: number
  /** Gap between the rightmost body zone and the body's own content edge. */
  rightGap: number
  emphasis: string | null
  clipped: string[]
}

async function read(page: import('@playwright/test').Page): Promise<Reading> {
  return page.evaluate<Reading>(() => {
    const root = document.querySelector('[data-vnext]')
    // The frame's scrollport: the element `WorkshopCanvas` gives the device
    // shell's real pixel height. Anything wider than this has left its shell.
    const scroller = root?.firstElementChild ?? null
    const rendered = (element: Element) => element.getClientRects().length > 0

    const navigationLabels = [...document.querySelectorAll('nav')]
      .filter(rendered)
      .map((nav) => nav.getAttribute('aria-label') ?? '(unnamed)')

    const smallTargets: string[] = []
    for (const control of document.querySelectorAll('button')) {
      if (!rendered(control)) continue
      // `offsetWidth`/`offsetHeight` are layout boxes and ignore the CSS
      // transform the workshop uses to fit frames on one screen, so they are
      // the real size a finger would meet.
      const { offsetWidth, offsetHeight } = control as HTMLElement
      if (offsetHeight < 44 || offsetWidth < 44) {
        smallTargets.push(
          `${control.textContent?.trim().slice(0, 28) || '(icon)'} @ ${offsetWidth}x${offsetHeight}`,
        )
      }
    }

    const zoneElements = [...document.querySelectorAll('[data-vnext-zone]')].filter(
      rendered,
    )
    const boxes = zoneElements.map((element) => ({
      name: element.getAttribute('data-vnext-zone') ?? '?',
      box: element.getBoundingClientRect(),
    }))

    const sideBySide: string[] = []
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]
        const b = boxes[j]
        if (a === undefined || b === undefined) continue
        const verticalOverlap =
          Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top)
        const horizontalOverlap =
          Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left)
        // Genuinely beside each other: they share most of a row and none of a
        // column. A 1px kiss from a rounding error is not "side by side".
        if (verticalOverlap > 40 && horizontalOverlap < -4) {
          sideBySide.push(`${a.name}|${b.name}`)
        }
      }
    }

    const bodyZones = boxes.filter((entry) =>
      ['stage', 'grounds', 'social'].includes(entry.name),
    )
    const bodyColumns = new Set(bodyZones.map((entry) => Math.round(entry.box.left)))
      .size

    /**
     * The body grid as DECLARED, and how far its content actually reaches.
     *
     * A grid keeps every track it declares whether or not an area is ever placed
     * into one. Competition emphasis places two areas; if it inherits the wide
     * three-track rule it silently grows a 340px column nothing fills, and the
     * page stops a fifth short of its own right edge while the masthead, score
     * bar and action banner still span the full width. Nothing overflows and
     * nothing clips, so every other measurement in this file stays green — which
     * is exactly why the declared count is measured against the filled count.
     */
    const bodyElement = zoneElements
      .find((element) => element.getAttribute('data-vnext-zone') === 'stage')
      ?.parentElement ?? null
    const bodyStyle = bodyElement ? getComputedStyle(bodyElement) : null
    const declaredColumns = bodyStyle
      ? bodyStyle.gridTemplateColumns.split(/\s+/).filter(Boolean).length
      : 0

    // `padding-inline` lives on the body itself, so the content edge — the edge
    // a zone is entitled to reach — is the border box minus that padding.
    let rightGap = 0
    if (bodyElement && bodyStyle && bodyZones.length > 0) {
      const contentRight =
        bodyElement.getBoundingClientRect().right -
        Number.parseFloat(bodyStyle.paddingRight || '0')
      const rightmost = Math.max(...bodyZones.map((entry) => entry.box.right))
      rightGap = Math.round(contentRight - rightmost)
    }

    /**
     * A club, player or league name that has been cut off.
     *
     * `scrollWidth > clientWidth` inside a box that hides its overflow is the
     * engine saying the string did not fit. Names are the thing this page keeps
     * getting wrong at a new width — Stage 3 shipped the same defect three
     * times — so they are measured rather than eyeballed.
     *
     * The check is on OVERFLOW rather than on `text-overflow: ellipsis`,
     * because the fix for a clipped name is usually to stop ellipsising it. A
     * guard that only watched ellipsised elements would go quiet the moment the
     * defect was worked around instead of fixed.
     */
    const clipped: string[] = []
    for (const element of document.querySelectorAll<HTMLElement>(
      '[data-vnext-zone] span, [data-vnext-zone] p, [data-vnext-zone] h1',
    )) {
      if (!rendered(element)) continue
      const style = getComputedStyle(element)
      // Screen-reader-only text is a 1px box holding a whole sentence, so it
      // overflows by design. `clip-path` is the idiom that hides it, and it is
      // what separates "deliberately invisible" from "accidentally cut off".
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
      // The CONTAINER Home answers, which since Stage 7.6 is the frame minus
      // the application shell's competition rail rather than the frame itself.
      mainWidth:
        (document.querySelector('figure [data-vnext] main') as HTMLElement | null)
          ?.offsetWidth ?? 0,
      horizontalOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : -1,
      navigationLabels,
      smallTargets,
      zones: boxes.map((entry) => entry.name),
      sideBySide,
      bodyColumns,
      declaredColumns,
      rightGap,
      emphasis:
        document
          .querySelector('[data-vnext-emphasis]')
          ?.getAttribute('data-vnext-emphasis') ?? null,
      clipped,
    }
  })
}

/**
 * SPACE EXISTS ONLY WHEN CONTENT HAS EARNED IT.
 *
 * Two independent ways of saying the same thing, because either one alone can be
 * satisfied by accident: the grid must declare exactly as many tracks as it
 * fills, and the rightmost zone must reach the body's own content edge. A track
 * declared and never placed into fails the first; a zone that stops short for
 * any other reason fails the second.
 */
function expectNoDeadTrack(reading: Reading, where: string) {
  expect(
    reading.declaredColumns,
    `${where} declares ${reading.declaredColumns} grid tracks but fills ${reading.bodyColumns}`,
  ).toBe(reading.bodyColumns)

  // Sub-pixel track sizing makes an exact 0 brittle; a dead rail is 340px.
  expect(
    reading.rightGap,
    `${where} leaves ${reading.rightGap}px of dead space at the right edge`,
  ).toBeLessThanOrEqual(4)
}

async function open(page: import('@playwright/test').Page, story: string) {
  await page.goto(`/iframe.html?id=vnext-home--${story}&viewMode=story`, {
    waitUntil: 'load',
  })
  await page.waitForSelector('figure [data-vnext] [data-vnext-zone]')
  // Home enters with a staggered rise; measuring mid-entrance reads transformed
  // boxes rather than laid-out ones.
  await page.waitForTimeout(1400)
}

test.describe('Home holds its frame', () => {
  for (const width of WIDTHS) {
    test(`at ${width.width}px`, async ({ page }) => {
      await open(page, width.story)
      const reading = await read(page)
      const where = `Home at ${width.width}px`

      // The frame is the frame, not the browser window. A `vh`/`vw` anywhere
      // inside would report 900/1280 here and could not be accidentally right.
      expect(reading.frameWidth, `${where} frame width`).toBe(width.width)
      expect(reading.frameHeight, `${where} frame height`).toBe(width.height)

      expect(reading.horizontalOverflow, `${where} scrolls sideways`).toBe(0)

      expect(reading.zones.length, `${where} exposes no zones`).toBeGreaterThan(2)

      // Both navigations are always rendered and one is `display: none`, which
      // removes it from the accessibility tree as well as from the page.
      expect(
        reading.navigationLabels,
        `${where} should show exactly one navigation`,
      ).toHaveLength(1)

      expect(reading.smallTargets, `${where} has controls under 44px`).toEqual([])

      expect(
        reading.bodyColumns,
        `${where} should compose in ${width.columns} column(s)`,
      ).toBe(width.columns)

      expectNoDeadTrack(reading, where)

      expect(reading.clipped, `${where} clips a name`).toEqual([])
    })
  }

  test('composes differently on a phone and on a desktop', async ({ page }) => {
    await open(page, 'live-matchday-430')
    const phone = await read(page)

    await open(page, 'live-matchday-1440')
    const desktop = await read(page)

    // A phone is one column. Anything beside anything else at 430 is a
    // composition that has not been designed for the width it is claiming.
    expect(phone.sideBySide, 'Home places zones side by side at 430px').toEqual([])

    // And the desktop is not that column stretched.
    expect(
      desktop.sideBySide.length,
      'Home at 1440px is the phone composition, wider',
    ).toBeGreaterThan(0)
  })

  test('gives the competitive module its own column only at 1920', async ({
    page,
  }) => {
    await open(page, 'live-matchday-1440')
    expect(
      (await read(page)).sideBySide,
      'the social zone should not take a column at 1440 — it would narrow the stage',
    ).not.toContain('stage|social')

    await open(page, 'live-matchday-1920')
    expect(
      (await read(page)).sideBySide,
      'the social zone should earn its column at 1920',
    ).toContain('stage|social')
  })

  /**
   * THE WIDE BREAKPOINT ITSELF, ON THE EMPHASIS THAT COMPOSES DIFFERENTLY THERE.
   *
   * Competition places two areas where live and decision place three, so 1560 is
   * the width at which it either declares the track count it uses or inherits
   * one it does not. 1559 and 1560 are measured as a pair because a threshold is
   * only proved by the step across it: the same page, one pixel apart, must
   * differ in composition and agree about having no dead space.
   *
   * The widths come from overriding the frame's own `--frame-width` rather than
   * from two more stories. Home answers its CONTAINER — that is the workshop's
   * load-bearing rule — so driving the container is the same measurement the
   * story would produce, without adding review surface nobody looks at.
   *
   * THE FRAME IS NOT THE CONTAINER ANY MORE, AND THAT IS WHY THIS MEASURES THE
   * GAP RATHER THAN ASSUMING IT IS ZERO. Stage 7.6 gave the application shell a
   * competition rail at 1120px and above, so `<main>` — the container Home
   * actually answers — is the frame minus that column. Driving the frame to
   * 1560 now produces a container of 1296 and the NARROW composition, which is
   * Home behaving correctly and the test asking the wrong question. The chrome's
   * width is measured from the page rather than hard-coded, so this stays true
   * if the rail's width ever changes and fails loudly if the shell stops taking
   * a column at all.
   */
  test('competition fills its wide composition at and above 1560', async ({
    page,
  }) => {
    for (const width of [1559, 1560, 1920]) {
      await open(page, 'competition-1440')

      // How much of the frame the shell spends on itself, at a width where the
      // rail is real. Measured on the story's own 1440 frame first.
      const chrome = await page.evaluate(() => {
        const root = document.querySelector('figure [data-vnext]')
        const scroller = root?.firstElementChild as HTMLElement | null
        const main = scroller?.querySelector('main') as HTMLElement | null
        if (!scroller || !main) throw new Error('no shell to measure')
        return scroller.clientWidth - main.offsetWidth
      })

      await page.evaluate(
        ({ containerWidth, chromeWidth }) => {
          const frame = document.querySelector<HTMLElement>('figure > div')
          if (!frame) throw new Error('no frame to resize')
          frame.style.setProperty('--frame-width', `${containerWidth + chromeWidth}px`)
          frame.style.setProperty('--frame-scale', '1')
        },
        { containerWidth: width, chromeWidth: chrome },
      )
      await page.waitForTimeout(400)

      const reading = await read(page)
      const where = `competition at a ${width}px container`

      expect(reading.frameWidth, `${where} frame width`).toBe(width + chrome)
      expect(
        reading.mainWidth,
        `${where} should put ${width}px in front of the page`,
      ).toBe(width)
      expect(reading.emphasis, `${where} emphasis`).toBe('competition')
      expect(reading.horizontalOverflow, `${where} scrolls sideways`).toBe(0)
      expect(reading.clipped, `${where} clips a name`).toEqual([])
      expect(reading.navigationLabels, `${where} navigation`).toHaveLength(1)
      expect(reading.smallTargets, `${where} has controls under 44px`).toEqual([])

      // The zone this emphasis does not draw stays undrawn — the league race is
      // already its dominant zone, and a second copy would be the same table
      // twice. It must not leave a column behind it either.
      expect(reading.zones, `${where} draws no separate social zone`).not.toContain(
        'social',
      )
      expect(reading.bodyColumns, `${where} composes in two columns`).toBe(2)
      expectNoDeadTrack(reading, where)
    }
  })
})

test.describe('the three emphases are one shell', () => {
  for (const scenario of EMPHASES) {
    test(`${scenario.label} holds the contract`, async ({ page }) => {
      await open(page, scenario.story)
      const reading = await read(page)
      const where = scenario.label

      expect(reading.frameWidth, `${where} frame width`).toBe(scenario.width)
      expect(reading.horizontalOverflow, `${where} scrolls sideways`).toBe(0)
      expect(reading.navigationLabels, `${where} navigation`).toHaveLength(1)
      expect(reading.smallTargets, `${where} has controls under 44px`).toEqual([])
      expect(reading.clipped, `${where} clips a name`).toEqual([])
      expectNoDeadTrack(reading, where)

      // The stable shell is present whatever is being emphasised. If any of
      // these ever went missing in one state, Home would have become three
      // pages that merely share a palette.
      expect(reading.zones, `${where} masthead`).toContain('masthead')
      expect(reading.zones, `${where} score bar`).toContain('scores')
      expect(reading.zones, `${where} dominant zone`).toContain('stage')
    })
  }

  test('each scenario declares the emphasis it is drawing', async ({ page }) => {
    for (const [story, expected] of [
      ['live-matchday-430', 'live'],
      ['decision-430', 'decision'],
      ['competition-430', 'competition'],
      ['new-season-430', 'competition'],
      // Nothing live and a calm deadline, so the competition state is what the
      // space is worth — the same answer the selector gives the new-season
      // scenario, reached from an entirely different set of nulls.
      ['reduced-430', 'competition'],
    ] as const) {
      await open(page, story)
      expect((await read(page)).emphasis, story).toBe(expected)
    }
  })

  test('the outstanding-action banner yields to the decision hero', async ({
    page,
  }) => {
    await open(page, 'live-matchday-430')
    expect(
      (await read(page)).zones,
      'live emphasis keeps the action banner above the football',
    ).toContain('action')

    await open(page, 'decision-430')
    expect(
      (await read(page)).zones,
      'decision emphasis would otherwise say the same thing twice',
    ).not.toContain('action')
  })
})

test.describe('reduced motion', () => {
  test('lays out identically with the preference set', async ({ page }) => {
    await open(page, 'live-matchday-430')
    const normal = await read(page)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, 'live-matchday-430')
    const reduced = await read(page)

    // The reduced path removes travel, not content or composition.
    expect(reduced.zones).toEqual(normal.zones)
    expect(reduced.horizontalOverflow).toBe(0)
    expect(reduced.smallTargets).toEqual([])
    expect(reduced.clipped).toEqual([])
  })
})

/**
 * THE CROSS-GAME WEEK, IN A REAL ENGINE.
 *
 * `DFA-010`'s shape — one primary action and at most two compact secondary ones
 * — is asserted in Vitest against the mapper. What only a browser can say is
 * whether the zone that draws them survives a 430px column and a 1440px one
 * without overflowing, whether its controls clear the 44px target the tokens
 * promise, and whether a settled game really renders with nothing to press.
 *
 * THE DISTINCTION THAT MATTERS IS COUNTED, NOT DESCRIBED. A report and a task
 * differ by whether the row has a BUTTON, so these tests count buttons inside
 * the zone rather than reading its classes.
 */
test.describe('the rest of the week', () => {
  test('draws at most two compact rows and never overflows', async ({ page }) => {
    for (const story of ['lms-first-430', 'lms-first-1440']) {
      await open(page, story)
      const reading = await read(page)

      expect(reading.horizontalOverflow, `${story} scrolls sideways`).toBe(0)
      expect(reading.smallTargets, `${story} has a control under 44px`).toEqual([])

      const rows = page.locator('[data-vnext-zone="week-elsewhere"] li')
      expect(await rows.count(), `${story} row count`).toBeLessThanOrEqual(2)
      expect(await rows.count(), `${story} says nothing`).toBeGreaterThan(0)
    }
  })

  test('gives a control only to a game that is still asking', async ({ page }) => {
    await open(page, 'lms-first-430')
    const zone = page.locator('[data-vnext-zone="week-elsewhere"]')
    // The Match Predictor is outstanding in this world; the Championship never is.
    await expect(zone.getByRole('button')).toHaveCount(1)

    await open(page, 'side-games-settled-430')
    // Both side games are settled. Two reports, nothing to press.
    await expect(
      page.locator('[data-vnext-zone="week-elsewhere"]').getByRole('button'),
    ).toHaveCount(0)
  })

  test('never offers an eliminated player a pick', async ({ page }) => {
    await open(page, 'lms-eliminated-430')
    const zone = page.locator('[data-vnext-zone="week-elsewhere"]')

    await expect(zone).toContainText('you are out')
    await expect(zone.getByRole('button', { name: /Pick your club/ })).toHaveCount(0)
  })

  test('is absent entirely for a player with one game', async ({ page }) => {
    await open(page, 'live-matchday-430')

    await expect(page.locator('[data-vnext-zone="week-elsewhere"]')).toHaveCount(0)
  })

  test('leads with the pick when Last Man Standing locks first', async ({ page }) => {
    await open(page, 'lms-first-430')

    // The banner above the zone promises the club pick, not the matchweek.
    await expect(page.getByRole('button', { name: 'Pick your club' })).toBeVisible()
  })

  test('is reachable and distinguishable from the keyboard', async ({ page }) => {
    await open(page, 'lms-first-430')

    // Tab until the zone's own control takes focus. A row that could not be
    // reached would exhaust the page without ever landing here.
    const target = page.locator('[data-vnext-zone="week-elsewhere"] button').first()
    let focused = false
    for (let press = 0; press < 40 && !focused; press += 1) {
      await page.keyboard.press('Tab')
      focused = await target.evaluate((node) => node === document.activeElement)
    }

    expect(focused, 'the zone’s control never took focus').toBe(true)
    // The verb alone would read as a repeated control; the game name travels in
    // the accessible name so two rows are told apart.
    await expect(target).toHaveAccessibleName(/Match Predictor/)
  })

  test('scans clean for serious accessibility violations', async ({ page }) => {
    for (const story of ['lms-first-430', 'side-games-settled-1440', 'lms-eliminated-430']) {
      await open(page, story)
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()

      const serious = results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious',
      )
      expect(
        serious.map((violation) => `${story}: ${violation.id}`),
        'serious accessibility violations',
      ).toEqual([])
    }
  })
})
