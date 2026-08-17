import { expect, test } from '@playwright/test'

/**
 * THE vNEXT APPLICATION SHELL, MEASURED BY A REAL ENGINE.
 *
 * `tests/vnext/shell.test.tsx` holds the semantic half of the contract —
 * landmarks, headings, the current destination, the direction of the
 * dependency — because none of that needs layout. This suite holds the half
 * that is nothing but layout, and that jsdom cannot see at all: it evaluates no
 * container query and computes no boxes, so every claim below would pass there
 * whether or not it were true.
 *
 * WHAT IT ASSERTS, and why each one is a thing a shell gets wrong:
 *
 *   1. exactly one navigation is REAL at any width. Both are always rendered
 *      and CSS shows one; a shell that hid the wrong one, or neither, would
 *      give every future page a duplicate landmark;
 *   2. the navigation swaps SHAPE at the right band — a bottom bar below
 *      1120px, a masthead band at and above it — and the bar is genuinely at
 *      the bottom rather than merely present;
 *   3. mobile content CLEARS the bar with no page doing anything. This is the
 *      one promise that would silently break every future mobile page: a bar
 *      changed from sticky to fixed still looks right until you scroll to the
 *      end of a page and find the last row underneath it;
 *   4. the shell imposes NO reading column. At 1440 and 1920 a data-dense page
 *      gets essentially the whole frame, because standings, fixtures grids and
 *      Match Centre are the pages this shell exists to host;
 *   5. nothing overflows sideways, in any demonstration, at any width;
 *   6. every control clears the 44px target, including with labels three times
 *      longer than the English ones;
 *   7. the page bounds are the SAME number for the masthead and for the page,
 *      which is what `--vnext-page-inset` is for.
 *
 * THE DEMONSTRATION MARKUP IS NEVER ASSERTED. Those placeholders exist to be
 * replaced by real pages and a test that froze them would make them permanent;
 * what is measured is the shell around them. There is no pixel baseline here
 * for the same reason `vnext-home.spec.ts` has none.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE. The page opens at 1280×900, which
 * is the width and height of no frame under review, so anything inside a frame
 * that measures the window produces a number that cannot be mistaken for right.
 */

/** The band each width belongs to, which decides which navigation is real. */
const WIDTHS = [
  { story: 'content-375', width: 375, height: 812, navigation: 'bar' },
  { story: 'content-430', width: 430, height: 900, navigation: 'bar' },
  { story: 'content-768', width: 768, height: 1024, navigation: 'bar' },
  { story: 'content-1440', width: 1440, height: 900, navigation: 'band' },
  { story: 'content-1920', width: 1920, height: 1080, navigation: 'band' },
] as const

/** Every demonstration, so a shell defect cannot hide in the page nobody ran. */
const DEMONSTRATIONS = [
  { story: 'content-375', label: 'content at 375', width: 375, destination: 'Fixtures' },
  { story: 'content-430', label: 'content at 430', width: 430, destination: 'Fixtures' },
  { story: 'content-768', label: 'content at 768', width: 768, destination: 'Fixtures' },
  {
    story: 'content-1440',
    label: 'content at 1440',
    width: 1440,
    destination: 'Fixtures',
  },
  {
    story: 'content-1920',
    label: 'content at 1920',
    width: 1920,
    destination: 'Fixtures',
  },
  { story: 'dense-430', label: 'dense at 430', width: 430, destination: 'Leagues' },
  { story: 'dense-1440', label: 'dense at 1440', width: 1440, destination: 'Leagues' },
  { story: 'dense-1920', label: 'dense at 1920', width: 1920, destination: 'Leagues' },
  { story: 'detail-430', label: 'detail at 430', width: 430, destination: 'Season' },
  { story: 'detail-1440', label: 'detail at 1440', width: 1440, destination: 'Season' },
] as const

type Reading = {
  frameWidth: number
  frameHeight: number
  horizontalOverflow: number
  navigationLabels: string[]
  /** `bar` or `band`, decided by where the one real navigation actually sits. */
  navigationShape: 'bar' | 'band' | 'none'
  currentDestinations: string[]
  smallTargets: string[]
  mainCount: number
  headingCount: number
  headingText: string | null
  /** Whether `<main aria-labelledby>` resolves to the page's own `h1`. */
  headingIsWired: boolean
  /** The content region's own width. The shell adds no inline padding to it. */
  mainWidth: number
  /** The widest box the page drew inside its own inset, and that inset. */
  contentWidth: number
  contentInsetStart: number
  mastheadInsetStart: number
  clipped: string[]
  /** Destination labels whose text escapes the target it belongs to. */
  spillingLabels: string[]
}

