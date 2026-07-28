import {
  expect,
  test,
  type Page,
  type Request,
  type Route,
  type TestInfo,
} from '@playwright/test'
import {
  cleanupEntryRaceUser,
  countRaceEntries,
  prepareEntryRaceUser,
} from './entry-creation-local'

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The coordinated two-context first-use race runs once; route smoke covers both viewports.',
  )
}

async function expectAuthenticatedPath(page: Page, path: string) {
  await expect(page).toHaveURL((url) => url.pathname === path, { timeout: 15_000 })
  await expect(page).not.toHaveURL(/\/auth\/login/)
}

async function prepareLogin(page: Page, email: string, password: string) {
  await page.goto('/account')

  if (new URL(page.url()).pathname !== '/auth/login') {
    await expectAuthenticatedPath(page, '/account')
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
}

function entriesPost(request: Request): boolean {
  return request.url().includes('/rest/v1/entries') && request.method() === 'POST'
}

test('two first-use tabs converge on one shared entry', async ({ page, browser }, testInfo) => {
  desktopOnly(testInfo)
  test.setTimeout(120_000)

  const prepared = await prepareEntryRaceUser()
  const baseURL = testInfo.project.use.baseURL
  if (typeof baseURL !== 'string') {
    throw new Error('Entry creation browser proof requires a string baseURL.')
  }
  const secondContext = await browser.newContext({ baseURL })
  const secondPage = await secondContext.newPage()

  let releaseRequests!: () => void
  const releaseGate = new Promise<void>((resolve) => {
    releaseRequests = resolve
  })
  let markBothStarted!: () => void
  const bothStarted = new Promise<void>((resolve) => {
    markBothStarted = resolve
  })
  let started = 0

  const holdEntryWrite = async (route: Route) => {
    if (!entriesPost(route.request())) {
      await route.continue()
      return
    }

    started += 1
    if (started === 2) markBothStarted()
    await releaseGate
    await route.continue()
  }

  try {
    await Promise.all([
      prepareLogin(page, prepared.email, prepared.password),
      prepareLogin(secondPage, prepared.email, prepared.password),
    ])

    await page.route('**/rest/v1/entries*', holdEntryWrite)
    await secondPage.route('**/rest/v1/entries*', holdEntryWrite)

    const firstResponse = page.waitForResponse((response) => entriesPost(response.request()))
    const secondResponse = secondPage.waitForResponse((response) => entriesPost(response.request()))

    const firstLogin = page
      .getByRole('button', { name: 'Log in', exact: true })
      .click({ noWaitAfter: true })
    const secondLogin = secondPage
      .getByRole('button', { name: 'Log in', exact: true })
      .click({ noWaitAfter: true })

    await bothStarted
    releaseRequests()

    const [firstWrite, secondWrite] = await Promise.all([
      firstResponse,
      secondResponse,
    ])
    await Promise.all([firstLogin, secondLogin])

    expect(firstWrite.ok()).toBe(true)
    expect(secondWrite.ok()).toBe(true)
    await expectAuthenticatedPath(page, '/')
    await expectAuthenticatedPath(secondPage, '/')

    await expect
      .poll(() => countRaceEntries(prepared.userId, prepared.tournamentId), {
        timeout: 15_000,
      })
      .toBe(1)
  } finally {
    releaseRequests()
    await secondContext.close()
    await cleanupEntryRaceUser(prepared.userId)
  }
})
