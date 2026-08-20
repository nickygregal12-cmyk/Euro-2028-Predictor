// Automated axe coverage over the surfaces a signed-out visitor sees.
//
// These routes had no accessibility scan at all. `axe-accessibility.spec.ts`
// rides the auto-logged-in harness, and `/auth/login`, `/auth/signup` and
// `/auth/reset` sit behind `RedirectIfAuthed` — so an authenticated scan is
// redirected away before it can look at them. They were deferred on the
// assumption that reaching them needed a sign-out helper.
//
// They did not. `playwright.auth.config.ts` already serves the app with
// `VITE_DEV_AUTOLOGIN=false` for the recovery and capacity journeys, so the
// unauthenticated surfaces were one `testMatch` entry away the whole time.
//
// This matters more than the count suggests: these are where every new user
// arrives, and where the Turnstile widget renders. The widened authenticated
// scan found a critical WCAG violation on its first run, on a route that had
// simply never been looked at.
//
// Same thresholds as the authenticated scan — WCAG 2.0/2.1/2.2 A and AA tags,
// failing on serious and critical impacts.

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Routes reachable with no session, each with the state it renders.
 *
 * `/join/:code` is scanned with a code that matches no league. That is a real
 * user-facing state — a stale or mistyped invite — and it is the one a signed-out
 * visitor is most likely to hit. The valid-code preview needs a seeded league
 * and belongs with the fixtures that already build one.
 */
const ROUTES = [
  // The public landing page (modernisation plan Appendix E). `/` is two pages
  // sharing one path — the Hub signed in, the conversion page signed out — and
  // this harness is the only one that sees the second, so an accessibility
  // scan of `/` from the authenticated suite says nothing about it.
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/reset',
  // Renders without a recovery token: the "link expired or already used" state.
  '/auth/update-password',
  '/join/NOSUCH',
  // ADR 0017's non-affiliation statement, and a page a visitor deciding whether
  // to sign up is exactly the reader for. Public, so it is scanned here rather
  // than in the authenticated pass.
  '/about',
]

const FAIL_IMPACTS = new Set(['critical', 'serious'])

for (const route of ROUTES) {
  test(`axe: no serious or critical WCAG A/AA violations on ${route} when signed out`, async ({
    page,
  }) => {
    await page.goto(route)

    // Assert we actually stayed here. If auto-login were ever enabled for this
    // config, `RedirectIfAuthed` would bounce these routes to `/` and the scan
    // would silently pass against the wrong page — a green result proving
    // nothing, which is the failure mode this whole exercise keeps finding.
    await expect(page).toHaveURL((url) => url.pathname === route, { timeout: 15_000 })

    // Something must have rendered. A blank page has no violations.
    await expect(page.locator('body')).not.toBeEmpty()
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()

    // `incomplete` counts as failing, with `color-contrast` set aside — see
    // `axe-accessibility.spec.ts` for why axe cannot always determine a
    // background even in a real browser, and why contrast coverage survives it.
    //
    // Verified to be a clean no-op on these five routes before it was
    // introduced: scanned in a real browser, they report no unresolved findings
    // at all, so this is a ratchet rather than a change of what passes today.
    const failing = [
      ...results.violations,
      ...results.incomplete.filter((result) => result.id !== 'color-contrast'),
    ].filter((violation) => violation.impact && FAIL_IMPACTS.has(violation.impact))
    const summary = failing
      .map(
        (violation) =>
          `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
            .slice(0, 3)
            .map((node) => node.target.join(' '))
            .join(' | ')}`,
      )
      .join('\n')

    expect(failing, summary).toEqual([])
  })
}
