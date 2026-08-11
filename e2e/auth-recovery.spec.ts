import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { clearLocalMailbox, waitForAuthLink } from './local-mail'
import {
  createLocalAdmin,
  DEFAULT_E2E_EMAIL,
  localTournamentSeason,
} from './local-supabase'
import { expectNoSeriousAxeViolations } from './axe-scan'

const EMAIL = 'auth-recovery-e2e@euro28.local'
const DISPLAY_NAME = 'Auth Recovery Tester'
const OLD_PASSWORD = 'Auth-local-only-2028!'
const NEW_PASSWORD = 'Auth-local-new-2028!'
const INVITE_CODE = 'AUTH28'
const INVITE_LEAGUE_NAME = 'Authentication Invite League'

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'auth-desktop-chromium',
    'The stateful signup and recovery lifecycle runs once; mobile retains route smoke coverage.',
  )
}

function mobileOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'auth-mobile-chromium',
    'The mobile project only verifies the signed-out auth surfaces without mutating shared state.',
  )
}

async function authUserId(): Promise<string | null> {
  const admin = createLocalAdmin()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((user) => user.email === EMAIL)?.id ?? null
}

/**
 * The invited player joins the game their league ranks.
 *
 * THIS JOURNEY USED TO GET THIS BY ACCIDENT. `PredictionsProvider` once called
 * `getOrCreateEntry` on mount, whose upsert fires the contract-66 membership
 * trigger — so merely looking at a page enrolled a player in Euro 2028. That
 * was removed as an `EURO-001` fix ("entry is an act, not a side effect of
 * looking"), and the membership `join_league` requires went with it. Nothing
 * about invites changed; an unstated precondition simply stopped being supplied
 * for free, so it is supplied here on purpose.
 *
 * An `entries` row IS the act of joining the Original Predictor: the trigger
 * turns it into the active `game_memberships` row, which is the same state a
 * real player reaches by entering the game.
 */
async function joinTheLeaguesGame(userId: string | null): Promise<void> {
  if (!userId) throw new Error(`Auth recovery E2E user ${EMAIL} was not created.`)
  const tournament = await localTournamentSeason()
  const { error } = await createLocalAdmin()
    .from('entries')
    .upsert(
      { user_id: userId, tournament_id: tournament.id },
      { onConflict: 'user_id,tournament_id', ignoreDuplicates: true },
    )
  if (error) throw error
}

/** Which games the caller actually holds, for diagnosing a withheld control. */
async function gameMembershipsOf(userId: string | null): Promise<string[]> {
  if (!userId) return []
  const { data, error } = await createLocalAdmin()
    .from('game_memberships')
    .select('game_competition_id, status')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((row) => `${row.game_competition_id} (${row.status})`)
}

async function removeExistingUser(): Promise<void> {
  const id = await authUserId()
  if (!id) return
  const { error } = await createLocalAdmin().auth.admin.deleteUser(id)
  if (error) throw error
}

async function preparePendingInviteLeague(): Promise<string> {
  const admin = createLocalAdmin()
  const ownerEmail = process.env.E2E_USER_EMAIL?.trim() || DEFAULT_E2E_EMAIL
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (usersError) throw usersError
  const owner = users.users.find((user) => user.email === ownerEmail)
  if (!owner) throw new Error(`Pending invite fixture found no owner ${ownerEmail}.`)

  const tournament = await localTournamentSeason()
  const { data: game, error: gameError } = await admin
    .from('bonus_competitions')
    .select('id')
    .eq('tournament_id', tournament.id)
    .eq('game_key', 'original_predictor')
    .single()
  if (gameError) throw gameError

  // Remove a prior interrupted fixture before recreating the deterministic code.
  const { error: priorError } = await admin.from('leagues').delete().eq('invite_code', INVITE_CODE)
  if (priorError) throw priorError

  const { data: league, error: leagueError } = await admin
    .from('leagues')
    .insert({
      tournament_id: tournament.id,
      game_competition_id: game.id,
      owner_id: owner.id,
      name: INVITE_LEAGUE_NAME,
      invite_code: INVITE_CODE,
    })
    .select('id')
    .single()
  if (leagueError) throw leagueError

  const { error: membershipError } = await admin.from('league_members').insert({
    league_id: league.id,
    user_id: owner.id,
    role: 'owner',
  })
  if (membershipError) throw membershipError

  return league.id
}

async function cleanupPendingInviteLeague(leagueId: string): Promise<void> {
  const { error } = await createLocalAdmin().from('leagues').delete().eq('id', leagueId)
  if (error) throw error
}

async function ensureFutureTournamentLock(): Promise<void> {
  const admin = createLocalAdmin()
  const tournament = await localTournamentSeason()

  const futureLock = new Date()
  futureLock.setUTCFullYear(futureLock.getUTCFullYear() + 10)
  const { error: updateError } = await admin
    .from('tournaments')
    .update({ lock_at: futureLock.toISOString() })
    .eq('id', tournament.id)
  if (updateError) throw updateError
}

