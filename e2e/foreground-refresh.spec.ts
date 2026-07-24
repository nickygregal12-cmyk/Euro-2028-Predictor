import { expect, test, type Page, type Response, type TestInfo } from '@playwright/test'
import { cleanupEntryRaceUser, prepareEntryRaceUser } from './entry-creation-local'

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The two-page foreground lifecycle runs once; route smoke covers both viewports.',
  )
}

function successfulPredictionWrite(response: Response): boolean {
  return (
    response.url().includes('/rest/v1/match_predictions') &&
    response.request().method() === 'POST' &&
    response.ok()
  )
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/more')
  if (new URL(page.url()).pathname !== '/auth/login') {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Sign out?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/auth/login', {
      timeout: 15_000,
    })
  }

  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 15_000 })
}

async function groupScoreInputs(page: Page) {
  await page.goto('/predict/groups/A')
  const home = page.getByLabel('Team A1 score').first()
  const away = page.getByLabel('Team A2 score').first()
  await expect(home).toBeVisible()
  await expect(away).toBeVisible()
  return { home, away }
}

test('a background page refreshes a score changed in a second page', async ({ page }, testInfo) => {
  desktopOnly(testInfo)
  test.setTimeout(120_000)

  const prepared = await prepareEntryRaceUser()
  let secondPage: Page | null = null

  try {
    await loginAs(page, prepared.email, prepared.password)
    const first = await groupScoreInputs(page)
    await expect(first.home).toHaveValue('')
    await expect(first.away).toHaveValue('')

    secondPage = await page.context().newPage()
    const second = await groupScoreInputs(secondPage)
    await secondPage.bringToFront()
    await expect
      .poll(() => page.evaluate(() => document.visibilityState), { timeout: 10_000 })
      .toBe('hidden')

    const saved = secondPage.waitForResponse(successfulPredictionWrite)
    await second.home.fill('4')
    await second.away.fill('2')
    await saved

    await page.bringToFront()
    await expect
      .poll(() => page.evaluate(() => document.visibilityState), { timeout: 10_000 })
      .toBe('visible')

    await expect(first.home).toHaveValue('4', { timeout: 15_000 })
    await expect(first.away).toHaveValue('2', { timeout: 15_000 })
  } finally {
    await secondPage?.close()
    await cleanupEntryRaceUser(prepared.userId)
  }
})
