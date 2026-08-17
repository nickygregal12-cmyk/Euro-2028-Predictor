import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

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
 *   3. EVERY CONTROL CLEARS 44×44 IN BOTH AXES, measured with
 *      `offsetWidth`/`offsetHeight` so the workshop's scaling transform cannot
 *      flatter it.
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

      /**
       * 44×44 MEANS 44×44, IN BOTH AXES.
       *
       * The first build of this suite asserted `offsetHeight >= 44` and
       * `offsetWidth >= 24`, and the lab report claimed every target cleared
       * 44×44. Those are not the same statement, and the report was the one
       * making a promise: a 24px-wide control passes WCAG 2.5.8's minimum and
       * fails 2.5.5 and the vNext tap-target contract, which is what
       * `--vnext-tap-target` exists to hold. The assertion now measures the
       * contract that was written down.
       *
       * THE INTERACTIVE BOX, NOT THE GLYPH. `offsetWidth`/`offsetHeight` are
       * the control's own layout box, so an 18px compass inside a 44px button
       * measures 44 — which is the number a thumb actually meets. They are also
       * layout numbers rather than painted ones, so `WorkshopCanvas`'s scaling
       * transform cannot flatter them.
       *
       * NO EXCEPTIONS ARE CARVED. Every control in all three concepts is a
       * button, an input or the skip link; there is no inline text link in the
       * chrome or in the shared bodies, so the question of whether prose links
       * are held to the same size does not arise here and is deliberately not
       * answered by this lab.
       */
      const smallTargets: string[] = []
      for (const control of shell?.querySelectorAll('button, input, a') ?? []) {
        if (!rendered(control)) continue
        const { offsetWidth, offsetHeight } = control as HTMLElement
        if (offsetHeight < 44 || offsetWidth < 44) {
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

/** Frame 0 is 375 and frame 1 is 430 in the `one-competition` story. */
const PHONE_FRAMES = [
  { index: 0, width: 375 },
  { index: 1, width: 430 },
]

test.describe('one competition', () => {
  for (const concept of CONCEPTS) {
    for (const phone of PHONE_FRAMES) {
      test(`Concept ${concept.toUpperCase()} costs a one-competition player nothing at ${phone.width}`, async ({
        page,
      }) => {
        await open(page, 'one-competition')
        const reading = await read(page, concept, phone.index)
        expect(reading.frameWidth).toBe(phone.width)
        expect(reading.horizontalOverflow).toBeLessThanOrEqual(1)
        expect(reading.smallTargets).toEqual([])
        expect(reading.clipped).toEqual([])
        expect(reading.visibleNavCount).toBe(1)
      })
    }
  }

  /**
   * THE OTHER HALF OF THE ONE-COMPETITION REQUIREMENT.
   *
   * "The product may feel like a one-competition product, but other
   * competitions must remain easy to discover." The first build of Concept A
   * kept the first clause and lost the second: with one owned context the
   * switcher correctly stops being a control, and below 1120 the rail that
   * carried "All competitions" is not rendered at all — so an EPL-only player
   * on a phone had Home, Matches, Games and Leagues, every one of them scoped
   * to the single competition, and no route into the catalogue whatsoever.
   *
   * This is the regression, and it is deliberately expressed as THREE separate
   * facts rather than one: the label must stay a label, the catalogue must stay
   * reachable, and the reachable thing must actually arrive somewhere. A fix
   * that satisfied any two of them would be one of the fixes the review ruled
   * out — a fake chooser, an undocumented route, or a fifth bottom-bar
   * destination.
   */
  for (const phone of PHONE_FRAMES) {
    test(`Concept A keeps discovery reachable for an EPL-only player at ${phone.width}`, async ({
      page,
    }) => {
      await open(page, 'one-competition')
      const frames = page.locator('figure [data-vnext]')
      const shell = frames.nth(phone.index).locator('[data-ia-concept="a"]')

      // 1. THE COMPETITION IS A LABEL AND NOT A FAKE CHOOSER. It is named on
      //    screen — counted among the elements that actually have a box, since
      //    the rail's copy of the switcher is in the DOM at every width — and
      //    pressing it is not a thing the player can do anywhere.
      const named = await shell
        .getByText('Premier League', { exact: true })
        .evaluateAll((elements) => elements.filter((el) => el.getClientRects().length > 0).length)
      expect(named, 'the single competition is not stated anywhere on screen').toBeGreaterThan(0)
      await expect(shell.getByRole('heading', { level: 1 })).toHaveText('Premier League')
      await expect(shell.getByRole('button', { name: /Premier League/ })).toHaveCount(0)

      // 2. DISCOVERY IS VISIBLE, not a gesture and not a route the player has
      //    to already know. Exactly one copy of it is on screen — the rail's
      //    "All competitions" row is not rendered at a phone width.
      const explore = shell.getByRole('button', { name: 'Explore competitions' })
      await expect(explore).toHaveCount(1)
      await expect(explore).toBeVisible()

      // 3. IT IS SECONDARY. The bottom bar still has four destinations and
      //    discovery is not one of them.
      const bottom = shell.getByRole('navigation', { name: 'Competition sections' })
      await expect(bottom.getByRole('button')).toHaveCount(4)
      await expect(bottom.getByRole('button', { name: /Explore/ })).toHaveCount(0)

      // 4. AND IT ARRIVES. The catalogue is the destination, not a sheet
      //    listing the one competition the player already has.
      await explore.click()
      await expect(shell.getByRole('heading', { level: 1 })).toHaveText('Competitions')
      const catalogue = await shell
        .getByRole('main')
        .getByText(/Scottish Premiership|Champions League/)
        .count()
      expect(catalogue).toBeGreaterThan(0)
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

/* --------------------------------------------------------------------------
   focus return, in both layout modes
   -------------------------------------------------------------------------- */

/**
 * THE DEFECT THESE TESTS EXIST FOR, AND WHY THEY HAVE TO RUN IN A BROWSER.
 *
 * All three concepts render their navigation twice and let CSS show one. The
 * first build of the lab restored focus with a single `useRef` shared by both
 * copies (Concept A) and with a hard-coded reference to the phone's Jump button
 * (Concept C). Both are correct on a phone and wrong on a desktop: the element
 * that receives `.focus()` is `display: none`, the browser refuses, and the
 * keyboard user is silently returned to `<body>` at the top of the document.
 *
 * jsdom cannot see any of this. It evaluates no container query, so both copies
 * are "visible" there and both `.focus()` calls appear to work — which is
 * exactly why the unit suite passed while the desktop was broken. The engine is
 * not a nicety here; it is the only witness.
 */

/** The one copy of a duplicated control that CSS is actually showing. */
async function onlyVisible(locator: Locator, what: string): Promise<Locator> {
  const candidates = await locator.all()
  const shown: Locator[] = []
  for (const candidate of candidates) {
    if (await candidate.isVisible()) shown.push(candidate)
  }
  expect(shown.length, `${what}: expected exactly one copy on screen`).toBe(1)
  return shown[0] as Locator
}

/**
 * What actually holds focus, described well enough to fail usefully.
 *
 * `rendered` is the assertion that matters: a `display: none` duplicate has no
 * client rects, and `<body>` is what the browser falls back to when a focus
 * call is refused.
 */
async function activeElement(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null
    return {
      tag: active?.tagName.toLowerCase() ?? '(none)',
      isBody: active === document.body,
      rendered: Boolean(active) && active!.getClientRects().length > 0,
      label:
        active?.getAttribute('aria-label') ?? active?.textContent?.trim().slice(0, 40) ?? '',
    }
  })
}

/** Focus is on the visible opener, and demonstrably not on a hidden twin. */
async function expectFocusReturned(page: Page, opener: Locator, what: string) {
  const active = await activeElement(page)
  expect(active.isBody, `${what}: focus fell to <body>`).toBe(false)
  expect(active.rendered, `${what}: focus landed on a control with no box — ${active.label}`).toBe(
    true,
  )
  await expect(opener, `${what}: focus did not return to the opener`).toBeFocused()
}

const A_OPENER = 'button[aria-haspopup="dialog"]'

for (const layout of [
  { name: 'mobile', story: 'compare-on-a-phone', region: 'header' },
  { name: 'desktop', story: 'compare-on-a-desktop', region: 'nav[aria-label="Competition"]' },
] as const) {
  test.describe(`Concept A focus return — ${layout.name}`, () => {
    test('closing the sheet returns focus to the visible opener', async ({ page }) => {
      await open(page, layout.story)
      const shell = page.locator('[data-ia-concept="a"]').first()

      // The switcher exists twice in the DOM at every width. Exactly one of the
      // two is on screen, and it is the one this test presses.
      const opener = await onlyVisible(shell.locator(A_OPENER), 'Concept A switcher')
      expect(
        await opener.evaluate((element, selector) => Boolean(element.closest(selector)), layout.region),
        `the visible switcher is not the ${layout.name} copy`,
      ).toBe(true)

      await opener.click()
      const sheet = page.getByRole('dialog', { name: 'Choose a competition' })
      await expect(sheet).toBeVisible()

      await sheet.getByRole('button', { name: 'Close' }).click()
      await expect(sheet).toBeHidden()
      await expectFocusReturned(page, opener, `Concept A ${layout.name} close`)
    })

    test('choosing a competition returns focus to the visible opener', async ({ page }) => {
      await open(page, layout.story)
      const shell = page.locator('[data-ia-concept="a"]').first()
      const opener = await onlyVisible(shell.locator(A_OPENER), 'Concept A switcher')

      await opener.click()
      const sheet = page.getByRole('dialog', { name: 'Choose a competition' })
      await expect(sheet).toBeVisible()

      // The selection path closes the sheet separately from the Close button,
      // so it restores focus separately and is tested separately.
      await sheet.getByRole('button', { name: /Scottish Premiership/ }).first().click()
      await expect(sheet).toBeHidden()

      // The context changed. Asserted on the page HEADING rather than on the
      // switcher's own text, because the switcher exists twice.
      await expect(shell.getByRole('heading', { level: 1 })).toHaveText(/Scottish Premiership/)
      await expectFocusReturned(page, opener, `Concept A ${layout.name} selection`)
    })

    test('the hidden copy of the switcher never receives focus', async ({ page }) => {
      await open(page, layout.story)
      const shell = page.locator('[data-ia-concept="a"]').first()
      const opener = await onlyVisible(shell.locator(A_OPENER), 'Concept A switcher')

      await opener.click()
      await page.getByRole('dialog', { name: 'Choose a competition' }).getByRole('button', { name: 'Close' }).click()

      const hidden = await shell.locator(A_OPENER).evaluateAll(
        (elements) =>
          elements
            .filter((element) => element.getClientRects().length === 0)
            .map((element) => element === document.activeElement),
      )
      expect(hidden, 'there is no hidden copy of the switcher to check').not.toEqual([])
      expect(hidden, 'a display:none copy of the switcher holds focus').not.toContain(true)
    })
  })
}

for (const layout of [
  {
    name: 'mobile',
    story: 'compare-on-a-phone',
    region: 'nav[aria-label="Primary"]',
    openerName: /^Jump$/,
  },
  {
    name: 'desktop',
    story: 'compare-on-a-desktop',
    region: 'nav[aria-label="Your play"]',
    openerName: /^Jump to anything$/,
  },
] as const) {
  test.describe(`Concept C focus return — ${layout.name}`, () => {
    test('closing the command surface returns focus to the visible opener', async ({ page }) => {
      await open(page, layout.story)
      const shell = page.locator('[data-ia-concept="c"]').first()

      const opener = await onlyVisible(
        shell.locator('button[aria-haspopup="dialog"]'),
        'Concept C command opener',
      )
      await expect(opener).toHaveAccessibleName(layout.openerName)
      expect(
        await opener.evaluate((element, selector) => Boolean(element.closest(selector)), layout.region),
        `the visible opener is not the ${layout.name} copy`,
      ).toBe(true)

      await opener.click()
      const command = page.getByRole('dialog', { name: 'Jump to anything' })
      await expect(command).toBeVisible()

      await command.getByRole('button', { name: 'Close' }).click()
      await expect(command).toBeHidden()
      await expectFocusReturned(page, opener, `Concept C ${layout.name} close`)
    })

    test('selecting a destination returns focus to the visible opener', async ({ page }) => {
      await open(page, layout.story)
      const shell = page.locator('[data-ia-concept="c"]').first()
      const opener = await onlyVisible(
        shell.locator('button[aria-haspopup="dialog"]'),
        'Concept C command opener',
      )

      await opener.click()
      const command = page.getByRole('dialog', { name: 'Jump to anything' })
      await expect(command).toBeVisible()

      await command.getByRole('button', { name: /Last Man Standing · Premier League/ }).click()
      await expect(command).toBeHidden()

      // The spine states both dimensions, so the jump landed.
      await expect(shell.getByRole('button', { name: /^Game: Last Man Standing/ })).toBeVisible()
      await expectFocusReturned(page, opener, `Concept C ${layout.name} selection`)
    })

    test('the hidden opener never receives focus', async ({ page }) => {
      await open(page, layout.story)
      const shell = page.locator('[data-ia-concept="c"]').first()
      const opener = await onlyVisible(
        shell.locator('button[aria-haspopup="dialog"]'),
        'Concept C command opener',
      )

      await opener.click()
      await page
        .getByRole('dialog', { name: 'Jump to anything' })
        .getByRole('button', { name: 'Close' })
        .click()

      const hidden = await shell.locator('button[aria-haspopup="dialog"]').evaluateAll(
        (elements) =>
          elements
            .filter((element) => element.getClientRects().length === 0)
            .map((element) => element === document.activeElement),
      )
      expect(hidden, 'there is no hidden opener to check').not.toEqual([])
      expect(hidden, 'a display:none opener holds focus').not.toContain(true)
    })
  })
}

/**
 * CONCEPT B, AUDITED IN THE SAME SEAM AND FOUND SAFE.
 *
 * It duplicates its anchors and its filter exactly as the other two duplicate
 * their navigation, so it is exposed to the same class of defect — but it opens
 * no sheet, dialog or menu anywhere, and therefore performs no focus
 * restoration at all. There is nothing to point at the wrong copy. This test
 * holds that property rather than the fix: if Concept B ever grows an overlay,
 * it fails here and has to adopt the same opener capture the other two use.
 */
test('Concept B has no overlay, and therefore no focus to restore', async ({ page }) => {
  await open(page, 'compare-on-a-phone')
  const shell = page.locator('[data-ia-concept="b"]').first()

  await expect(shell.locator('[aria-haspopup]')).toHaveCount(0)
  await expect(shell.getByRole('dialog')).toHaveCount(0)

  // Its one interaction — filtering — moves nothing, so the pressed chip keeps
  // focus and no hidden duplicate can acquire it. Scoped to the masthead, which
  // is where the phone's copy of the filter lives: the queue below it also
  // names competitions, on cards that are not the filter.
  const chip = await onlyVisible(
    shell.locator('header').getByRole('button', { name: /Champions League/ }),
    'Concept B filter chip',
  )
  await chip.click()
  await expectFocusReturned(page, chip, 'Concept B filter')
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
