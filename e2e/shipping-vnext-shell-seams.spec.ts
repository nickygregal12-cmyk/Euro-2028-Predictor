import { expect, test, type Page } from '@playwright/test'

const SCOTTISH_HOME = '/competitions/scottish-premiership/2026-27'
const PREMIER_HOME = '/competitions/premier-league/2026-27'

function nav(page: Page) {
  return page.locator('nav[aria-label="Competition sections"]:visible')
}

async function expectVNext(page: Page) {
  await expect(page.locator('[data-vnext-shell]:visible')).toBeVisible()
  await expect(page.locator('[data-vnext-shell-zone="navbar"]')).toHaveCount(1)
}

test('Home settled fixture opens its exact Match Centre rather than generic Matches', async ({ page }) => {
  await page.goto(SCOTTISH_HOME)
  await expectVNext(page)

  // The disposable Scottish season always contains three played matchweek-one
  // fixtures. Home reaches these through the real recent-results model, so this
  // control starts from UI state rather than a direct Match Centre URL.
  const matchCentre = page
    .locator('[data-vnext-control="home-fixture-action"]:visible')
    .filter({ hasText: 'Match centre' })
    .first()
  await expect(matchCentre).toBeVisible({ timeout: 15_000 })
  await matchCentre.click()

  await expect(page).toHaveURL((url) =>
    new RegExp(`^${SCOTTISH_HOME}/matches/[^/]+$`).test(url.pathname),
  )
  await expectVNext(page)
  await expect(page.getByText('Back to Matches', { exact: true })).toBeVisible()
})

test('game-specific and create routes cannot trap the player outside primary navigation', async ({ page }) => {
  await page.goto(SCOTTISH_HOME)
  await expectVNext(page)
  await nav(page).getByRole('button', { name: 'Games', exact: true }).click()
  await expect(page).toHaveURL(`${SCOTTISH_HOME}/games`)

  // Reach a game-specific route by the visible Games row, not a direct goto.
  const openPredictor = page.getByRole('button', { name: /Open Match Predictor/i })
  await expect(openPredictor).toBeVisible()
  await openPredictor.click()
  await expect(page).toHaveURL((url) => url.pathname === `${SCOTTISH_HOME}/games/match-predictor`)
  await expectVNext(page)

  await nav(page).getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page).toHaveURL(SCOTTISH_HOME)

  // Reach create from Games, then leave it through the same shared shell seam.
  await nav(page).getByRole('button', { name: 'Games', exact: true }).click()
  await page.getByRole('button', { name: 'Create private play', exact: true }).click()
  await expect(page).toHaveURL(`${SCOTTISH_HOME}/games/create`)
  await expectVNext(page)

  await nav(page).getByRole('button', { name: 'Matches', exact: true }).click()
  await expect(page).toHaveURL(`${SCOTTISH_HOME}/matches`)
  await expectVNext(page)
})

test('About is reachable from shell footer and cannot trap primary navigation', async ({ page }) => {
  await page.goto(SCOTTISH_HOME)
  await expectVNext(page)

  await page.getByRole('button', { name: 'About & Disclaimer', exact: true }).click()
  await expect(page).toHaveURL('/about')
  await expectVNext(page)

  await nav(page).getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page).toHaveURL(SCOTTISH_HOME)
  await expectVNext(page)
})

test('competition switcher has a real chooser, keyboard close/focus return and persistent context', async ({ page }) => {
  await page.goto(SCOTTISH_HOME)
  await expectVNext(page)

  const switcher = page.locator('button[data-vnext-switcher="control"]:visible')
  await expect(switcher).toBeVisible()
  await expect(switcher).toHaveAttribute('aria-expanded', 'false')

  // Keyboard activation opens the real dialog and Escape returns focus to the
  // exact visible opener, not to the CSS-hidden duplicate switcher.
  await switcher.focus()
  await switcher.press('Enter')
  await expect(switcher).toHaveAttribute('aria-expanded', 'true')
  const dialog = page.getByRole('dialog', { name: 'Change competition' })
  await expect(dialog).toBeVisible()
  await dialog.press('Escape')
  await expect(switcher).toHaveAttribute('aria-expanded', 'false')
  await expect(switcher).toBeFocused()

  // Re-open and change subject. The next primary destination must retain B,
  // proving the switch is context rather than a one-off Home redirect.
  await switcher.click()
  const reopened = page.getByRole('dialog', { name: 'Change competition' })
  await reopened.getByRole('button', { name: /Premier League/ }).click()
  await expect(page).toHaveURL(PREMIER_HOME)
  await expectVNext(page)

  await nav(page).getByRole('button', { name: 'Games', exact: true }).click()
  await expect(page).toHaveURL(`${PREMIER_HOME}/games`)
})
