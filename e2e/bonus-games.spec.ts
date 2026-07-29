import { expect, test, type Locator, type Page } from '@playwright/test'

type GameName = 'KO Predictor' | 'Last Man Standing' | 'Predictor Cup'

async function openGamesHub(page: Page): Promise<void> {
  await page.goto('/games')
  await expect(page).toHaveURL((url) => url.pathname === '/games', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Bonus Games', exact: true })).toBeVisible()
  await expect(page.getByText('More ways to play Euro 2028', { exact: true })).toBeVisible()
}

function gameCard(page: Page, name: GameName): Locator {
  return page
    .getByRole('heading', { name, exact: true })
    .locator('xpath=ancestor::section[1]')
}

async function enterGame(page: Page, name: GameName): Promise<Locator> {
  await openGamesHub(page)
  const card = gameCard(page, name)
  await expect(card).toBeVisible()

  const enter = card.getByRole('button', { name: 'Enter', exact: true })
  if (await enter.isVisible()) {
    await enter.click()
  }

  await expect(card.getByRole('button', { name: 'Withdraw', exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await expect(card.getByText('Entered', { exact: true })).toBeVisible()
  return card
}

async function withdrawGame(page: Page, name: GameName): Promise<void> {
  await openGamesHub(page)
  const card = gameCard(page, name)
  const withdraw = card.getByRole('button', { name: 'Withdraw', exact: true })

  if (!(await withdraw.isVisible())) return

  await withdraw.click()
  const dialog = page.getByRole('dialog', { name: 'Withdraw from this game?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Withdraw', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Enter', exact: true })).toBeVisible({
    timeout: 15_000,
  })
}

function firstKnockoutCard(page: Page): Locator {
  return page
    .getByRole('heading', { name: 'Round of 16 · R16-1', exact: true })
    .locator('xpath=ancestor::section[1]')
}

async function openKnockoutPredictions(page: Page): Promise<Locator> {
  await page.goto('/games/knockout')
  await expect(page).toHaveURL((url) => url.pathname === '/games/knockout', {
    timeout: 15_000,
  })
  await expect(
    page.getByRole('heading', { name: 'Knockout predictions', exact: true }),
  ).toBeVisible()
  const card = firstKnockoutCard(page)
  await expect(card).toBeVisible()
  return card
}

async function clearFirstKnockoutPrediction(page: Page): Promise<void> {
  const card = await openKnockoutPredictions(page)
  const clear = card.getByRole('button', { name: 'Clear', exact: true })
  if (!(await clear.isVisible())) return

  await clear.click()
  await expect(card.getByText('Saved', { exact: true })).toHaveCount(0, {
    timeout: 15_000,
  })
}

async function saveFirstKnockoutPrediction(
  page: Page,
  homeScore: string,
  awayScore: string,
): Promise<void> {
  const card = await openKnockoutPredictions(page)
  const clear = card.getByRole('button', { name: 'Clear', exact: true })
  if (await clear.isVisible()) {
    await clear.click()
    await expect(card.getByText('Saved', { exact: true })).toHaveCount(0, {
      timeout: 15_000,
    })
  }

  const scoreInputs = card.getByRole('textbox')
  await expect(scoreInputs).toHaveCount(2)
  await scoreInputs.nth(0).fill(homeScore)
  await scoreInputs.nth(1).fill(awayScore)
  await card.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(card.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 })
}

test('KO Predictor registration, scoreline save and standings work end to end', async ({
  page,
}) => {
  await withdrawGame(page, 'KO Predictor')

  try {
    const card = await enterGame(page, 'KO Predictor')
    await expect(card.getByRole('button', { name: 'Predictions', exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Standings', exact: true })).toBeVisible()

    await saveFirstKnockoutPrediction(page, '2', '1')

    await page.goto('/games/ko-predictor')
    await expect(page).toHaveURL((url) => url.pathname === '/games/ko-predictor')
    await expect(page.getByRole('heading', { name: 'KO Predictor', exact: true })).toBeVisible()
    await expect(page.getByText('E2E Tester (you)', { exact: true })).toBeVisible()
    await expect(page.getByText(/Rank 1 · 0 points/)).toBeVisible()
  } finally {
    await clearFirstKnockoutPrediction(page)
    await withdrawGame(page, 'KO Predictor')
  }
})

test('Last Man Standing registration and first-round pick work end to end', async ({
  page,
}) => {
  await withdrawGame(page, 'Last Man Standing')

  try {
    const card = await enterGame(page, 'Last Man Standing')
    await card.getByRole('button', { name: 'Play', exact: true }).click()

    await expect(page).toHaveURL((url) => url.pathname === '/games/lms')
    await expect(
      page.getByRole('heading', { name: 'Last Man Standing', exact: true }),
    ).toBeVisible()
    await expect(page.getByText('1 of 1 still standing', { exact: true })).toBeVisible()

    const picker = page.getByRole('group', { name: 'Pick for Round 1 — Matchday 1' })
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: 'Team A1', exact: true }).click()

    await expect(page.getByText('Picked', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Your pick:\s*Team A1/)).toBeVisible()
  } finally {
    await withdrawGame(page, 'Last Man Standing')
  }
})

test('Predictor Cup registration shares knockout predictions and reaches the draw state', async ({
  page,
}) => {
  await withdrawGame(page, 'Predictor Cup')

  try {
    const card = await enterGame(page, 'Predictor Cup')
    await expect(card.getByRole('button', { name: 'My Cup', exact: true })).toBeVisible()

    await saveFirstKnockoutPrediction(page, '1', '0')

    await page.goto('/games/cup')
    await expect(page).toHaveURL((url) => url.pathname === '/games/cup')
    await expect(page.getByRole('heading', { name: 'Predictor Cup', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Waiting for the draw' })).toBeVisible()
    await expect(page.getByText(/1 entrants so far/)).toBeVisible()
  } finally {
    await clearFirstKnockoutPrediction(page)
    await withdrawGame(page, 'Predictor Cup')
  }
})
