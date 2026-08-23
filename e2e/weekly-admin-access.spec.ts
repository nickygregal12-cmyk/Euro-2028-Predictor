import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { expectNoSeriousAxeViolations } from './axe-scan'
import { deleteOrdinaryUser, prepareOrdinaryUser } from './admin-results-local'

async function attachVisual(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(`${name}-${testInfo.project.name}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

async function visibleAdminNav(page: Page, testInfo: TestInfo) {
  if (testInfo.project.name === 'mobile-chromium') {
    const header = page.locator('header').filter({ hasText: 'Control Room' }).first()
    await expect(header).toBeVisible()
    await expect(page.getByLabel('Control Room navigation')).toBeHidden()
    await header.getByText('Sections', { exact: true }).click()
    return header.getByRole('navigation', { name: 'Admin control room' })
  }

  const rail = page.getByLabel('Control Room navigation')
  await expect(rail).toBeVisible()
  return rail.getByRole('navigation', { name: 'Admin control room' })
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/account')
  await expect(page).toHaveURL((url) => url.pathname === '/account', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Sign out?' })
  await dialog.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/auth/login', { timeout: 15_000 })
  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 15_000 })
}

test('the weekly Control Room is responsive, accessible and capability-safe', async ({ page }, testInfo) => {
  await page.goto('/admin')
  await expect(page).toHaveURL((url) => url.pathname === '/admin', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Control Room', exact: true })).toBeVisible()
  await expect(page.locator('[data-admin-control-room]')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAxeViolations(page, '/admin')

  const nav = await visibleAdminNav(page, testInfo)
  for (const label of [
    'Overview',
    'Competitions',
    'Football Data',
    'Games',
    'Results Centre',
    'AI Lab',
    'Analytics',
    'Audit',
    'Notifications',
    'System Health',
  ]) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible()
  }

  // The deterministic admin holds `results + competitions`, not these
  // capabilities. A unified admin shell is not a reason to show dead controls.
  await expect(nav.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Leagues & containers', exact: true })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Euro publication', exact: true })).toHaveCount(0)

  await attachVisual(page, testInfo, 'control-room-overview')

  await nav.getByRole('link', { name: 'Notifications', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible()
  await expect(page.getByText('Delivery disabled', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAxeViolations(page, '/admin?workspace=notifications')
  await attachVisual(page, testInfo, 'control-room-notifications')

  // The same competitions capability owns the existing competition
  // administration route. Keep it in the accessibility floor now that the
  // unified shell no longer needs to defer that route as harness work.
  await page.goto('/admin/season')
  await expect(page).toHaveURL((url) => url.pathname === '/admin/season', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Competition administration' })).toBeVisible()
  await expect(page.locator('[data-admin-control-room]')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAxeViolations(page, '/admin/season')

  // AI Lab keeps its own analytical page but now lives inside the same shell.
  await page.goto('/admin/ai')
  await expect(page).toHaveURL((url) => url.pathname === '/admin/ai', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'AI Lab' })).toBeVisible()
  await expect(page.locator('[data-admin-control-room]')).toBeVisible()
  await expect(page.getByText('Private analysis · administrators only')).toBeVisible()
  await expectNoSeriousAxeViolations(page, '/admin/ai')

  // A guessed address cannot bypass the per-capability navigation boundary.
  await page.goto('/admin/users')
  await expect(page).toHaveURL((url) => url.pathname === '/admin', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Control Room', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Users', exact: true })).toHaveCount(0)

  await page.goto('/admin/euro')
  await expect(page).toHaveURL((url) => url.pathname === '/admin', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Euro 2028 publication' })).toHaveCount(0)
})

test('an ordinary authenticated player gets no Control Room route', async ({ page }, testInfo) => {
  const ordinary = await prepareOrdinaryUser(`control-room-${testInfo.project.name}`)
  try {
    await loginAs(page, ordinary.email, ordinary.password)
    await page.goto('/admin')
    await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 15_000 })
    await expect(page.locator('[data-admin-control-room]')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Control Room', exact: true })).toHaveCount(0)
  } finally {
    await deleteOrdinaryUser(ordinary.id)
  }
})
