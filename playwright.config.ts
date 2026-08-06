import { defineConfig, devices } from '@playwright/test'

const port = 4173
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  // `axe-unauthenticated` must run only under playwright.auth.config.ts, which
// serves the app with VITE_DEV_AUTOLOGIN=false. Here it would be signed in and
// `RedirectIfAuthed` would bounce it off the routes it exists to scan.
//
// `visual-gallery` must run only under playwright.visual.config.ts. This
// config's `testDir` sweeps up every spec in `e2e/`, so when the visual suite
// arrived it was picked up here too and ran 104 screenshot comparisons with no
// baselines to compare against — every one of them failing, on a suite that
// gates the merge. Its own config is dispatch-only until the baselines are
// bootstrapped on the runner; this is the other half of keeping it there.
  testIgnore: [
    'auth-recovery.spec.ts',
    'auth-capacity.spec.ts',
    'axe-unauthenticated.spec.ts',
    'visual-gallery.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
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
  ],
})
