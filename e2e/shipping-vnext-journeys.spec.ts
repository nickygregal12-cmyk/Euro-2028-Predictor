import { randomUUID } from 'node:crypto'
import { expect, test, type Page, type Response, type TestInfo } from '@playwright/test'
import { seedIdentity } from './seed-contract'

const PLAYER = seedIdentity('admin')
const SCOTTISH_HOME = '/competitions/scottish-premiership/2026-27'
const PREMIER_HOME = '/competitions/premier-league/2026-27'

/**
 * THE RELEASE-CANDIDATE BROWSER BEHAVES LIKE A PLAYER.
 *
 * These cases deliberately do not `goto()` the destination under test. A route
 * seam is proved by starting from the previous surface and pressing the visible
 * control. Direct route arrival has useful coverage elsewhere and was exactly
 * why the owner could still find dead controls in a largely-green suite.
 *
 * The one direct address below is SCOTTISH_HOME when a case's subject is an
 * interaction ON Home rather than how Home itself was reached. `/` has its own
 * root case and proves the ordinary resolver independently.
 */

function shell(page: Page) {
  return page.locator('[data-vnext-shell]:visible')
}

function nav(page: Page) {
  return page.locator('nav[aria-label="Competition sections"]:visible')
}

function accountControl(page: Page) {
  return page
    .locator('button:visible')
    .filter({ hasText: PLAYER.displayName })
    .first()
}

function successfulRpc(response: Response, name: string): boolean {
  return (
    response.url().includes(`/rest/v1/rpc/${name}`) &&
    response.request().method() === 'POST' &&
    response.ok()
  )
}

