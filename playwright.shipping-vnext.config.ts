import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

/**
 * THE APPLICATION AS IT SHIPS, NOT AS A TEST HAPPENS TO DEFAULT.
 *
 * `src/app/routeFlags.ts` fails closed, which is the correct production safety
 * property and the wrong default for a release gate whose entire job is to
 * prove the code production is currently serving. The ordinary browser suite
 * historically inherited no Football Hub flags and could therefore stay green
 * while exercising the legacy branches that Netlify no longer serves.
 *
 * This config does not create a second set of release switches. It reads the
 * committed deployment template — the repository authority that currently says
 * every Football Hub vNext route ships ON — and refuses to start if any one of
 * those values stops being exactly `true`. A rollback therefore changes the
 * source value and makes this release-candidate suite fail loudly until its
 * expected shipping surface is deliberately revised.
 */
const shippingFlagKeys = [
  'VITE_UI_FOOTBALL_HUB_HOME',
  'VITE_UI_FOOTBALL_HUB_MATCHES',
  'VITE_UI_FOOTBALL_HUB_GAMES',
  'VITE_UI_FOOTBALL_HUB_LEAGUES',
  'VITE_UI_FOOTBALL_HUB_PLAYER_PROFILE',
  'VITE_UI_FOOTBALL_HUB_DISCOVERY',
  'VITE_UI_FOOTBALL_HUB_ACCOUNT',
  'VITE_UI_FOOTBALL_HUB_LMS',
  'VITE_UI_FOOTBALL_HUB_CHAMPIONSHIP',
  'VITE_UI_FOOTBALL_HUB_PREDICTOR',
  'VITE_UI_FOOTBALL_HUB_ONBOARDING',
  'VITE_UI_FOOTBALL_HUB_INVITE',
  'VITE_UI_FOOTBALL_HUB_CREATE',
  'VITE_UI_FOOTBALL_HUB_WRAPPED',
] as const

function committedShippingEnvironment(): Record<string, string> {
  const template = readFileSync(
    fileURLToPath(new URL('./.env.example', import.meta.url)),
    'utf8',
  )
  const env: Record<string, string> = { VITE_SITE_VARIANT: 'hub' }

  for (const key of shippingFlagKeys) {
    const match = template.match(new RegExp(`^${key}=([^\\r\\n]*)$`, 'm'))
    const value = match?.[1]?.trim()
    if (value !== 'true') {
      throw new Error(
        `Shipping vNext browser gate requires committed ${key}=true; found ${String(value)}.`,
      )
    }
    env[key] = value
  }

  return env
}

const port = 4175
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  // This gate began as the one player matrix and is now intentionally a family:
  // the matrix, private-LMS multi-account lifecycle and cross-width/hover
  // release acceptance all have to run under the same exact shipping flags.
  testMatch: ['shipping-vnext-*.spec.ts'],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report-shipping-vnext' }]]
    : [['list']],
  // The shipping wrapper delegates first to the canonical e2e/global-setup and
  // then adds only the Football Hub player context this suite needs: additive
  // test state rather than a second identity bootstrap. That canonical setup
  // hard-deletes and recreates the seeded identities, which only succeeds on a
  // freshly rebuilt database, so browser-e2e.yml gives this configuration its
  // own rebuild rather than the ordinary suite's leftovers.
  globalSetup: './e2e/shipping-vnext-global-setup.ts',
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
    env: {
      ...process.env,
      ...committedShippingEnvironment(),
    },
  },
  projects: [
    { name: 'shipping-vnext-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'shipping-vnext-mobile', use: { ...devices['Pixel 7'] } },
  ],
})