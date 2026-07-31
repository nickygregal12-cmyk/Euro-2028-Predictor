import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { expectNoSeriousAxeViolations } from './axe-scan'
import {
  clearPreparedKnockoutFixture,
  clearPreparedThirdPlaceBoundaryTie,
  deleteOrdinaryUser,
  ensureMatchResultCleared,
  prepareActualThirdPlaceBoundaryTie,
  prepareOrdinaryUser,
  prepareResolvedKnockoutFixture,
} from './admin-results-local'

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The stateful result lifecycle runs once; mobile has an independent form journey.',
  )
}

function mobileOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    'This journey verifies the phone layout once.',
  )
}

async function openAdminResults(page: Page) {
  await page.goto('/admin/results')
  await expect(page).toHaveURL((url) => url.pathname === '/admin/results', {
    timeout: 15_000,
  })
  await expect(
    page.getByRole('heading', { name: 'Results Centre' }),
  ).toBeVisible()

  // The administrator surfaces were deferred for needing the `results`
  // capability. This spec creates a user who holds it and is already here.
  await expectNoSeriousAxeViolations(page, '/admin/results')
}

async function chooseGroupFixture(page: Page) {
  await page.getByRole('button', { name: /^GA-1\b/ }).click()
  const editor = page.getByRole('region', { name: /Team A1 v Team A2/ })
  await expect(editor).toBeVisible()
  return editor
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/account')
  await expect(page).toHaveURL((url) => url.pathname === '/account', {
    timeout: 15_000,
  })
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Sign out?' })
  await dialog.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/auth/login', {
    timeout: 15_000,
  })
  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/', {
    timeout: 15_000,
  })
}

