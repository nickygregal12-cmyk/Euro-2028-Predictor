import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Which global navigation a browser project actually sees.
 *
 * WHY THIS EXISTS. The signed-in shell renders BOTH navigations — the five-tab
 * bottom bar and the persistent desktop rail — and a CSS media query at 1024px
 * decides which is displayed. Both are in the DOM at every width deliberately,
 * so that no JavaScript width measurement decides navigation and neither can
 * flicker on first paint; the consequence for a browser test is that "the
 * global navigation" is a different element in the `desktop-chromium` project
 * (1280px) than in `mobile-chromium` (Pixel 7).
 *
 * Before the rail existed, every spec asked for the bar by name and was right
 * in both projects. Asking for it by name now would fail on desktop, where it
 * is display:none and therefore absent from the accessibility tree — which is
 * exactly the behaviour that is wanted and would look like a regression.
 *
 * THE DESTINATIONS ARE THE SAME FIVE IN BOTH. Only the Leagues label differs:
 * "Leagues & Competitions" on desktop, where there is room for the distinction
 * between a private league and a competition to be made.
 */

const DESKTOP_BREAKPOINT = 1024

export function isDesktopViewport(page: Page): boolean {
  const width = page.viewportSize()?.width ?? 0
  return width >= DESKTOP_BREAKPOINT
}

/** The navigation the viewer can actually see and operate at this width. */
export function globalNav(page: Page): Locator {
  return page.getByRole('navigation', { name: isDesktopViewport(page) ? 'Sections' : 'Primary' })
}

/** The five global destinations, labelled as this width labels them. */
export function globalDestinations(page: Page): readonly (readonly [string, string])[] {
  return [
    ['Home', '/'],
    ['Play', '/play'],
    ['Matches', '/matches'],
    [isDesktopViewport(page) ? 'Leagues & Competitions' : 'Leagues', '/leagues'],
    // The More TAB is a phone destination: on desktop the rail reaches its
    // contents — How to play, Profile, Account — directly, so there is no index
    // page to send anyone to.
    ['More', '/more'],
  ] as const
}

/**
 * Assert that the global navigation offers its five destinations, and that the
 * other one is not on screen. The second half is the half worth keeping: two
 * visible global navigations would be the failure this composition is designed
 * to avoid.
 */
export async function expectGlobalNavigation(page: Page): Promise<void> {
  const nav = globalNav(page)
  await expect(nav).toBeVisible()

  for (const [label, href] of globalDestinations(page)) {
    if (isDesktopViewport(page) && label === 'More') continue
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href)
  }

  const other = page.getByRole('navigation', {
    name: isDesktopViewport(page) ? 'Primary' : 'Sections',
  })
  await expect(other).toBeHidden()
}
