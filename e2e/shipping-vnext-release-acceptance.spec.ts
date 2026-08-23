import { expect, test, type Page, type TestInfo } from '@playwright/test'

const SCOTTISH_HOME = '/competitions/scottish-premiership/2026-27'

function shell(page: Page) {
  return page.locator('[data-vnext-shell]:visible')
}

function nav(page: Page) {
  return page.locator('nav[aria-label="Competition sections"]:visible')
}

async function expectVNext(page: Page) {
  await expect(shell(page)).toBeVisible()
  await expect(page.locator('[data-vnext-shell-zone="navbar"]')).toHaveCount(1)
  await expect(page.locator('body')).not.toContainText('Legacy')
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(`${name}-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
}

async function computedBackground(locator: ReturnType<Page['locator']>): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor)
}

async function expectHoverBackgroundChanges(locator: ReturnType<Page['locator']>) {
  const before = await computedBackground(locator)
  await locator.hover()
  await expect.poll(() => computedBackground(locator)).not.toBe(before)
}

test('Matches uses the real filter, league-table context and Match Centre journey', async ({ page }, testInfo) => {
  let tableRequests = 0
  page.on('response', (response) => {
    if (response.url().includes('/rest/v1/rpc/get_competition_table') && response.ok()) {
      tableRequests += 1
    }
  })

  await page.goto(SCOTTISH_HOME)
  await expectVNext(page)
  await nav(page).getByRole('button', { name: 'Matches', exact: true }).click()
  await expect(page).toHaveURL(`${SCOTTISH_HOME}/matches`)
  await expectVNext(page)

  // One secondary table read per mounted Matches screen — no per-row or hidden
  // duplicate request. The UI remains truthful whether the local fixture has
  // already settled a table or the season has not started counting yet.
  const table = page.locator('[data-vnext-league-table]:visible')
  await expect(table).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => tableRequests).toBe(1)

  if (testInfo.project.name.includes('mobile')) {
    const disclosure = table.getByText('League table', { exact: true })
    await expect(disclosure).toBeVisible()
    await disclosure.click()
    await expect(table.locator('table, p').filter({ visible: true }).first()).toBeVisible()
  } else {
    await expect(table.getByRole('heading', { name: 'League table', exact: true })).toBeVisible()
  }

  const upcoming = page.getByRole('button', { name: /^Upcoming\b/ })
  if (await upcoming.isEnabled()) {
    await upcoming.click()
    await expect(upcoming).toHaveAttribute('aria-pressed', 'true')
  }

  const firstMatch = page.locator('[data-vnext-match-row]:visible').first()
  await expect(firstMatch).toBeVisible()
  const matchId = await firstMatch.getAttribute('data-vnext-match-row')
  if (!matchId) throw new Error('Shipping Matches exposed a fixture row without an id.')
  await firstMatch.click()
  await expect(page).toHaveURL(`${SCOTTISH_HOME}/matches/${matchId}`)
  await expectVNext(page)
  await expect(page.getByText('Back to Matches', { exact: true })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(`${SCOTTISH_HOME}/matches`)
  await expectVNext(page)
  await screenshot(page, testInfo, 'matches-table-filter-return')
})

test('desktop pointer feedback changes computed styles on representative shipping controls', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'shipping-vnext-desktop',
    'Hover is a fine-pointer acceptance check and only a desktop project has a fine pointer.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(SCOTTISH_HOME)
  await expectVNext(page)

  await expectHoverBackgroundChanges(nav(page).getByRole('button', { name: 'Matches', exact: true }))
  await expectHoverBackgroundChanges(page.locator('button[data-vnext-switcher="control"]:visible'))

  await nav(page).getByRole('button', { name: 'Matches', exact: true }).click()
  await expect(page).toHaveURL(`${SCOTTISH_HOME}/matches`)
  await expectHoverBackgroundChanges(page.locator('[data-vnext-match-row]:visible').first())
})

test('changed Matches composition has real-app screenshot evidence across required widths', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'shipping-vnext-desktop',
    'One project captures the explicit cross-width visual matrix, which sets its own widths.',
  )

  for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 900 : 1050 })
    await page.goto(`${SCOTTISH_HOME}/matches`)
    await expectVNext(page)
    await expect(page.locator('[data-vnext-match-row]:visible').first()).toBeVisible({ timeout: 15_000 })

    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(overflow.scroll, `Matches overflowed horizontally at ${width}px`).toBeLessThanOrEqual(
      overflow.client + 1,
    )

    await screenshot(page, testInfo, `matches-${width}`)
  }
})
