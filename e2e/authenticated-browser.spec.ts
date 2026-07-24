import { expect, test } from '@playwright/test'

async function expectAuthenticatedPath(page: import('@playwright/test').Page, path: string) {
  await expect(page).toHaveURL((url) => url.pathname === path, { timeout: 15_000 })
  await expect(page).not.toHaveURL(/\/auth\/login/)
}

test('authenticated user reaches core routes', async ({ page }) => {
  await page.goto('/')
  await expectAuthenticatedPath(page, '/')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()

  await page.goto('/predict')
  await expectAuthenticatedPath(page, '/predict')
  await expect(page.getByRole('heading', { name: 'Predict' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Groups A–F/ })).toBeVisible()

  await page.goto('/matches')
  await expectAuthenticatedPath(page, '/matches')
  await expect(page.getByRole('button', { name: 'By group' })).toBeVisible()

  await page.goto('/profile')
  await expectAuthenticatedPath(page, '/profile')
  await expect(page.getByText('E2E Tester', { exact: true })).toBeVisible()
})

test('group score persists, clears, and stays cleared after reload', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The mutation journey runs once; route smoke covers both viewports.',
  )

  await page.goto('/predict/groups/A')
  await expectAuthenticatedPath(page, '/predict/groups/A')
  await expect(page.getByText('Group A', { exact: true }).first()).toBeVisible()

  const home = page.getByLabel('Team A1 score').first()
  const away = page.getByLabel('Team A2 score').first()
  await expect(home).toBeVisible()
  await expect(away).toBeVisible()

  await home.fill('2')
  await away.fill('1')
  await expect(page.getByText('Saving…').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('Saved').first()).toBeVisible({ timeout: 10_000 })

  await page.reload()
  await expect(home).toHaveValue('2')
  await expect(away).toHaveValue('1')

  await home.fill('')
  await away.fill('')
  await expect(page.getByText('Saving…').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('Saved').first()).toBeVisible({ timeout: 10_000 })

  await page.reload()
  await expect(home).toHaveValue('')
  await expect(away).toHaveValue('')
})
