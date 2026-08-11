import { expect, test } from '@playwright/test'
import { expectGlobalNavigation, globalNav } from './global-navigation'

/**
 * The SCOTTISH season, because it is the one this environment publishes.
 *
 * Both league seasons are created `draft` by the C1b migration and nothing in
 * the repository moves them out; `e2e/league-season-fixture.sql` opens the
 * Scottish one. Since contract 147 the catalogue is the server's
 * `get_published_weekly_seasons`, which excludes drafts — so a draft season is
 * no longer routable at all, and this spec used to pass only because a static
 * frontend array routed one regardless of its lifecycle. The draft case is
 * asserted below rather than left implied.
 */
const SEASON = '/competitions/scottish-premiership/2026-27'
const DRAFT_SEASON = '/competitions/premier-league/2026-27'

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
  await page.goto(`${SEASON}/games`)
  await expect(page).toHaveURL((url) => url.pathname === `${SEASON}/games`, {
    timeout: 15_000,
  })

  await expect(page.getByRole('heading', { name: 'Scottish Premiership' })).toBeVisible()

  const primary = globalNav(page)
  await expect(primary).toBeVisible()
  await expect(primary.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
    'href',
    '/',
  )
  // No second way home beside the Home tab.
  await expect(page.getByRole('link', { name: 'Back to Hub' })).toHaveCount(0)

  const sections = page.getByRole('navigation', { name: 'Scottish Premiership sections' })
  await expect(sections).toBeVisible()
  await expect(sections.getByText('Games', { exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(sections.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', SEASON)
  await expect(sections.getByRole('link', { name: 'Play' })).toHaveAttribute(
    'href',
    `${SEASON}/play`,
  )
  await expect(sections.getByRole('link', { name: 'Matches' })).toHaveAttribute(
    'href',
    `${SEASON}/matches`,
  )
  await expect(sections.getByRole('link', { name: 'Leagues' })).toHaveAttribute(
    'href',
    `${SEASON}/leagues`,
  )
})

/**
 * A DRAFT season is not routable, and that is the server's decision showing
 * through rather than a frontend omission.
 *
 * WHY THIS ASSERTION EXISTS. Until contract 147 the frontend held a static
 * array of competitions and their route slugs, so a season was openable
 * whatever its lifecycle said — the catalogue and the database could disagree
 * about what was published, and the array won. The catalogue is now
 * `get_published_weekly_seasons`, which excludes `draft` for the same reason a
 * draft is a draft: it is set up and not open.
 *
 * The Premier League season is created `draft` by the C1b migration and this
 * environment never opens it, so it is the case. It must report that the
 * competition could not be found — NOT render a competition shell, and not
 * crash.
 */
test('a season the server has not published cannot be opened', async ({ page }) => {
  await page.goto(DRAFT_SEASON)

  await expect(
    page.getByRole('heading', { name: 'Scottish Premiership' }),
  ).toHaveCount(0)
  await expect(page.getByText('This competition could not be found')).toBeVisible({
    timeout: 15_000,
  })
})
