import { expect, test } from '@playwright/test'
import { expectNoSeriousAxeViolations } from './axe-scan'
import { globalNav } from './global-navigation'

/**
 * The Innovation Lab UI pass, in a browser, against the seeded Scottish season.
 *
 * WHAT THIS SUITE IS FOR, AND WHAT IT DELIBERATELY IS NOT. Every model behind
 * these surfaces has its own unit coverage, and those tests own the arithmetic.
 * What no component test can prove is the property this pass is most at risk
 * of breaking: that a projection, a hypothetical or a decoration never appears
 * where a real number goes, and that a surface with nothing to say renders
 * NOTHING rather than an empty frame. So the assertions below are mostly about
 * absence, which is the harder half to get right and the half a screenshot
 * cannot check.
 *
 * SCOTTISH ONLY, for the reason `season-competition-journey.spec.ts` records:
 * the Premier League season is left empty on purpose so the suite proves the
 * unpopulated path elsewhere rather than proving the populated one twice.
 *
 * THE SEED CARRIES NO PROVIDER LIVE SCORE, and that is why the What-If
 * assertion is a negative one. A projection that appeared over a fixture with
 * no live score would be the single worst defect this feature could ship — a
 * number that looks like points, derived from nothing — so its absence is
 * asserted rather than assumed, and the positive case stays with the model
 * tests where a live score can be supplied.
 */

const SEASON = '/competitions/scottish-premiership/2026-27'
const TV = `${SEASON}/tv`

test('the matchday television screen is a room screen, not the app in a frame', async ({
  page,
}) => {
  await page.goto(TV)

  // It is the competition's own screen, named.
  await expect(page.getByRole('heading', { name: /Scottish Premiership/ })).toBeVisible({
    timeout: 20_000,
  })

  // THE POINT OF THE ROUTE. The signed-in shell is absent at BOTH widths: no
  // bottom bar on the phone project, no rail on the desktop one. A television
  // showing a five-tab navigation sized for a thumb is the thing this screen
  // exists not to be.
  await expect(globalNav(page)).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Sections', exact: true })).toHaveCount(0)

  // The way out, which is the only navigation it has.
  await expect(page.getByRole('link', { name: 'Exit' })).toBeVisible()
})

test('the television screen offers no control that could change anybody’s entry', async ({
  page,
}) => {
  await page.goto(TV)
  await expect(page.getByRole('heading', { name: /Scottish Premiership/ })).toBeVisible({
    timeout: 20_000,
  })

  // A shared screen in a room is very often not operated by the account it is
  // signed in as. The read-only property is enforced by what the route
  // imports; this is the browser-level statement of the same rule.
  for (const forbidden of [
    /confirm/i,
    /submit/i,
    /save/i,
    /joker/i,
    /leave/i,
    /join/i,
    /sign out/i,
  ]) {
    await expect(page.getByRole('button', { name: forbidden })).toHaveCount(0)
  }
  await expect(page.locator('input')).toHaveCount(0)
})

test('the television screen is accessible at this width', async ({ page }) => {
  await page.goto(TV)
  await expect(page.getByRole('heading', { name: /Scottish Premiership/ })).toBeVisible({
    timeout: 20_000,
  })
  await expectNoSeriousAxeViolations(page, TV)
})

test('a fixture with no provider score shows no projection at all', async ({ page }) => {
  await page.goto(`${SEASON}/matches`)
  await expect(page.getByRole('heading', { name: 'Matches', exact: true })).toBeVisible({
    timeout: 20_000,
  })

  const fixtureRow = page.getByRole('button', { name: /kick-off/ }).first()
  await expect(fixtureRow).toBeVisible({ timeout: 20_000 })
  await fixtureRow.click()

  // Nothing at all: not a heading, not an empty card, not a "no projection
  // available" apology. A panel on every unplayed fixture in the calendar
  // would be noise on the surface a player uses most.
  await expect(page.getByRole('heading', { name: 'Projection' })).toHaveCount(0)
  await expect(page.getByText(/projected pts?/)).toHaveCount(0)
})

test('the Hub briefing states only what it was given, and never a football claim', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible({
    timeout: 20_000,
  })

  // The briefing is silent on a quiet day by design, so its PRESENCE is not
  // asserted. What is asserted is that where it does appear it never carries
  // an invented football fact: `worthKnowing` has no fallback sentence, and
  // Home supplies none, so the tag must not be on the page.
  await expect(page.getByText('Worth knowing')).toHaveCount(0)
})
