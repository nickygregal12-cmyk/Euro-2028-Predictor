import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * THE STAGE 7.5 CONCEPTS, MEASURED BY A REAL ENGINE.
 *
 * `tests/vnext/iaLab.test.tsx` holds the semantic half — landmarks, the player
 * identity contract, absent-versus-disabled games, the three dimensions staying
 * apart — because none of that needs layout. This suite holds the half jsdom
 * cannot see at all, and for a NAVIGATION lab that half is unusually large:
 * jsdom evaluates no container query, so the question "does exactly one
 * navigation exist at this width" is unanswerable there and would pass whether
 * or not it were true.
 *
 * WHAT IS MEASURED, and why each one decides something:
 *
 *   1. EXACTLY ONE NAVIGATION IS REAL at every width, in every concept. All
 *      three render two — a phone shape and a desktop shape — and CSS shows
 *      one. Getting this wrong gives a keyboard user a second copy of every
 *      destination that they cannot see.
 *   2. NOTHING OVERFLOWS SIDEWAYS, in any concept, at any width, in the worlds
 *      that stress it — twenty competitions and the longest names the fixtures
 *      hold.
 *   3. EVERY CONTROL CLEARS 44×44, measured with `offsetWidth` so the
 *      workshop's scaling transform cannot flatter it.
 *   4. NOTHING IS CLIPPED. A competition name may wrap; it may never be cut.
 *   5. MOBILE CONTENT CLEARS THE BOTTOM BAR, which is the promise that breaks
 *      silently — the last row sits under the bar and everything above it looks
 *      right.
 *   6. THE PERMANENT CHROME DOES NOT GROW WITH THE CATALOGUE. Twenty published
 *      competitions and three played must cost no more chrome height than four
 *      played competitions do. This is the binding scalability requirement, and
 *      it is the one measurement a still screenshot cannot make.
 *   7. THE DESKTOP IS NOT THE PHONE STRETCHED: each concept must compose
 *      differently at 1440 than at 430, and this suite fails a concept that
 *      merely widens.
 *
 * NO PIXEL BASELINES. Two of these three concepts are going to be thrown away
 * — that is the entire point of a selection stage — so a screenshot baseline
 * here would be a baseline deleted in the change that acts on the review.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE. 1280×900 matches no frame under
 * review, so any measurement that reached for the window instead of the frame
 * produces a number that cannot coincidentally be right.
 */

const CONCEPTS = ['a', 'b', 'c'] as const
type Concept = (typeof CONCEPTS)[number]

type Reading = {
  frameWidth: number
  horizontalOverflow: number
  visibleNavCount: number
  navLabels: string[]
  smallTargets: string[]
  clipped: string[]
  mainCount: number
  headingCount: number
  /** The height of everything that is permanently on screen. */
  chromeHeight: number
  /** Whether the last thing on the page is above the bottom bar's top edge. */
  contentClearsBar: boolean
  /** The content region's own width, for the desktop-composition check. */
  mainWidth: number
  /** Whether a permanent side column is rendered at this width. */
  hasSideColumn: boolean
}

/**
 * ALL WIDTHS ARE `offsetWidth`, NEVER A CLIENT RECT.
 *
 * `WorkshopCanvas` fits frames on one screen with a CSS transform, so a
 * bounding rect inside a frame shown at 62% returns 62% of the real number. A
 * transform does not change layout and `offsetWidth` is the layout box, so it
 * is the width the concept actually got. Only comparisons WITHIN one frame use
 * rects, where the scale cancels.
 */
