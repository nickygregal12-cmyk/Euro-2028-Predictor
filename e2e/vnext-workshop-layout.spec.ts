import { expect, test } from '@playwright/test'

/**
 * THE vNext FRAME, MEASURED BY A REAL ENGINE.
 *
 * jsdom evaluates no container query and computes no layout, so every existing
 * vNext responsive guard reads the stylesheet and reasons about it. That caught
 * the structural mistakes — a `container-type` on the wrong element, a viewport
 * media query, a `vh` — and it cannot catch the thing those mistakes were only
 * ever a proxy for: whether the composition a width is supposed to produce is
 * the composition it actually produces.
 *
 * So this suite opens the workshop's five frames in Chromium and asks the
 * engine. It asserts the STRUCTURAL CONTRACT — which regions exist, how many
 * columns the grid has, which navigation is real, whether anything overflows
 * sideways — and deliberately not pixels. A pixel baseline of a workshop that
 * exists to be redesigned would be a baseline updated on every commit, which is
 * a baseline that holds nothing. `visual-gallery.spec.ts` is where images are
 * compared, and it compares the legacy design system, not this.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE. The page is opened at 1280×900,
 * which is not the width or the height of any frame under review. Anything
 * inside a frame that measures the window instead of the frame therefore
 * produces a number that cannot be mistaken for the right one — a `100vh` rail
 * in a 1920×1080 shell reports 900, and a `82vw` card in a 375px shell reports
 * over a thousand. That mismatch is the whole point of the viewport.
 */

const STORY =
  '/iframe.html?id=vnext-workshop-app-frame-probe--all-widths&viewMode=story'

/** The workshop's own five widths, and the composition each one owes. */
const FRAMES = [
  {
    label: 'Phone 375',
    width: 375,
    height: 812,
    columns: 1,
    navigation: 'bar',
  },
  {
    label: 'Phone 430',
    width: 430,
    height: 900,
    columns: 1,
    navigation: 'bar',
  },
  {
    label: 'Tablet 768',
    width: 768,
    height: 1024,
    columns: 2,
    navigation: 'bar',
  },
  {
    label: 'Laptop 1440',
    width: 1440,
    height: 900,
    columns: 3,
    navigation: 'rail',
  },
  {
    label: 'Desktop 1920',
    width: 1920,
    height: 1080,
    columns: 4,
    navigation: 'rail',
  },
] as const

type FrameReading = {
  label: string
  frameWidth: number
  frameHeight: number
  horizontalOverflow: number
  columnCount: number
  rootOverflowX: string
  regions: Record<string, boolean>
  navRailPosition: string | null
  personalPosition: string | null
  personalMaxHeight: string | null
  railCardMaxWidth: string | null
  railCardWidth: string | null
}

async function readFrames(page: import('@playwright/test').Page) {
  return page.evaluate<FrameReading[]>(() => {
    const visible = (element: Element | null) => {
      if (!element) return false
      const style = getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden'
    }

    return [...document.querySelectorAll('figure')].map((figure) => {
      const region = (name: string) =>
        figure.querySelector(`[data-vnext-region="${name}"]`)

      const root = figure.querySelector('[data-vnext]')
      // The frame's scrollport: the element `WorkshopCanvas` gives the device
      // shell's real pixel height. If anything inside is wider than this, the
      // composition has broken out of its own shell.
      const scroller = root?.firstElementChild ?? null
      const grid = region('main')?.parentElement ?? null
      const personal = region('personal')
      const navRail = region('nav-rail')
      const railCard = figure.querySelector(
        '[data-vnext-region="main"] section ul > li > article',
      )

      const columns = grid
        ? getComputedStyle(grid)
            .gridTemplateColumns.split(' ')
            .filter(Boolean).length
        : 0

      return {
        label: figure.querySelector('figcaption')?.textContent?.trim() ?? '',
        frameWidth: scroller?.clientWidth ?? 0,
        frameHeight: scroller?.clientHeight ?? 0,
        horizontalOverflow: scroller
          ? scroller.scrollWidth - scroller.clientWidth
          : -1,
        columnCount: columns,
        rootOverflowX: root ? getComputedStyle(root).overflowX : '',
        regions: {
          main: visible(region('main')),
          context: visible(region('context')),
          personal: visible(personal),
          navBar: visible(region('nav-bar')),
          navRail: visible(navRail),
        },
        navRailPosition: navRail ? getComputedStyle(navRail).position : null,
        personalPosition: personal ? getComputedStyle(personal).position : null,
        personalMaxHeight: personal ? getComputedStyle(personal).maxHeight : null,
        railCardMaxWidth: railCard ? getComputedStyle(railCard).maxWidth : null,
        railCardWidth: railCard ? getComputedStyle(railCard).width : null,
      }
    })
  })
}

