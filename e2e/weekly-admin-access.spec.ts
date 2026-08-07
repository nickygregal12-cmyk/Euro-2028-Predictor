import { expect, test } from '@playwright/test'
import { expectNoSeriousAxeViolations } from './axe-scan'

test('the protected administrator routes remain reachable in the weekly app', async ({ page }) => {
  await page.goto('/admin/results')
  await expect(page).toHaveURL((url) => url.pathname === '/admin/results', {
    timeout: 15_000,
  })
  await expect(page.getByRole('heading', { name: 'Results Centre' })).toBeVisible()
  await expectNoSeriousAxeViolations(page, '/admin/results')

  await page.goto('/admin/users')
  await expect(page).toHaveURL((url) => url.pathname === '/admin/users', {
    timeout: 15_000,
  })
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  await expect(page.getByText('User controls are not enabled yet')).toBeVisible()
  await expectNoSeriousAxeViolations(page, '/admin/users')
})
