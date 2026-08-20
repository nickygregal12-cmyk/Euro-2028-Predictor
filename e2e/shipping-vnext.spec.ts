import { expect, test } from '@playwright/test'

/**
 * RELEASE-CLOSURE ASSERTION, NOT A WORKSHOP TEST.
 *
 * The authenticated Browser E2E job creates a real disposable Supabase user and
 * starts the real application. Historically it never supplied the Football Hub
 * cutover flags, and every route flag fails closed, so this otherwise valuable
 * suite could pass while exercising the legacy application shell that players no
 * longer receive.
 *
 * `.env.e2e` is loaded before Playwright starts Vite. This one assertion makes
 * that selection executable: a legacy application shell cannot satisfy the
 * vNext-owned marker, so an omitted or false cutover flag fails the same suite
 * that is meant to certify the shipping app.
 */
test('authenticated application E2E is running the shipping vNext Hub', async ({ page }) => {
  await page.goto('/')

  const shell = page.locator('[data-vnext-shell]').first()
  await expect(shell).toBeVisible({ timeout: 15_000 })
  await expect(shell.getByRole('main')).toBeVisible()
  await expect(shell.getByRole('navigation').first()).toBeVisible()
})
