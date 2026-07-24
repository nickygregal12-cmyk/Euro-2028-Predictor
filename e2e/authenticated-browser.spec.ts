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
  prepareCompleteGroupEntry,
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

async function navigateToGroupA(page: Page) {
  await navigateToPredictHub(page)
  await page.getByRole('button', { name: /Groups A–F/ }).click()
  await expectAuthenticatedPath(page, '/predict/groups/A')
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
    // An untouched tie has no aria-pressed=true row. Selecting its first available
    // team drives the real auto-advance flow through R16, QF, SF and the final.
    const nextWinner = page
      .locator('section:not(:has(button[aria-pressed="true"])) button[aria-label^="Pick "]')
      .first()
    await expect(nextWinner).toBeVisible({ timeout: 15_000 })
    await nextWinner.click()
  }

  await expect(page.getByRole('status')).toContainText('Saved', { timeout: 15_000 })
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

test.describe('submission barriers', () => {
  // This is one stateful, ordered lifecycle. A failed attempt must leave its trace
  // intact rather than retrying against the deliberately mutated local entry.
  test.describe.configure({ retries: 0 })

  test(
    'failure, conflict and final in-flight edit all gate server submission',
    async ({ page }, testInfo) => {
      desktopOnly(testInfo)
      test.setTimeout(120_000)

      const prepared = await prepareCompleteGroupEntry()
      await completeBracket(page)
      await navigateToReview(page)
      await expect(page.getByRole('button', { name: 'Submit entry', exact: true })).toBeVisible()

      let submitRequests = 0
      page.on('request', (request) => {
        if (targets(request, '/rest/v1/rpc/submit_entry')) submitRequests += 1
      })

      // ---------------------------------------------------------------------
      // 1. Ordinary failure: all automatic retries exhaust. Submission waits
      //    for that terminal state, reports the error and never calls validator.
      // ---------------------------------------------------------------------
      let { home, away } = await openFirstGroupMatch(page, prepared)
      let currentHome = Number(await home.inputValue())
      let currentAway = Number(await away.inputValue())

      let markFirstFailure!: () => void
      const firstFailure = new Promise<void>((resolve) => {
        markFirstFailure = resolve
      })
      let failedAttempts = 0
      await page.route('**/rest/v1/match_predictions*', async (route) => {
        if (route.request().method() !== 'POST') {
          await route.continue()
          return
        }
        failedAttempts += 1
        if (failedAttempts === 1) markFirstFailure()
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

      await home.fill(String(currentHome + 1))
      await firstFailure
      await navigateToReview(page)
      await confirmSubmission(page)

      const submitFailureAlert = page
        .getByRole('alert')
        .filter({ hasText: "Couldn't submit" })
      await expect(submitFailureAlert).toContainText('Some changes could not be saved', {
        timeout: 15_000,
      })
      expect(failedAttempts).toBe(3)
      expect(submitRequests).toBe(0)

      // The visible manual retry reuses the retained local edit and fresh network.
      await page.unroute('**/rest/v1/match_predictions*')
      await navigateToGroupA(page)
      const recovered = page.waitForResponse((response) =>
        successfulWrite(response, '/rest/v1/match_predictions'),
      )
      await page.getByRole('button', { name: 'retry', exact: true }).first().click()
      await recovered

      // ---------------------------------------------------------------------
      // 2. Optimistic-concurrency conflict: an external local client advances
      //    the row version. Submit stays blocked until explicit Keep mine.
      // ---------------------------------------------------------------------
      home = page.getByLabel(`${prepared.firstHomeName} score`).first()
      away = page.getByLabel(`${prepared.firstAwayName} score`).first()
      currentHome = Number(await home.inputValue())
      currentAway = Number(await away.inputValue())

      await overwritePrediction(
        prepared.entryId,
        prepared.firstMatchId,
        currentHome + 1,
        currentAway,
      )
      await home.fill(String(currentHome + 2))
      const conflictAlert = page
        .getByRole('alert')
        .filter({ hasText: 'These picks were changed on another device' })
      await expect(conflictAlert).toBeVisible({ timeout: 10_000 })

      await navigateToReview(page)
      await confirmSubmission(page)
      await expect(
        page.getByRole('alert').filter({ hasText: "Couldn't submit" }),
      ).toContainText('Resolve the prediction conflict')
      expect(submitRequests).toBe(0)

      const keptMine = page.waitForResponse((response) =>
        successfulWrite(response, '/rest/v1/match_predictions'),
      )
      await page.getByRole('button', { name: 'Keep mine', exact: true }).click()
      await keptMine
      await expect(conflictAlert).toHaveCount(0)

      // ---------------------------------------------------------------------
      // 3. Last-second edit: deliberately hold the final score request while
      //    submitting. The validator cannot run until that request succeeds.
      // ---------------------------------------------------------------------
      await navigateToGroupA(page)
      home = page.getByLabel(`${prepared.firstHomeName} score`).first()
      currentHome = Number(await home.inputValue())

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

      await home.fill(String(currentHome + 1))
      await saveStarted
      await navigateToReview(page)
      await confirmSubmission(page)

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
    },
  )
})