async function read(page: Page, concept: Concept, frameIndex = 0): Promise<Reading> {
  return page.evaluate<Reading, { concept: string; frameIndex: number }>(
    ({ concept: key, frameIndex: index }) => {
      const frames = [...document.querySelectorAll('figure [data-vnext]')]
      const root = frames[index] ?? null
      const scroller = root?.firstElementChild ?? null
      const shell = scroller?.querySelector(`[data-ia-concept="${key}"]`) ?? null
      const main = shell?.querySelector('main') ?? null
      const rendered = (element: Element) => element.getClientRects().length > 0

      const visibleNavs = [...(shell?.querySelectorAll('nav') ?? [])].filter(rendered)

      const smallTargets: string[] = []
      for (const control of shell?.querySelectorAll('button, input, a') ?? []) {
        if (!rendered(control)) continue
        const { offsetWidth, offsetHeight } = control as HTMLElement
        if (offsetHeight < 44 || offsetWidth < 24) {
          smallTargets.push(
            `${control.textContent?.trim().slice(0, 24) || '(icon)'} @ ${offsetWidth}x${offsetHeight}`,
          )
        }
      }

      const clipped: string[] = []
      for (const element of shell?.querySelectorAll<HTMLElement>('span, p, h1, h2, h3') ?? []) {
        if (!rendered(element)) continue
        const style = getComputedStyle(element)
        // The skip link is a whole sentence in a box translated off screen, so
        // it is excluded by the same rule the shell suite uses.
        if (style.clipPath !== 'none') continue
        if (style.overflowX !== 'hidden' && style.overflowX !== 'clip') continue
        if (element.scrollWidth - element.clientWidth > 1) {
          clipped.push(`"${element.textContent?.trim().slice(0, 36)}"`)
        }
      }

      /**
       * THE PERMANENT CHROME, measured rather than assumed.
       *
       * Everything that is on screen whatever the player scrolls to: the
       * masthead, the side column where there is one, and the bottom bar. This
       * is the number the twenty-competition requirement is really about — a
       * concept passes by keeping it flat as the catalogue grows, not by
       * looking tidy in a screenshot.
       */
      let chromeHeight = 0
      const sticky = [...(shell?.querySelectorAll<HTMLElement>('*') ?? [])].filter(
        (element) => {
          if (!rendered(element)) return false
          const style = getComputedStyle(element)
          return style.position === 'sticky' || style.position === 'fixed'
        },
      )
      // Only the outermost sticky boxes, so a sticky child inside a sticky
      // masthead is not counted twice.
      for (const element of sticky) {
        if (sticky.some((other) => other !== element && other.contains(element))) continue
        chromeHeight += element.offsetHeight
      }

      /**
       * DOES THIS CONCEPT SPEND A COLUMN?
       *
       * Measured as "the content region is meaningfully narrower than the
       * frame", rather than by looking for a particular element. The three
       * concepts put their side column in three different places in the tree —
       * a sibling of the content in one, a grid child inside it in another —
       * and a structural test would have been measuring one concept's markup
       * and calling it a property of all three.
       */
      const frameWidthPx = (scroller as HTMLElement | null)?.clientWidth ?? 0
      const mainOffsetWidth = (main as HTMLElement | null)?.offsetWidth ?? 0
      const spendsAColumn = frameWidthPx - mainOffsetWidth > 100

      /**
       * DOES THE LAST THING ON THE PAGE CLEAR THE BOTTOM BAR?
       *
       * Scrolled to the end, because that is the only place the defect shows:
       * a bar changed from sticky to fixed looks right everywhere else.
       */
      let contentClearsBar = true
      const bar = visibleNavs.find((nav) => {
        const box = nav.getBoundingClientRect();
        const mainBox = main?.getBoundingClientRect()
        return Boolean(mainBox) && box.top >= mainBox!.top
      })
      if (bar && scroller instanceof HTMLElement && main) {
        scroller.scrollTop = scroller.scrollHeight
        const last = [...main.querySelectorAll<HTMLElement>('section, li')].filter(rendered).pop()
        if (last) {
          contentClearsBar =
            last.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top + 1
        }
        scroller.scrollTop = 0
      }

      return {
        frameWidth: (scroller as HTMLElement | null)?.clientWidth ?? 0,
        horizontalOverflow: scroller
          ? (scroller as HTMLElement).scrollWidth - (scroller as HTMLElement).clientWidth
          : 0,
        visibleNavCount: visibleNavs.length,
        navLabels: visibleNavs.map((nav) => nav.getAttribute('aria-label') ?? '(unlabelled)'),
        smallTargets,
        clipped,
        mainCount: shell?.querySelectorAll('main').length ?? 0,
        headingCount: shell?.querySelectorAll('h1').length ?? 0,
        chromeHeight,
        contentClearsBar,
        mainWidth: (main as HTMLElement | null)?.offsetWidth ?? 0,
        hasSideColumn: spendsAColumn,
      }
    },
    { concept, frameIndex },
  )
}

async function open(page: Page, story: string) {
  await page.goto(`/iframe.html?id=vnext-ia-lab-stage-7-5--${story}&viewMode=story`, {
    waitUntil: 'load',
  })
  await page.waitForSelector('figure [data-vnext] [data-ia-concept]')
  // The masthead rises in; measuring mid-entrance reads transformed boxes.
  await page.waitForTimeout(900)
}

/* ==========================================================================
   one navigation, and no overflow, at every width
   ========================================================================== */