test.describe('Admin result workflow', () => {
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('authorised admin reviews, confirms, corrects and clears a result', async ({
    page,
  }, testInfo) => {
    desktopOnly(testInfo)
    try {
      await openAdminResults(page)
      const editor = await chooseGroupFixture(page)

      let mutationRequests = 0
      page.on('request', (request) => {
        if (
          request.method() === 'POST' &&
          /\/rest\/v1\/rpc\/admin_(confirm|correct|clear)_match_result/.test(
            request.url(),
          )
        ) {
          mutationRequests += 1
        }
      })

      const regulation = editor.getByRole('group', { name: '90-minute score' })
      await regulation.getByLabel('Team A1').fill('2')
      await regulation.getByLabel('Team A2').fill('1')
      await editor
        .getByRole('button', { name: 'Review confirm result' })
        .click()

      const confirmDialog = page.getByRole('dialog', {
        name: 'Review: Confirm result',
      })
      await expect(confirmDialog).toContainText('2–1')
      expect(mutationRequests).toBe(0)
      await confirmDialog
        .getByRole('button', { name: 'Confirm result', exact: true })
        .click()

      await expect(
        page.getByRole('status').filter({ hasText: 'Confirm result saved' }),
      ).toBeVisible({ timeout: 15_000 })
      await expect(editor).toContainText('Confirmed · revision 1')
      await expect(page.getByText('Revision 1 · confirm')).toBeVisible()
      expect(mutationRequests).toBe(1)

      await editor
        .getByRole('button', { name: 'Correct', exact: true })
        .click()
      await regulation.getByLabel('Team A2').fill('2')
      await editor
        .getByLabel('Reason')
        .fill('Official score was entered incorrectly')
      await editor
        .getByRole('button', { name: 'Review correct result' })
        .click()
      const correctionDialog = page.getByRole('dialog', {
        name: 'Review: Correct result',
      })
      await expect(correctionDialog).toContainText(
        'Official score was entered incorrectly',
      )
      await correctionDialog
        .getByRole('button', { name: 'Correct result', exact: true })
        .click()

      await expect(
        page.getByRole('status').filter({ hasText: 'Correct result saved' }),
      ).toBeVisible({ timeout: 15_000 })
      await expect(editor).toContainText('Corrected · revision 2')
      await expect(page.getByText('Revision 2 · correct')).toBeVisible()
      await expect(
        page.getByText('Official score was entered incorrectly'),
      ).toBeVisible()
      expect(mutationRequests).toBe(2)

      await editor
        .getByRole('button', { name: 'Clear', exact: true })
        .click()
      await editor
        .getByLabel('Reason')
        .fill('Result belonged to another fixture')
      await editor
        .getByRole('button', { name: 'Review clear result' })
        .click()
      const clearDialog = page.getByRole('dialog', {
        name: 'Review: Clear result',
      })
      await expect(clearDialog).toContainText(
        'remove the current authoritative result',
      )
      await clearDialog
        .getByRole('button', { name: 'Clear result', exact: true })
        .click()

      await expect(
        page.getByRole('status').filter({ hasText: 'Clear result saved' }),
      ).toBeVisible({ timeout: 15_000 })
      await expect(editor).toContainText('Awaiting result')
      await expect(page.getByText('Revision 3 · clear')).toBeVisible()
      expect(mutationRequests).toBe(3)
    } finally {
      await ensureMatchResultCleared()
    }
  })

  test('authorised admin can use the result form on a phone viewport', async ({
    page,
  }, testInfo) => {
    mobileOnly(testInfo)
    const fixture = await prepareResolvedKnockoutFixture()
    try {
      await openAdminResults(page)
      await page.getByRole('button', { name: new RegExp(`^${fixture.matchRef}\\b`) }).click()
      const editor = page.getByRole('region', {
        name: new RegExp(`${fixture.homeName} v ${fixture.awayName}`),
      })
      await expect(editor).toBeVisible()

      await editor.getByLabel('Result method').selectOption('extra_time')
      const regulation = editor.getByRole('group', { name: '90-minute score' })
      const extraTime = editor.getByRole('group', { name: '120-minute score' })
      await regulation.getByLabel(fixture.homeName).fill('1')
      await regulation.getByLabel(fixture.awayName).fill('1')
      await extraTime.getByLabel(fixture.homeName).fill('2')
      await extraTime.getByLabel(fixture.awayName).fill('1')
      await editor
        .getByRole('button', { name: 'Review confirm result' })
        .click()
      const extraTimeDialog = page.getByRole('dialog', {
        name: 'Review: Confirm result',
      })
      await expect(extraTimeDialog).toContainText('Extra time')
      await extraTimeDialog.getByRole('button', { name: 'Cancel' }).click()

      await editor.getByLabel('Result method').selectOption('penalties')
      const shootoutExtraTime = editor.getByRole('group', {
        name: '120-minute score',
      })
      const penalties = editor.getByRole('group', { name: 'Penalty shootout' })
      await shootoutExtraTime.getByLabel(fixture.homeName).fill('2')
      await shootoutExtraTime.getByLabel(fixture.awayName).fill('2')
      await penalties.getByLabel(fixture.homeName).fill('5')
      await penalties.getByLabel(fixture.awayName).fill('4')
      await editor
        .getByRole('button', { name: 'Review confirm result' })
        .click()
      const penaltiesDialog = page.getByRole('dialog', {
        name: 'Review: Confirm result',
      })
      await expect(penaltiesDialog).toContainText('Penalties')
      await expect(penaltiesDialog).toContainText('5–4')
      await penaltiesDialog
        .getByRole('button', { name: 'Confirm result', exact: true })
        .click()

      await expect(
        page.getByRole('status').filter({ hasText: 'Confirm result saved' }),
      ).toBeVisible({ timeout: 15_000 })

      await page.goto(`/match/${fixture.matchRef}`)
      await expect(page).toHaveURL(
        (url) => url.pathname === `/match/${fixture.matchRef}`,
        { timeout: 15_000 },
      )
      await expect(page.getByText('2–2', { exact: true })).toBeVisible()
      await expect(
        page.getByText(`${fixture.homeName} won 5–4 on penalties`, {
          exact: true,
        }),
      ).toBeVisible()
    } finally {
      await clearPreparedKnockoutFixture(fixture)
    }
  })

  test('authorised admin resolves and clears an actual third-place boundary tie', async ({
    page,
  }, testInfo) => {
    desktopOnly(testInfo)
    const fixture = await prepareActualThirdPlaceBoundaryTie()
    try {
      await openAdminResults(page)
      const panel = page.locator('section').filter({
        has: page.getByRole('heading', { name: 'Best third-place boundary' }),
      })
      await expect(panel).toBeVisible()
      await expect(panel).toContainText('An official order is required')
      await expect(panel).toContainText('Team B3')
      await expect(panel).toContainText('Team C3')

      await panel.getByRole('button', { name: 'Move Team C3 up' }).click()
      await panel
        .getByLabel('Resolution reason')
        .fill('Official fair-play order placed Team C3 first')
      await panel.getByRole('button', { name: 'Review resolution' }).click()

      const resolveDialog = page.getByRole('dialog', {
        name: 'Review: Resolve third-place order',
      })
      await expect(resolveDialog).toContainText('Team C3')
      await expect(resolveDialog).toContainText('qualifies')
      await resolveDialog
        .getByRole('button', { name: 'Save official order', exact: true })
        .click()

      await expect(panel).toContainText('The current official order is active', {
        timeout: 15_000,
      })
      await expect(panel).toContainText('Revision 1 · resolve')

      await panel
        .getByLabel('Correction or clear reason')
        .fill('Clear the browser-test official order')
      await panel.getByRole('button', { name: 'Review clear' }).click()

      const clearDialog = page.getByRole('dialog', {
        name: 'Review: Clear third-place order',
      })
      await clearDialog
        .getByRole('button', { name: 'Clear resolution', exact: true })
        .click()

      await expect(panel).toContainText('An official order is required', {
        timeout: 15_000,
      })
      await expect(panel).toContainText('Revision 2 · clear')
    } finally {
      await clearPreparedThirdPlaceBoundaryTie(fixture)
    }
  })

  test('the user administration surface is accessible', async ({ page }, testInfo) => {
    desktopOnly(testInfo)

    // `/admin/users` was deferred for "requires the protected administrator
    // capability". This spec's auto-logged-in user holds it — `openAdminResults`
    // is a plain `goto` — so the capability was never the blocker.
    //
    // Placed before the denial journey below, which signs in as an ordinary
    // user and would leave no admin session to scan with. It mutates nothing,
    // so its position is otherwise free.
    await page.goto('/admin/users')
    await expect(page).toHaveURL((url) => url.pathname === '/admin/users', {
      timeout: 15_000,
    })
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
    await expect(page.getByText('User controls are not enabled yet')).toBeVisible()

    await expectNoSeriousAxeViolations(page, '/admin/users')
  })

  test('ordinary authenticated users are denied the admin route', async ({
    page,
  }, testInfo) => {
    const ordinary = await prepareOrdinaryUser(testInfo.project.name)
    try {
      await loginAs(page, ordinary.email, ordinary.password)
      await page.goto('/admin/results')
      await expect(page).toHaveURL((url) => url.pathname === '/', {
        timeout: 15_000,
      })
      await expect(
        page.getByRole('heading', { name: 'Results Centre' }),
      ).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
    } finally {
      await deleteOrdinaryUser(ordinary.id)
    }
  })
})
