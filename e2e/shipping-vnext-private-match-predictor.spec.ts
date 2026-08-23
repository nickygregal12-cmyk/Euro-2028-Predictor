import { randomUUID } from 'node:crypto'
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Response,
  type TestInfo,
} from '@playwright/test'
import {
  cleanupPrivatePlayUsers,
  prepareFreshPrivatePlayUser,
  type PrivatePlayUser,
} from './private-play-lifecycle-local'

const SCOTTISH_HOME = '/competitions/scottish-premiership/2026-27'

function successfulRpc(response: Response, name: string): boolean {
  return (
    response.url().includes(`/rest/v1/rpc/${name}`) &&
    response.request().method() === 'POST' &&
    response.ok()
  )
}

function nav(page: Page) {
  return page.locator('nav[aria-label="Competition sections"]:visible')
}

async function expectVNext(page: Page) {
  await expect(page.locator('[data-vnext-shell]:visible')).toBeVisible()
  await expect(page.locator('[data-vnext-shell-zone="navbar"]')).toHaveCount(1)
  await expect(page.locator('body')).not.toContainText('Legacy')
}

async function loginAs(page: Page, user: PrivatePlayUser) {
  await page.goto('/account')
  if (new URL(page.url()).pathname !== '/auth/login') {
    const signOut = page.getByRole('button', { name: 'Sign out', exact: true })
    await expect(signOut).toBeVisible({ timeout: 15_000 })
    await signOut.click()

    const dialog = page.getByRole('dialog', { name: 'Sign out?' })
    if (await dialog.isVisible({ timeout: 750 }).catch(() => false)) {
      await dialog.getByRole('button', { name: 'Sign out', exact: true }).click()
    }
    await expect(page).toHaveURL((url) => url.pathname === '/auth/login', { timeout: 15_000 })
  }

  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15_000 })
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(`${name}-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
}

async function createPrivateLeague(page: Page, name: string): Promise<{ id: string; code: string }> {
  await page.goto(SCOTTISH_HOME)
  await expectVNext(page)
  await nav(page).getByRole('button', { name: 'Games', exact: true }).click()
  await expect(page).toHaveURL(`${SCOTTISH_HOME}/games`)

  await page.getByRole('button', { name: 'Create private play', exact: true }).click()
  await expect(page).toHaveURL(`${SCOTTISH_HOME}/games/create`)
  await expectVNext(page)

  const choose = page.locator('[data-vnext-zone="choose-game"]')
  await choose.getByRole('button', { name: /^Match Predictor\b/ }).click()
  await page.getByRole('textbox', { name: /what is it called/i }).fill(name)
  await page.getByRole('button', { name: 'Review', exact: true }).click()

  const review = page.locator('[data-vnext-zone="review"]')
  await expect(review).toContainText(name)
  await expect(review).toContainText('Match Predictor')

  const write = page.waitForResponse((response) => successfulRpc(response, 'create_game_league'))
  const verified = page.waitForResponse((response) => successfulRpc(response, 'get_my_game_leagues'))
  await review.getByRole('button', { name: 'Create it', exact: true }).click()
  const response = await write
  await verified

  const payload = (await response.json()) as unknown
  const row = Array.isArray(payload) ? payload[0] : null
  const id =
    row && typeof row === 'object' && typeof (row as Record<string, unknown>).id === 'string'
      ? ((row as Record<string, unknown>).id as string)
      : null
  const code =
    row && typeof row === 'object' && typeof (row as Record<string, unknown>).invite_code === 'string'
      ? ((row as Record<string, unknown>).invite_code as string)
      : null
  if (!id || !code) throw new Error('Shipping private league create returned no id/invite code.')

  const created = page.locator('[data-vnext-zone="created"]')
  await expect(created).toContainText(`${name} is ready`)
  await expect(created).toContainText(code)
  await created.getByRole('button', { name: 'Open it', exact: true }).click()
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === `${SCOTTISH_HOME}/leagues` &&
      url.searchParams.get('league') === id,
    { timeout: 15_000 },
  )
  await expectVNext(page)
  await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 })
  return { id, code }
}

async function joinMatchPredictorFromInvite(page: Page, code: string, leagueName: string) {
  await page.goto(`/join/${code}`)
  await expectVNext(page)
  await expect(page.getByText(leagueName, { exact: true })).toBeVisible({ timeout: 15_000 })

  // The invite contract deliberately withholds the private league id before
  // membership. It must therefore state the prerequisite and offer a useful
  // public route, not draw an inert button or guess a competition address.
  await expect(page.getByRole('button', { name: 'Accept invitation', exact: true })).toHaveCount(0)
  const prerequisite = page.getByRole('button', { name: 'Go to Match Predictor', exact: true })
  await expect(prerequisite).toBeVisible()
  await prerequisite.click()
  await expect(page).toHaveURL('/competitions')
  await expectVNext(page)

  const scottish = page
    .getByRole('button', { name: /Look inside Scottish Premiership/ })
    .filter({ visible: true })
    .first()
  await expect(scottish).toBeVisible()
  await scottish.click()
  await expect(page).toHaveURL(SCOTTISH_HOME)

  await nav(page).getByRole('button', { name: 'Games', exact: true }).click()
  await expect(page).toHaveURL(`${SCOTTISH_HOME}/games`)
  const predictor = page
    .locator('[data-vnext-game]:visible')
    .filter({ hasText: 'Match Predictor' })
    .first()
  await expect(predictor).toBeVisible()

  const gameJoin = page.waitForResponse((response) => successfulRpc(response, 'join_competition_game'))
  const gameReread = page.waitForResponse((response) => successfulRpc(response, 'get_competition_games'))
  await predictor.getByRole('button', { name: /^Join Match Predictor$/ }).click()
  await gameJoin
  await gameReread
  await expect(predictor).toHaveAttribute('data-standing', 'playing', { timeout: 15_000 })
}

test.describe.configure({ mode: 'serial' })

test('shipping vNext Match Predictor private league completes prerequisite, join and reopen lifecycle', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'shipping-vnext-desktop',
    'The two-account data lifecycle runs once; the owner create corridor is covered on both shipping viewports.',
  )
  test.setTimeout(210_000)

  const suffix = randomUUID().slice(0, 8)
  const name = `Shipping League ${suffix}`
  const invitee = await prepareFreshPrivatePlayUser(`shipping-league-${suffix}`)
  const baseURL = testInfo.project.use.baseURL
  if (typeof baseURL !== 'string') {
    throw new Error('Shipping vNext private Match Predictor requires a string baseURL.')
  }

  let inviteeContext: BrowserContext | null = null
  try {
    const created = await createPrivateLeague(page, name)

    // Owner identity and scope survive a hard reload before another user joins.
    await page.reload()
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === `${SCOTTISH_HOME}/leagues` &&
        url.searchParams.get('league') === created.id,
    )
    await expectVNext(page)
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 })
    await screenshot(page, testInfo, 'private-match-predictor-owner-after-reload')

    inviteeContext = await browser.newContext({ baseURL })
    const inviteePage = await inviteeContext.newPage()
    await loginAs(inviteePage, invitee)

    // This user starts with no entry and no game membership. The first visit is
    // therefore a real prerequisite path, not an already-qualified happy path.
    await joinMatchPredictorFromInvite(inviteePage, created.code, name)

    // Reopen THE SAME invite after joining the underlying game. It should now
    // become joinable and, after the write, rediscover the exact private league
    // from current server state rather than from stale shell cache or invite copy.
    await inviteePage.goto(`/join/${created.code}`)
    await expectVNext(inviteePage)
    await expect(inviteePage.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 })
    const accept = inviteePage.getByRole('button', { name: 'Accept invitation', exact: true })
    await expect(accept).toBeVisible()

    const leagueJoin = inviteePage.waitForResponse((response) => successfulRpc(response, 'join_league'))
    const leagueReread = inviteePage.waitForResponse((response) =>
      successfulRpc(response, 'get_my_game_leagues'),
    )
    await accept.click()
    await leagueJoin
    await leagueReread

    await expect(inviteePage).toHaveURL(
      (url) =>
        url.pathname === `${SCOTTISH_HOME}/leagues` &&
        url.searchParams.get('league') === created.id,
      { timeout: 20_000 },
    )
    await expectVNext(inviteePage)
    await expect(inviteePage.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 })

    await inviteePage.reload()
    await expect(inviteePage).toHaveURL(
      (url) =>
        url.pathname === `${SCOTTISH_HOME}/leagues` &&
        url.searchParams.get('league') === created.id,
    )
    await expectVNext(inviteePage)
    await expect(inviteePage.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 })
    await screenshot(inviteePage, testInfo, 'private-match-predictor-invitee-after-reload')
  } finally {
    await inviteeContext?.close()
    await cleanupPrivatePlayUsers([invitee])
  }
})
