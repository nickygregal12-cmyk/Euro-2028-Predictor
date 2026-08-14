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
  assertSharedCardWithoutMainMembership,
  findPrivateCompetitionByName,
  joinPrivateCompetitionAs,
  prepareFreshPrivatePlayUser,
  saveSharedPredictionAs,
  type PrivatePlayUser,
} from './private-play-lifecycle-local'

/**
 * PPLAY-005 — real lifecycle evidence against disposable local Supabase.
 *
 * The component tests prove presentation. These journeys prove the actual
 * write -> authoritative reread -> destination -> hard reload sequence with
 * real RPCs and real auth identities. They run once on desktop because the
 * lifecycle/data authority is viewport-independent; the ordinary route/a11y
 * suite already covers both desktop and phone shells.
 */

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The multi-account private-play lifecycle runs once; shared responsive journeys cover both viewports.',
  )
}

function successfulRpc(response: Response, name: string): boolean {
  return (
    response.url().includes(`/rest/v1/rpc/${name}`) &&
    response.request().method() === 'POST' &&
    response.ok()
  )
}

async function expectAuthenticatedPath(page: Page, path: string) {
  await expect(page).toHaveURL((url) => url.pathname === path, { timeout: 15_000 })
  await expect(page).not.toHaveURL(/\/auth\/login/)
}

/**
 * The browser job has local-only dev autologin enabled for its canonical owner.
 * A fresh invitee therefore first signs that account out, then signs in as
 * itself. This is the same two-account boundary used by the retained ordinary
 * private-league lifecycle proof.
 */
async function prepareLogin(page: Page, email: string, password: string) {
  await page.goto('/account')

  if (new URL(page.url()).pathname !== '/auth/login') {
    await expectAuthenticatedPath(page, '/account')
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Sign out?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/auth/login', { timeout: 15_000 })
  }

  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expectAuthenticatedPath(page, '/')
}

async function chooseScottishSeason(page: Page) {
  const scottish = page.getByRole('button', { name: /Scottish Premiership/ })
  if ((await scottish.count()) > 0) await scottish.first().click()
}

async function createPrivateCompetition(
  page: Page,
  game: 'Last Man Standing' | 'Predictor Championship',
  name: string,
  rpc: 'create_private_season_lms' | 'create_private_season_cup',
): Promise<string> {
  await page.goto('/leagues')
  await expectAuthenticatedPath(page, '/leagues')
  await expect(page.getByRole('heading', { name: 'Leagues', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Create private play' }).click()
  // Retries can legitimately leave an earlier private container in the same
  // disposable database. Its page-level game filter has a similar accessible
  // name, so scope the choice to the create wizard rather than using `.first()`
  // and accidentally clicking whichever duplicate happens to be earlier.
  const createWizard = page.getByRole('region', { name: 'Create private play' })
  await expect(createWizard).toBeVisible()
  await createWizard.getByRole('button', { name: new RegExp(`^${game}\\b`) }).click()
  await chooseScottishSeason(page)
  await page.getByLabel('Competition name').fill(name)
  await page.getByRole('button', { name: 'Review', exact: true }).click()

  const created = page.waitForResponse((response) => successfulRpc(response, rpc))
  await page.getByRole('button', { name: 'Create and share', exact: true }).click()
  await created

  await expect(page.getByRole('heading', { name: `${name} is ready` })).toBeVisible({
    timeout: 15_000,
  })
  const codeButton = page.getByRole('button', {
    name: /Copy invite code [A-Z0-9]{6,16}/,
  })
  await expect(codeButton).toBeVisible()
  const label = await codeButton.getAttribute('aria-label')
  const code = label?.match(/Copy invite code ([A-Z0-9]{6,16})/)?.[1]
  if (!code) throw new Error(`${game} create flow exposed no valid invite code.`)
  return code
}

async function joinThroughDeepLink(
  page: Page,
  user: PrivatePlayUser,
  code: string,
  expectedName: string,
) {
  await prepareLogin(page, user.email, user.password)
  await page.goto(`/join/${code}`)
  await expect(page).toHaveURL((url) => url.pathname === `/join/${code}`)
  await expect(page.getByRole('heading', { name: expectedName })).toBeVisible({ timeout: 15_000 })

  const joined = page.waitForResponse((response) => successfulRpc(response, 'join_private_competition'))
  await page.getByRole('button', { name: 'Join competition', exact: true }).click()
  await joined

  await expectAuthenticatedPath(page, '/leagues')
  await expect(page.getByRole('heading', { name: expectedName })).toBeVisible({ timeout: 15_000 })
}

test.describe.configure({ mode: 'serial' })

test('private LMS owner and invitee both rediscover it after hard reload', async ({
  page,
  browser,
}, testInfo) => {
  desktopOnly(testInfo)
  test.setTimeout(150_000)

  const suffix = randomUUID().slice(0, 8)
  const name = `E2E Survivors ${suffix}`
  const invitee = await prepareFreshPrivatePlayUser(`lms-${suffix}`)
  const baseURL = testInfo.project.use.baseURL
  if (typeof baseURL !== 'string') throw new Error('Private-play E2E requires a string baseURL.')

  let inviteeContext: BrowserContext | null = null
  try {
    const code = await createPrivateCompetition(
      page,
      'Last Man Standing',
      name,
      'create_private_season_lms',
    )

    // CREATE -> DONE -> AUTHORITATIVE REREAD -> HARD RELOAD.
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 })
    await page.reload()
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 })

    const stored = await findPrivateCompetitionByName(name)
    expect(stored.inviteCode).toBe(code)

    inviteeContext = await browser.newContext({ baseURL })
    const inviteePage = await inviteeContext.newPage()
    await joinThroughDeepLink(inviteePage, invitee, code, name)

    // A member can rediscover the container but not the organiser's secret.
    await expect(inviteePage.getByText(code, { exact: true })).toHaveCount(0)
    await expect(inviteePage.getByText('Invite code available from the organiser')).toBeVisible()

    // JOIN -> AUTHORITATIVE REREAD -> HARD RELOAD.
    await inviteePage.reload()
    await expect(inviteePage.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 })
    await expect(inviteePage.getByText(code, { exact: true })).toHaveCount(0)
  } finally {
    await inviteeContext?.close()
  }
})

