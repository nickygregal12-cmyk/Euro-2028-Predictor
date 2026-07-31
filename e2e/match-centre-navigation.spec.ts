import { expect, test } from '@playwright/test'
import { expectNoSeriousAxeViolations } from './axe-scan'

test.describe('Match Centre browser navigation', () => {
  test('opens from Matches and returns to the preserved fixture view', async ({ page }) => {
    await page.goto('/matches?view=date#fixtures')

    await expect(page.getByRole('heading', { name: 'Matches' })).toBeVisible()

    const fixture = page.getByRole('button').filter({ hasText: 'No prediction' }).first()
    await expect(fixture).toBeVisible()
    await fixture.click()

    await expect(page).toHaveURL(/\/match\/[^?#]+$/)
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()

    // The Match Centre reached the way a user reaches it, with a real fixture
    // behind it rather than a /dev preview scenario.
    await expectNoSeriousAxeViolations(page, '/match/:matchRef')

    await page.getByRole('button', { name: 'Back' }).click()

    await expect(page).toHaveURL(/\/matches\?view=date#fixtures$/)
    await expect(page.getByRole('heading', { name: 'Matches' })).toBeVisible()
  })

  test('keeps the routed Match Centre shell within the viewport', async ({ page }) => {
    await page.goto('/matches')

    const fixture = page.getByRole('button').filter({ hasText: 'No prediction' }).first()
    await expect(fixture).toBeVisible()
    await fixture.click()

    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasHorizontalOverflow).toBe(false)
  })
})

const lifecycleScenarios = [
  { scenario: 'scheduled', heading: 'Match preview' },
  { scenario: 'lineupsUnavailable', heading: 'Starting soon', notice: 'Match data is provisional' },
  { scenario: 'live', heading: 'Second half' },
  { scenario: 'fullTime', heading: 'Match complete' },
  { scenario: 'stale', heading: 'First half', notice: 'Live match data delayed' },
  { scenario: 'unavailable', heading: 'Match preview', notice: 'Live match data unavailable' },
] as const

test.describe('Match Centre deterministic lifecycle scenarios', () => {
  for (const scenario of lifecycleScenarios) {
    test(`${scenario.scenario} renders its lifecycle and feed-quality state`, async ({ page }) => {
      await page.goto(`/dev/match-centre/${scenario.scenario}`)

      await expect(page.getByRole('heading', { name: scenario.heading })).toBeVisible()
      await expect(page.getByText('Scotland')).toBeVisible()
      await expect(page.getByText('Germany')).toBeVisible()

      if ('notice' in scenario) {
        await expect(page.getByText(scenario.notice)).toBeVisible()
      }

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(hasHorizontalOverflow).toBe(false)
    })
  }
})
