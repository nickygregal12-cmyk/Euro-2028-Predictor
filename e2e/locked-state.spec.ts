import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Response,
  type TestInfo,
} from '@playwright/test'
import {
  prepareLockedStateEntry,
  setDisposableTournamentLock,
} from './locked-state-local'

type BracketSnapshot = Record<'R16' | 'QF' | 'SF' | 'Final', string[]>

const rounds = [
  { label: 'R16' as const, total: 8 },
  { label: 'QF' as const, total: 4 },
  { label: 'SF' as const, total: 2 },
  { label: 'Final' as const, total: 1 },
]

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The stateful lock transition runs once; authenticated route smoke covers both viewports.',
  )
}

async function expectAuthenticatedPath(page: Page, path: string) {
  await expect(page).toHaveURL((url) => url.pathname === path, { timeout: 15_000 })
  await expect(page).not.toHaveURL(/\/auth\/login/)
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/more')
  await expectAuthenticatedPath(page, '/more')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/auth/login', { timeout: 15_000 })
  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expectAuthenticatedPath(page, '/')
}

function postTo(response: Response, path: string): boolean {
  return response.url().includes(path) && response.request().method() === 'POST'
}

async function expectRejected(response: Response, message: string) {
  expect(response.ok()).toBe(false)
  expect(await response.text()).toContain(message)
}

async function selectRound(page: Page, label: string) {
  const tab = page.getByRole('tab', { name: new RegExp(`^${label}\\b`) })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
}

