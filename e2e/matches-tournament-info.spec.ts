// The Matches tab's tournament-info sub-views (design-system §Matches):
// Fixtures stays the default, and the Tables / Bracket / Stats views render
// from real tournament state. Assertions are result-state-agnostic — every
// pinned element exists whether or not any match has been played.

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const FAIL_IMPACTS = new Set(['critical', 'serious'])

async function expectAxeClean(page: Page, context: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const failing = results.violations.filter(
    (violation) => violation.impact && FAIL_IMPACTS.has(violation.impact),
  )
  const summary = failing
    .map((violation) => `${context}: ${violation.id} (${violation.impact}): ${violation.help}`)
    .join('\n')
  expect(failing, summary).toEqual([])
}

test.describe('Matches tournament info sub-views', () => {
  test('switches between Fixtures, Tables, Bracket and Stats', async ({ page }) => {
    await page.goto('/matches')
    await expect(page.getByRole('heading', { name: 'Matches' })).toBeVisible()

    // Fixtures is the default view, with its filter chips intact.
    await expect(page.getByRole('button', { name: 'By group' })).toBeVisible()

    await page.getByRole('button', { name: 'Tables' }).click()
    await expect(page.getByRole('table', { name: 'Group A' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Group F' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Best thirds' })).toBeVisible()

    await page.getByRole('button', { name: 'Bracket' }).click()
    await expect(page.getByRole('heading', { name: 'Round of 16' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Final', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Stats' }).click()
    await expect(page.getByRole('heading', { name: 'Group-stage goals' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Top-scoring teams' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tournament', exact: true })).toBeVisible()

    // Back to Fixtures — the list and its filters return.
    await page.getByRole('button', { name: 'Fixtures' }).click()
    await expect(page.getByRole('button', { name: 'By group' })).toBeVisible()
  })

  test('a bracket tie opens the match centre', async ({ page }) => {
    await page.goto('/matches')
    await page.getByRole('button', { name: 'Bracket' }).click()

    const r16Section = page.locator('section', {
      has: page.getByRole('heading', { name: 'Round of 16' }),
    })
    await r16Section.getByRole('button').first().click()
    await expect(page).toHaveURL(/\/match\/[^?#]+$/)

    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByRole('heading', { name: 'Matches' })).toBeVisible()
  })

  test('each sub-view stays free of serious or critical axe violations', async ({ page }) => {
    await page.goto('/matches')
    await expect(page.getByRole('heading', { name: 'Matches' })).toBeVisible()
    await page.waitForLoadState('networkidle')

    for (const view of ['Tables', 'Bracket', 'Stats'] as const) {
      await page.getByRole('button', { name: view }).click()
      await expectAxeClean(page, view)
    }
  })
})
