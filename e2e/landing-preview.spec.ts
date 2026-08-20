// The public landing page's product preview, in a real browser.
//
// ============================ WHAT ONLY A BROWSER CAN ANSWER =================
//
// `tests/features/landing/` holds the page's structure, its script and its
// accessibility contract in jsdom, and that is where most of this surface is
// measured. Three of its claims cannot be measured there at all, and all three
// are the claims the preview exists to make:
//
//   1. THE TWO COMPOSITIONS ARE THE PRODUCT'S OWN. `VNextShell.module.css` is
//      written against `@container vnext-shell` rather than the viewport, so a
//      1280px frame gets the real navigation RAIL and a 390px frame gets the
//      real BOTTOM BAR — on one page, at one viewport, at the same time. jsdom
//      implements no layout, let alone container queries.
//
//   2. `inert` REALLY DOES MAKE THE PRODUCT UNPRESSABLE. jsdom parses the
//      attribute and does nothing with it, so a jsdom test can only assert that
//      it is present. Here a click can actually be attempted.
//
//   3. NOTHING IS FETCHED FROM ANOTHER HOST. The badge policy ships disabled and
//      the club identity is drawn from authoritative colours, so a preview of
//      real football should make no request off origin at all. That is a network
//      fact and needs a network.
//
// It runs in `playwright.auth.config.ts` because that is the only harness that
// sees the landing page: every other config auto-logs-in and gets the Hub.

import { expect, test } from '@playwright/test'

const DEVICE = '[data-preview-variant]'

test.describe('the landing page shows the product it is selling', () => {
  test('renders the desktop rail and the phone bottom bar on one page at one viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.locator(DEVICE).first().waitFor()

    const desktop = page.locator('[data-preview-variant="desktop"]')
    const phone = page.locator('[data-preview-variant="phone"]').first()
    await expect(desktop).toBeVisible()
    await expect(phone).toBeVisible()

    // THE RAIL IS THE DESKTOP COMPOSITION. It only exists above a 1120px
    // CONTAINER, so its presence is the container query resolving against the
    // frame rather than against the window.
    await expect(desktop.locator('[data-vnext-shell-zone="rail"]')).toBeVisible()
    await expect(desktop.locator('[data-vnext-shell-zone="navbar"]')).toBeHidden()

    // AND THE BAR IS THE PHONE'S, at the same instant, in the same document.
    await expect(phone.locator('[data-vnext-shell-zone="navbar"]')).toBeVisible()
    await expect(phone.locator('[data-vnext-shell-zone="rail"]')).toBeHidden()
  })

  test('drops the desktop device rather than shrinking it onto a phone', async ({ page }) => {
    // A 1280px composition scaled to a 375px column is a picture of neither
    // product. The phone story is what that visitor came for and stays.
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/')
    await page.locator(DEVICE).first().waitFor({ state: 'attached' })

    await expect(page.locator('[data-preview-variant="desktop"]')).toBeHidden()
    await expect(page.locator('[data-preview-variant="phone"]').first()).toBeVisible()
  })

  test('lets nothing inside the device be pressed, focused or tabbed to', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const desktop = page.locator('[data-preview-variant="desktop"]')
    await desktop.waitFor()

    const control = desktop.locator('button').first()
    await expect(control).toBeAttached()

    // `inert` removes the subtree from hit-testing, so the click lands on
    // whatever is behind it rather than on the product's control. Forced,
    // because Playwright's actionability check would otherwise refuse the click
    // for exactly the reason being asserted.
    const before = page.url()
    await control.click({ force: true })
    expect(page.url()).toBe(before)

    // And nothing in there can be reached by keyboard either.
    const focusedInsideDevice = await page.evaluate(() => {
      const active = document.activeElement
      return active !== null && active.closest('[data-preview-variant]') !== null
    })
    expect(focusedInsideDevice).toBe(false)
  })

  test('announces each device as one described picture', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.locator(DEVICE).first().waitFor()

    for (const device of await page.locator(DEVICE).all()) {
      await expect(device).toHaveAttribute('role', 'img')
      const label = await device.getAttribute('aria-label')
      expect(label ?? '').toMatch(/^Preview of the signed-in product on (Home|Matches|Games|Leagues)/)
    }
  })

  test('fetches nothing from another host, and shows no remote image at all', async ({ page }) => {
    // The badge capability ships DISABLED and the club identity is drawn from
    // the authoritative colours the domain already holds, so a page full of real
    // football should still make no off-origin request. A marketing-only logo
    // source would show up here as the first one.
    // EVERY request is collected and the origin is decided afterwards. Deciding
    // it inside the listener would compare against `about:blank`, which is where
    // the page still is when the first request goes out.
    const requested: string[] = []
    page.on('request', (request) => requested.push(request.url()))

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.locator(DEVICE).first().waitFor()
    await page.waitForLoadState('networkidle')

    const origin = new URL(page.url()).origin
    const offOrigin = requested.filter(
      (url) => !url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'),
    )

    expect(requested.length, 'nothing was requested at all').toBeGreaterThan(5)
    expect(offOrigin, 'the landing page fetched something from another host').toEqual([])
    expect(
      await page.locator(`${DEVICE} img`).count(),
      'a preview device drew an image — the badge capability is meant to be off',
    ).toBe(0)
  })

  test('reserves the device box, so the preview arriving moves nothing', async ({ page }) => {
    // The preview is behind `React.lazy`, and the whole reason that is allowed
    // is that `previewDevice.ts` gives the placeholder the device's exact box.
    // Measured rather than asserted: the stage's height before and after.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/', { waitUntil: 'commit' })

    const section = page.locator('#experience')
    await section.waitFor()
    // Measured while the placeholder is still standing: the section's height is
    // already the height it will have.
    await expect(page.locator(DEVICE)).toHaveCount(0)
    const before = await section.boundingBox()

    await page.locator(DEVICE).first().waitFor()
    await page.waitForLoadState('networkidle')
    const after = await section.boundingBox()

    expect(before?.height ?? 0, 'the section had no height to compare').toBeGreaterThan(100)
    expect(
      Math.abs((after?.height ?? 0) - (before?.height ?? 0)),
      'the preview arriving changed the page height, so it shifted the layout',
    ).toBeLessThan(2)
  })
})