async function completeBracket(page: Page) {
  await page.goto('/predict/bracket')
  await expectAuthenticatedPath(page, '/predict/bracket')
  await expect(page.getByRole('heading', { name: 'Knockout bracket' })).toBeVisible()
  await expect(page.getByText('Finish the group stage first')).toHaveCount(0)

  for (let pick = 0; pick < 15; pick += 1) {
    const nextWinner = page
      .locator('section:not(:has(button[aria-pressed="true"])) button[aria-label^="Pick "]')
      .first()
    await expect(nextWinner).toBeVisible({ timeout: 15_000 })
    await nextWinner.click()
  }

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

async function openGroupA(page: Page, homeName: string, awayName: string) {
  await page.goto('/predict/groups/A')
  await expectAuthenticatedPath(page, '/predict/groups/A')
  const home = page.getByLabel(`${homeName} score`).first()
  const away = page.getByLabel(`${awayName} score`).first()
  await expect(home).toBeVisible()
  await expect(away).toBeVisible()
  return { home, away }
}

async function openReview(page: Page) {
  await page.goto('/predict/review')
  await expectAuthenticatedPath(page, '/predict/review')
  await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible()
}

async function confirmSubmission(page: Page) {
  await page.getByRole('button', { name: 'Submit entry', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Submit your entry?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Submit entry', exact: true }).click()
}

test.describe('locked-state rejection', () => {
  test.describe.configure({ retries: 0 })

  test(
    'server rejects every prediction write after lock while saved picks remain readable',
    async ({ page, browser }, testInfo) => {
      desktopOnly(testInfo)
      test.setTimeout(180_000)

      const prepared = await prepareLockedStateEntry()
      await loginAs(page, prepared.email, prepared.password)
      await completeBracket(page)
      const originalBracket = await readBracketSnapshot(page)

      const origin = new URL(page.url()).origin
      const storageState = await page.context().storageState()
      const contexts: BrowserContext[] = []
      let lockMoved = false

      const makePage = async (path: string) => {
        const context = await browser.newContext({ baseURL: origin, storageState })
        contexts.push(context)
        const next = await context.newPage()
        await next.goto(path)
        await expectAuthenticatedPath(next, path)
        return next
      }

      try {
        // Load every page before the lock transition. Their UI still believes the
        // future lock is active, so each attempted write must reach the database
        // and be rejected by the authoritative server boundary.
        const scoreUpdatePage = await makePage('/predict/groups/A')
        const scoreDeletePage = await makePage('/predict/groups/A')
        const bracketPage = await makePage('/predict/bracket')
        const bonusPage = await makePage('/predict/review')
        const submitPage = await makePage('/predict/review')

        const updateFields = await openGroupA(
          scoreUpdatePage,
          prepared.firstHomeName,
          prepared.firstAwayName,
        )
        const deleteFields = await openGroupA(
          scoreDeletePage,
          prepared.firstHomeName,
          prepared.firstAwayName,
        )
        await expect(bracketPage.getByRole('heading', { name: 'Knockout bracket' })).toBeVisible()
        await expect(bonusPage.getByLabel('Top scorer')).toBeVisible()
        await expect(submitPage.getByRole('button', { name: 'Submit entry', exact: true })).toBeVisible()

        const originalHome = await updateFields.home.inputValue()
        const originalAway = await updateFields.away.inputValue()

        const pastLock = new Date(Date.now() - 60_000).toISOString()
        await setDisposableTournamentLock(prepared.tournamentId, pastLock)
        lockMoved = true

        // Score update: ordinary REST upsert reaches the score lock trigger.
        const scoreUpdateResponse = scoreUpdatePage.waitForResponse((response) =>
          postTo(response, '/rest/v1/match_predictions'),
        )
        await updateFields.home.fill(String(Number(originalHome) + 1))
        await expectRejected(await scoreUpdateResponse, 'Predictions are locked')
        await expect(
          scoreUpdatePage.getByRole('button', { name: 'retry', exact: true }).first(),
        ).toBeVisible({ timeout: 15_000 })

        // Score clear: the protected version-safe delete RPC also fails closed.
        const scoreDeleteResponse = scoreDeletePage.waitForResponse((response) =>
          postTo(response, '/rest/v1/rpc/delete_match_prediction'),
        )
        await deleteFields.home.fill('')
        await expectRejected(await scoreDeleteResponse, 'Predictions are locked')
        await expect(
          scoreDeletePage.getByRole('button', { name: 'retry', exact: true }).first(),
        ).toBeVisible({ timeout: 15_000 })

        // Bracket replacement: changing the final sends one complete atomic RPC.
        await selectRound(bracketPage, 'Final')
        const bracketResponse = bracketPage.waitForResponse((response) =>
          postTo(response, '/rest/v1/rpc/replace_predicted_progression'),
        )
        await bracketPage
          .locator('section[aria-label^="Final"] button[aria-pressed="false"]')
          .first()
          .click()
        await expectRejected(await bracketResponse, 'Predictions are locked')
        await expect(bracketPage.getByRole('status')).toContainText('Save failed', {
          timeout: 15_000,
        })

        // Golden Boot: the local-only player exists, but the bonus row insert is
        // rejected by the same tournament lock and surfaces its visible retry UI.
        await bonusPage.getByLabel('Top scorer').fill(prepared.playerName)
        const playerOption = bonusPage.getByRole('button', {
          name: prepared.playerName,
          exact: true,
        })
        await expect(playerOption).toBeVisible({ timeout: 15_000 })
        const bonusResponse = bonusPage.waitForResponse((response) =>
          postTo(response, '/rest/v1/bonus_predictions'),
        )
        await playerOption.click()
        await expectRejected(await bonusResponse, 'Predictions are locked')
        await expect(
          bonusPage.getByRole('alert').filter({ hasText: 'Golden Boot pick not saved' }),
        ).toBeVisible({ timeout: 15_000 })

        // Submission has its own explicit lock rejection and must call the server
        // exactly once rather than relying on the stale pre-lock client view.
        let submitRequests = 0
        submitPage.on('request', (request) => {
          if (
            request.url().includes('/rest/v1/rpc/submit_entry') &&
            request.method() === 'POST'
          ) {
            submitRequests += 1
          }
        })
        const submitResponse = submitPage.waitForResponse((response) =>
          postTo(response, '/rest/v1/rpc/submit_entry'),
        )
        await confirmSubmission(submitPage)
        await expectRejected(await submitResponse, 'Entry submission is closed')
        await expect(
          submitPage.getByRole('alert').filter({ hasText: "Couldn't submit" }),
        ).toBeVisible({ timeout: 15_000 })
        expect(submitRequests).toBe(1)

        // A fresh post-lock client renders the authoritative entry read-only.
        // Failed optimistic edits never replace the stored scores or bracket tree.
        const readPage = await makePage('/predict/groups/A')
        await expect(readPage.getByRole('img', { name: 'Predictions locked' }).first()).toBeVisible()
        await expect(
          readPage.getByText(`${prepared.firstHomeName} score: ${originalHome}`, {
            exact: false,
          }).first(),
        ).toBeVisible()
        await expect(
          readPage.getByText(`${prepared.firstAwayName} score: ${originalAway}`, {
            exact: false,
          }).first(),
        ).toBeVisible()

        await readPage.goto('/predict/bracket')
        await expectAuthenticatedPath(readPage, '/predict/bracket')
        expect(await readBracketSnapshot(readPage)).toEqual(originalBracket)

        await openReview(readPage)
        await expect(
          readPage.getByText('Predictions are locked — the tournament has started', {
            exact: true,
          }),
        ).toBeVisible()
      } finally {
        if (lockMoved) {
          await setDisposableTournamentLock(prepared.tournamentId, prepared.futureLockAt)
        }
        await Promise.all(contexts.map((context) => context.close()))
      }
    },
  )
})
