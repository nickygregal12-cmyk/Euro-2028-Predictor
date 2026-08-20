import { defineConfig, devices } from '@playwright/test'

const port = 4174
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  // `landing-preview.spec.ts` is here for the same reason the axe scan is: this
  // is the only harness that sees the public landing page at all, because every
  // other config auto-logs-in and gets the Hub.
  testMatch: [
    'auth-recovery.spec.ts',
    'auth-capacity.spec.ts',
    'axe-unauthenticated.spec.ts',
    'landing-preview.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report-auth' }]]
    : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    // `VITE_UI_PUBLIC_LANDING=true` because this is the only harness that can
    // see the page at all: the landing page renders at `/` for a signed-out
    // visitor, and every other config auto-logs-in and gets the Hub. Scanning
    // it with the flag off would scan `/auth/login` after the redirect and
    // report a green result for a page that was never looked at.
    command: `VITE_DEV_AUTOLOGIN=false VITE_UI_PUBLIC_LANDING=true npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'auth-desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'auth-mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
})
