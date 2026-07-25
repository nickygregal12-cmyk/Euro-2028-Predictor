import { defineConfig, devices } from '@playwright/test'

const productionOrigin = 'https://euro28predictor.com'
const configuredOrigin = process.env.EURO28_SMOKE_ORIGIN ?? productionOrigin
const allowNonProduction =
  process.env.EURO28_SMOKE_ALLOW_NON_PRODUCTION === 'true'

const origin = new URL(configuredOrigin)

if (origin.protocol !== 'https:' || origin.username || origin.password) {
  throw new Error(
    'EURO28_SMOKE_ORIGIN must be an HTTPS origin without credentials.',
  )
}

if (origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error(
    'EURO28_SMOKE_ORIGIN must not include a path, query or fragment.',
  )
}

if (origin.origin !== productionOrigin && !allowNonProduction) {
  throw new Error(
    `Refusing to browser-smoke non-production origin ${origin.origin}. ` +
      'Set EURO28_SMOKE_ALLOW_NON_PRODUCTION=true only for an intentional preview check.',
  )
}

export default defineConfig({
  testDir: './production-smoke',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: origin.origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'production-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
