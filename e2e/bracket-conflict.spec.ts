import {
  expect,
  test,
  type Page,
  type Request,
  type Response,
  type TestInfo,
} from '@playwright/test'
import { prepareBracketConflictEntry } from './bracket-conflict-local'

type BracketSnapshot = Record<'R16' | 'QF' | 'SF' | 'Final', string[]>

const rounds = [
  { label: 'R16' as const, total: 8 },
  { label: 'QF' as const, total: 4 },
  { label: 'SF' as const, total: 2 },
  { label: 'Final' as const, total: 1 },
]

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
    'The stateful two-device bracket journey runs once; route smoke covers both viewports.',
  )
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/more')
  await expectAuthenticatedPath(page, '/more')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/auth/login', { timeout: 15_000 })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expectAuthenticatedPath(page, '/')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
}

async function openBracket(page: Page) {
  await page.goto('/predict/bracket')
  await expectAuthenticatedPath(page, '/predict/bracket')
  await expect(page.getByRole('heading', { name: 'Knockout bracket' })).toBeVisible()
  await expect(page.getByText('Finish the group stage first')).toHaveCount(0)
}

async function selectRound(page: Page, label: string) {
  const tab = page.getByRole('tab', { name: new RegExp(`^${label}\\b`) })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  return tab
}

async function fillMissingBracketPicks(page: Page) {
  for (const round of rounds) {
    const tab = await selectRound(page, round.label)
    while ((await tab.getAttribute('aria-selected')) === 'true') {
      const nextWinner = page
        .locator('section:not(:has(button[aria-pressed="true"])) button[aria-label^="Pick "]')
        .first()
      if ((await nextWinner.count()) === 0) break
      await nextWinner.click()
    }

    await selectRound(page, round.label)
    await expect(page.locator('section button[aria-pressed="true"]')).toHaveCount(round.total)
  }

  // The bracket save is debounced by 600 ms. Waiting beyond that boundary before
  // asserting Saved proves the final complete snapshot, not an earlier partial one.
  await page.waitForTimeout(700)
  await expect(page.getByRole('status')).toContainText('Saved', { timeout: 15_000 })
}

async function readBracketSnapshot(page: Page): Promise<BracketSnapshot> {
  const snapshot = {} as BracketSnapshot
  for (const round of rounds) {
    await selectRound(page, round.label)
    const picked = page.locator('section button[aria-pressed="true"]')
    await expect(picked).toHaveCount(round.total)
    snapshot[round.label] = await picked.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute('aria-label') ?? ''),
    )
  }
  return snapshot
}

async function expectBracketSnapshot(page: Page, expected: BracketSnapshot) {
  expect(await readBracketSnapshot(page)).toEqual(expected)
}

async function changeFirstR16Winner(page: Page) {
  await selectRound(page, 'R16')
  const firstTie = page.locator('section[aria-label^="R16"]').first()
  const replacement = firstTie.locator('button[aria-pressed="false"]').first()
  await expect(replacement).toBeVisible()
  await replacement.click()

  const dialog = page.getByRole('dialog', { name: 'Change this pick?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Change it', exact: true }).click()
  await fillMissingBracketPicks(page)
}

async function changeFinalWinner(page: Page) {
  await selectRound(page, 'Final')
  const replacement = page
    .locator('section[aria-label^="Final"] button[aria-pressed="false"]')
    .first()
  await expect(replacement).toBeVisible()
  await replacement.click()
}

async function navigateToReview(page: Page) {
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Predict', exact: true })
    .click()
  await expectAuthenticatedPath(page, '/predict')
  await page.getByRole('button', { name: /Review and submit/ }).click()
  await expectAuthenticatedPath(page, '/predict/review')
}

