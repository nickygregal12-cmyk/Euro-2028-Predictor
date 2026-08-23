import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/** Public/sessionless routes that must be accessible without an account. */
const ROUTES = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/reset',
  '/auth/update-password',
  '/join/NOSUCH',
  '/about',
  '/privacy',
  '/terms',
]

const FAIL_IMPACTS = new Set(['critical', 'serious'])

for (const route of ROUTES) {
  test(`axe: no serious or critical WCAG A/AA violations on ${route} when signed out`, async ({
    page,
  }) => {
    await page.goto(route)
    await expect(page).toHaveURL((url) => url.pathname === route, { timeout: 15_000 })
    await expect(page.locator('body')).not.toBeEmpty()
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()

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
