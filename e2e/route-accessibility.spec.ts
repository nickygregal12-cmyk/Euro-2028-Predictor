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

  const playLink = page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Play', exact: true })

  await playLink.focus()
  await expect(playLink).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL((url) => url.pathname === '/play')
  await expect(page).toHaveTitle('Play | Football Prediction Hub')
  await expect(main).toBeFocused()
  await expect(page.locator(liveRegion)).toHaveText('Play page loaded')

  const homeLink = page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Home', exact: true })
  await homeLink.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL((url) => url.pathname === '/')

  const competitionButton = page.getByRole('button', { name: 'View Premier League' })
  await competitionButton.focus()
  await expect(competitionButton).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(
    (url) => url.pathname === '/competitions/premier-league/2026-27',
    { timeout: 15_000 },
  )
  await expect(main).toBeFocused()

  const competitionPlay = page
    .getByRole('navigation', { name: 'Premier League sections' })
    .getByRole('link', { name: 'Play', exact: true })
  await competitionPlay.focus()
  await expect(competitionPlay).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(
    (url) => url.pathname === '/competitions/premier-league/2026-27/play',
  )
  await expect(page).toHaveTitle('Competition play | Football Prediction Hub')
  await expect(main).toBeFocused()
  await expect(page.locator(liveRegion)).toHaveText('Competition play page loaded')
})
