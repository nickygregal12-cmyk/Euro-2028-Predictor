import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/**
 * An accessibility scan of wherever the caller has already navigated.
 *
 * `axe-accessibility.spec.ts` scans a list of routes it can reach on its own.
 * The routes it could not — a league, a match, another player's profile, a
 * head-to-head — were deferred in `tests/app/axeRouteCoverage.test.ts` with the
 * reason "needs a seeded id". That reason was true of a standalone scan and
 * false of the suite as a whole: `profile-h2h-surfaces`, `private-league-*`,
 * `match-centre-navigation` and `admin-results` already seed those records and
 * already stand on those pages, several assertions deep.
 *
 * So the scan goes to the page rather than the page being rebuilt for the scan.
 * Nothing new is seeded, no new navigation is invented, and the flake surface is
 * whatever the host journey already had.
 *
 * Two routes use it today. `/h2h/:rivalId`, `/profile/:playerId` and
 * `/admin/results` were scanned the same way while this was written — the scans
 * found real defects, which are fixed — but those pages carry a backlog beyond
 * them, and each remaining violation surfaces only one CI run at a time. They
 * stay deferred in `axeRouteCoverage` with that as the stated reason, so the
 * queue is visible rather than the suite being left red.
 *
 * The `route` argument is the declared pattern from `src/App.tsx`, not the
 * concrete path. `axeRouteCoverage` reads these call sites to work out what is
 * covered, so passing `/league/:id` is what closes that deferral — a literal
 * `/league/42` would scan correctly and account for nothing.
 */

/** Same tags as the route scans — WCAG 2.0/2.1/2.2 A and AA. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])

export async function expectNoSeriousAxeViolations(page: Page, route: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()

  // `incomplete` counts, minus `color-contrast` — see `axe-accessibility.spec.ts`.
  // Axe cannot determine a background behind an overlapping element, a gradient
  // or a background image, however real the browser is, and that is not a
  // defect. A contrast failure it *can* compute is a violation and still fails.
  const failing = [
    ...results.violations,
    ...results.incomplete.filter((result) => result.id !== 'color-contrast'),
  ].filter((violation) => violation.impact && FAIL_IMPACTS.has(violation.impact))

  const summary = failing
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}) on ${route}: ${violation.help} — ${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(' '))
          .join(' | ')}`,
    )
    .join('\n')

  expect(failing, summary).toEqual([])
}
