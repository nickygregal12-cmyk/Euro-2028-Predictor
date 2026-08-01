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

  await expect(page).toHaveURL((url) => url.pathname === '/predict')
  await expect(page).toHaveTitle('Predict | Football Prediction Hub')
  await expect(main).toBeFocused()
  await expect(page.locator(liveRegion)).toHaveText('Predict page loaded')

  const groupsButton = page.getByRole('button', { name: /Groups A–F/ })
  await groupsButton.focus()
  await expect(groupsButton).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL((url) => url.pathname === '/predict/groups/A')
  await expect(page).toHaveTitle('Group A predictions | Football Prediction Hub')
  await expect(main).toBeFocused()
  await expect(page.locator(liveRegion)).toHaveText(
    'Group A predictions page loaded',
  )
})
