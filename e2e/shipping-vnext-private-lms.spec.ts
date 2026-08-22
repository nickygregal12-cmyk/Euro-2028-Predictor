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

async function expectVNext(page: Page) {
  await expect(page.locator('[data-vnext-shell]:visible')).toBeVisible()
  await expect(page.locator('[data-vnext-shell-zone="navbar"]')).toHaveCount(1)
  await expect(page.locator('body')).not.toContainText('Legacy')
}

/**
 * The shared browser setup can autologin the canonical E2E account in a new
 * context. Shipping vNext signs out immediately while the retained legacy
 * account asks for confirmation, so this helper deliberately supports both
 * responses before signing the disposable identity in.
 */
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

async function openCreateFromGames(page: Page) {
  await page.goto(SCOTTISH_HOME)
  await expectVNext(page)
  const nav = page.locator('nav[aria-label="Competition sections"]:visible')
  await nav.getByRole('button', { name: 'Games', exact: true }).click()
  await expect(page).toHaveURL(`${SCOTTISH_HOME}/games`)
  await page.getByRole('button', { name: 'Create private play', exact: true }).click()
  await expect(page).toHaveURL(`${SCOTTISH_HOME}/games/create`)
  await expectVNext(page)
}

async function createLms(page: Page, name: string): Promise<{ id: string; code: string }> {
  await openCreateFromGames(page)

  const choose = page.locator('[data-vnext-zone="choose-game"]')
  await choose.getByRole('button', { name: /^Last Man Standing\b/ }).click()

  // Two seasons are deliberately published in the shipping fixture, so make
  // the host choice through the visible UI rather than relying on ordering.
  const setup = page.locator('[data-vnext-zone="setup"]')
  await setup.getByRole('button', { name: /Scottish Premiership/ }).click()
  await page.getByRole('textbox', { name: /what is it called/i }).fill(name)

  // Configure non-default rules so this journey proves the LMS-specific setup
  // controls rather than only the generic name/host corridor.
  await page.getByRole('group', { name: 'Lives each' }).getByRole('button', { name: '1' }).click()
  await page
    .getByRole('group', { name: 'If your club draws' })
    .getByRole('button', { name: 'A draw keeps you in' })
    .click()

  await page.getByRole('button', { name: 'Review', exact: true }).click()
  const review = page.locator('[data-vnext-zone="review"]')
  await expect(review).toContainText(name)
  await expect(review).toContainText('Last Man Standing')
  await expect(review).toContainText('1 life')
  await expect(review).toContainText('A draw keeps you in')

  const write = page.waitForResponse((response) => successfulRpc(response, 'create_private_season_lms'))
  const reread = page.waitForResponse((response) => successfulRpc(response, 'get_my_private_competitions'))
  await review.getByRole('button', { name: 'Create it', exact: true }).click()
  const response = await write
  await reread

  const payload = (await response.json()) as unknown
  const row = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {}
  const id = typeof row.competition_id === 'string' ? row.competition_id : null
  const code = typeof row.invite_code === 'string' ? row.invite_code : null
  if (!id || !code) throw new Error('Shipping vNext private LMS create returned no id/invite code.')

  const created = page.locator('[data-vnext-zone="created"]')
  await expect(created).toContainText(`${name} is ready`)
  await expect(created).toContainText(code)
  await created.getByRole('button', { name: 'Open it', exact: true }).click()
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === `${SCOTTISH_HOME}/games/lms` &&
      url.searchParams.get('competition') === id,
    { timeout: 15_000 },
  )
  await expectVNext(page)
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible({ timeout: 15_000 })
  return { id, code }
}

test.describe.configure({ mode: 'serial' })

test('shipping vNext private LMS creates, invites, joins and persists a first pick', async ({
  browser,
}, testInfo) => {
  test.setTimeout(210_000)

  const suffix = randomUUID().slice(0, 8)
  const owner = await prepareFreshPrivatePlayUser(`shipping-lms-owner-${suffix}`)
  const invitee = await prepareFreshPrivatePlayUser(`shipping-lms-invitee-${suffix}`)
  const name = `Shipping Survivors ${suffix}`
  const baseURL = testInfo.project.use.baseURL
  if (typeof baseURL !== 'string') throw new Error('Shipping vNext private LMS requires a string baseURL.')

  let ownerContext: BrowserContext | null = null
  let inviteeContext: BrowserContext | null = null
  try {
    ownerContext = await browser.newContext({ baseURL })
    const ownerPage = await ownerContext.newPage()
    await loginAs(ownerPage, owner)
    const created = await createLms(ownerPage, name)

    // The created private instance, not the public season LMS, survives a hard
    // reload at its own address and still offers the first-pick workspace.
    await ownerPage.reload()
    await expectVNext(ownerPage)
    await expect(ownerPage.getByRole('heading', { name, exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(ownerPage.locator('[data-vnext-control="private-lms-pick"]')).not.toHaveCount(0)
    await screenshot(ownerPage, testInfo, 'private-lms-owner-after-reload')

    inviteeContext = await browser.newContext({ baseURL })
    const inviteePage = await inviteeContext.newPage()
    await loginAs(inviteePage, invitee)
    await inviteePage.goto(`/join/${created.code}`)
    await expectVNext(inviteePage)
    await expect(inviteePage.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 })

    const join = inviteePage.waitForResponse((response) =>
      successfulRpc(response, 'join_private_competition'),
    )
    await inviteePage.getByRole('button', { name: 'Accept invitation', exact: true }).click()
    await join

    // The post-join adapter rediscoveries the private container and published
    // season before routing. It must land on the SAME instance identity the
    // owner opened, never on public LMS or absorbed Match Predictor Leagues.
    await expect(inviteePage).toHaveURL(
      (url) =>
        url.pathname === `${SCOTTISH_HOME}/games/lms` &&
        url.searchParams.get('competition') === created.id,
      { timeout: 15_000 },
    )
    await expectVNext(inviteePage)
    await expect(inviteePage.getByRole('heading', { name, exact: true })).toBeVisible()
    await expect(inviteePage.getByText(created.code, { exact: true })).toHaveCount(0)

    const choices = inviteePage.locator('[data-vnext-control="private-lms-pick"]')
    await expect(choices).not.toHaveCount(0)

    const write = inviteePage.waitForResponse((response) => successfulRpc(response, 'save_lms_selection'))
    const verified = inviteePage.waitForResponse((response) =>
      successfulRpc(response, 'get_private_competition_workspace'),
    )
    await choices.first().click()
    await write
    await verified

    // The success sentence is downstream of the authoritative workspace reread
    // (`has_picked_current_round`), not the mutation response. With contract
    // 179's privacy shape we may truthfully say it is saved but may not invent
    // or redisclose the club name on reload.
    await expect(inviteePage.getByText('Your pick is saved for this round.', { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(inviteePage.locator('[data-vnext-control="private-lms-pick"]')).toHaveCount(0)

    await inviteePage.reload()
    await expectVNext(inviteePage)
    await expect(inviteePage.getByText('Your pick is saved for this round.', { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(inviteePage.locator('[data-vnext-control="private-lms-pick"]')).toHaveCount(0)
    await screenshot(inviteePage, testInfo, 'private-lms-invitee-pick-after-reload')
  } finally {
    await inviteeContext?.close()
    await ownerContext?.close()
  }
})
