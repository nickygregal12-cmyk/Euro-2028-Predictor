import { defineConfig, devices } from '@playwright/test'

/**
 * The Euro 2028 deployment's browser journeys.
 *
 * WHAT THIS IS FOR. `EURO-001` requires Euro 2028 to be completely hidden from
 * the weekly platform, and its route half has been blocked since PR #702 on one
 * missing thing, recorded in the register in its own words: withdrawing the
 * tournament's routes from the Hub build "deletes the `euro-2028-baseline`
 * return evidence (the tournament profile, a tournament league's pagination,
 * the head-to-head) rather than moving it, because there is no Euro-variant
 * browser configuration for those specs to run under". This is that
 * configuration. It is the destination the fourteen parked specs move TO, which
 * is what turns `servesEuroTournament: false` on the Hub from a deletion into a
 * relocation.
 *
 * THE PROJECT NAMES ARE DELIBERATELY THE WEEKLY ONES, AND THIS IS THE WHOLE
 * TRAP. Eleven of the fourteen specs below open with
 * `test.skip(testInfo.project.name !== 'desktop-chromium', ...)`, and
 * `admin-results.spec.ts` gates on `'mobile-chromium'` as well. Naming these
 * projects `euro-desktop-chromium` and `euro-mobile-chromium` — the obvious
 * spelling, and the one that reads better in a report — makes every one of
 * those gates true, so all fourteen specs SKIP and the suite reports green
 * having executed nothing. A suite that passes by running nothing is worse than
 * one that fails, because nobody looks at it again. The names are a contract the
 * specs already depend on; the config that owns them is free to be a different
 * file, but it is not free to rename them. `e2eProjectGating` asserts this
 * against the specs' own gates rather than against a copy of this list.
 *
 * WHY IT IS DISPATCH-ONLY, AND WHAT WOULD CHANGE THAT. `src/App.tsx` does not
 * register `/predict`, `/match/:matchRef`, `/games`, `/league/overall`,
 * `/prediction-trends` or `/competitions/euro/2028/original` — and
 * `tests/app/parkedEuroBoundary.test.ts` actively asserts their absence, because
 * `MASTER-TODO.md` parks the remaining Euro scope to January 2028. So these
 * specs cannot pass today: the harness is complete and the routes it drives are
 * not registered. Wiring this into `ci.yml` or `browser-e2e.yml` now would add
 * fourteen permanently-red journeys, and the usual next step is to delete them.
 *
 * The same shape as `playwright.visual.config.ts`, and for the same reason: a
 * suite whose prerequisite has not landed is reachable through its own
 * `workflow_dispatch` until it can pass, not bolted onto a gate that must stay
 * green. `.github/workflows/euro-browser-journeys.yml` is how it is run.
 *
 * It becomes a pull-request gate when the tournament routes are registered
 * against `VITE_SITE_VARIANT=euro` — the work the owner has sequenced behind
 * PR #707's variant route dispatcher. At that point `parkedEuroBoundary` is
 * rewritten as a VARIANT boundary (the tournament tree must stay unreachable
 * from the HUB build, rather than from the application at all) rather than
 * deleted, and the `pull_request` trigger is added below the dispatch one.
 */

const port = 4176
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  /**
   * The parked Euro 2028 return evidence, and nothing else.
   *
   * This list is `PARKED_EURO_SPECS` from `scripts/select-browser-journeys.mjs`,
   * which `playwright.config.ts` ignores one for one. Both are literal rather
   * than imported because Playwright reads a config before any bundling, and
   * `e2eProjectGating` compares them against that single source so the two
   * cannot drift: a spec parked in one place and forgotten in the other is a
   * journey that runs nowhere, which is the state this config exists to end.
   */
  testMatch: [
    'admin-results.spec.ts',
    'authenticated-browser.spec.ts',
    'automatic-submission.spec.ts',
    'bonus-games.spec.ts',
    'bracket-conflict.spec.ts',
    'entry-creation.spec.ts',
    'foreground-refresh.spec.ts',
    'locked-state.spec.ts',
    'match-centre-navigation.spec.ts',
    'matches-tournament-info.spec.ts',
    'operating-cap.spec.ts',
    'overall-standings.spec.ts',
    'prediction-trends.spec.ts',
    'private-league-invite.spec.ts',
    // The two the flip moved. See `PARKED_EURO_SPECS`.
    'private-league-pagination.spec.ts',
    'profile-h2h-surfaces.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report-euro' }]]
    : [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    /**
     * `VITE_SITE_VARIANT=euro` is the entire point of this file.
     *
     * `resolveSiteVariant` fails closed to `'hub'` on anything it does not
     * recognise, which is correct everywhere else and would be silent here: an
     * unset or misspelled value produces a Hub build, the tournament routes are
     * absent from it for a second and unrelated reason, and the failure reads
     * as "the Euro journeys are broken" rather than "this harness built the
     * wrong product". `tests/scripts/e2eProjectGating.test.ts` asserts the
     * variable is set in this command for that reason.
     */
    command: `VITE_SITE_VARIANT=euro npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    // See the header. These names are the specs' contract, not this file's
    // choice — renaming them skips all fourteen journeys silently.
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
})
