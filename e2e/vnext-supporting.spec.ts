import { expect, test } from '@playwright/test'

/**
 * THE STAGE 13 SURFACES, MEASURED BY A REAL ENGINE.
 *
 * Every prior stage carried a browser suite and Stage 13 shipped five surfaces
 * without one. That gap is the point of this file: jsdom computes no layout, so
 * every responsive and target-size claim in `tests/vnext/` is about the MODEL
 * and the MARKUP, and the supporting surfaces are exactly where a claim about
 * the picture is easy to make and impossible to check.
 *
 * WHAT IT ASSERTS, and why each one needs a browser:
 *
 *   1. NO SURFACE SCROLLS SIDEWAYS at any reviewed width, including a
 *      twenty-competition catalogue at 375 and the widest games hub.
 *   2. NO TEXT IS CLIPPED. A competition name, a season name and a game name
 *      are all server-owned strings of unknown length, and a player scanning
 *      for their own competition has to be able to read the whole row.
 *   3. NO CONTROL IS UNDER 44px. Onboarding is the one journey in the product
 *      where every step is a control, on a phone, by somebody who has used the
 *      product for ninety seconds.
 *   4. EVERY SURFACE HAS EXACTLY ONE MAIN AND ONE H1, wired together — the
 *      structural contract the shell owns and each page can break.
 *   5. THE GAMES HUB DRAWS ITS ROWS AT ONE SIZE. Every game the same height at
 *      every width is the anti-promotion rule the hub exists for, and it is a
 *      geometric claim: a stylesheet promoting one game leaves every class
 *      name in place.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE. The page opens at 1280x900, which
 * is the width and height of no frame under review.
 */

const FRAMES = [
  // Account.
  { id: 'vnext-account--frame-ordinary-phone', label: 'the account at 375', width: 375 },
  { id: 'vnext-account--frame-ordinary-tablet', label: 'the account at 768', width: 768 },
  { id: 'vnext-account--frame-ordinary-desktop', label: 'the account at 1920', width: 1920 },
  { id: 'vnext-account--frame-many-follows-phone', label: 'many follows at 375', width: 375 },
  { id: 'vnext-account--frame-unnameable-phone', label: 'an unnameable follow at 375', width: 375 },
  { id: 'vnext-account--frame-new-account-phone', label: 'a new account at 375', width: 375 },
  { id: 'vnext-account--frame-both-unavailable-phone', label: 'both reads failed at 375', width: 375 },
  { id: 'vnext-account--frame-finished-phone', label: 'a finished season at 375', width: 375 },
  // The settings the cutover could not leave behind. The pending-email row is
  // the longest thing on the page and the one most likely to overflow a phone.
  { id: 'vnext-account--frame-email-pending-phone', label: 'an email change pending at 375', width: 375 },
  { id: 'vnext-account--frame-email-pending-desktop', label: 'an email change pending at 1920', width: 1920 },
  { id: 'vnext-account--frame-settings-unavailable-phone', label: 'the details read failed at 375', width: 375 },
  { id: 'vnext-account--frame-no-support-phone', label: 'no administrator configured at 375', width: 375 },

  // The games hub.
  { id: 'vnext-games--frame-all-open-phone', label: 'the games hub at 375', width: 375 },
  { id: 'vnext-games--frame-all-open-tablet', label: 'the games hub at 768', width: 768 },
  { id: 'vnext-games--frame-all-open-desktop', label: 'the games hub at 1920', width: 1920 },
  { id: 'vnext-games--frame-playing-one-phone', label: 'one game played at 375', width: 375 },
  { id: 'vnext-games--frame-left-uncertain-phone', label: 'left and uncertain at 375', width: 375 },
  { id: 'vnext-games--frame-wide-phone', label: 'five games and long names at 375', width: 375 },
  { id: 'vnext-games--frame-wide-desktop', label: 'five games and long names at 1920', width: 1920 },
  { id: 'vnext-games--frame-unavailable-phone', label: 'a read that did not answer at 375', width: 375 },

  // Discovery.
  { id: 'vnext-discovery--frame-catalogue-phone', label: 'the catalogue at 375', width: 375 },
  { id: 'vnext-discovery--frame-catalogue-tablet', label: 'the catalogue at 768', width: 768 },
  { id: 'vnext-discovery--frame-catalogue-desktop', label: 'the catalogue at 1920', width: 1920 },

  // The invite landing.
  { id: 'vnext-invite--frame-league-open-phone', label: 'a league invitation at 375', width: 375 },
  { id: 'vnext-invite--frame-needs-game-first-phone', label: 'a refused league invitation at 375', width: 375 },
  { id: 'vnext-invite--frame-not-found-phone', label: 'an unknown code at 375', width: 375 },
  { id: 'vnext-invite--frame-long-name-desktop', label: 'a very long container name at 1920', width: 1920 },

  // Onboarding.
  { id: 'vnext-onboarding--frame-first-step-phone', label: 'onboarding step one at 375', width: 375 },
  { id: 'vnext-onboarding--frame-first-step-tablet', label: 'onboarding step one at 768', width: 768 },
  { id: 'vnext-onboarding--frame-first-step-desktop', label: 'onboarding step one at 1920', width: 1920 },
  { id: 'vnext-onboarding--frame-clubs-phone', label: 'the club step at 375', width: 375 },
  { id: 'vnext-onboarding--frame-games-phone', label: 'the games step at 375', width: 375 },
  { id: 'vnext-onboarding--frame-games-desktop', label: 'the games step at 1920', width: 1920 },
  { id: 'vnext-onboarding--frame-review-phone', label: 'the review at 375', width: 375 },
  { id: 'vnext-onboarding--frame-partial-phone', label: 'a partly refused setup at 375', width: 375 },
] as const