async function waitForWelcomeStamp(timeoutMs = 10_000): Promise<void> {
  const userId = await authUserId()
  if (!userId) throw new Error(`Auth recovery E2E user ${EMAIL} was not created.`)
  const admin = createLocalAdmin()
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const { data, error } = await admin
      .from('profiles')
      .select('welcomed_at')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw error
    if (data?.welcomed_at) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error('Timed out waiting for the welcome timestamp to persist.')
}

async function logIn(page: Page, password: string): Promise<void> {
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
}

async function signOut(page: Page): Promise<void> {
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: /sign out/i })
  const confirmationOpened = await dialog
    .waitFor({ state: 'visible', timeout: 500 })
    .then(() => true)
    .catch(() => false)
  if (confirmationOpened) {
    await dialog.getByRole('button', { name: 'Sign out', exact: true }).click()
  }

  await expect(page).toHaveURL((url) => url.pathname === '/auth/login', { timeout: 15_000 })
}

test.describe('authentication and recovery', () => {
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('signup confirmation, pending invite, welcome, login and recovery work end to end', async ({
    page,
  }, testInfo) => {
    desktopOnly(testInfo)
    test.setTimeout(120_000)

    await ensureFutureTournamentLock()
    await removeExistingUser()
    await clearLocalMailbox(EMAIL)
    const inviteLeagueId = await preparePendingInviteLeague()

    // WHICH RPC REFUSED, AND WITH WHAT. The surface deliberately shows a player
    // one sanitised sentence — `userFacingError` never puts a database message
    // on screen — which is right for them and useless for a failing suite: this
    // journey once failed with "We could not finish your setup" and nothing
    // anywhere said which call had been refused. Every non-2xx RPC is recorded
    // here and named in the assertion that fails, so the next failure diagnoses
    // itself instead of costing a round of guessing.
    const refusedCalls: string[] = []
    page.on('response', (response) => {
      const url = new URL(response.url())
      if (url.pathname.includes('/rest/v1/rpc/') && !response.ok()) {
        refusedCalls.push(`${response.status()} ${url.pathname.split('/rpc/')[1]}`)
      }
    })

    try {
      await page.goto(`/join/${INVITE_CODE}`)
      await expect(page).toHaveURL((url) => url.pathname === '/auth/signup')
      await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
      await page.getByLabel('Display name').fill(DISPLAY_NAME)
      await page.getByLabel('Email').fill(EMAIL)
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill(OLD_PASSWORD)
      await page.getByRole('button', { name: 'Create account', exact: true }).click()

      await expect(page.getByRole('status')).toContainText('Almost there — check your email')
      await expect(page.getByRole('status')).toContainText(EMAIL)

      const confirmationLink = await waitForAuthLink(EMAIL, 'signup')
      await page.goto(confirmationLink)
      await expect(page).toHaveURL((url) => url.pathname === '/welcome', { timeout: 20_000 })

      // `/welcome` USED TO BE ONE STATIC SCREEN with a Continue button, and
      // this assertion used to read `heading "Welcome, <name>"`. It is now the
      // four-step onboarding journey contract 157 made storable, so the page's
      // own h1 names what the page is FOR and the greeting sits above it as an
      // eyebrow. Promoting the greeting back to a heading would give the page
      // two h1s to satisfy a test, which is the wrong way round — so the test
      // moved to the markup rather than the markup to the test.
      await expect(page.getByRole('heading', { name: 'Set up your season' })).toBeVisible({
        timeout: 15_000,
      })
      await expect(page.getByText(`Welcome, ${DISPLAY_NAME}`, { exact: true })).toBeVisible()
      await expect(page.getByText('Step 1 of 4')).toBeVisible()

      // `/welcome` was deferred for needing "a fixture user who has not
      // completed it". This journey creates exactly that user and is standing
      // on the page — the blocker named a fixture the suite already had.
      await expectNoSeriousAxeViolations(page, '/welcome')

      // Walk the journey without answering anything. EVERY STEP IS SKIPPABLE by
      // design, so a player who wants to get to their invite can, and that is
      // exactly what this fixture user is doing — they arrived from an invite
      // link and setup is the interruption. The advance control is located by
      // its position in the step navigation rather than by its label, because
      // the label is deliberately "Skip for now" or "Continue" depending on
      // whether the step in front of the player has been answered.
      const advance = page.getByRole('navigation', { name: 'Setup steps' }).getByRole('button').last()
      for (const step of ['Step 2 of 4', 'Step 3 of 4', 'Step 4 of 4']) {
        await advance.click()
        await expect(page.getByText(step)).toBeVisible()
      }

      await page.getByRole('button', { name: 'Finish setup', exact: true }).click()

      // FINISHING MUST NOT FAIL SILENTLY, and this waits for whichever answer
      // comes first rather than only for the one it hopes for. `finish` either
      // hands the player onward or leaves them on the page with the reason —
      // a partial-failure list or an error — and waiting only on the URL would
      // spend twenty seconds and then report a timeout, which says the journey
      // did not finish without saying why.
      await Promise.race([
        page.waitForURL((url) => url.pathname === `/join/${INVITE_CODE}`, { timeout: 30_000 }),
        page.getByRole('alert').first().waitFor({ state: 'visible', timeout: 30_000 }),
      ]).catch(() => undefined)
      const refusals = await page.getByRole('alert').allInnerTexts()
      expect(
        refusals,
        `finishing setup reported a problem instead of handing back the invite; refused RPCs: ${
          refusedCalls.length > 0 ? refusedCalls.join(', ') : 'none'
        }`,
      ).toEqual([])

      // The pending invite survived sign-up AND onboarding. It was captured on
      // arrival at `/welcome` and is consumed only now, so somebody who had
      // abandoned setup halfway would still have had it waiting.
      await expect(page).toHaveURL((url) => url.pathname === `/join/${INVITE_CODE}`, {
        timeout: 20_000,
      })
      await expect(page.getByRole('heading', { name: INVITE_LEAGUE_NAME })).toBeVisible()

      // The owner's name is ABSENT, and that is the assertion rather than the
      // loss of one. Contract 158 stopped `get_league_preview` returning
      // `owner_name`, because answering any authenticated guess with a real
      // person's name is what turned a guessed code into a positively
      // identified group. The name reappears on the league page after joining,
      // where a member may see the membership — which the join below still
      // proves.
      await expect(page.getByText('Owner: E2E Tester', { exact: true })).toBeHidden()

      // The valid-invite preview, which is a different page from the stale
      // `/join/NOSUCH` state `axe-unauthenticated` scans: a league name and a
      // join action rather than a not-found message.
      await expectNoSeriousAxeViolations(page, '/join/:code')
      await waitForWelcomeStamp()

      // WHY THE JOIN CONTROL IS OR IS NOT OFFERED. `join_league` refuses a
      // caller with no ACTIVE `game_memberships` row for the league's game, and
      // `resolve_invite_code` reports exactly that as `requires_game_entry` —
      // so the preview withholds the button rather than offering one the server
      // would refuse. That makes this journey depend on a precondition it never
      // used to state: the invited player must hold the league's game. Stated
      // here, with what the caller actually holds, so a failure says which of
      // the two is missing rather than "the button was not there".
      await joinTheLeaguesGame(await authUserId())
      // Re-resolved rather than assumed: the preview decided there was no join
      // control from the answer it had, so it has to ask again now the answer
      // has changed.
      await page.reload()
      await expect(page.getByRole('heading', { name: INVITE_LEAGUE_NAME })).toBeVisible()

      const held = await gameMembershipsOf(await authUserId())
      expect(
        await page.getByRole('button', { name: 'Join league', exact: true }).count(),
        `the invite preview offered no join control; the caller holds ${
          held.length > 0 ? held.join(', ') : 'no game membership'
        } and the league needs the game it ranks`,
      ).toBe(1)

      await page.getByRole('button', { name: 'Join league', exact: true }).click()
      await expect(page).toHaveURL((url) => url.pathname === `/league/${inviteLeagueId}`, {
        timeout: 20_000,
      })
      await expect(page.getByRole('heading', { name: INVITE_LEAGUE_NAME })).toBeVisible()
      await expect(page.getByText('2 members', { exact: true })).toBeVisible()

      await signOut(page)
      await logIn(page, OLD_PASSWORD)
      await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 15_000 })
      await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible()

      await signOut(page)
      await clearLocalMailbox(EMAIL)

      await page.getByRole('button', { name: 'Forgot password?' }).click()
      await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
      await page.getByLabel('Email').fill(EMAIL)
      await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
      await expect(page.getByRole('status')).toContainText('Reset link sent')

      const recoveryLink = await waitForAuthLink(EMAIL, 'recovery')
      await page.goto(recoveryLink)
      await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible({
        timeout: 20_000,
      })
      await page.getByRole('textbox', { name: 'New password', exact: true }).fill(NEW_PASSWORD)
      await page
        .getByRole('textbox', { name: 'Confirm new password', exact: true })
        .fill(NEW_PASSWORD)
      await page.getByRole('button', { name: 'Save new password', exact: true }).click()

      await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible()
      await page.getByRole('button', { name: 'Continue to the app', exact: true }).click()
      await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 15_000 })

      await signOut(page)
      await logIn(page, OLD_PASSWORD)
      await expect(page.getByRole('alert')).toContainText(
        "That email or password isn't right. Please try again.",
      )
      await expect(page).toHaveURL((url) => url.pathname === '/auth/login')

      await page.getByRole('textbox', { name: 'Password', exact: true }).fill(NEW_PASSWORD)
      await page.getByRole('button', { name: 'Log in', exact: true }).click()
      await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 15_000 })
      await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible()
    } finally {
      await cleanupPendingInviteLeague(inviteLeagueId)
    }
  })

  test('signed-out auth routes remain usable at phone width', async ({ page }, testInfo) => {
    mobileOnly(testInfo)

    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
    await page.getByRole('button', { name: 'Create an account' }).click()
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
    await page.getByRole('button', { name: 'Log in' }).click()
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  })
})
