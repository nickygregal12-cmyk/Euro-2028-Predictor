import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

function gameCard(page: Page, name: string): Locator {
  return page
    .getByRole('heading', { name, exact: true })
    .locator('xpath=ancestor::section[1]')
}

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The no-rejoin LMS lifecycle is stateful and runs once; route smoke covers both viewports.',
  )
}

async function withdrawGame(page: Page, name: string) {
  await page.goto('/games')
  await expect(page).toHaveURL((url) => url.pathname === '/games')
  const card = gameCard(page, name)
  await expect(card).toBeVisible()
  const withdraw = card.getByRole('button', { name: 'Withdraw', exact: true })
  if (await withdraw.isVisible()) await withdraw.click()
}

async function enterGame(page: Page, name: string) {
  await page.goto('/games')
  await expect(page).toHaveURL((url) => url.pathname === '/games')
  const card = gameCard(page, name)
  await expect(card).toBeVisible()
  const enter = card.getByRole('button', { name: 'Enter', exact: true })
  if (await enter.isVisible()) await enter.click()
  await expect(card.getByRole('button', { name: 'Withdraw', exact: true })).toBeVisible({
    timeout: 15_000,
  })
}

test('bonus games catalogue exposes independent entry actions', async ({ page }) => {
  await page.goto('/games')

  await expect(page).toHaveURL((url) => url.pathname === '/games')
  await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible()
  await expect(gameCard(page, 'KO Predictor')).toBeVisible()
  await expect(gameCard(page, 'Last Man Standing')).toBeVisible()
  await expect(gameCard(page, 'Predictor Championship')).toBeVisible()
})

test('KO Predictor registration and withdrawal work end to end', async ({ page }) => {
  await withdrawGame(page, 'KO Predictor')
  await enterGame(page, 'KO Predictor')

  await page.getByRole('link', { name: 'Open KO Predictor' }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/games/ko')
  await expect(page.getByRole('heading', { name: 'KO Predictor' })).toBeVisible()
  await expect(page.getByText('Registration confirmed', { exact: true })).toBeVisible()
  await expect(page.getByText('Round of 16', { exact: true })).toBeVisible()

  await withdrawGame(page, 'KO Predictor')
  await expect(
    gameCard(page, 'KO Predictor').getByRole('button', { name: 'Enter', exact: true }),
  ).toBeVisible()
})

test('KO Predictor saves and clears a protected knockout pick', async ({ page }) => {
  await withdrawGame(page, 'KO Predictor')
  await enterGame(page, 'KO Predictor')

  await page.getByRole('link', { name: 'Open KO Predictor' }).click()
  const tie = page.getByRole('group', { name: 'R16-1' })
  await expect(tie).toBeVisible()
  await tie.getByLabel('Select Team A').check()
  await expect(tie.getByLabel('Select Team A')).toBeChecked()
  await expect(tie.getByText('Saved', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('group', { name: 'R16-1' }).getByLabel('Select Team A')).toBeChecked()

  await page.getByRole('group', { name: 'R16-1' }).getByLabel('Select Team A').check()
  await expect(page.getByRole('group', { name: 'R16-1' }).getByText('Cleared', { exact: true })).toBeVisible()

  await withdrawGame(page, 'KO Predictor')
})

test('Last Man Standing registration and first-round pick work end to end', async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo)
  await enterGame(page, 'Last Man Standing')

  await page.getByRole('link', { name: 'Open Last Man Standing' }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/games/lms')
  await expect(page.getByRole('heading', { name: 'Last Man Standing' })).toBeVisible()
  await expect(page.getByText('Registration confirmed', { exact: true })).toBeVisible()

  await page.getByLabel('Round 1 pick').selectOption({ label: 'Team A' })
  await page.getByRole('button', { name: 'Save pick' }).click()
  await expect(page.getByText('Round pick saved', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Round 1 pick')).toHaveValue('50000000-0000-0000-0000-000000000001')
})

test('Predictor Championship registration exposes penalty-number setup', async ({ page }) => {
  await withdrawGame(page, 'Predictor Championship')
  await enterGame(page, 'Predictor Championship')

  await page.getByRole('link', { name: 'Open Predictor Championship' }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/games/cup')
  await expect(page.getByRole('heading', { name: 'Predictor Championship' })).toBeVisible()
  await expect(page.getByText('Registration confirmed', { exact: true })).toBeVisible()

  await page.getByLabel('Penalty number').fill('17')
  await page.getByRole('button', { name: 'Save penalty number' }).click()
  await expect(page.getByText('Penalty number saved', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Penalty number')).toHaveValue('17')

  await withdrawGame(page, 'Predictor Championship')
})
