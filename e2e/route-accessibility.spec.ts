import { expect, test } from '@playwright/test'

const liveRegion = '[aria-live="polite"][aria-atomic="true"]'

test('keyboard navigation preserves skip target, route focus and announcements', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Choose your competition' })).toBeVisible()
  await expect(page).toHaveTitle('Competitions | Football Prediction Hub')

  const skipLink = page.getByRole('link', { name: 'Skip to main content' })
  const main = page.locator('#main-content')

  await page.keyboard.press('Tab')
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(main).toBeFocused()

  const predictLink = page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Predict', exact: true })

  await predictLink.focus()
  await expect(predictLink).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL((url) => url.pathname === '/play')
  await expect(page).toHaveTitle('Play | Football Prediction Hub')
  await expect(main).toBeFocused()
  await expect(page.locator(liveRegion)).toHaveText('Play page loaded')

  const competitionLink = page.getByRole('link', { name: /Euro 2028 2028/ })
  await competitionLink.focus()
  await expect(competitionLink).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL((url) => url.pathname === '/competitions/euro/2028/play')
  await expect(page).toHaveTitle('Competition play | Football Prediction Hub')
  await expect(main).toBeFocused()
  await expect(page.locator(liveRegion)).toHaveText('Competition play page loaded')
})
