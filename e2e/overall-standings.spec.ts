import { expect, test, type Page, type TestInfo } from '@playwright/test'
import {
  clearOverallStandingsFixture,
  prepareOverallStandingsFixture,
} from './overall-standings-local'

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The 55-user standings lifecycle is stateful and runs once.',
  )
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/account')
  await expect(page).toHaveURL((url) => url.pathname === '/account', {
    timeout: 15_000,
  })
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  const signOutDialog = page.getByRole('dialog', { name: 'Sign out?' })
  await signOutDialog
    .getByRole('button', { name: 'Sign out', exact: true })
    .click()

  await expect(page).toHaveURL((url) => url.pathname === '/auth/login', {
    timeout: 15_000,
  })
  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/', {
    timeout: 15_000,
  })
}

test('overall standings page loads bounded pages and preserves your position', async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo)
  test.setTimeout(180_000)

  const fixture = await prepareOverallStandingsFixture(
    `${testInfo.project.name}-retry-${testInfo.retry}`,
  )

  try {
    await loginAs(page, fixture.email, fixture.password)
    await page.goto('/league')
    await expect(page).toHaveURL((url) => url.pathname === '/league', {
      timeout: 15_000,
    })

    const overallCard = page.getByRole('button', {
      name: /All players, everywhere/,
    })
    await expect(overallCard).toContainText("You're", { timeout: 15_000 })
    await overallCard.click()

    await expect(page).toHaveURL((url) => url.pathname === '/league/overall', {
      timeout: 15_000,
    })
    await expect(
      page.getByRole('heading', { name: 'Overall standings' }),
    ).toBeVisible()

    await expect(page.getByText('Your position', { exact: true })).toBeVisible()
    await expect(page.getByText(fixture.displayName, { exact: true })).toBeVisible()
    await expect(page.getByText(/^Showing 50 of /)).toBeVisible()

    await page.getByRole('button', { name: 'Load more standings' }).click()

    await expect(page.getByText('Your position', { exact: true })).toHaveCount(0, {
      timeout: 15_000,
    })
    await expect(
      page.locator('[aria-current="true"]').filter({ hasText: fixture.displayName }),
    ).toBeVisible()
    await expect(page.getByText(/^Showing (?!50 of )\d+ of \d+$/)).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Load more standings' }),
    ).toHaveCount(0)
  } finally {
    await clearOverallStandingsFixture(fixture)
  }
})
