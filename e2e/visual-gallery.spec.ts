import { expect, test } from '@playwright/test'

/**
 * Visual contracts against stable `ComponentsPreview` anchors.
 *
 * WHAT THIS CATCHES that nothing else does. The token tests prove the palette
 * is a coherent system; the adoption guard proves components consume it; axe
 * proves the result is accessible. None of them notices that a card lost its
 * border, a row's columns fell out of register, or a dark-theme surface stopped
 * being distinguishable from the page behind it. Those are visual facts, and a
 * picture is the only cheap way to hold them.
 *
 * ANCHORS, NOT CLASS NAMES. Sections are addressed by `data-section`, derived
 * from the section title in `ComponentsPreview`. CSS module class names are
 * hashed and change whenever the stylesheet does, so a baseline keyed on one
 * would break for reasons unrelated to what it shows.
 *
 * Prefix matching (`^=`) is deliberate: the state sections carry their
 * requirement in the title — "state-offline-banner-preserved-state-only-safe-
 * actions" — and matching the whole slug would make every wording change a
 * baseline failure. The prefix is the identity; the rest is prose.
 *
 * WHY A CURATED LIST rather than every section. The gallery has ~75 sections
 * per theme. Photographing all of them at two widths in two themes is 300
 * images, which nobody reviews — and an unreviewed baseline is worse than no
 * baseline, because it converts real regressions into a diff people click
 * through. These are the surfaces the modernisation plan's first-gallery scope
 * names: navigation, action cards, prediction fixtures, standings rows, and
 * the page states.
 */

const SECTIONS = [
  'button',
  'textinput',
  'alert',
  'emptystate',
  'pageshell-bottomnav',
  'matchcard-editable',
  // The SEASON prediction card, which is the one a domestic player actually
  // enters a score on and had never been photographed. Added when tap-to-step
  // score entry landed: "the provisional score is not in the result column"
  // has a sibling here — "the score can be changed without a keyboard" — and
  // both are facts about layout that no assertion holds.
  'clubmatchcard',
  'leaguetable-full-twenty-row-league',
  'state-offline',
  'state-unavailable',
  'state-conflict',
  'state-refreshing',
  'state-stale',
  'state-error-blocking',
  // The season surfaces. Every entry above this line is tournament-era, which
  // is what the gallery grew alongside; these are the ones where a stylesheet
  // edit could quietly move a provisional score into a result's place, and no
  // assertion anywhere would notice.
  'season-fixtures-day-list',
  'season-match-centre',
  'season-overview-next-up',
  'provider-review-queues',
] as const

const WIDTHS = ['phone', 'desktop'] as const
const THEMES = ['dark', 'light'] as const

for (const width of WIDTHS) {
  for (const theme of THEMES) {
    test.describe(`${width} · ${theme}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(`/dev/components?width=${width}`)
        // The panel anchor proves the width actually applied. Without this the
        // suite would happily photograph the flexible default and bake a
        // viewport-dependent image into the baseline.
        await expect(page.locator(`[data-theme-panel="${theme}"]`)).toBeVisible()
        // Webfonts are self-hosted with `font-display: swap`, so text reflows
        // once when they land. Waiting for them removes the one race that
        // would otherwise make the first screenshot of a run differ from the
        // rest.
        await page.evaluate(() => document.fonts.ready)
      })

      for (const section of SECTIONS) {
        test(`${section}`, async ({ page }) => {
          const target = page
            .locator(`[data-theme-panel="${theme}"] [data-section^="${section}"]`)
            .first()

          // A missing anchor must fail loudly rather than silently photograph
          // nothing: a renamed or deleted section is exactly the change a
          // reviewer needs told about.
          await expect(target, `no gallery section anchored at "${section}"`).toBeVisible()
          await target.scrollIntoViewIfNeeded()

          await expect(target).toHaveScreenshot(`${section}-${width}-${theme}.png`)
        })
      }
    })
  }
}