function pixels(value: string | null): number | null {
  if (!value || value === 'none') return null
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

test.describe('vNext workshop layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STORY, { waitUntil: 'load' })
    await page.waitForSelector('figure [data-vnext]')
    // The probe's cards enter with a staggered rise; measuring mid-entrance
    // reads transformed boxes rather than laid-out ones.
    await page.waitForTimeout(1200)
  })

  test('renders all five workshop frames at their declared sizes', async ({ page }) => {
    const frames = await readFrames(page)

    expect(frames).toHaveLength(FRAMES.length)
    for (const [index, expected] of FRAMES.entries()) {
      const frame = frames[index]
      expect(frame.label, `frame ${index}`).toContain(expected.label)
      // A `transform: scale()` shrinks the picture and not the layout, which is
      // the only reason five frames can be compared on one screen honestly.
      expect(frame.frameWidth, expected.label).toBe(expected.width)
      expect(frame.frameHeight, expected.label).toBe(expected.height)
    }
  })

  test('never overflows sideways at any width', async ({ page }) => {
    const frames = await readFrames(page)

    for (const frame of frames) {
      // A horizontal scrollbar on a phone is the single most common way a
      // desktop-first composition announces itself.
      expect(frame.horizontalOverflow, `${frame.label} scrolls sideways`).toBe(0)
    }
  })

  test('gives every width the composition it owes', async ({ page }) => {
    const frames = await readFrames(page)

    for (const [index, expected] of FRAMES.entries()) {
      const frame = frames[index]
      const where = expected.label

      // The football workspace is the one region no composition may drop.
      expect(frame.regions.main, `${where} main`).toBe(true)
      expect(frame.regions.personal, `${where} personal`).toBe(true)
      expect(frame.regions.context, `${where} context`).toBe(true)

      // Exactly one navigation is real at any width. Both are rendered and one
      // is `display: none`, which removes it from the accessibility tree too,
      // so there is never a duplicate landmark or a hidden focus stop.
      expect(frame.regions.navBar, `${where} bottom bar`).toBe(
        expected.navigation === 'bar',
      )
      expect(frame.regions.navRail, `${where} nav rail`).toBe(
        expected.navigation === 'rail',
      )

      // The compositions are structurally different, not differently sized:
      // one column on a phone, personal beside the football at 768, a
      // navigation rail at 1440, and competition context in its own column at
      // 1920. Column COUNT is the smallest honest expression of that.
      expect(frame.columnCount, `${where} columns`).toBe(expected.columns)
    }
  })

  test('sizes the desktop rails against the frame, not the browser window', async ({
    page,
  }) => {
    const frames = await readFrames(page)
    const viewport = page.viewportSize()
    expect(viewport, 'the test needs a known window size').not.toBeNull()

    for (const [index, expected] of FRAMES.entries()) {
      if (expected.navigation !== 'rail') continue
      const frame = frames[index]

      // Sticky at all, first: `overflow-x: hidden` on the vNext root would make
      // the root a scroll container that never scrolls, and every sticky
      // descendant would silently stop sticking while still saying `sticky`.
      expect(frame.rootOverflowX, `${expected.label} root`).toBe('clip')
      expect(frame.personalPosition, `${expected.label} personal`).toBe('sticky')
      expect(frame.navRailPosition, `${expected.label} nav rail`).toBe('sticky')

      const bound = pixels(frame.personalMaxHeight)
      expect(bound, `${expected.label} personal rail is unbounded`).not.toBeNull()
      // It has to be the FRAME's height it is bounded by. The window is 900
      // tall and the 1920 shell is 1080, so a `vh` rail there reports a number
      // that is not merely wrong but provably the window's.
      expect(bound, `${expected.label} personal rail`).toBeLessThan(expected.height)
      expect(bound, `${expected.label} personal rail`).toBeGreaterThan(
        expected.height - 100,
      )
      if (expected.height !== viewport?.height) {
        expect(
          bound,
          `${expected.label} personal rail is measuring the browser window`,
        ).not.toBe(viewport?.height)
      }
    }
  })

  test('caps rail cards against the frame, not the browser window', async ({
    page,
  }) => {
    const frames = await readFrames(page)
    const viewportWidth = page.viewportSize()?.width ?? 0

    for (const [index, expected] of FRAMES.entries()) {
      const frame = frames[index]
      const cap = pixels(frame.railCardMaxWidth)

      if (expected.width >= 1100) {
        // Once there is room, a card takes its full width and the cap goes.
        expect(cap, `${expected.label} rail cap`).toBeNull()
        continue
      }

      expect(cap, `${expected.label} rail card is uncapped`).not.toBeNull()
      // 82% of the FRAME. Against the 1280px window it would be ~1050px at
      // every width, which is no cap at all and exactly the bug this replaced.
      expect(cap, `${expected.label} rail cap`).toBeCloseTo(expected.width * 0.82, 0)
      expect(cap, `${expected.label} rail cap follows the window`).toBeLessThan(
        viewportWidth * 0.82,
      )
      // And the card still leaves the next one peeking, which is what says the
      // row scrolls.
      expect(
        pixels(frame.railCardWidth) ?? 0,
        `${expected.label} rail card fills its frame`,
      ).toBeLessThan(expected.width)
    }
  })
})
