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

const EMPHASES = [
  { story: 'live-matchday-430', label: 'live at 430', width: 430 },
  { story: 'live-matchday-1440', label: 'live at 1440', width: 1440 },
  { story: 'decision-430', label: 'decision at 430', width: 430 },
  { story: 'decision-1440', label: 'decision at 1440', width: 1440 },
  { story: 'competition-430', label: 'competition at 430', width: 430 },
  { story: 'competition-1440', label: 'competition at 1440', width: 1440 },
  { story: 'new-season-430', label: 'new season at 430', width: 430 },
  { story: 'new-season-1440', label: 'new season at 1440', width: 1440 },
] as const

type Reading = {
  frameWidth: number
  frameHeight: number
  horizontalOverflow: number
  navigationLabels: string[]
  smallTargets: string[]
  zones: string[]
  /** Pairs of zones sharing vertical space but not horizontal: `a|b`. */
  sideBySide: string[]
  /** Distinct left edges among the body zones — the column count. */
  bodyColumns: number
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
      horizontalOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : -1,
      navigationLabels,
      smallTargets,
      zones: boxes.map((entry) => entry.name),
      sideBySide,
      bodyColumns,
      emphasis:
        document
          .querySelector('[data-vnext-emphasis]')
          ?.getAttribute('data-vnext-emphasis') ?? null,
      clipped,
    }
  })
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
