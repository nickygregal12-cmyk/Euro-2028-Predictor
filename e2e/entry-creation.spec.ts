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

/*
 * BLOCKED, MEASURED, AND NOT BY THE ROUTE FLIP. Run 31543352969 (11 August 2026)
 * left this the last failing journey in the Euro suite, timing out on an
 * `entries` POST that never happens — and it never happens by DESIGN.
 *
 * `PredictionsProvider` used to call `getOrCreateEntry`, whose upsert fires the
 * contract-66 membership trigger, so merely rendering a tournament surface
 * enrolled the visitor in Euro 2028. `tests/app/noSilentTournamentEntry.test.ts`
 * removed that and holds it removed: "Looking at a page must not enter you into
 * a competition." Its allowance list is EMPTY and its assertion unconditional —
 * there is no production-reachable caller of the creator left anywhere.
 *
 * This journey's subject is that caller. `prepareEntryRaceUser` deliberately
 * makes a user with NO entry and watches two tabs race to create one; with
 * nothing in the product creating one, there is no race to observe. Restarting
 * it from the navigation rather than the login was correct and was not enough:
 * the act it waits for was deleted on purpose while these specs were parked.
 *
 * THE TWO WAYS TO MAKE IT PASS ARE BOTH WRONG TODAY. Reinstating render-time
 * entry creation is the `EURO-001` violation with a stored consequence that the
 * guard above exists to prevent. Pointing it at an explicit tournament JOIN
 * surface is right — that guard's own note says the parked journeys "will need a
 * way to enter, as an explicit act, from a join surface" — and no such surface
 * exists yet. It is parked tournament work, not a spec fix, and inventing one to
 * turn a check green would be a product decision taken by a test.
 *
 * So it is left failing and named rather than skipped, loosened or deleted. The
 * suite is dispatch-only; a red journey here is the record of a real gap.
 */
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

    /*
     * THE RACE IS STARTED BY THE NAVIGATION NOW, NOT BY THE LOGIN, and that is a
     * correction rather than a rewrite of what this journey proves.
     *
     * Signing in used to create the entry on its own, because the tournament
     * providers were mounted above the whole signed-in shell — so arriving
     * anywhere, `/` included, asked for an entry. `TournamentJourney` moved them
     * to a route layout wrapping exactly the routes that consume them, and
     * `EURO-001`'s route flip left `/` deliberately outside it: on this build the
     * signed-in home is `EuroDestinationPage`, which reads the publication state
     * and nothing else. So logging in and stopping at `/` now writes no entry,
     * and this test timed out waiting for a POST that had no reason to happen.
     *
     * What it exists to prove is unchanged: two first-use tabs asking for an
     * entry AT THE SAME MOMENT converge on one row. The simultaneous act is now
     * the navigation into the tournament journey, which is where an entry is
     * created, and the gate below still holds both writes until both have
     * started so the race is real rather than incidental.
     */
    await Promise.all([
      page.getByRole('button', { name: 'Log in', exact: true }).click(),
      secondPage.getByRole('button', { name: 'Log in', exact: true }).click(),
    ])
    await Promise.all([
      expectAuthenticatedPath(page, '/'),
      expectAuthenticatedPath(secondPage, '/'),
    ])

    const firstResponse = page.waitForResponse((response) => entriesPost(response.request()))
    const secondResponse = secondPage.waitForResponse((response) => entriesPost(response.request()))

    // `commit` rather than the default: the gate below deliberately holds the
    // entry write until both tabs have started one, and waiting for `load` here
    // would deadlock against the gate this test is built on.
    const firstNavigation = page.goto('/predict', { waitUntil: 'commit' })
    const secondNavigation = secondPage.goto('/predict', { waitUntil: 'commit' })

    await bothStarted
    releaseRequests()

    const [firstWrite, secondWrite] = await Promise.all([
      firstResponse,
      secondResponse,
    ])
    await Promise.all([firstNavigation, secondNavigation])

    // Contract 66 can surface the membership unique-key loser as 409. The
    // service deliberately recovers that response by reading the winner's
    // committed entry. A future race-safe trigger may make both writes 201, so
    // accept either shape while requiring one successful creator.
    const statuses = [firstWrite.status(), secondWrite.status()].sort((a, b) => a - b)
    expect(statuses[0]).toBe(201)
    expect([201, 409]).toContain(statuses[1])

    await expectAuthenticatedPath(page, '/predict')
    await expectAuthenticatedPath(secondPage, '/predict')

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