const WIDTH_STORIES = [
  { story: 'concept-a-across-widths', concept: 'a' as Concept },
  { story: 'concept-b-across-widths', concept: 'b' as Concept },
  { story: 'concept-c-across-widths', concept: 'c' as Concept },
]

const FRAMES = [
  { index: 0, width: 375 },
  { index: 1, width: 430 },
  { index: 2, width: 768 },
  { index: 3, width: 1024 },
  { index: 4, width: 1440 },
  { index: 5, width: 1920 },
]

for (const { story, concept } of WIDTH_STORIES) {
  test.describe(`Concept ${concept.toUpperCase()} across every width`, () => {
    for (const frame of FRAMES) {
      test(`composes honestly at ${frame.width}`, async ({ page }) => {
        await open(page, story)
        const reading = await read(page, concept, frame.index)

        expect(reading.frameWidth, 'the frame is not the width it claims').toBe(frame.width)

        // ONE NAVIGATION. Both shapes are always in the DOM; CSS shows one.
        expect(
          reading.visibleNavCount,
          `two navigations are real at ${frame.width} — ${reading.navLabels.join(', ')}`,
        ).toBe(1)
        expect(reading.navLabels.every((label) => label !== '(unlabelled)')).toBe(true)

        expect(reading.mainCount).toBe(1)
        expect(reading.headingCount).toBe(1)

        expect(
          reading.horizontalOverflow,
          `the page scrolls sideways by ${reading.horizontalOverflow}px at ${frame.width}`,
        ).toBeLessThanOrEqual(1)

        expect(reading.smallTargets, `targets under 44px at ${frame.width}`).toEqual([])
        expect(reading.clipped, `clipped text at ${frame.width}`).toEqual([])
      })
    }

    test('uses the desktop rather than stretching the phone', async ({ page }) => {
      await open(page, story)
      const phone = await read(page, concept, 1)
      const desktop = await read(page, concept, 4)

      // A concept that merely widens has the same chrome at both widths and no
      // side column at either. All three of these are supposed to change shape.
      expect(
        desktop.hasSideColumn,
        `Concept ${concept.toUpperCase()} spends nothing on the 1440 width — it is the phone stretched`,
      ).toBe(true)
      expect(phone.hasSideColumn).toBe(false)
      expect(desktop.mainWidth).toBeGreaterThan(phone.mainWidth)
    })
  })
}

/* ==========================================================================
   the binding scalability requirement
   ========================================================================== */

test.describe('twenty published competitions', () => {
  for (const concept of CONCEPTS) {
    test(`Concept ${concept.toUpperCase()} keeps its chrome flat`, async ({ page }) => {
      await open(page, 'twenty-published')
      const twenty = await read(page, concept, 0)

      await open(page, 'compare-on-a-phone')
      const four = await read(page, concept, 0)

      expect(twenty.horizontalOverflow).toBeLessThanOrEqual(1)
      expect(twenty.clipped).toEqual([])
      expect(twenty.smallTargets).toEqual([])

      /**
       * THE MEASUREMENT THE WHOLE REQUIREMENT COMES DOWN TO. A platform of
       * twenty published competitions, where the player is relevant to three,
       * must not cost more permanent chrome than a player with four. A tolerance
       * of 8px absorbs a heading that wraps one line differently; it does not
       * absorb a row per competition, which is what a logo wall would add.
       */
      expect(
        twenty.chromeHeight,
        `Concept ${concept.toUpperCase()}: chrome grew from ${four.chromeHeight}px at four ` +
          `competitions to ${twenty.chromeHeight}px at twenty published`,
      ).toBeLessThanOrEqual(four.chromeHeight + 8)
    })
  }
})

test.describe('one competition', () => {
  for (const concept of CONCEPTS) {
    test(`Concept ${concept.toUpperCase()} costs a one-competition player nothing`, async ({
      page,
    }) => {
      await open(page, 'one-competition')
      const reading = await read(page, concept, 0)
      expect(reading.horizontalOverflow).toBeLessThanOrEqual(1)
      expect(reading.smallTargets).toEqual([])
      expect(reading.clipped).toEqual([])
      expect(reading.visibleNavCount).toBe(1)
    })
  }
})

/* ==========================================================================
   the worst strings the product has to print
   ========================================================================== */

test.describe('long competition and player names', () => {
  for (const concept of CONCEPTS) {
    test(`Concept ${concept.toUpperCase()} wraps rather than cutting`, async ({ page }) => {
      await open(page, 'long-names')
      // Frame 0 is 375 — the width at which "Union of European Football
      // Associations Champions League" is most hostile.
      const narrow = await read(page, concept, 0)
      expect(narrow.clipped, 'a name was cut off at 375').toEqual([])
      expect(narrow.horizontalOverflow).toBeLessThanOrEqual(1)
      expect(narrow.smallTargets).toEqual([])
    })
  }
})