/**
 * ALL WIDTHS ARE `offsetWidth`, NEVER A CLIENT RECT.
 *
 * `WorkshopCanvas` fits several frames on one screen with a CSS transform, so
 * `getBoundingClientRect()` inside a frame shown at 62% returns 62% of the real
 * number — 1190 for a 1920 frame. A transform does not change layout, and
 * `offsetWidth` is the layout box, so it is the width the page actually got.
 * Only relative comparisons within one frame use rects, where the scale cancels.
 *
 * Everything is scoped to the FIRST frame, because a story may board several
 * widths at once and each frame renders its own shell.
 */
async function read(page: import('@playwright/test').Page): Promise<Reading> {
  return page.evaluate<Reading>(() => {
    const root = document.querySelector('figure [data-vnext]')
    // The frame's scrollport: the element `WorkshopCanvas` gives the device
    // shell's real pixel height. Anything wider than this has left its shell.
    const scroller = root?.firstElementChild ?? null
    const shell = scroller?.querySelector('[data-vnext-shell]') ?? null
    const main = shell?.querySelector('main') ?? null
    const masthead = shell?.querySelector('[data-vnext-zone="masthead"]') ?? null
    const rendered = (element: Element) => element.getClientRects().length > 0

    const visibleNavs = [...(shell?.querySelectorAll('nav') ?? [])].filter(rendered)

    /**
     * WHICH SHAPE THE REAL NAVIGATION IS, measured rather than read off a class.
     *
     * A band lives inside the masthead; a bar is the last thing on the page. A
     * shell that rendered the bar inside the masthead would still have exactly
     * one navigation and would still pass every count below.
     */
    let navigationShape: 'bar' | 'band' | 'none' = 'none'
    const onlyNav = visibleNavs[0]
    if (visibleNavs.length === 1 && onlyNav && masthead && main) {
      navigationShape = masthead.contains(onlyNav)
        ? 'band'
        : onlyNav.getBoundingClientRect().top >= main.getBoundingClientRect().top
          ? 'bar'
          : 'none'
    }

    const smallTargets: string[] = []
    for (const control of shell?.querySelectorAll('button') ?? []) {
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

    const headings = [...(shell?.querySelectorAll('h1') ?? [])].filter(rendered)
    const labelledBy = main?.getAttribute('aria-labelledby') ?? null

    /**
     * THE WIDEST BOX THE PAGE DREW INSIDE ITS OWN INSET.
     *
     * Strictly narrower than the content region, on purpose: a page's outermost
     * wrapper spans the whole region and carries the inset as padding, so
     * measuring THAT would report an inset of zero on every page. What is wanted
     * is the first thing the page actually painted — the editorial page's panels,
     * the dense page's table scroller — because that is what reaches, or fails to
     * reach, the page bounds.
     */
    const mainWidth = (main as HTMLElement | null)?.offsetWidth ?? 0
    let contentWidth = 0
    for (const element of main?.querySelectorAll<HTMLElement>('*') ?? []) {
      if (!rendered(element)) continue
      if (element.offsetWidth > contentWidth && element.offsetWidth < mainWidth) {
        contentWidth = element.offsetWidth
      }
    }

    const clipped: string[] = []
    for (const element of shell?.querySelectorAll<HTMLElement>('span, p, h1') ?? []) {
      if (!rendered(element)) continue
      const style = getComputedStyle(element)
      // The skip link is a 1px box holding a whole sentence, so it overflows by
      // design. `clip-path` is the idiom that hides it, and it is what
      // separates "deliberately invisible" from "accidentally cut off".
      if (style.clipPath !== 'none') continue
      if (style.overflowX !== 'hidden' && style.overflowX !== 'clip') continue
      if (element.scrollWidth - element.clientWidth > 1) {
        clipped.push(`"${element.textContent?.trim().slice(0, 36)}"`)
      }
    }

    /**
     * A DESTINATION LABEL THAT HAS LEFT ITS OWN TARGET.
     *
     * Not the same defect as clipping, and invisible to every other measurement
     * here: the text is not cut off, the frame does not scroll, and every target
     * still clears 44px — the words simply run through the destination beside
     * them. That is exactly what the long German labels did at 375px on the
     * first build of this shell, and only a picture showed it.
     */
    const spillingLabels: string[] = []
    for (const nav of visibleNavs) {
      for (const control of nav.querySelectorAll('button')) {
        if (!rendered(control)) continue
        const target = control.getBoundingClientRect()
        for (const span of control.querySelectorAll('span')) {
          if (!rendered(span)) continue
          const text = span.getBoundingClientRect()
          if (text.left < target.left - 1 || text.right > target.right + 1) {
            spillingLabels.push(`"${span.textContent?.trim().slice(0, 24)}"`)
          }
        }
      }
    }

    const mastheadStyle = masthead ? getComputedStyle(masthead) : null

    return {
      frameWidth: scroller?.clientWidth ?? 0,
      frameHeight: scroller?.clientHeight ?? 0,
      horizontalOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : -1,
      navigationLabels: visibleNavs.map(
        (nav) => nav.getAttribute('aria-label') ?? '(unnamed)',
      ),
      navigationShape,
      currentDestinations: visibleNavs.flatMap((nav) =>
        [...nav.querySelectorAll('[aria-current="page"]')].map(
          (item) => item.textContent?.trim() ?? '',
        ),
      ),
      smallTargets,
      mainCount: shell?.querySelectorAll('main').length ?? 0,
      headingCount: headings.length,
      headingText: headings[0]?.textContent?.trim() ?? null,
      headingIsWired: Boolean(
        labelledBy && document.getElementById(labelledBy) === headings[0],
      ),
      mainWidth,
      contentWidth,
      // Symmetric by construction: the inset is `padding-inline`, so half the
      // difference is the inset on each side.
      contentInsetStart: Math.round((mainWidth - contentWidth) / 2),
      mastheadInsetStart: Math.round(
        Number.parseFloat(mastheadStyle?.paddingLeft ?? '0'),
      ),
      clipped,
      spillingLabels,
    }
  })
}

async function open(page: import('@playwright/test').Page, story: string) {
  await page.goto(`/iframe.html?id=vnext-shell--${story}&viewMode=story`, {
    waitUntil: 'load',
  })
  await page.waitForSelector('figure [data-vnext] [data-vnext-shell] main')
  // The masthead enters with a rise; measuring mid-entrance reads transformed
  // boxes rather than laid-out ones.
  await page.waitForTimeout(1200)
}

/** Every demonstration owes the same baseline, whatever it is demonstrating. */
function expectShellBaseline(reading: Reading, where: string) {
  expect(reading.horizontalOverflow, `${where} scrolls sideways`).toBe(0)
  expect(
    reading.navigationLabels,
    `${where} should show exactly one navigation`,
  ).toHaveLength(1)
  expect(
    reading.currentDestinations.length,
    `${where} should mark exactly one current destination`,
  ).toBe(1)
  expect(reading.mainCount, `${where} should have exactly one main`).toBe(1)
  expect(reading.headingCount, `${where} should have exactly one h1`).toBe(1)
  expect(reading.headingIsWired, `${where} main is not labelled by its own h1`).toBe(true)
  expect(reading.smallTargets, `${where} has controls under 44px`).toEqual([])
  expect(reading.clipped, `${where} clips text`).toEqual([])
  expect(
    reading.spillingLabels,
    `${where} has a destination label sitting outside its own target`,
  ).toEqual([])
}

test.describe('the shell holds its frame', () => {
  for (const width of WIDTHS) {
    test(`at ${width.width}px`, async ({ page }) => {
      await open(page, width.story)
      const reading = await read(page)
      const where = `the shell at ${width.width}px`

      // The frame is the frame, not the browser window. A `vh`/`vw` anywhere
      // inside would report 900/1280 here and could not be accidentally right.
      expect(reading.frameWidth, `${where} frame width`).toBe(width.width)
      expect(reading.frameHeight, `${where} frame height`).toBe(width.height)

      expectShellBaseline(reading, where)

      expect(
        reading.navigationShape,
        `${where} should use the ${width.navigation} navigation`,
      ).toBe(width.navigation)

      // The page bounds are one number, and the masthead and the page both use
      // it. A page that hard-coded its own inset would diverge here at 1120.
      expect(
        reading.contentInsetStart,
        `${where} page inset should match the masthead inset`,
      ).toBe(reading.mastheadInsetStart)
    })
  }

  for (const demo of DEMONSTRATIONS) {
    test(`${demo.label} holds the shell contract`, async ({ page }) => {
      await open(page, demo.story)
      const reading = await read(page)

      expect(reading.frameWidth, `${demo.label} frame width`).toBe(demo.width)
      expectShellBaseline(reading, demo.label)
      expect(reading.currentDestinations[0], `${demo.label} current destination`).toBe(
        demo.destination,
      )
    })
  }
})

test.describe('mobile content clears the bottom navigation', () => {
  for (const story of ['content-375', 'content-430', 'dense-430'] as const) {
    test(story, async ({ page }) => {
      await open(page, story)

      // AT REST AT THE BOTTOM OF THE PAGE, which is the only place this can
      // fail. A sticky bar is in flow and reserves its own height, so the last
      // row lands above it; a fixed bar would look identical until here.
      const gap = await page.evaluate(() => {
        const scroller = document.querySelector('[data-vnext]')
          ?.firstElementChild as HTMLElement
        scroller.scrollTop = scroller.scrollHeight
        const shell = scroller.querySelector('[data-vnext-shell]') as HTMLElement
        const main = shell.querySelector('main') as HTMLElement
        const nav = [...shell.querySelectorAll('nav')].filter(
          (element) => element.getClientRects().length > 0,
        )[0]
        if (!nav) throw new Error('The shell rendered no visible navigation.')
        return (
          nav.getBoundingClientRect().top - main.getBoundingClientRect().bottom
        )
      })

      expect(
        gap,
        `${story}: the bottom navigation overlaps the end of the page by ${Math.round(-gap)}px`,
      ).toBeGreaterThanOrEqual(-1)
    })
  }
})

test.describe('the shell imposes no reading column', () => {
  for (const { story, width } of [
    { story: 'dense-1440', width: 1440 },
    { story: 'dense-1920', width: 1920 },
  ] as const) {
    test(`a data-dense page uses the workspace at ${width}`, async ({ page }) => {
      await open(page, story)
      const reading = await read(page)

      // The content region is the whole frame — the shell adds no inline
      // padding of its own, which is what lets a page bleed to the bounds.
      expect(reading.mainWidth, `main at ${width}`).toBe(width)

      // And what the page drew reaches the page bounds. A shell with a reading
      // column, or a `max-width` left over from an earlier frame, fails here
      // while every other assertion in this file stays green.
      const expected = width - 2 * reading.mastheadInsetStart
      expect(
        Math.round(reading.contentWidth),
        `a dense page at ${width} got ${Math.round(reading.contentWidth)}px of ${expected}px`,
      ).toBe(expected)
    })
  }
})

test.describe('long and localised destination labels', () => {
  test('keep four legible destinations above 44px targets', async ({ page }) => {
    await open(page, 'long-navigation-labels')
    const reading = await read(page)

    expectShellBaseline(reading, 'long labels')
    expect(reading.currentDestinations[0]).toBe('Spielbegegnungen')
  })
})

test.describe('reduced motion', () => {
  test('lays out identically with the preference set', async ({ page }) => {
    await open(page, 'content-430')
    const normal = await read(page)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, 'content-430')
    const reduced = await read(page)

    // The reduced path removes travel, not content, bounds or composition.
    expect(reduced.navigationShape).toBe(normal.navigationShape)
    expect(reduced.contentWidth).toBe(normal.contentWidth)
    expect(reduced.contentInsetStart).toBe(normal.contentInsetStart)
    expect(reduced.horizontalOverflow).toBe(0)
    expect(reduced.smallTargets).toEqual([])
    expect(reduced.clipped).toEqual([])
  })
})

test.describe('the skip link', () => {
  test('appears on focus and moves focus into the page', async ({ page }) => {
    await open(page, 'content-430')

    const before = await page.evaluate(
      () =>
        (
          document.querySelector('[data-vnext-shell] a') as HTMLElement
        ).getBoundingClientRect().width,
    )
    expect(before, 'the skip link should cost no layout until it is focused').toBeLessThan(
      2,
    )

    await page.evaluate(() =>
      (document.querySelector('[data-vnext-shell] a') as HTMLElement).focus(),
    )

    const focused = await page.evaluate(() => {
      const link = document.querySelector('[data-vnext-shell] a') as HTMLElement
      const box = link.getBoundingClientRect()
      return { width: box.width, height: box.height, href: link.getAttribute('href') }
    })

    expect(focused.width, 'the focused skip link should be visible').toBeGreaterThan(80)
    expect(focused.height, 'the focused skip link should clear 44px').toBeGreaterThanOrEqual(
      44,
    )

    await page.evaluate(() =>
      (document.querySelector('[data-vnext-shell] a') as HTMLElement).click(),
    )
    expect(
      await page.evaluate(() => document.activeElement?.tagName),
      'the skip link should move focus into the content region',
    ).toBe('MAIN')
  })
})
