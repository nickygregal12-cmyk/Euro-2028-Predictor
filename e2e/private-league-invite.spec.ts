import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Response,
  type TestInfo,
} from '@playwright/test'
import {
  cleanupLeagueInviteFixture,
  prepareLeagueInviteUser,
} from './league-invite-local'

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The two-account invite lifecycle runs once; established route smoke covers both viewports.',
  )
}

async function expectAuthenticatedPath(page: Page, path: string) {
  await expect(page).toHaveURL((url) => url.pathname === path, { timeout: 15_000 })
  await expect(page).not.toHaveURL(/\/auth\/login/)
}

function successfulRpc(response: Response, name: string): boolean {
  return (
    response.url().includes(`/rest/v1/rpc/${name}`) &&
    response.request().method() === 'POST' &&
    response.ok()
  )
}

async function prepareLogin(page: Page, email: string, password: string) {
  await page.goto('/more')

  if (new URL(page.url()).pathname !== '/auth/login') {
    await expectAuthenticatedPath(page, '/more')
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Sign out?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/auth/login', {
      timeout: 15_000,
    })
  }

  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expectAuthenticatedPath(page, '/')
}

test('owner creates an invite and a second account joins through the deep link', async ({
  page,
  browser,
}, testInfo) => {
  desktopOnly(testInfo)
  test.setTimeout(120_000)

  const invited = await prepareLeagueInviteUser()
  const baseURL = testInfo.project.use.baseURL
  if (typeof baseURL !== 'string') {
    throw new Error('League invite browser proof requires a string baseURL.')
  }

  let secondContext: BrowserContext | null = null
  let leagueId: string | null = null
  const leagueName = 'E2E Invite League'

  try {
    await page.goto('/league')
    await expectAuthenticatedPath(page, '/league')
    await expect(page.getByRole('heading', { name: 'League' })).toBeVisible()

    await page.getByRole('button', { name: 'Create league', exact: true }).click()
    const createDialog = page.getByRole('dialog', { name: 'Create a league' })
    await expect(createDialog).toBeVisible()
    await createDialog.getByLabel('League name').fill(leagueName)

    const created = page.waitForResponse((response) =>
      successfulRpc(response, 'create_league'),
    )
    await createDialog.getByRole('button', { name: 'Create', exact: true }).click()
    await created

    const createdDialog = page.getByRole('dialog', { name: 'League created' })
    await expect(createdDialog).toBeVisible()
    await expect(createdDialog.getByText(leagueName, { exact: true })).toBeVisible()

    const inviteCodeButton = createdDialog.getByRole('button', {
      name: /Copy invite code [A-Z0-9]{6}/,
    })
    await expect(inviteCodeButton).toBeVisible()
    const inviteLabel = await inviteCodeButton.getAttribute('aria-label')
    const inviteCode = inviteLabel?.match(/Copy invite code ([A-Z0-9]{6})/)?.[1]
    if (!inviteCode) throw new Error('Created league exposed no valid invite code.')

    await createdDialog.getByRole('button', { name: 'View league' }).click()
    await expect(page).toHaveURL((url) => /^\/league\/[0-9a-f-]+$/i.test(url.pathname))
    leagueId = new URL(page.url()).pathname.split('/').at(-1) ?? null
    if (!leagueId) throw new Error('Created league route exposed no league id.')
    await expect(page.getByRole('heading', { name: leagueName })).toBeVisible()
    await expect(page.getByText('1 member', { exact: true })).toBeVisible()

    secondContext = await browser.newContext({ baseURL })
    const invitedPage = await secondContext.newPage()
    await prepareLogin(invitedPage, invited.email, invited.password)

    await invitedPage.goto(`/join/${inviteCode}`)
    await expect(invitedPage).toHaveURL((url) => url.pathname === `/join/${inviteCode}`)
    await expect(invitedPage.getByRole('heading', { name: leagueName })).toBeVisible()
    await expect(invitedPage.getByText('1 member', { exact: true })).toBeVisible()
    await expect(invitedPage.getByText('Owner: E2E Tester', { exact: true })).toBeVisible()

    const joined = invitedPage.waitForResponse((response) =>
      successfulRpc(response, 'join_league'),
    )
    await invitedPage.getByRole('button', { name: 'Join league', exact: true }).click()
    await joined

    await expectAuthenticatedPath(invitedPage, `/league/${leagueId}`)
    await expect(invitedPage.getByRole('heading', { name: leagueName })).toBeVisible()
    await expect(invitedPage.getByText('2 members', { exact: true })).toBeVisible()
    await expect(invitedPage.getByText(invited.displayName, { exact: true })).toBeVisible()
    await expect(invitedPage.getByText('E2E Tester', { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.getByText('2 members', { exact: true })).toBeVisible()
    await expect(page.getByText(invited.displayName, { exact: true })).toBeVisible()
  } finally {
    await secondContext?.close()
    await cleanupLeagueInviteFixture(invited.userId, leagueId)
  }
})