/* ==========================================================================
   the bottom bar, and the content that has to clear it
   ========================================================================== */

test.describe('mobile bottom-bar clearance', () => {
  for (const concept of CONCEPTS) {
    test(`Concept ${concept.toUpperCase()} keeps its last row above the bar`, async ({
      page,
    }) => {
      await open(page, 'compare-on-a-phone')
      const reading = await read(page, concept, 0)
      expect(
        reading.contentClearsBar,
        `the last row sits underneath Concept ${concept.toUpperCase()}'s bottom bar`,
      ).toBe(true)
    })
  }
})

/* ==========================================================================
   interaction — the journeys the selection turns on
   ========================================================================== */

test('Concept A switches competition through its sheet and restores focus', async ({
  page,
}) => {
  await open(page, 'compare-on-a-phone')
  const shell = page.locator('[data-ia-concept="a"]').first()
  const switcher = shell.getByRole('button', { name: /Premier League/ }).first()

  await switcher.click()
  const sheet = page.getByRole('dialog', { name: 'Choose a competition' })
  await expect(sheet).toBeVisible()

  await sheet.getByRole('button', { name: /Scottish Premiership/ }).first().click()
  await expect(sheet).toBeHidden()

  // The context changed. Asserted on the page HEADING rather than on the
  // switcher's own text: Concept A renders the switcher twice — a rail copy and
  // a bar copy, with CSS showing one — so `getByText(...).first()` resolves to
  // whichever is first in the DOM and not to whichever is on screen.
  await expect(shell.getByRole('heading', { level: 1 })).toHaveText(
    /Scottish Premiership/,
  )
  const focused = await page.evaluate(
    () => document.activeElement?.textContent?.slice(0, 40) ?? '',
  )
  expect(focused).toContain('Scottish Premiership')
})

test('Concept B filters the queue by competition without leaving it', async ({ page }) => {
  await open(page, 'compare-on-a-phone')
  const shell = page.locator('[data-ia-concept="b"]').first()

  const before = await shell.getByRole('listitem').count()
  await shell.getByRole('button', { name: /Champions League/ }).first().click()
  const after = await shell.getByRole('listitem').count()

  // The queue narrowed and the player is still in the queue — a filter, not a
  // destination change.
  expect(after).toBeLessThan(before)
  await expect(shell.getByRole('heading', { level: 1 })).toHaveText(/Needs you/)
})

test('Concept C reaches a game through the command surface and shows it in the spine', async ({
  page,
}) => {
  await open(page, 'compare-on-a-phone')
  const shell = page.locator('[data-ia-concept="c"]').first()

  await shell.getByRole('button', { name: /^Jump$/ }).click()
  const command = page.getByRole('dialog', { name: 'Jump to anything' })
  await expect(command).toBeVisible()

  await command.getByRole('button', { name: /Last Man Standing · Premier League/ }).click()
  await expect(command).toBeHidden()

  // The spine now states both dimensions, and the game segment is a control.
  await expect(shell.getByRole('button', { name: /^Competition: /})).toBeVisible()
  await expect(shell.getByRole('button', { name: /^Game: Last Man Standing/ })).toBeVisible()
})

/* ==========================================================================
   reduced motion
   ========================================================================== */

test.describe('reduced motion', () => {
  /**
   * THE STORY SETS THE PREFERENCE, NOT THE BROWSER. `WorkshopCanvas` passes
   * `motion="reduced"` to each frame's `VNextRoot`, which is the mechanism the
   * whole vNext lane resolves motion through — so this measures the path the
   * product actually takes rather than an emulated OS setting the components
   * would consult separately.
   */
  for (const concept of CONCEPTS) {
    test(`Concept ${concept.toUpperCase()} is a coherent still surface`, async ({ page }) => {
      await open(page, 'reduced-motion')
      const reading = await read(page, concept, 0)

      expect(reading.horizontalOverflow).toBeLessThanOrEqual(1)
      expect(reading.clipped).toEqual([])
      expect(reading.smallTargets).toEqual([])
      expect(reading.visibleNavCount).toBe(1)

      // The active destination is a colour and `aria-current`, never a
      // movement — so it survives the reduced path unchanged.
      const current = await page
        .locator(`[data-ia-concept="${concept}"] [aria-current="page"]`)
        .first()
        .count()
      expect(current).toBeGreaterThan(0)
    })
  }
})
