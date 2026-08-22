import { randomUUID } from 'node:crypto'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import {
  cleanupPrivatePlayUsers,
  prepareFreshPrivatePlayUser,
  type PrivatePlayUser,
} from './private-play-lifecycle-local'
import { createLocalAdmin } from './local-supabase'

const LONGEST_DISPLAY_NAME = 'Longest Supported Player Display Name 10'

async function expectVNext(page: Page) {
  await expect(page.locator('[data-vnext-shell]:visible')).toBeVisible()
  await expect(page.locator('[data-vnext-shell-zone="navbar"]')).toHaveCount(1)
  await expect(page.locator('body')).not.toContainText('Legacy')
}

async function loginAs(page: Page, user: PrivatePlayUser) {
  await page.goto('/account')
  if (new URL(page.url()).pathname !== '/auth/login') {
    const signOut = page.getByRole('button', { name: 'Sign out', exact: true })
    await expect(signOut).toBeVisible({ timeout: 15_000 })
    await signOut.click()
    const dialog = page.getByRole('dialog', { name: 'Sign out?' })
    if (await dialog.isVisible({ timeout: 750 }).catch(() => false)) {
      await dialog.getByRole('button', { name: 'Sign out', exact: true }).click()
    }
    await expect(page).toHaveURL((url) => url.pathname === '/auth/login', { timeout: 15_000 })
  }

  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15_000 })
  await page.goto('/account')
  await expectVNext(page)
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(`${name}-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
}

async function assertControlFitsViewport(page: Page, accessibleName: string) {
  const control = page.getByRole('button', { name: accessibleName, exact: true })
  await expect(control).toBeVisible()
  const box = await control.boundingBox()
  if (!box) throw new Error(`Account control ${accessibleName} had no visible box.`)
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Shipping account acceptance has no viewport.')
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box.width).toBeGreaterThanOrEqual(36)
  expect(box.height).toBeGreaterThanOrEqual(36)

  const text = (await control.textContent())?.trim() ?? ''
  expect(text).not.toMatch(/^[.·•]$/)
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1)
}

test('Account keeps the longest supported display name recognisable on shipping phone and desktop chrome', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  const width = testInfo.project.name.includes('mobile') ? 390 : 1440
  await page.setViewportSize({ width, height: testInfo.project.name.includes('mobile') ? 844 : 1000 })
  const user = await prepareFreshPrivatePlayUser(`account-long-${randomUUID().slice(0, 6)}`)

  try {
    await loginAs(page, user)
    const row = page.locator('button[data-vnext-setting="display-name"]')
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()

    const field = page.getByLabel('New display name')
    await expect(field).toHaveAttribute('maxlength', '40')
    await field.fill(LONGEST_DISPLAY_NAME)

    const write = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/profiles') &&
        response.request().method() === 'PATCH' &&
        response.ok(),
    )
    await page.getByRole('button', { name: 'Change display name', exact: true }).click()
    await write
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Done', exact: true }).click()

    // A hard reload proves the shell is drawing the stored 40-character name,
    // not only optimistic sheet state. The same accessible account name must
    // survive in the compact avatar and the desktop rail.
    await page.reload()
    await expectVNext(page)
    await assertControlFitsViewport(page, LONGEST_DISPLAY_NAME)
    await expect(page.getByText(LONGEST_DISPLAY_NAME, { exact: true })).toBeVisible()
    await screenshot(page, testInfo, 'account-longest-display-name')
  } finally {
    await cleanupPrivatePlayUsers([user])
  }
})

test('Account missing-profile fallback is Your account / YA rather than punctuation', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  const width = testInfo.project.name.includes('mobile') ? 390 : 1440
  await page.setViewportSize({ width, height: testInfo.project.name.includes('mobile') ? 844 : 1000 })
  const user = await prepareFreshPrivatePlayUser(`account-fallback-${randomUUID().slice(0, 6)}`)

  try {
    const { error } = await createLocalAdmin().from('profiles').delete().eq('id', user.userId)
    if (error) throw error

    await loginAs(page, user)
    await assertControlFitsViewport(page, 'Your account')
    const control = page.getByRole('button', { name: 'Your account', exact: true })
    expect((await control.textContent()) ?? '').toContain('YA')
    await screenshot(page, testInfo, 'account-missing-profile-fallback')
  } finally {
    await cleanupPrivatePlayUsers([user])
  }
})
