import { expect, test, type TestInfo } from '@playwright/test'
import { localOperatingCounts, setLocalOperatingLimits } from './local-supabase'

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'auth-desktop-chromium',
    'The stateful registration-cap journey runs once against the shared disposable stack.',
  )
}

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
