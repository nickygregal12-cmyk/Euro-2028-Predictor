import { defineConfig, devices } from '@playwright/test'

/**
 * The vNext workshop's layout contract, in a real browser.
 *
 * SEPARATE FROM EVERY OTHER CONFIG BECAUSE IT SERVES A DIFFERENT THING. The
 * weekly, auth and Euro suites boot the application; the visual suite boots the
 * dev server for the `/dev/components` gallery. vNext is not wired into the
 * application at all — Storybook is its review surface — so this config boots
 * Storybook and nothing else. Pointing it at the app would test a page that
 * contains no vNext code.
 *
 * NO SCREENSHOTS. The workshop exists to be redesigned in the next stage, so a
 * pixel baseline here would be a baseline rewritten every time the thing it
 * guards is touched. The spec asserts the structural contract — regions,
 * columns, sticky behaviour, overflow — which is the part that must survive the
 * redesign.
 *
 * THE WINDOW IS DELIBERATELY THE WRONG SIZE. 1280×900 matches no frame under
 * review, so any measurement inside a frame that reaches for the window instead
 * of the frame produces a number that cannot coincidentally be right. That is
 * how the suite proves the isolation rather than assuming it.
 */

const port = 6008
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'vnext-home.spec.ts',
    'vnext-shell.spec.ts',
    'vnext-predictor.spec.ts',
    // Stage 8, Matches and the Match Centre. Same terms as the rest: Storybook
    // is the review surface, the worlds are deterministic, and the connected
    // proof lives at the dev harness rather than in a browser suite that would
    // then need a database.
    'vnext-matches.spec.ts',
    // Stage 9, Leagues. Same terms: Storybook is the review surface, the worlds
    // are deterministic, and the connected proof lives at the dev harness
    // rather than in a browser suite that would then need a database — and,
    // here, real people in a real league.
    'vnext-leagues.spec.ts',
    // Stage 10, the player profile. Same terms again — and here the browser is
    // doing something the other suites are not: it reads the plotted
    // coordinates out of the rendered SVG. A rank chart drawn upside down is
    // invisible to every assertion that cannot see geometry.
    'vnext-player-profile.spec.ts',
    // Stage 11, Last Man Standing. Same terms — and here the browser measures
    // the thing that costs most: a mis-tap on this surface spends a club for
    // the season, so the club controls are checked for size and clipping at
    // every reviewed width rather than trusted.
    'vnext-lms.spec.ts',
    // Stage 12, the Predictor Championship. Same terms — and here the browser
    // carries the stage predicate itself rather than a house rule: a bracket
    // layout that works on phone and desktop without becoming unreadable is a
    // claim about rendered geometry, so the suite measures round rows and
    // columns. Rounds-as-sections versus a scaled tree is exactly the
    // difference jsdom cannot see.
    //
    // NO APOSTROPHES OR QUOTES IN THIS COMMENT, and none anywhere in this
    // array: `e2eProjectGating.test.ts` scans the file for single-quoted spec
    // names, so a stray apostrophe opens a string that swallows the next entry
    // whole. Every comment above avoids them for the same reason.
    'vnext-championship.spec.ts',
    // Stage 7.5, the three information-architecture concepts. Registered on
    // the same terms as the other three: Storybook is the review surface, and
    // the lab has no application route at all — it runs on deterministic
    // fixtures, so there is nothing for a dev harness to show.
    // Stage 13, the supporting surfaces. Same terms as the rest, and here the
    // browser closes a gap rather than adding a flourish: five surfaces landed
    // with no browser measurement at all. Onboarding is the reason it matters
    // most. Every step of it is a control, on a phone, operated by somebody who
    // has used the product for ninety seconds, and a target under 44px there
    // costs a player their setup rather than a scroll position.
    'vnext-supporting.spec.ts',
    'vnext-ia.spec.ts',
    // THE CANONICAL SCREENSHOT SUITE. It compares nothing — see its header —
    // and exists so a passing build leaves behind something a person can look
    // at, at the three widths where the composition changes shape.
    'vnext-visual-contract.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report-vnext' }]]
    : [['list']],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'vnext-workshop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
      },
    },
  ],

  webServer: {
    // Storybook, not the application. The cutover gave vNext real routes, and
    // this suite deliberately does NOT follow them there: it measures
    // composition against deterministic worlds, which is a different question
    // from whether the reads work. The connected proof lives at the `/dev`
    // harnesses and in the authenticated browser suite.
    //
    // ONE STORY HERE IS DOCUMENT-SCOPED RATHER THAN FRAMED — `vNext/Focus Not
    // Obscured` — because WCAG 2.2's 2.4.11 is about where a SCROLLER scrolls
    // to, and a framed surface scrolls inside its frame. See the case at the
    // end of `e2e/vnext-shell.spec.ts`.
    command: `npm run storybook -- --ci --quiet --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
