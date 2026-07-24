import {
  expect,
  test,
  type Page,
  type Request,
  type Response,
  type TestInfo,
} from '@playwright/test'
import {
  overwritePrediction,
  resetCompleteGroupEntry,
  type PreparedEntry,
} from './local-supabase'

async function expectAuthenticatedPath(page: Page, path: string) {
  await expect(page).toHaveURL((url) => url.pathname === path, { timeout: 15_000 })
  await expect(page).not.toHaveURL(/\/auth\/login/)
}

function successfulWrite(response: Response, path: string): boolean {
  return response.url().includes(path) && response.request().method() === 'POST' && response.ok()
}

function targets(request: Request, path: string): boolean {
  return request.url().includes(path) && request.method() === 'POST'
}

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Mutation and submission journeys run once; route smoke covers both viewports.',
  )
}

async function navigateToPredictHub(page: Page) {
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Predict', exact: true })
    .click()
  await expectAuthenticatedPath(page, '/predict')
}

async function navigateToReview(page: Page) {
  await navigateToPredictHub(page)
  await page.getByRole('button', { name: /Review and submit/ }).click()
  await expectAuthenticatedPath(page, '/predict/review')
  await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible()
}

async function confirmSubmission(page: Page) {
  await page.getByRole('button', { name: 'Submit entry', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Submit your entry?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Submit entry', exact: true }).click()
}

async function completeBracket(page: Page) {
  await page.goto('/predict/bracket')
  await expectAuthenticatedPath(page, '/predict/bracket')
  await expect(page.getByRole('heading', { name: 'Knockout bracket' })).toBeVisible()
  await expect(page.getByText('Finish the group stage first')).toHaveCount(0)

  for (let pick = 0; pick < 15; pick += 1) {
    // An unpicked tie has no aria-pressed=true row yet. Once one side is selected,
    // the remaining loser button stays available for changing the pick, so the
    // section-level predicate is what advances us to the next untouched tie.
    const nextWinner = page
      .locator('section:not(:has(button[aria-pressed="true"])) button[aria-label^="Pick "]')
      .first()
    await expect(nextWinner).toBeVisible({ timeout: 15_000 })
    await nextWinner.click()
  }

  await expect(page.getByRole('status')).toContainText('Saved', { timeout: 15_000 })
}

async function prepareReviewReadyEntry(page: Page): Promise<PreparedEntry> {
  const prepared = await resetCompleteGroupEntry()
  await completeBracket(page)
  await navigateToReview(page)
  await expect(page.getByRole('button', { name: 'Submit entry', exact: true })).toBeVisible()
  return prepared
}

async function openFirstGroupMatch(page: Page, prepared: PreparedEntry) {
  await page.goto('/predict/groups/A')
  await expectAuthenticatedPath(page, '/predict/groups/A')
  const home = page.getByLabel(`${prepared.firstHomeName} score`).first()
  const away = page.getByLabel(`${prepared.firstAwayName} score`).first()
  await expect(home).toBeVisible()
  await expect(away).toBeVisible()
  return { home, away }
}

test('authenticated user reaches core routes', async ({ page }) => {
  await page.goto('/')
  await expectAuthenticatedPath(page, '/')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()

  await page.goto('/predict')
  await expectAuthenticatedPath(page, '/predict')
  await expect(page.getByRole('heading', { name: 'Predict' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Groups A–F/ })).toBeVisible()

  await page.goto('/matches')
  await expectAuthenticatedPath(page, '/matches')
  await expect(page.getByRole('button', { name: 'By group' })).toBeVisible()

  await page.goto('/profile')
  await expectAuthenticatedPath(page, '/profile')
  await expect(page.getByText('E2E Tester', { exact: true })).toBeVisible()
})

test('group score persists, clears, and stays cleared after reload', async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo)

  await page.goto('/predict/groups/A')
  await expectAuthenticatedPath(page, '/predict/groups/A')
  await expect(page.getByText('Group A', { exact: true }).first()).toBeVisible()

  const home = page.getByLabel('Team A1 score').first()
  const away = page.getByLabel('Team A2 score').first()
  await expect(home).toBeVisible()
  await expect(away).toBeVisible()

  const persisted = page.waitForResponse((response) =>
    successfulWrite(response, '/rest/v1/match_predictions'),
  )
  await home.fill('2')
  await away.fill('1')
  await persisted

  await page.reload()
  await expect(home).toHaveValue('2')
  await expect(away).toHaveValue('1')

  const deleted = page.waitForResponse((response) =>
    successfulWrite(response, '/rest/v1/rpc/delete_match_prediction'),
  )
  await home.fill('')
  await away.fill('')
  await deleted

  await page.reload()
  await expect(home).toHaveValue('')
  await expect(away).toHaveValue('')
})

