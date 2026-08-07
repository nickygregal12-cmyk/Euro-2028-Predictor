// Automated axe coverage over the active weekly frontend. Tournament-only
// routes are not scanned here: Domestic Frontend Alpha Phase 1 deliberately
// retired that route tree from this App, and its browser journeys are retained
// separately as parked Euro 2028 return evidence.

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const ROUTES = [
  '/',
  '/play',
  '/matches',
  '/leagues',
  '/more',
  '/account',
  '/profile',
  '/more/scoring',
  '/competitions/premier-league/2026-27',
  '/competitions/premier-league/2026-27/play',
  '/competitions/premier-league/2026-27/matches',
  '/competitions/premier-league/2026-27/games',
  '/competitions/premier-league/2026-27/leagues',
  '/competitions/scottish-premiership/2026-27',
]

const FAIL_IMPACTS = new Set(['critical', 'serious'])

for (const route of ROUTES) {
  test(`axe: no serious or critical WCAG A/AA violations on ${route}`, async ({
    page,
  }) => {
    await page.goto(route)
    await expect(page).toHaveURL((url) => url.pathname === route, {
      timeout: 15_000,
    })
    await expect(page.locator('#main-content')).toBeVisible()
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()

    // Keep undecided serious/critical findings in the gate. Contrast is the one
    // exception on the incomplete side because overlap/background composition
    // can stop axe computing a background; computable contrast violations still
    // fail normally.
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
