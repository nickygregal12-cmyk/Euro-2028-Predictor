import { defineConfig, devices } from '@playwright/test'

const port = 4173
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  // The weekly frontend no longer exposes the tournament-era route tree. These
  // specs are retained as Euro 2028 return evidence against the
  // `euro-2028-baseline` recovery point, but running them against the weekly
  // App would test routes that this milestone deliberately retired. The
  // project-gating contract verifies that this list contains only the explicit
  // parked-Euro set and that every non-parked spec still runs under exactly one
  // active config.
  //
  // The leading entries belong to other active Playwright configs — the auth,
  // visual and vNext-workshop suites. Counting them in prose was wrong the
  // moment a fourth vNext spec landed, so the comment no longer tries to.
  testIgnore: [
    'auth-recovery.spec.ts',
    'auth-capacity.spec.ts',
    'axe-unauthenticated.spec.ts',
    // The public landing page, which this config never sees: it auto-logs-in
    // and `/` becomes the Hub. `playwright.auth.config.ts` runs it.
    'landing-preview.spec.ts',
    'visual-gallery.spec.ts',
    // Storybook, not the application: vNext has no application route yet.
    'vnext-home.spec.ts',
    'vnext-shell.spec.ts',
    'vnext-predictor.spec.ts',
    'vnext-matches.spec.ts',
    'vnext-leagues.spec.ts',
    'vnext-player-profile.spec.ts',
    'vnext-lms.spec.ts',
    'vnext-championship.spec.ts',
    'vnext-supporting.spec.ts',
    'vnext-ia.spec.ts',
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
  ],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    {
      name: 'smoke-firefox',
      testMatch: ['weekly-navigation.spec.ts'],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'smoke-webkit',
      testMatch: ['weekly-navigation.spec.ts'],
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
