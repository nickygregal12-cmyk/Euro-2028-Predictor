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

  // Competition administration renders its chrome from the route alone, so this
  // scan does not wait on a seeded domestic season — which is precisely why it
  // can be scanned here while every parameterised /competitions/** route is
  // still deferred. What a harness with a real season would add is the fixture
  // rows and their controls, not this page's structure.
  await page.goto('/admin/season')
  await expect(page).toHaveURL((url) => url.pathname === '/admin/season', {
    timeout: 15_000,
  })
  await expect(page.getByRole('heading', { name: 'Competition administration' })).toBeVisible()
  await expectNoSeriousAxeViolations(page, '/admin/season')

  // Euro publication renders its chrome from the route and one bounded read.
  // The state itself is whatever this environment holds — the fixture does
  // advance it to `prelaunch` for the tournament routes — so this asserts the
  // surface and its scan rather than a particular lifecycle position.
  await page.goto('/admin/euro')
  await expect(page).toHaveURL((url) => url.pathname === '/admin/euro', {
    timeout: 15_000,
  })
  await expect(page.getByRole('heading', { name: 'Euro 2028 publication' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Current state' })).toBeVisible()
  await expectNoSeriousAxeViolations(page, '/admin/euro')
})
