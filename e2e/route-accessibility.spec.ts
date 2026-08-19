import { expect, test } from '@playwright/test'
import { globalNav } from './global-navigation'

const liveRegion = '[aria-live="polite"][aria-atomic="true"]'

test('keyboard navigation preserves skip target, route focus and announcements', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Home | Predictor Hub')

  const skipLink = page.getByRole('link', { name: 'Skip to main content' })
  const main = page.locator('#main-content')
  await page.keyboard.press('Tab')
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(main).toBeFocused()

  const playLink = globalNav(page).getByRole('link', { name: 'Play', exact: true })
  await playLink.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL((url) => url.pathname === '/play')
  await expect(page).toHaveTitle('Play | Predictor Hub')
  await expect(main).toBeFocused()
  await expect(page.locator(liveRegion)).toHaveText('Play page loaded')

  const homeLink = globalNav(page).getByRole('link', { name: 'Home', exact: true })
  await homeLink.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL((url) => url.pathname === '/')

  await page.goto('/competitions')
  await expect(page).toHaveURL((url) => url.pathname === '/competitions', { timeout: 15_000 })
  const competitionLink = main.getByRole('link', { name: /Scottish Premiership/ }).first()
  await competitionLink.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(
    (url) => url.pathname === '/competitions/scottish-premiership/2026-27',
    { timeout: 15_000 },
  )
  await expect(main).toBeFocused()

  const competitionPlay = page
    .getByRole('navigation', { name: 'Scottish Premiership sections' })
    .getByRole('link', { name: 'Play', exact: true })
  await competitionPlay.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(
    (url) => url.pathname === '/competitions/scottish-premiership/2026-27/play',
  )
  await expect(page).toHaveTitle('Scottish Premiership 2026/27 Play | Predictor Hub')
  await expect(main).toBeFocused()
  await expect(page.locator(liveRegion)).toHaveText(
    'Scottish Premiership 2026/27 Play page loaded',
  )
})