test('private Championship survives leaving the flow, supports a fresh entrant, then launches on return', async ({
  page,
  browser,
}, testInfo) => {
  desktopOnly(testInfo)
  test.setTimeout(180_000)

  const suffix = randomUUID().slice(0, 8)
  const name = `E2E Championship ${suffix}`
  const first = await prepareFreshPrivatePlayUser(`cup-first-${suffix}`)
  const second = await prepareFreshPrivatePlayUser(`cup-second-${suffix}`)
  const third = await prepareFreshPrivatePlayUser(`cup-third-${suffix}`)
  const baseURL = testInfo.project.use.baseURL
  if (typeof baseURL !== 'string') throw new Error('Private-play E2E requires a string baseURL.')

  let firstContext: BrowserContext | null = null
  try {
    const code = await createPrivateCompetition(
      page,
      'Predictor Championship',
      name,
      'create_private_season_cup',
    )

    // Deliberately leave without launching. This is the PPLAY-003 state that
    // used to strand the organiser after the create wizard disappeared.
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 })
    await page.reload()
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 })

    const stored = await findPrivateCompetitionByName(name)
    expect(stored.inviteCode).toBe(code)

    // Start from an account that had NO entry and NO game membership. Join in
    // the browser, prove the list survives reload, then exercise Contract 180's
    // actual shared prediction write without creating a Match Predictor membership.
    firstContext = await browser.newContext({ baseURL })
    const firstPage = await firstContext.newPage()
    await joinThroughDeepLink(firstPage, first, code, name)
    await firstPage.reload()
    await expect(firstPage.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 })

    await assertSharedCardWithoutMainMembership(first.userId, stored.tournamentId)
    await saveSharedPredictionAs(first, stored.tournamentId)
    await assertSharedCardWithoutMainMembership(first.userId, stored.tournamentId)

    // Four is the private single-group floor: owner + these three fresh users.
    // The two additional joins use the same authenticated RPC but do not need
    // two more browser contexts; the first user above is the end-to-end journey.
    expect(await joinPrivateCompetitionAs(second, code)).toBe(stored.id)
    expect(await joinPrivateCompetitionAs(third, code)).toBe(stored.id)

    // RETURN -> server readiness -> LAUNCH. No local format calculation decides
    // whether the button exists.
    await page.reload()
    const organiser = page.getByRole('button', { name: new RegExp(name) })
    await expect(organiser).toBeVisible({ timeout: 15_000 })
    await organiser.click()

    const launchButton = page.getByRole('button', { name: 'Launch the Championship', exact: true })
    await expect(launchButton).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/fixes the draw and closes registration/i)).toBeVisible()
    await expect(page.getByText(/cannot be undone/i)).toBeVisible()

    const launched = page.waitForResponse((response) =>
      successfulRpc(response, 'launch_private_season_cup'),
    )
    await launchButton.click()
    await launched
    await expect(page.getByText('The field is fixed and registration is closed.')).toBeVisible({
      timeout: 15_000,
    })

    // The launched answer itself must also survive a fresh read after reload.
    await page.reload()
    const returnedOrganiser = page.getByRole('button', { name: new RegExp(name) })
    await expect(returnedOrganiser).toBeVisible({ timeout: 15_000 })
    await returnedOrganiser.click()
    await expect(page.getByText('Championship launched')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('The field is fixed and registration is closed.')).toBeVisible()
  } finally {
    await firstContext?.close()
  }
})
