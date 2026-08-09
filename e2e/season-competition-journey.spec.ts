import { expect, test } from '@playwright/test'
import { expectNoSeriousAxeViolations } from './axe-scan'

/**
 * A competition season, in a browser, with real rows behind it.
 *
 * WHAT THIS CLOSES. Overview's fixtures card, the Matches section, the Match
 * Centre and contract 141's club form were all built with component coverage
 * and had never been opened against a database — the browser environment held
 * both league-season rows with no clubs, matchweeks or fixtures, so contract
 * 121 raised "This competition has no league matchweeks" and every one of those
 * surfaces rendered its unavailable state. `e2e/league-season-fixture.sql` fills
 * the Scottish season, and this walks it.
 *
 * SCOTTISH ONLY, DELIBERATELY. The Premier League season is left empty and
 * `weekly-navigation.spec.ts` keeps asserting the competition shell against it,
 * so the suite proves the empty-season path and the populated one rather than
 * proving the populated one twice.
 *
 * THE PLAYER HAS JOINED NOTHING, and that is an assertion rather than a gap.
 * The fixture writes football and no entry, so the Match Centre answers "you are
 * not playing the Match Predictor in this competition" — the honest state for a
 * browser user who has joined nothing, and the branch that would otherwise only
 * ever be exercised against a mocked refusal code.
 */

const SEASON = '/competitions/scottish-premiership/2026-27'

test('a competition season shows its fixtures on Overview and in Matches', async ({ page }) => {
  await page.goto(SEASON)
  await expect(page).toHaveURL((url) => url.pathname === SEASON, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Scottish Premiership' })).toBeVisible()

  // Overview's fixtures card. "Next up" rather than "Latest results", because
  // the seeded season has matchweeks 2 and 3 still to play — the heading
  // follows the data rather than a clock.
  const overviewFixtures = page.getByRole('region', { name: /Next up|Latest results/ })
  await expect(overviewFixtures).toBeVisible({ timeout: 20_000 })
  await expect(overviewFixtures.getByRole('button', { name: 'All fixtures and results' })).toBeVisible()

  await overviewFixtures.getByRole('button', { name: 'All fixtures and results' }).click()
  await expect(page).toHaveURL((url) => url.pathname === `${SEASON}/matches`, {
    timeout: 15_000,
  })

  // The Matches section, with the real season behind it: a settled Matchweek 1
  // result and clubs the contract 136 identity reference resolves.
  await expect(page.getByRole('heading', { name: 'Matches', exact: true })).toBeVisible()
  await expect(page.getByText('Celtic').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('3 - 1').first()).toBeVisible()
})

test('opening a fixture reaches the Match Centre and tells a non-entrant where they stand', async ({
  page,
}) => {
  await page.goto(`${SEASON}/matches`)
  await expect(page.getByRole('heading', { name: 'Matches', exact: true })).toBeVisible({
    timeout: 20_000,
  })

  // Addressed by the row's own accessible summary rather than by a class or a
  // bare `aria-expanded`, both of which would also match shell disclosures.
  // A scheduled fixture's summary is "<home> against <away>, kick-off HH:MM",
  // which is unique to this list.
  const fixtureRow = page.getByRole('button', { name: /kick-off/ }).first()
  await expect(fixtureRow).toBeVisible({ timeout: 20_000 })
  await fixtureRow.click()

  // The player's own side of the fixture: they have joined nothing, so the
  // panel says so rather than showing an error or an empty prediction.
  await expect(page.getByText(/not playing the Match Predictor/)).toBeVisible({
    timeout: 20_000,
  })

  // And contract 141's football, which does not depend on an entry at all.
  await expect(page.getByRole('heading', { name: 'Recent form' })).toBeVisible({
    timeout: 20_000,
  })
})

test('the season surfaces are accessible with real rows on them', async ({ page }) => {
  // Every earlier scan of a `/competitions/**` route ran against an unavailable
  // state, which is a page with almost nothing on it. This is the first scan of
  // these surfaces with fixtures, club identities and a settled result present
  // — which is where a contrast or naming defect would actually live.
  await page.goto(`${SEASON}/matches`)
  await expect(page.getByRole('heading', { name: 'Matches', exact: true })).toBeVisible({
    timeout: 20_000,
  })
  await expectNoSeriousAxeViolations(page, `${SEASON}/matches`)
})