async function confirmSubmission(page: Page) {
  await page.getByRole('button', { name: 'Submit entry', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Submit your entry?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Submit entry', exact: true }).click()
}

test.describe('bracket snapshot conflict and recovery', () => {
  test.describe.configure({ retries: 0 })

  test(
    'two devices load latest, keep mine, and gate submission behind the atomic snapshot',
    async ({ page, browser }, testInfo) => {
      desktopOnly(testInfo)
      test.setTimeout(180_000)

      const prepared = await prepareBracketConflictEntry()
      await loginAs(page, prepared.email, prepared.password)
      await openBracket(page)
      await fillMissingBracketPicks(page)
      const initialSnapshot = await readBracketSnapshot(page)

      const origin = new URL(page.url()).origin
      const secondContext = await browser.newContext({ baseURL: origin })
      const secondPage = await secondContext.newPage()

      let submitRequests = 0
      page.on('request', (request) => {
        if (targets(request, '/rest/v1/rpc/submit_entry')) submitRequests += 1
      })

      try {
        await loginAs(secondPage, prepared.email, prepared.password)
        await openBracket(secondPage)
        await expectBracketSnapshot(secondPage, initialSnapshot)

        // Device B replaces an early winner. The real cascade confirmation clears
        // dependent QF/SF/final picks, then the UI rebuilds and atomically saves a
        // complete replacement snapshot.
        await changeFirstR16Winner(secondPage)
        const deviceBSnapshot = await readBracketSnapshot(secondPage)
        expect(deviceBSnapshot).not.toEqual(initialSnapshot)

        // Device A is still on the original complete snapshot. Changing only the
        // final keeps all 15 local picks present, but stale versions must produce
        // PT409 and block submit_entry until the user chooses a recovery direction.
        await changeFinalWinner(page)
        const conflictAlert = page
          .getByRole('alert')
          .filter({ hasText: 'These picks were changed on another device' })
        await expect(conflictAlert).toBeVisible({ timeout: 15_000 })

        await navigateToReview(page)
        await confirmSubmission(page)
        await expect(page.getByRole('alert').filter({ hasText: "Couldn't submit" })).toContainText(
          'Resolve the prediction conflict',
        )
        expect(submitRequests).toBe(0)

        const latestReload = page.waitForResponse(
          (response) =>
            response.url().includes('/rest/v1/predicted_progression') &&
            response.request().method() === 'GET' &&
            response.ok(),
        )
        await page.getByRole('button', { name: 'Load latest', exact: true }).click()
        await latestReload
        await expect(conflictAlert).toHaveCount(0)

        await openBracket(page)
        await expectBracketSnapshot(page, deviceBSnapshot)

        // Device B changes the early winner again, creating a new authoritative
        // snapshot while device A keeps the previously loaded complete bracket.
        await changeFirstR16Winner(secondPage)
        const newerServerSnapshot = await readBracketSnapshot(secondPage)
        expect(newerServerSnapshot).not.toEqual(deviceBSnapshot)

        // A complete stale final edit conflicts again. This time Keep mine must
        // reload every row version and atomically reapply A's entire local tree.
        await changeFinalWinner(page)
        await expect(conflictAlert).toBeVisible({ timeout: 15_000 })
        const localMineSnapshot = await readBracketSnapshot(page)
        expect(localMineSnapshot).not.toEqual(newerServerSnapshot)

        const keepReload = page.waitForResponse(
          (response) =>
            response.url().includes('/rest/v1/predicted_progression') &&
            response.request().method() === 'GET' &&
            response.ok(),
        )
        const keepWrite = page.waitForResponse((response) =>
          successfulWrite(response, '/rest/v1/rpc/replace_predicted_progression'),
        )
        await page.getByRole('button', { name: 'Keep mine', exact: true }).click()
        await keepReload
        await keepWrite
        await expect(conflictAlert).toHaveCount(0)
        await expect(page.getByRole('status')).toContainText('Saved', { timeout: 15_000 })

        await page.reload()
        await expectBracketSnapshot(page, localMineSnapshot)
        await secondPage.reload()
        await expectBracketSnapshot(secondPage, localMineSnapshot)

        // Finally hold an entire bracket replacement in flight during submission.
        // The validator must remain absent until the atomic snapshot succeeds.
        let releaseHeldSave!: () => void
        const heldSaveGate = new Promise<void>((resolve) => {
          releaseHeldSave = resolve
        })
        let markSaveStarted!: () => void
        const saveStarted = new Promise<void>((resolve) => {
          markSaveStarted = resolve
        })
        let held = false

        await page.route('**/rest/v1/rpc/replace_predicted_progression', async (route) => {
          if (!held && route.request().method() === 'POST') {
            held = true
            markSaveStarted()
            await heldSaveGate
          }
          await route.continue()
        })

        await changeFinalWinner(page)
        await saveStarted
        await navigateToReview(page)
        await confirmSubmission(page)
        await page.waitForTimeout(300)
        expect(submitRequests).toBe(0)

        const bracketPersisted = page.waitForResponse((response) =>
          successfulWrite(response, '/rest/v1/rpc/replace_predicted_progression'),
        )
        const submitted = page.waitForResponse((response) =>
          successfulWrite(response, '/rest/v1/rpc/submit_entry'),
        )
        releaseHeldSave()
        await bracketPersisted
        await submitted

        await expect(page.getByText('Entry submitted', { exact: true })).toBeVisible()
        expect(submitRequests).toBe(1)
      } finally {
        await secondContext.close()
      }
    },
  )
})
