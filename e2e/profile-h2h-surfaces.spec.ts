import { expect, test } from '@playwright/test'
import {
  clearH2HSurfaceFixture,
  lockH2HSurfaceFixture,
  prepareH2HSurfaceFixture,
} from './h2h-local'

test('secure player profiles cross lock on desktop and phone', async ({ page }, testInfo) => {
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

    await expect(page.getByText('Stats are hidden until entries lock.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Head to head', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Profile', exact: true }).click()

    await expect(page).toHaveURL((url) => url.pathname === `/profile/${fixture.rivalId}`)
    await expect(page.getByRole('heading', { name: 'Player profile' })).toBeVisible()
    await expect(page.getByText(fixture.rivalDisplayName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/Predictions and stats are hidden until entries lock/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'H2H', exact: true })).toHaveCount(0)
    await expect(page.getByText('Points', { exact: true })).toHaveCount(0)

    await lockH2HSurfaceFixture(fixture)
    await page.reload()

    await expect(page.getByText(fixture.rivalDisplayName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(String(fixture.rivalPoints), { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Points', { exact: true })).toBeVisible()
    await expect(page.getByText('Overall rank', { exact: true })).toBeVisible()
    await expect(page.getByText('Group matches', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'H2H', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'H2H', exact: true }).click()

    await expect(page).toHaveURL((url) => url.pathname === `/h2h/${fixture.rivalId}`)
    await expect(page.getByRole('heading', { name: 'Head to head' })).toBeVisible()
    await expect(page.getByText(fixture.rivalDisplayName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Total points', { exact: true })).toBeVisible()
    await expect(
      page.getByText(new RegExp(`\\d+\\s+–\\s+${fixture.rivalPoints}`)),
    ).toBeVisible()
    await expect(page.getByText('Bracket health', { exact: true })).toBeVisible()
    await expect(page.getByText('Head-to-head unavailable')).toHaveCount(0)

    await page.getByRole('button', { name: 'View player profile', exact: true }).click()
    await expect(page).toHaveURL((url) => url.pathname === `/profile/${fixture.rivalId}`)
    await expect(page.getByText(String(fixture.rivalPoints), { exact: true }).first()).toBeVisible()
  } finally {
    await clearH2HSurfaceFixture(fixture)
  }
})
