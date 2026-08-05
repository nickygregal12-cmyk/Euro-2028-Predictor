import { defineConfig, devices } from '@playwright/test'

/**
 * Visual contracts for the design system.
 *
 * SEPARATE FROM EVERY OTHER CONFIG ON PURPOSE. A screenshot suite with no
 * baselines fails, and baselines cannot be produced here: Playwright compares
 * images pixel by pixel, and a PNG rendered in one container never matches one
 * rendered on a different kernel, GPU stack and font build. Generating them
 * locally and committing them would hand CI a suite that fails on its first
 * run for reasons nobody can act on.
 *
 * So this config is reachable only through `.github/workflows/visual-contracts.yml`,
 * which bootstraps the baselines ON the runner that will later compare them.
 * Until that has been run once and its images committed, nothing here executes
 * in CI — which is why it is absent from `ci.yml` and from the browser suite.
 *
 * DETERMINISM IS THE WHOLE DESIGN. Every source of variation that would make an
 * image differ between two identical commits is pinned:
 *
 *   - the gallery panels are pinned to real widths through `?width=`, because
 *     their normal `flex: 1 1 340px` follows the viewport;
 *   - `deviceScaleFactor: 1`, so the image is not resampled;
 *   - `animations: 'disabled'` freezes CSS animations and transitions at their
 *     end state, which is what removes the spinners, shimmers and pulses the
 *     motion contract deliberately keeps running;
 *   - one browser, one project. A second engine would double the baselines
 *     without doubling what they tell anyone.
 *
 * The gallery renders fixture data and no clock, so there is no time to freeze
 * — `tests/design-system/galleryDeterminism.test.ts` keeps it that way.
 */

const port = 4175
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  testMatch: ['visual-gallery.spec.ts'],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  // No retries. A flaky screenshot is a defective contract, not a slow one:
  // retrying until it passes is how a baseline stops meaning anything.
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report-visual' }]]
    : [['list']],

  snapshotPathTemplate: '{testDir}/visual-baselines/{arg}{ext}',

  expect: {
    toHaveScreenshot: {
      // Anti-aliasing differs by a pixel or two along curves and text edges
      // even on the same runner. This tolerates that and nothing structural:
      // a moved element, a changed colour or a different size is thousands of
      // pixels, not a handful.
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
      scale: 'css',
    },
  },

  use: {
    baseURL,
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'visual-chromium',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 },
    },
  ],

  webServer: {
    // The gallery is a DEV-only route, so this serves the dev build. The
    // Supabase values are placeholders: `/dev/components` renders fixture data
    // and calls nothing, but the client throws at module load without them.
    command:
      `VITE_SUPABASE_URL=https://visual-contracts.supabase.invalid ` +
      `VITE_SUPABASE_ANON_KEY=visual-contracts-not-a-real-key ` +
      `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
