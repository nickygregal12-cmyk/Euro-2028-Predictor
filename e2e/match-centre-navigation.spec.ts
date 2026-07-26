import { expect, test } from '@playwright/test'

test.describe('Match Centre browser navigation', () => {
  test('opens from Matches and returns to the preserved fixture view', async ({ page }) => {
    await page.goto('/matches?view=date#fixtures')

    await expect(page.getByRole('heading', { name: 'Matches' })).toBeVisible()

    const fixture = page.getByRole('button').filter({ hasText: 'No prediction' }).first()
    await expect(fixture).toBeVisible()
    await fixture.click()

    await expect(page).toHaveURL(/\/match\/[^?#]+$/)
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()

    await page.getByRole('button', { name: 'Back' }).click()

    await expect(page).toHaveURL(/\/matches\?view=date#fixtures$/)
    await expect(page.getByRole('heading', { name: 'Matches' })).toBeVisible()
  })

  test('keeps the Match Centre shell within the viewport', async ({ page }) => {
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
