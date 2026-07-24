import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { clearLocalMailbox, waitForAuthLink } from './local-mail'
import { createLocalAdmin } from './local-supabase'

const EMAIL = 'auth-recovery-e2e@euro28.local'
const DISPLAY_NAME = 'Auth Recovery Tester'
const OLD_PASSWORD = 'Auth-local-only-2028!'
const NEW_PASSWORD = 'Auth-local-new-2028!'

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

async function removeExistingUser(): Promise<void> {
  const admin = createLocalAdmin()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  const existing = data.users.find((user) => user.email === EMAIL)
  if (!existing) return
  const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id)
  if (deleteError) throw deleteError
}

async function logIn(page: Page, password: string): Promise<void> {
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
}

async function signOut(page: Page): Promise<void> {
  await page.goto('/more')
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/auth/login', { timeout: 15_000 })
}

test.describe('authentication and recovery', () => {
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('signup confirmation, welcome, login and password recovery work end to end', async ({
    page,
  }, testInfo) => {
    desktopOnly(testInfo)
    test.setTimeout(120_000)

    await removeExistingUser()
    await clearLocalMailbox(EMAIL)

    await page.goto('/auth/signup')
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
    await page.getByLabel('Display name').fill(DISPLAY_NAME)
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(OLD_PASSWORD)
    await page.getByRole('button', { name: 'Create account', exact: true }).click()

    await expect(
      page.getByRole('alert').filter({ hasText: 'Almost there — check your email' }),
    ).toContainText(EMAIL)

    const confirmationLink = await waitForAuthLink(EMAIL, 'signup')
    await page.goto(confirmationLink)
    await expect(page).toHaveURL((url) => url.pathname === '/welcome', { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: `Welcome, ${DISPLAY_NAME}` })).toBeVisible()

    await page.getByRole('button', { name: /Start with Group A/ }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/predict/groups/A')

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
    await expect(page.getByRole('alert').filter({ hasText: 'Reset link sent' })).toBeVisible()

    const recoveryLink = await waitForAuthLink(EMAIL, 'recovery')
    await page.goto(recoveryLink)
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible({
      timeout: 20_000,
    })
    await page.getByLabel('New password').fill(NEW_PASSWORD)
    await page.getByLabel('Confirm new password').fill(NEW_PASSWORD)
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

    await page.getByLabel('Password').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
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
