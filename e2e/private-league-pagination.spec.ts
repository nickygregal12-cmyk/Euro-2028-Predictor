import { expect, test, type Page, type TestInfo } from '@playwright/test'
import {
  clearPrivateLeagueFixture,
  preparePrivateLeagueFixture,
} from './private-league-local'

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The 56-member private-league lifecycle is stateful and runs once.',
  )
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/more')
  await expect(page).toHaveURL((url) => url.pathname === '/more', {
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

test('private league pages preserve your position and search ownership candidates', async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo)
  test.setTimeout(240_000)

  const fixture = await preparePrivateLeagueFixture(
    `${testInfo.project.name}-retry-${testInfo.retry}`,
  )

  try {
    await page.goto(`/league/${fixture.leagueId}`)
    await expect(page).toHaveURL((url) => url.pathname === `/league/${fixture.leagueId}`, {
      timeout: 15_000,
    })
    await expect(page.getByRole('heading', { name: fixture.leagueName })).toBeVisible()
    await expect(page.getByText('Your position', { exact: true })).toBeVisible()
    await expect(page.getByText('56 of 56', { exact: true })).toBeVisible()
    await expect(page.getByText(fixture.memberDisplayName, { exact: true })).toBeVisible()
    await expect(page.getByText('Showing 50 of 56', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Load more members' }).click()

    await expect(page.getByText('Your position', { exact: true })).toHaveCount(0, {
      timeout: 15_000,
    })
    await expect(
      page.locator('[aria-current="true"]').filter({ hasText: fixture.memberDisplayName }),
    ).toBeVisible()
    await expect(page.getByText('Showing 56 of 56', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Load more members' })).toHaveCount(0)

    await loginAs(page, fixture.ownerEmail, fixture.ownerPassword)
    await page.goto(`/league/${fixture.leagueId}`)
    await expect(page.getByText('You own this', { exact: true })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'League options' }).click()
    await page.getByRole('button', { name: 'Transfer ownership' }).click()

    const dialog = page.getByRole('dialog', { name: 'Transfer ownership' })
    await dialog.getByLabel('Search members').fill(fixture.candidateDisplayName)
    const candidate = dialog.getByRole('radio', { name: fixture.candidateDisplayName })
    await expect(candidate).toBeVisible({ timeout: 15_000 })
    await candidate.click()
    await dialog.getByRole('button', { name: 'Transfer', exact: true }).click()

    await expect(
      page.getByText(`Owner: ${fixture.candidateDisplayName}`, { exact: true }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('You own this', { exact: true })).toHaveCount(0)
  } finally {
    await clearPrivateLeagueFixture(fixture)
  }
})
