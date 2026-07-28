import { expect, test, type Page, type TestInfo } from '@playwright/test'
import {
  prepareAutomaticSubmissionFixture,
  restoreAutomaticSubmissionFixture,
} from './automatic-submission-local'

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The automatic submission lifecycle is stateful and runs once.',
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

test('complete and incomplete entries expose truthful automatic outcomes', async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo)
  test.setTimeout(180_000)

  const fixture = await prepareAutomaticSubmissionFixture(
    `${testInfo.project.name}-retry-${testInfo.retry}`,
  )
  try {
    await loginAs(page, fixture.complete.email, fixture.complete.password)
    await page.goto('/predict/review')
    await expect(page).toHaveURL((url) => url.pathname === '/predict/review', {
      timeout: 15_000,
    })
    await expect(
      page.getByRole('heading', { name: 'Review and submit' }),
    ).toBeVisible()
    await expect(
      page.getByText('Entry submitted automatically', { exact: true }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/No prediction was changed/)).toBeVisible()

    await loginAs(page, fixture.incomplete.email, fixture.incomplete.password)
    await page.goto('/predict/review')
    await expect(page).toHaveURL((url) => url.pathname === '/predict/review', {
      timeout: 15_000,
    })
    await expect(
      page.getByText('Entry was not submitted automatically', { exact: true }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/remains unsubmitted/)).toBeVisible()
    await expect(
      page.getByText('Group predictions incomplete (0 of 36)', { exact: true }),
    ).toBeVisible()
  } finally {
    await restoreAutomaticSubmissionFixture(fixture)
  }
})
