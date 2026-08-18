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
    // Stage 7.5, the three information-architecture concepts. Registered on
    // the same terms as the other three: Storybook is the review surface, and
    // the lab has no application route at all — it runs on deterministic
    // fixtures, so there is nothing for a dev harness to show.
    'vnext-ia.spec.ts',
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
    // Storybook, not the application. vNext has no application route, and the
    // whole point of the workshop is that it does not have one yet.
    command: `npm run storybook -- --ci --quiet --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