test('submission waits for the final in-flight score save', async ({ page }, testInfo) => {
  desktopOnly(testInfo)
  const prepared = await prepareReviewReadyEntry(page)
  const { home } = await openFirstGroupMatch(page, prepared)
  const nextHomeScore = String(Number(await home.inputValue()) + 1)

  let releaseHeldSave!: () => void
  const heldSaveGate = new Promise<void>((resolve) => {
    releaseHeldSave = resolve
  })
  let markSaveStarted!: () => void
  const saveStarted = new Promise<void>((resolve) => {
    markSaveStarted = resolve
  })
  let held = false

  await page.route('**/rest/v1/match_predictions*', async (route) => {
    if (!held && route.request().method() === 'POST') {
      held = true
      markSaveStarted()
      await heldSaveGate
    }
    await route.continue()
  })

  let submitRequests = 0
  page.on('request', (request) => {
    if (targets(request, '/rest/v1/rpc/submit_entry')) submitRequests += 1
  })

  await home.fill(nextHomeScore)
  await saveStarted
  await navigateToReview(page)
  await confirmSubmission(page)

  // The confirm action has started, but the server validator must not run while
  // the latest score is still on the wire.
  await page.waitForTimeout(300)
  expect(submitRequests).toBe(0)

  const scorePersisted = page.waitForResponse((response) =>
    successfulWrite(response, '/rest/v1/match_predictions'),
  )
  const submitted = page.waitForResponse((response) =>
    successfulWrite(response, '/rest/v1/rpc/submit_entry'),
  )
  releaseHeldSave()
  await scorePersisted
  await submitted

  await expect(page.getByText('Entry submitted', { exact: true })).toBeVisible()
  expect(submitRequests).toBe(1)
})

test('exhausted score-save retries block submission and manual retry recovers', async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo)
  const prepared = await prepareReviewReadyEntry(page)
  const { home } = await openFirstGroupMatch(page, prepared)
  const nextHomeScore = String(Number(await home.inputValue()) + 1)

  let markFirstFailure!: () => void
  const firstFailure = new Promise<void>((resolve) => {
    markFirstFailure = resolve
  })
  let attempts = 0
  await page.route('**/rest/v1/match_predictions*', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    attempts += 1
    if (attempts === 1) markFirstFailure()
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'PGRST000',
        message: 'Forced browser E2E save failure',
        details: null,
        hint: null,
      }),
    })
  })

  let submitRequests = 0
  page.on('request', (request) => {
    if (targets(request, '/rest/v1/rpc/submit_entry')) submitRequests += 1
  })

  await home.fill(nextHomeScore)
  await firstFailure
  await navigateToReview(page)
  await confirmSubmission(page)

  await expect(page.getByRole('alert', { name: "Couldn't submit" })).toContainText(
    'Some changes could not be saved',
    { timeout: 15_000 },
  )
  expect(attempts).toBe(3)
  expect(submitRequests).toBe(0)

  await page.unroute('**/rest/v1/match_predictions*')
  await navigateToPredictHub(page)
  await page.getByRole('button', { name: /Groups A–F/ }).click()
  await expectAuthenticatedPath(page, '/predict/groups/A')

  const recovered = page.waitForResponse((response) =>
    successfulWrite(response, '/rest/v1/match_predictions'),
  )
  await page.getByRole('button', { name: 'retry', exact: true }).first().click()
  await recovered

  await navigateToReview(page)
  const submitted = page.waitForResponse((response) =>
    successfulWrite(response, '/rest/v1/rpc/submit_entry'),
  )
  await confirmSubmission(page)
  await submitted
  await expect(page.getByText('Entry submitted', { exact: true })).toBeVisible()
})

test('version conflict blocks submission until Keep mine succeeds', async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo)
  const prepared = await prepareReviewReadyEntry(page)
  const { home, away } = await openFirstGroupMatch(page, prepared)
  const currentHome = Number(await home.inputValue())
  const currentAway = Number(await away.inputValue())

  // The browser has already read the row/version. Change it through the local
  // service-role client to simulate another authenticated device.
  await overwritePrediction(
    prepared.entryId,
    prepared.firstMatchId,
    currentHome + 1,
    currentAway,
  )

  await home.fill(String(currentHome + 2))
  await expect(
    page.getByRole('alert', { name: 'These picks were changed on another device' }),
  ).toBeVisible({ timeout: 10_000 })

  let submitRequests = 0
  page.on('request', (request) => {
    if (targets(request, '/rest/v1/rpc/submit_entry')) submitRequests += 1
  })

  await navigateToReview(page)
  await confirmSubmission(page)
  await expect(page.getByRole('alert', { name: "Couldn't submit" })).toContainText(
    'Resolve the prediction conflict',
  )
  expect(submitRequests).toBe(0)

  const keptMine = page.waitForResponse((response) =>
    successfulWrite(response, '/rest/v1/match_predictions'),
  )
  await page.getByRole('button', { name: 'Keep mine', exact: true }).click()
  await keptMine
  await expect(
    page.getByRole('alert', { name: 'These picks were changed on another device' }),
  ).toHaveCount(0)

  const submitted = page.waitForResponse((response) =>
    successfulWrite(response, '/rest/v1/rpc/submit_entry'),
  )
  await confirmSubmission(page)
  await submitted
  await expect(page.getByText('Entry submitted', { exact: true })).toBeVisible()
})