function watchCleanPage(page: Page) {
  const errors: string[] = []
  const allowedFailures: RegExp[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('requestfailed', (request) => {
    const text = `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`
    if (!allowedFailures.some((pattern) => pattern.test(text))) errors.push(text)
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    const request = response.request()
    const text = `http ${response.status()}: ${request.method()} ${response.url()}`
    if (!allowedFailures.some((pattern) => pattern.test(text))) errors.push(text)
  })

  return {
    allow(pattern: RegExp) {
      allowedFailures.push(pattern)
    },
    assertClean() {
      expect(errors, `Unexpected browser/network failures:\n${errors.join('\n')}`).toEqual([])
    },
  }
}

async function expectVNext(page: Page) {
  await expect(shell(page)).toBeVisible()
  await expect(page.locator('[data-vnext-shell-zone="navbar"]')).toHaveCount(1)
  await expect(page.locator('body')).not.toContainText('Legacy')
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(`${name}-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
}

async function clickDestination(page: Page, destination: 'Home' | 'Matches' | 'Games' | 'Leagues') {
  await nav(page).getByRole('button', { name: destination, exact: true }).click()
  await expectVNext(page)
}

function exploreControl(page: Page) {
  return page
    .getByRole('button', { name: 'Explore competitions', exact: true })
    .filter({ visible: true })
    .first()
}

test.describe('shipping vNext user-found regression matrix', () => {
  test('root resolves into the player’s relevant shipping-vNext Home', async ({ page }) => {
    const clean = watchCleanPage(page)
    await page.goto('/')
    await expect(page).toHaveURL(new RegExp(`${SCOTTISH_HOME}/?$`))
    await expectVNext(page)
    await expect(
      page.locator('button[data-vnext-switcher="control"]:visible'),
    ).toHaveAccessibleName(/Scottish Premiership, change competition/i)
    clean.assertClean()
  })

  test('Home Find a league is a real keyboard-operable journey with sensible Back', async ({ page }) => {
    const clean = watchCleanPage(page)
    await page.goto(SCOTTISH_HOME)
    await expectVNext(page)

    const findLeague = page.getByRole('button', { name: 'Find a league', exact: true })
    await expect(findLeague).toBeVisible()
    await expect(findLeague).toHaveAttribute('data-vnext-control', 'home-primary-action')

    await findLeague.click()
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/leagues`)
    await expectVNext(page)

    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`${SCOTTISH_HOME}/?$`))
    await expect(findLeague).toBeVisible()

    await findLeague.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/leagues`)

    await page.goBack()
    await expect(findLeague).toBeVisible()
    await findLeague.focus()
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/leagues`)
    clean.assertClean()
  })

  test('Games create private play reaches verified Match Predictor handover and survives reload', async ({
    page,
  }, testInfo) => {
    const clean = watchCleanPage(page)
    const viewport = testInfo.project.name.includes('mobile') ? 'mobile' : 'desktop'
    const name = `VNext ${viewport} ${randomUUID().slice(0, 8)}`

    await page.goto(SCOTTISH_HOME)
    await expectVNext(page)
    await clickDestination(page, 'Games')
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/games`)

    const createEntry = page.getByRole('button', { name: 'Create private play', exact: true })
    await expect(createEntry).toBeVisible()
    await createEntry.click()
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/games/create`)
    await expectVNext(page)

    const choose = page.locator('[data-vnext-zone="choose-game"]')
    await choose.getByRole('button', { name: /^Match Predictor/ }).click()
    await page.getByRole('textbox', { name: /what is it called/i }).fill(name)

    // SETUP IS NOT A WRITE. The real review gate must exist before a create can
    // run, which catches the old setup -> mutation shortcut in the browser.
    await expect(page.getByRole('button', { name: 'Create it', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Review', exact: true }).click()
    const review = page.locator('[data-vnext-zone="review"]')
    await expect(review).toContainText(name)
    await expect(review).toContainText('Scottish Premiership')

    const write = page.waitForResponse((response) => successfulRpc(response, 'create_game_league'))
    const reread = page.waitForResponse((response) => successfulRpc(response, 'get_my_game_leagues'))
    await review.getByRole('button', { name: 'Create it', exact: true }).click()
    const writeResponse = await write
    await reread

    const payload = (await writeResponse.json()) as unknown
    const row = Array.isArray(payload) ? payload[0] : null
    const leagueId =
      row && typeof row === 'object' && typeof (row as Record<string, unknown>).id === 'string'
        ? ((row as Record<string, unknown>).id as string)
        : null
    const inviteCode =
      row && typeof row === 'object' && typeof (row as Record<string, unknown>).invite_code === 'string'
        ? ((row as Record<string, unknown>).invite_code as string)
        : null
    if (!leagueId || !inviteCode) {
      throw new Error('Shipping vNext create returned no league id/invite code.')
    }

    // Success copy must be downstream of the reread and must expose the same
    // server-minted invite the write created, not an optimistic local object.
    const created = page.locator('[data-vnext-zone="created"]')
    await expect(created).toContainText(`${name} is ready`)
    await expect(created).toContainText(inviteCode)

    await created.getByRole('button', { name: 'Open it', exact: true }).click()
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === `${SCOTTISH_HOME}/leagues` &&
        url.searchParams.get('league') === leagueId,
    )
    await expectVNext(page)
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 })

    await page.reload()
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === `${SCOTTISH_HOME}/leagues` &&
        url.searchParams.get('league') === leagueId,
    )
    await expectVNext(page)
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 })
    await screenshot(page, testInfo, 'created-private-match-predictor-after-reload')
    clean.assertClean()
  })

  test('the real bottom/rail navigation traverses Home → Matches → Games → Leagues → Home', async ({ page }) => {
    const clean = watchCleanPage(page)
    await page.goto(SCOTTISH_HOME)
    await expectVNext(page)

    await clickDestination(page, 'Matches')
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/matches`)
    await clickDestination(page, 'Games')
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/games`)
    await clickDestination(page, 'Leagues')
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/leagues`)
    await clickDestination(page, 'Home')
    await expect(page).toHaveURL(new RegExp(`${SCOTTISH_HOME}/?$`))
    clean.assertClean()
  })

  test('Account cannot trap the player outside competition context', async ({ page }, testInfo) => {
    const clean = watchCleanPage(page)
    await page.goto(SCOTTISH_HOME)
    await expectVNext(page)

    const account = accountControl(page)
    await expect(account).toBeVisible()
    await expect(account).not.toHaveText(/^[.·•]$/)
    await account.click()
    await expect(page).toHaveURL('/account')
    await expectVNext(page)

    await clickDestination(page, 'Home')
    await expect(page).toHaveURL(new RegExp(`${SCOTTISH_HOME}/?$`))
    await accountControl(page).click()
    await clickDestination(page, 'Matches')
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/matches`)
    await accountControl(page).click()
    await clickDestination(page, 'Games')
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/games`)
    await accountControl(page).click()
    await clickDestination(page, 'Leagues')
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/leagues`)

    await screenshot(page, testInfo, 'account-returned-to-leagues')
    clean.assertClean()
  })

  test('Explore cannot trap the player outside competition context', async ({ page }) => {
    const clean = watchCleanPage(page)
    await page.goto(SCOTTISH_HOME)
    await expectVNext(page)

    await exploreControl(page).click()
    await expect(page).toHaveURL('/competitions')
    await expectVNext(page)

    await clickDestination(page, 'Home')
    await expect(page).toHaveURL(new RegExp(`${SCOTTISH_HOME}/?$`))
    await exploreControl(page).click()
    await clickDestination(page, 'Matches')
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/matches`)
    await exploreControl(page).click()
    await clickDestination(page, 'Games')
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/games`)
    await exploreControl(page).click()
    await clickDestination(page, 'Leagues')
    await expect(page).toHaveURL(`${SCOTTISH_HOME}/leagues`)
    clean.assertClean()
  })

  test('competition card switches A → B, lands on B Home, and B owns later destinations', async ({ page }) => {
    const clean = watchCleanPage(page)
    await page.goto(SCOTTISH_HOME)
    await expectVNext(page)

    const switcher = page.locator('button[data-vnext-switcher="control"]:visible')
    await expect(switcher).toHaveAccessibleName(/Scottish Premiership, change competition/i)
    await switcher.click()
    await expect(switcher).toHaveAttribute('aria-expanded', 'true')

    const premier = page.getByRole('button', { name: /Premier League/ }).filter({ visible: true })
    await expect(premier).toBeVisible()
    await premier.click()
    await expect(page).toHaveURL(new RegExp(`${PREMIER_HOME}/?$`))
    await expectVNext(page)

    // Premier is intentionally fixture-empty in the shared browser fixture.
    // The shell still has to remain navigable even when a destination's body
    // truthfully has no league matchweek to render.
    await clickDestination(page, 'Games')
    await expect(page).toHaveURL(`${PREMIER_HOME}/games`)
    await clickDestination(page, 'Leagues')
    await expect(page).toHaveURL(`${PREMIER_HOME}/leagues`)
    clean.assertClean()
  })

  test('real application screenshots retain the shell on Home, Matches, Explore and Account', async ({ page }, testInfo) => {
    const clean = watchCleanPage(page)

    await page.goto(SCOTTISH_HOME)
    await expectVNext(page)
    await screenshot(page, testInfo, 'home')

    await clickDestination(page, 'Matches')
    await screenshot(page, testInfo, 'matches')

    await exploreControl(page).click()
    await expect(page).toHaveURL('/competitions')
    await screenshot(page, testInfo, 'explore')

    await accountControl(page).click()
    await expect(page).toHaveURL('/account')
    await screenshot(page, testInfo, 'account')

    clean.assertClean()
  })
})
