// Automated axe coverage over the key authenticated surfaces (the standing
// "Immediate product gaps" item). This is the automated half of WCAG 2.2 AA
// assurance: it fails on serious/critical violations of the WCAG A/AA rule
// tags; manual review remains separate. Scans ride the same auto-logged-in
// harness as the other authenticated journeys.

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Coverage is guarded by tests/app/axeRouteCoverage.test.ts, which fails when a
// route declared in src/App.tsx is neither scanned here nor recorded there as a
// deliberate deferral. Adding a route to the app is therefore a decision about
// scanning it, rather than something that silently escapes accessibility cover.
const ROUTES = [
  '/',
  '/predict',
  '/prediction-trends',
  '/predict/groups/A',
  '/predict/review',
  '/predict/bracket',
  '/predict/jokers',
  '/predict/third-place',
  '/matches',
  '/games',
  '/games/cup',
  '/games/lms',
  '/games/knockout',
  '/games/ko-predictor',
  '/league',
  '/league/overall',
  '/account',
  '/profile',
  '/more',
  '/more/points',
  '/more/scoring',
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
    // Let data-backed sections settle so we scan real content, not skeletons.
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()

    const failing = results.violations.filter(
      (violation) => violation.impact && FAIL_IMPACTS.has(violation.impact),
    )
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
