import { expect, test } from '@playwright/test'

/**
 * THE THREE HOME CONCEPTS, MEASURED AT EVERY REVIEW WIDTH.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not assert any concept's markup.
 * These are exploratory compositions that exist to be compared and then mostly
 * discarded, and turning their structure into a permanent contract would freeze
 * the thing Stage 4 is supposed to be free to choose between. There is no pixel
 * baseline here either, for the same reason the frame spec has none.
 *
 * WHAT IT DOES ASSERT is the small set of properties true of ANY acceptable
 * Home concept, and that jsdom cannot check because it evaluates no container
 * query and computes no layout:
 *
 *   1. nothing overflows sideways at any of the five widths — the single most
 *      common way a desktop-first composition announces itself;
 *   2. desktop is a different COMPOSITION rather than a wider phone: at 430 the
 *      concept's zones are stacked, and at 1440 at least one pair of them sits
 *      side by side;
 *   3. exactly one navigation is real at any width, so there is never a
 *      duplicate landmark or a focus stop nobody can see;
 *   4. every control clears the 44px target the tokens promise.
 *
 * `data-vnext-zone` is the only hook the concepts expose for this. It names a
 * top-level zone without saying what is in it or how it is built, so a concept
 * can be rewritten entirely and this spec still means the same thing.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE, as in the frame spec: 1280×900 is
 * the width and height of no frame under review, so anything inside a frame
 * that measures the window rather than the frame produces a number that cannot
 * coincidentally be right.
 */

const CONCEPTS = [
  { story: 'vnext-home-concepts-a-matchday-arena', label: 'A — Matchday Arena' },
  {
    story: 'vnext-home-concepts-b-game-command-centre',
    label: 'B — Game Command Centre',
  },
  { story: 'vnext-home-concepts-c-cinematic-football', label: 'C — Cinematic Football' },
] as const

const WIDTHS = [
  { story: 'phone-375', width: 375, height: 812 },
  { story: 'phone-430', width: 430, height: 900 },
  { story: 'tablet-768', width: 768, height: 1024 },
  { story: 'laptop-1440', width: 1440, height: 900 },
  { story: 'desktop-1920', width: 1920, height: 1080 },
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

    return {
      frameWidth: scroller?.clientWidth ?? 0,
      frameHeight: scroller?.clientHeight ?? 0,
      horizontalOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : -1,
      navigationLabels,
      smallTargets,
      zones: boxes.map((entry) => entry.name),
      sideBySide,
    }
  })
}

async function open(
  page: import('@playwright/test').Page,
  story: string,
  width: string,
) {
  await page.goto(`/iframe.html?id=${story}--${width}&viewMode=story`, {
    waitUntil: 'load',
  })
  await page.waitForSelector('figure [data-vnext] [data-vnext-zone]')
  // The concepts enter with a staggered rise; measuring mid-entrance reads
  // transformed boxes rather than laid-out ones.
  await page.waitForTimeout(1400)
}

for (const concept of CONCEPTS) {
  test.describe(`Concept ${concept.label}`, () => {
    for (const width of WIDTHS) {
      test(`holds its frame at ${width.width}px`, async ({ page }) => {
        await open(page, concept.story, width.story)
        const reading = await read(page)
        const where = `${concept.label} at ${width.width}px`

        // The frame is the frame, not the browser window. A `vh`/`vw` anywhere
        // inside would report 900/1280 here and could not be mistaken for right.
        expect(reading.frameWidth, `${where} frame width`).toBe(width.width)
        expect(reading.frameHeight, `${where} frame height`).toBe(width.height)

        expect(reading.horizontalOverflow, `${where} scrolls sideways`).toBe(0)

        // The concept has zones at all, so every assertion below means something.
        expect(reading.zones.length, `${where} exposes no zones`).toBeGreaterThan(2)

        // Both navigations are always rendered and one is `display: none`, which
        // removes it from the accessibility tree as well as from the page.
        expect(
          reading.navigationLabels,
          `${where} should show exactly one navigation`,
        ).toHaveLength(1)

        expect(reading.smallTargets, `${where} has controls under 44px`).toEqual([])
      })
    }

    test('composes differently on a phone and on a desktop', async ({ page }) => {
      await open(page, concept.story, 'phone-430')
      const phone = await read(page)

      await open(page, concept.story, 'laptop-1440')
      const desktop = await read(page)

      // A phone is one column. Anything beside anything else at 430 is a
      // composition that has not been designed for the width it is claiming.
      expect(
        phone.sideBySide,
        `${concept.label} places zones side by side at 430px`,
      ).toEqual([])

      // And the desktop is not that column stretched.
      expect(
        desktop.sideBySide.length,
        `${concept.label} at 1440px is the phone composition, wider`,
      ).toBeGreaterThan(0)
    })
  })
}
