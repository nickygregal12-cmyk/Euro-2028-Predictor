import { expect, test, type Page } from '@playwright/test'

const productionSupabaseRef = 'vkfnsqdyhvtwyqkisxhk'
const developmentSupabaseRef = 'iouzoutneyjpugbbtdem'
const expectedSupabaseRef =
  process.env.EURO28_SMOKE_EXPECTED_SUPABASE_REF ?? productionSupabaseRef
const expectedEnvironment =
  process.env.EURO28_SMOKE_EXPECTED_CONTEXT ?? 'production'
const expectedCommit = process.env.EURO28_SMOKE_EXPECTED_COMMIT ?? ''
const expectedContract = parseExpectedContract(
  process.env.EURO28_SMOKE_EXPECTED_CONTRACT,
)

const expectedSupabaseHost = `${expectedSupabaseRef}.supabase.co`
const developmentSupabaseHost = `${developmentSupabaseRef}.supabase.co`

/**
 * WHICH PRODUCT THIS ORIGIN IS, AND WHY THIS FILE HAD TO LEARN THE QUESTION.
 *
 * `appName` was the constant `'Football Prediction Hub'` here, and the signed-out
 * root asserted the Hub's own hero heading. That was correct while there was one
 * production site. ADR 0026 made two from one commit — `predictorhub` builds
 * `VITE_SITE_VARIANT=hub` and `euro28predictor` builds `=euro` — and
 * `euro28predictor.com`, the origin this smoke points at, is now the EURO one.
 *
 * So every title assertion below was measuring the Euro deployment against the
 * Hub's brand, and the root assertion was measuring the Euro landing page
 * against the Hub's copy. The HTTP smoke failed first and hid it: run
 * 31574100495, 12 August 2026, `STOP: application title is missing "Football
 * Prediction Hub"`, against a deploy serving the expected commit at the expected
 * contract. The browser half would have failed immediately afterwards, twice.
 *
 * THE VARIANT IS DERIVED FROM THE ORIGIN, NOT PASSED BESIDE IT. A separate
 * `EURO28_SMOKE_EXPECTED_VARIANT` that a caller sets independently can disagree
 * with the origin it is set beside, and the disagreement reads as a site defect.
 * An override exists for a preview of a known variant at an unknown origin, and
 * an unknown origin with no override is a stop rather than a guess.
 *
 * THE VALUES ARE LITERAL AND ARE PINNED ELSEWHERE. Playwright reads a spec
 * before any bundling, which is the same reason `playwright.euro.config.ts`
 * gives for restating its spec list; `tests/scripts/productionSmokePerimeter`
 * compares each field below against `siteConfiguration()` and against the
 * landing models, so a rename fails CI rather than surfacing here as a red
 * production smoke.
 */
type ProductionVariant = 'hub' | 'euro'

const VARIANT_BY_ORIGIN = new Map<string, ProductionVariant>([
  ['https://euro28predictor.com', 'euro'],
  ['https://predictorhub.netlify.app', 'hub'],
])

const PRODUCT = {
  hub: {
    appName: 'Predictor Hub',
    // `LandingPage.tsx`'s hero.
    landingHeading: 'Make every match mean more.',
  },
  euro: {
    appName: 'Euro 2028 Predictor',
    /**
     * `euroLandingModel.ts`'s headline for `hidden` — and, identically, for
     * `unknown`. That the two agree is what makes this assertion stable: the
     * page fails closed to the same words whether contract 143's read says the
     * tournament is hidden or the read does not answer at all, so a Supabase
     * blip cannot turn this into a flake.
     *
     * It changes the day the owner publishes Euro 2028, which is an owner act
     * with its own evidence and not something a smoke should absorb silently.
     */
    landingHeading: 'Euro 2028 is on its way.',
  },
} as const satisfies Record<ProductionVariant, { appName: string; landingHeading: string }>

const variant = resolveVariant()
const appName = PRODUCT[variant].appName
const landingHeading = PRODUCT[variant].landingHeading

