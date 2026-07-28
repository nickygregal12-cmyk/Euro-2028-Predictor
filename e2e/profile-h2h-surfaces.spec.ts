import { expect, test } from '@playwright/test'
import { clearH2HSurfaceFixture, prepareH2HSurfaceFixture } from './h2h-local'

test('profile and league-to-H2H surfaces work on desktop and phone', async ({ page }, testInfo) => {
  test.setTimeout(150_000)
  const fixture = await prepareH2HSurfaceFixture(
    `${testInfo.project.name}-retry-${testInfo.retry}`,
  )

  try {
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
    await expect(page.getByText('E2E Tester', { exact: true })).toBeVisible()
    await expect(page.getByText(/\d+ leagues?/, { exact: true })).toBeVisible()
    await expect(page.getByText('Some profile data is unavailable')).toHaveCount(0)

    await page.goto(`/league/${fixture.leagueId}`)
    await expect(page.getByRole('heading', { name: fixture.leagueName })).toBeVisible()

    const rivalRow = page
      .getByRole('button')
      .filter({ hasText: fixture.rivalDisplayName })
      .first()
    await expect(rivalRow).toBeVisible()
    await rivalRow.click()
    await page.getByRole('button', { name: 'Head to head', exact: true }).click()

    await expect(page).toHaveURL((url) => url.pathname === `/h2h/${fixture.rivalId}`)
    await expect(page.getByRole('heading', { name: 'Head to head' })).toBeVisible()
    await expect(page.getByText(fixture.rivalDisplayName, { exact: true })).toBeVisible()
    await expect(page.getByText('Total points', { exact: true })).toBeVisible()
    await expect(
      page.getByText(new RegExp(`\\d+\\s+–\\s+${fixture.rivalPoints}`)),
    ).toBeVisible()
    await expect(page.getByText('Head-to-head unavailable')).toHaveCount(0)

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL((url) => url.pathname === `/league/${fixture.leagueId}`)
    await expect(page.getByRole('heading', { name: fixture.leagueName })).toBeVisible()
  } finally {
    await clearH2HSurfaceFixture(fixture)
  }
})
