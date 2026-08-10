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
  // The UI-finalisation surfaces. Each is a composition no route harness
  // renders, so the gallery is the only place they can be photographed at all:
  // the desktop rail against a twenty-competition catalogue, the two game
  // contextual panels, the onboarding steps, the create-a-league journey and
  // the rules disclosure.
  //
  // The BAR had to get a section of its own, and the first runner render is
  // what showed why: `PageShell` hides it above 1024px, and that is a VIEWPORT
  // media query while the gallery pins panel WIDTH in CSS — so the runner's
  // window puts both panels above the breakpoint and "pageshell-bottomnav"
  // photographs a shell with no bar in it. That image lost its five tabs and a
  // fifth of its bytes. Rendering the component directly is what `SideRailDemo`
  // already does for the rail.
  'mobile-bottom-navigation',
  'desktop-navigation-rail',
  'lms-form-guide-panel',
  'fixture-consensus-panel',
  'onboarding-choose-competitions',
  'onboarding-favourite-team',
  'onboarding-games-and-review',
  'create-a-league-journey',
  'game-rules-disclosure',
  // The contract 149/150/151 surfaces. Each needs a season, a league, a
  // matchweek and a signed-in caller, so no route harness can render one and
  // the gallery is the only place they can be photographed at all. Two visual
  // properties matter here and no assertion holds either: that the hidden
  // state shows no names AND no count, and that the phone layout is a
  // purpose-built fixture list rather than the desktop matrix scaled down.
  'league-matchweek-comparison',
  'match-centre-your-leagues',
  'season-player-profile',
  'competition-club-form',
] as const

/**
 * Sections declared above whose baselines have not been rendered yet.
 *
 * **EMPTY, AND THAT IS THE POINT.** Every section above is photographed.
 *
 * WHY THE LIST EXISTS AT ALL, AND WHY IT IS NOT A WEAKENING. A baseline is only
 * meaningful when it was rendered on the machine that will compare it, and only
 * the GitHub runner is that machine — an image produced in a development
 * container differs from the runner's by font build and graphics stack, so
 * committing one from here would hand CI a failure nobody can act on and invite
 * someone to raise the tolerance. A section added from a development container
 * therefore lands here, and `visual-contracts.yml` is dispatched with
 * `update_baselines` and `commit_baselines` to produce its images.
 *
 * IT IS SELF-DELETING. `visualContractHarness` excludes these from its baseline
 * count and **fails if a name here already has baselines on disk**, so an entry
 * cannot outlive the dispatch that satisfies it — which is what stops a
 * "temporary" exemption from becoming the way new sections are added. The nine
 * UI-finalisation sections passed through it and are gone from it.
 */
export const AWAITING_BASELINE: readonly string[] = [
  // Renamed 11 August 2026: the panel's heading became "Club form" so it stops
  // colliding with the Match Centre's "Recent form" for an opened fixture's two
  // clubs — the browser suite caught the duplicate as a strict-mode violation,
  // which is the same defect a screen-reader user meets navigating by heading.
  // Its images come from the next `visual-contracts.yml` dispatch; the four
  // rendered under the old name are deleted rather than left orphaned.
  'competition-club-form',
]

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