test('anonymous production routes and environment isolation', async ({
  page,
  request,
}) => {
  const pageErrors: string[] = []
  const unexpectedSupabaseHosts = new Set<string>()
  const forbiddenDevelopmentRequests: string[] = []

  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  page.on('request', (browserRequest) => {
    const url = new URL(browserRequest.url())
    if (!url.hostname.endsWith('.supabase.co')) return

    if (
      expectedSupabaseHost !== developmentSupabaseHost &&
      url.hostname === developmentSupabaseHost
    ) {
      forbiddenDevelopmentRequests.push(
        `${browserRequest.method()} ${url.hostname}${url.pathname}`,
      )
    }

    if (url.hostname !== expectedSupabaseHost) {
      unexpectedSupabaseHosts.add(url.hostname)
    }
  })

  const releaseResponse = await request.get('/release.json')
  expect(releaseResponse.status()).toBe(200)
  await expect(releaseResponse).toBeOK()

  const release = (await releaseResponse.json()) as Record<string, unknown>
  expect(release).toMatchObject({
    environment: expectedEnvironment,
    applicationContract: expectedContract,
    hostedContract: expectedContract,
    supabaseProjectRef: expectedSupabaseRef,
  })

  if (expectedCommit) {
    expect(release.commit).toBe(expectedCommit)
  }

  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', { name: 'Log in', exact: true }),
  ).toBeVisible()
  await expect(page).toHaveTitle(`Log in | ${appName}`)
  await expect(
    page.getByRole('textbox', { name: 'Email', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Password', exact: true }),
  ).toBeVisible()

  await page
    .getByRole('button', { name: 'Create an account', exact: true })
    .click()
  await expect(page).toHaveURL('/auth/signup')
  await expect(page).toHaveTitle(`Sign up | ${appName}`)

  await page.goto('/auth/reset', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveTitle(`Reset password | ${appName}`)

  // `/` stood in the signed-out gate below until 11 August 2026, and this is
  // the same kind of staleness as the retired `/predict` note further down
  // rather than a gate that was weakened. `SignedOutDestination` serves the
  // PUBLIC LANDING PAGE at the root when `VITE_UI_PUBLIC_LANDING` is on, which
  // is the configuration production runs; the flag fails closed, so with it
  // unset `/` redirects to `/auth/login` exactly as it always did.
  //
  // Asserted positively — the landing heading, not merely "did not redirect" —
  // because a root that renders nothing, errors, or quietly serves the signed-in
  // Hub would also fail to redirect, and those are the outcomes worth catching.
  // Every OTHER signed-in route still gates, which `/play` proves immediately
  // below; that assertion is the one guarding the boundary.
  //
  // The heading is this BUILD's landing heading, not the Hub's. `/` signed out
  // resolves to `EuroLandingPage` on the Euro build and `LandingPage` on the
  // Hub's, and the two share no copy at all — see `PRODUCT` above.
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL('/')
  await expect(page).toHaveTitle(`Home | ${appName}`)
  await expect(page.getByRole('heading', { name: landingHeading, level: 1 })).toBeVisible()

  // `/predict` stood here until 10 August 2026. It is a retired tournament path
  // that the application no longer declares and netlify.toml deliberately sends
  // to the 404 catch-all, so it never reached the signed-out gate — it rendered
  // the not-found page. `/play` is the current weekly route this meant to check.
  await assertSignedOutGate(page, '/play')

  await page.goto('/__production-not-found-probe__', {
    waitUntil: 'domcontentloaded',
  })
  await expect(
    page.getByRole('heading', {
      name: 'This page has gone walkabout',
      exact: true,
    }),
  ).toBeVisible()
  await expect(page).toHaveTitle(`Page not found | ${appName}`)

  expect(pageErrors).toEqual([])
  expect(forbiddenDevelopmentRequests).toEqual([])
  expect([...unexpectedSupabaseHosts]).toEqual([])
})

async function assertSignedOutGate(page: Page, pathname: string) {
  await page.goto(pathname, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL('/auth/login')
  await expect(page).toHaveTitle(`Log in | ${appName}`)
}

function resolveVariant(): ProductionVariant {
  const override = process.env.EURO28_SMOKE_EXPECTED_VARIANT
  if (override) {
    if (override !== 'hub' && override !== 'euro') {
      throw new Error(
        `EURO28_SMOKE_EXPECTED_VARIANT must be 'hub' or 'euro', not ${JSON.stringify(override)}.`,
      )
    }
    return override
  }

  // The same default the smoke script and the Playwright configuration use, so
  // an unset origin means the same site in all three.
  const origin = process.env.EURO28_SMOKE_ORIGIN || 'https://euro28predictor.com'
  const known = VARIANT_BY_ORIGIN.get(origin.replace(/\/+$/, ''))
  if (!known) {
    throw new Error(
      `No known site variant for origin ${origin}. Set EURO28_SMOKE_EXPECTED_VARIANT to ` +
        "'hub' or 'euro'; this smoke does not guess which product an origin serves.",
    )
  }
  return known
}

function parseExpectedContract(value: string | undefined): number {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    throw new Error(
      'EURO28_SMOKE_EXPECTED_CONTRACT must be an explicit positive integer.',
    )
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(
      'EURO28_SMOKE_EXPECTED_CONTRACT is outside the safe integer range.',
    )
  }

  return parsed
}
