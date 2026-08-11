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
const appName = 'Football Prediction Hub'

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
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL('/')
  await expect(page).toHaveTitle(`Home | ${appName}`)
  await expect(
    page.getByRole('heading', { name: 'Make every match mean more.', level: 1 }),
  ).toBeVisible()

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
