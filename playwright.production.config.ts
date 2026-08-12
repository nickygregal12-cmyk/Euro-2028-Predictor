import { defineConfig, devices } from '@playwright/test'

/**
 * THERE ARE TWO PRODUCTION ORIGINS UNDER ADR 0026, and this guard knew one.
 *
 * `euro28predictor` builds `VITE_SITE_VARIANT=euro` and `predictorhub` builds
 * `=hub`. Both are production; neither is a preview. Listing only the first
 * meant that pointing this suite at the other would have demanded
 * `EURO28_SMOKE_ALLOW_NON_PRODUCTION=true` — the escape hatch that also turns
 * off the same guard in `scripts/production-smoke.mjs`, so reaching the second
 * production site required disarming the check on the first.
 *
 * The default stays the Euro origin, which is what the production smoke
 * workflow points at. `anonymous.spec.ts` derives which PRODUCT each origin is
 * from the same list, and `tests/scripts/productionSmokePerimeter` compares all
 * three copies so a site added to one is not missing from another.
 */
const productionOrigins = ['https://euro28predictor.com', 'https://predictorhub.netlify.app']
const productionOrigin = productionOrigins[0]
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

if (!productionOrigins.includes(origin.origin) && !allowNonProduction) {
  throw new Error(
    `Refusing to browser-smoke non-production origin ${origin.origin}. ` +
      'Set EURO28_SMOKE_ALLOW_NON_PRODUCTION=true only for an intentional preview check.',
  )
}

/**
 * The site session, when the origin is password protected.
 *
 * `scripts/write-production-storage-state.mjs` writes this file before the
 * browser smoke runs. It is a path rather than a cookie value on purpose: the
 * cookie is a runtime-minted JWT that GitHub does not mask, and a file under the
 * runner's temporary directory can be shredded afterwards where an environment
 * variable cannot.
 *
 * Unset means "expect an open origin" and leaves the browser anonymous.
 */
const storageState = process.env.EURO28_SMOKE_STORAGE_STATE || undefined

export default defineConfig({
  testDir: './production-smoke',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: origin.origin,
    storageState,
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