type Reading = {
  frameWidth: number
  horizontalOverflow: number
  mainCount: number
  headingCount: number
  headingIsWired: boolean
  clipped: string[]
  smallTargets: string[]
  /**
   * The typographic weight of each games-hub row: font size and vertical
   * padding of the row itself. Distinct values mean one game is drawn larger
   * than another, which is the promotion the hub exists to prevent.
   *
   * NOT ROW HEIGHT. A long competition name wraps and the row grows, which is
   * content rather than emphasis — the first draft of this suite asserted equal
   * heights and failed on the five-game world for exactly that reason.
   */
  gameRowWeights: string[]
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

    const clipped: string[] = []
    for (const node of scope.querySelectorAll<HTMLElement>('span, p, h1, h2, h3, li, strong')) {
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

    const smallTargets: string[] = []
    for (const control of scope.querySelectorAll<HTMLElement>(
      'button, a[href], [role="button"], label:has(input), input:not([type="hidden"])',
    )) {
      if (!rendered(control)) continue
      if (getComputedStyle(control).clipPath !== 'none') continue
      // Layout boxes, not client rects: the workshop scales frames with a CSS
      // transform, and a scaled rect reports a 44px control as 18px.
      if (control.offsetWidth < 44 || control.offsetHeight < 44) {
        smallTargets.push(`${describe(control)} @ ${control.offsetWidth}x${control.offsetHeight}`)
      }
    }

    const main = scope.querySelector('main') as HTMLElement | null
    const heading = scope.querySelector('h1')
    const labelledBy = main?.getAttribute('aria-labelledby') ?? null

    const gameRows = [...scope.querySelectorAll<HTMLElement>('[data-vnext-game]')].filter(rendered)

    return {
      frameWidth: (frame ?? document.body).getBoundingClientRect().width,
      horizontalOverflow: Math.max(0, (main?.scrollWidth ?? 0) - (main?.clientWidth ?? 0)),
      mainCount: [...scope.querySelectorAll('main')].filter(rendered).length,
      headingCount: [...scope.querySelectorAll('h1')].filter(rendered).length,
      headingIsWired: Boolean(heading && labelledBy && heading.id === labelledBy),
      clipped,
      smallTargets,
      gameRowWeights: [
        ...new Set(
          gameRows.map((node) => {
            const style = getComputedStyle(node)
            const title = node.querySelector('p, span, h3')
            const titleStyle = title === null ? null : getComputedStyle(title)
            return [
              style.paddingTop,
              style.paddingBottom,
              titleStyle?.fontSize ?? '',
              titleStyle?.fontWeight ?? '',
            ].join('|')
          }),
        ),
      ],
    }
  })
}

async function open(page: import('@playwright/test').Page, id: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'load' })
  await page.waitForSelector('figure [data-vnext] [data-vnext-shell] main')
  await page.waitForTimeout(1200)
}

function expectBaseline(reading: Reading, where: string) {
  expect(reading.horizontalOverflow, `${where} scrolls sideways`).toBe(0)
  expect(reading.mainCount, `${where} should have exactly one main`).toBe(1)
  expect(reading.headingCount, `${where} should have exactly one h1`).toBe(1)
  expect(reading.headingIsWired, `${where} main is not labelled by its own h1`).toBe(true)
  expect(reading.clipped, `${where} clips text`).toEqual([])
  expect(reading.smallTargets, `${where} has controls under 44px`).toEqual([])
}

