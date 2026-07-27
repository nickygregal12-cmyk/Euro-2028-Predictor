import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { clearLocalMailbox, waitForAuthLink } from './local-mail'
import {
  createLocalAdmin,
  DEFAULT_E2E_EMAIL,
  localOperatingCounts,
  setLocalOperatingLimits,
} from './local-supabase'

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

  const { data: tournament, error: tournamentError } = await admin
    .from('tournaments')
    .select('id')
    .limit(1)
    .single()
  if (tournamentError) throw tournamentError

  const { error: priorError } = await admin.from('leagues').delete().eq('invite_code', INVITE_CODE)
  if (priorError) throw priorError

  const { data: league, error: leagueError } = await admin
    .from('leagues')
    .insert({
      tournament_id: tournament.id,
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
  const { data, error } = await admin.from('tournaments').select('id').limit(1).single()
  if (error) throw error

  const futureLock = new Date()
  futureLock.setUTCFullYear(futureLock.getUTCFullYear() + 10)
  const { error: updateError } = await admin
    .from('tournaments')
    .update({ lock_at: futureLock.toISOString() })
    .eq('id', data.id)
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
  await page.goto('/more')
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible()
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
      await expect(page.getByRole('heading', { name: `Welcome, ${DISPLAY_NAME}` })).toBeVisible()

      await page
        .getByRole('button', { name: 'Continue to league invite →', exact: true })
        .click()
      await expect(page).toHaveURL((url) => url.pathname === `/join/${INVITE_CODE}`)
      await expect(page.getByRole('heading', { name: INVITE_LEAGUE_NAME })).toBeVisible()
      await expect(page.getByText('Owner: E2E Tester', { exact: true })).toBeVisible()
      await waitForWelcomeStamp()

      await page.getByRole('button', { name: 'Join league', exact: true }).click()
      await expect(page).toHaveURL((url) => url.pathname === `/league/${inviteLeagueId}`, {
        timeout: 20_000,
      })
      await expect(page.getByRole('heading', { name: INVITE_LEAGUE_NAME })).toBeVisible()
      await expect(page.getByText('2 members', { exact: true })).toBeVisible()

      await signOut(page)
      await logIn(page, OLD_PASSWORD)
      await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 15_000 })
      await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()

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
      await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
    } finally {
      await cleanupPendingInviteLeague(inviteLeagueId)
    }
  })

  test('signup shows the contact-admin full state at the configured user cap', async ({
    page,
  }, testInfo) => {
    desktopOnly(testInfo)
    const counts = await localOperatingCounts()
    await setLocalOperatingLimits(counts.users, 20)

    try {
      await page.goto('/auth/signup')
      await expect(
        page.getByText('Registration is currently full', { exact: true }),
      ).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/Contact admin if you need access/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Create account' })).toHaveCount(0)
    } finally {
      await setLocalOperatingLimits(50, 20)
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
