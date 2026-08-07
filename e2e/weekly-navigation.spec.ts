import { expect, test } from '@playwright/test'

const PREMIER = '/competitions/premier-league/2026-27'

test('the weekly Hub exposes the canonical five-destination global shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Choose your competition' })).toBeVisible()

  const primary = page.getByRole('navigation', { name: 'Primary' })
  const expected = [
    ['Home', '/'],
    ['Play', '/play'],
    ['Matches', '/matches'],
    ['Leagues', '/leagues'],
    ['More', '/more'],
  ] as const

  for (const [label, href] of expected) {
    await expect(primary.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'href',
      href,
    )
  }
})

test('competition mode replaces the global tabs and keeps deterministic exits', async ({ page }) => {
  await page.goto(`${PREMIER}/games`)
  await expect(page).toHaveURL((url) => url.pathname === `${PREMIER}/games`, {
    timeout: 15_000,
  })

  await expect(page.getByRole('heading', { name: 'Premier League' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0)

  const sections = page.getByRole('navigation', { name: 'Premier League sections' })
  await expect(sections).toBeVisible()
  await expect(sections.getByText('Games', { exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('link', { name: 'Back to Hub' })).toHaveAttribute('href', '/')
  await expect(sections.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', PREMIER)
  await expect(sections.getByRole('link', { name: 'Play' })).toHaveAttribute(
    'href',
    `${PREMIER}/play`,
  )
  await expect(sections.getByRole('link', { name: 'Matches' })).toHaveAttribute(
    'href',
    `${PREMIER}/matches`,
  )
  await expect(sections.getByRole('link', { name: 'Leagues' })).toHaveAttribute(
    'href',
    `${PREMIER}/leagues`,
  )
})
