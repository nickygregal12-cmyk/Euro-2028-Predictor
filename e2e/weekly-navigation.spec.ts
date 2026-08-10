import { expect, test } from '@playwright/test'
import { expectGlobalNavigation, globalNav } from './global-navigation'

const PREMIER = '/competitions/premier-league/2026-27'

/**
 * The five global destinations, in whichever navigation this width shows — the
 * bottom bar on the phone project, the persistent rail on the desktop one. The
 * helper also asserts the other is NOT on screen, which is the property that
 * matters most: two visible global navigations at one width would be the
 * failure the composition exists to avoid.
 */
test('the weekly Hub exposes the canonical five-destination global shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible()

  await expectGlobalNavigation(page)
})

/**
 * The global bar used to be hidden here, and this test asserted its absence.
 * The design authority says the opposite — the global destinations "remain
 * visible inside competition context" and the rail "never swaps its
 * destinations", so the Hub stays one click away "without a compensating Back
 * to Hub control". The assertion is inverted rather than deleted: the absence
 * was the shipped behaviour and this is the record that it changed.
 */
test('competition mode keeps the global tabs and adds its own beneath them', async ({ page }) => {
  await page.goto(`${PREMIER}/games`)
  await expect(page).toHaveURL((url) => url.pathname === `${PREMIER}/games`, {
    timeout: 15_000,
  })

  await expect(page.getByRole('heading', { name: 'Premier League' })).toBeVisible()

  const primary = globalNav(page)
  await expect(primary).toBeVisible()
  await expect(primary.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
    'href',
    '/',
  )
  // No second way home beside the Home tab.
  await expect(page.getByRole('link', { name: 'Back to Hub' })).toHaveCount(0)

  const sections = page.getByRole('navigation', { name: 'Premier League sections' })
  await expect(sections).toBeVisible()
  await expect(sections.getByText('Games', { exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(sections.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', PREMIER)
  await expect(sections.getByRole('link', { name: 'Play' })).toHaveAttribute(
    'href',
    `${PREMIER}/play`,
  )
  await expect(sections.getByRole('link', { name: 'Matches' })).toHaveAttribute(
    'href',
    `${PREMIER}/matches`,
  )
  await expect(sections.getByRole('link', { name: 'Leagues' })).toHaveAttribute(
    'href',
    `${PREMIER}/leagues`,
  )
})
