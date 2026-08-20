import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'

/**
 * THE CANONICAL vNEXT SCREENSHOT SUITE.
 *
 * ============================ WHAT IT IS FOR ============================
 *
 * A passing build should leave behind something a person can look at. Every
 * other check in this suite answers a question — is anything clipped, does one
 * navigation exist, does focus stay visible — and none of them produces
 * evidence a reviewer can open. The programme's own acceptance asks for the
 * finished surfaces to be REVIEWED rather than only asserted, and that needs
 * pictures.
 *
 * ============================ IT IS NOT A PIXEL BASELINE ================
 *
 * Deliberately, and it is the reason this file compares nothing. The vNext lane
 * is under active design; a pixel baseline here would be a baseline rewritten
 * every time the thing it guards is deliberately improved, which teaches
 * everybody to regenerate it without looking. The artifact is the point. What
 * IS asserted per shot is the pair of properties a screenshot cannot show you
 * are missing: that the surface actually rendered, and that nothing overflows
 * sideways at that width.
 *
 * ============================ THE WIDTHS ARE THE COMPOSITION'S ==========
 *
 * 375 is the phone the product is designed against; 768 is the tablet band
 * where the bottom bar is still real; 1280 is the first width where the rail
 * replaces it. Those three are where the composition CHANGES, which is what
 * makes them worth photographing — 1440 and 1920 differ from 1280 in measure
 * rather than in shape, and the workshop boards already cover them.
 *
 * Light is captured for the surfaces carrying the most colour rather than for
 * all of them: `DEC-016` ships both ramps, and a second image of every page is
 * screenshot spam rather than evidence.
 */

/**
 * The ordinary world of every surface a player passes through.
 *
 * These are STORY IDS, which Storybook derives by kebab-casing the export name
 * — `MatchPredictor` becomes `match-predictor`. Written out rather than
 * computed, because a wrong id fails as "the surface never rendered" and that
 * is a confusing way to be told a name is misspelled.
 */
const SURFACES = [
  'home',
  'home-returning',
  'match-predictor',
  'matches',
  'match-centre',
  'games',
  'leagues-season',
  'leagues-private',
  'player-profile',
  'last-man-standing',
  'championship',
  'discovery',
  'account',
  'invite',
  'onboarding',
  'create-private-play',
  'read-failed',
] as const

/** Where the composition changes, rather than merely gets wider. */
const WIDTHS = [
  { width: 375, height: 812, label: '375' },
  { width: 768, height: 1024, label: '768' },
  { width: 1280, height: 900, label: '1280' },
] as const

/**
 * THE SURFACES WORTH SEEING IN BOTH RAMPS.
 *
 * The ones where colour is doing the most work: a live matchday, a scoring
 * card, a ranked table and a bracket. A light image of the account settings
 * would be a second picture of the same grey.
 */
const BOTH_THEMES = new Set(['home', 'match-predictor', 'leagues-private', 'championship'])

const OUT = 'playwright-report-vnext/visual-contract'

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true })
})

for (const surface of SURFACES) {
  for (const frame of WIDTHS) {
    const themes = BOTH_THEMES.has(surface) ? (['dark', 'light'] as const) : (['dark'] as const)

    for (const theme of themes) {
      test(`${surface} at ${frame.label} in ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: frame.width, height: frame.height })
        await page.goto(
          `/iframe.html?id=vnext-visual-contract--${surface}&viewMode=story&args=theme:${theme}`,
          { waitUntil: 'load' },
        )

        // THE SURFACE ACTUALLY RENDERED. A screenshot of a blank frame is still
        // a screenshot, and it would sit in the artifact looking like evidence.
        await page.waitForSelector('[data-vnext] main')
        // Entrances are a rise; photographing mid-entrance captures a
        // transformed box rather than the composition.
        await page.waitForTimeout(1200)

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `${surface} scrolls sideways at this width`).toBeLessThanOrEqual(0)

        // THE VIEWPORT, NOT THE FULL PAGE, and it took a look at the artifact
        // to see why. Both navigations are sticky, so a full-page capture
        // paints the bottom bar wherever the scroll happened to be — across the
        // middle of every tall page, over content it does not cover in life.
        // That is a picture no player ever sees, and on the create corridor it
        // made a perfectly reachable form look like it was underneath the
        // navigation.
        //
        // The viewport is what a player is actually looking at, with the sticky
        // chrome in the place it really occupies. The composition — which is
        // what these three widths exist to show — is above the fold by design.
        await page.screenshot({
          path: `${OUT}/${surface}-${frame.label}-${theme}.png`,
        })
      })
    }
  }
}