test.describe('every Stage 13 frame holds the same baseline', () => {
  for (const { id, label, width } of FRAMES) {
    test(label, async ({ page }) => {
      await open(page, id)
      const reading = await read(page)
      expect(Math.round(reading.frameWidth)).toBe(width)
      expectBaseline(reading, label)
    })
  }
})

test('the Account push switch reports persistence without claiming delivery', async ({ page }) => {
  await open(page, 'vnext-account--frame-ordinary-phone')
  const control = page.getByRole('switch', { name: /Push notifications/ })

  await expect(control).not.toBeChecked()
  await control.click()
  await expect(control).toBeChecked()
  await expect(page.getByRole('status')).toHaveText('Push preference saved.')
  await expect(page.locator('body')).not.toContainText(/\b(sent|delivered|we emailed)\b/i)
})

/**
 * THE RULE THE GAMES HUB EXISTS FOR.
 *
 * Last Man Standing was under-scoped for a whole programme because nothing put
 * it beside its peers, and a hub that draws one game larger is doing the same
 * thing again with better spacing. Structural tests cannot see it: a stylesheet
 * promoting one game leaves every class name in place.
 */
test.describe('the games hub promotes no game over its peers', () => {
  for (const { id, label } of [
    { id: 'vnext-games--frame-all-open-phone', label: 'at 375' },
    { id: 'vnext-games--frame-all-open-desktop', label: 'at 1920' },
    { id: 'vnext-games--frame-wide-phone', label: 'with five games at 375' },
  ] as const) {
    test(`no row is drawn larger than its peers ${label}`, async ({ page }) => {
      await open(page, id)
      const reading = await read(page)
      expect(
        reading.gameRowWeights,
        `rows differ in type size or padding ${label}: ${reading.gameRowWeights.join(' / ')}`,
      ).toHaveLength(1)
    })
  }
})

/**
 * GAMES LEADS WITH THE ACTION, IN A REAL ENGINE.
 *
 * `DFA-006`'s rule is that a card's primary control is the action where the
 * game is asking and a destination where it is not. Vitest proves the mapping;
 * what a browser adds is that the difference SURVIVES a 375px column — the
 * width where an action verb is longest relative to the space it has — and that
 * a settled row really has nothing to press.
 *
 * The distinction is counted rather than described: a report and a task differ
 * by whether the row carries an action verb.
 */
test.describe('the games hub leads with the action', () => {
  test('gives an asking game its own verb and a reporting one a destination', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto('/iframe.html?id=vnext-games--frame-asking-phone&viewMode=story', {
      waitUntil: 'load',
    })
    await page.waitForSelector('[data-vnext-game]')

    const predictor = page.locator('[data-vnext-game="g-main"]')
    const lms = page.locator('[data-vnext-game="g-lms"]')
    const cup = page.locator('[data-vnext-game="g-cup"]')

    await expect(predictor.getByRole('button', { name: /Predict this matchweek/ })).toBeVisible()
    await expect(lms.getByRole('button', { name: /Pick your club/ })).toBeVisible()

    // The Championship is riding on points the player is already earning. It
    // reports its matchup and keeps a destination verb.
    await expect(cup).toContainText('Matchday 3')
    await expect(cup.locator('button[data-asking="true"]')).toHaveCount(0)
  })

  test('gives a settled week no action verb at all', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto('/iframe.html?id=vnext-games--frame-settled-phone&viewMode=story', {
      waitUntil: 'load',
    })
    await page.waitForSelector('[data-vnext-game]')

    await expect(page.locator('button[data-asking="true"]')).toHaveCount(0)
    await expect(page.locator('[data-vnext-game="g-lms"]')).toContainText('you are out')
  })

  test('keeps every action target tappable at 375', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto('/iframe.html?id=vnext-games--frame-asking-phone&viewMode=story', {
      waitUntil: 'load',
    })
    await page.waitForSelector('[data-vnext-game]')

    const small = await page.evaluate(() =>
      [...document.querySelectorAll('[data-vnext-game] button')]
        .map((node) => ({
          label: (node.textContent ?? '').trim().slice(0, 32),
          height: Math.round(node.getBoundingClientRect().height),
        }))
        .filter((entry) => entry.height < 44),
    )

    expect(small, 'controls under the 44px target').toEqual([])
  })
})
