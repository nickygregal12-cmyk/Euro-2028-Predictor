import { expect, test, type Page } from '@playwright/test'

const productionSupabaseRef = 'vkfnsqdyhvtwyqkisxhk'
const developmentSupabaseRef = 'iouzoutneyjpugbbtdem'
const expectedSupabaseRef =
  process.env.EURO28_SMOKE_EXPECTED_SUPABASE_REF ?? productionSupabaseRef
const expectedEnvironment =
  process.env.EURO28_SMOKE_EXPECTED_CONTEXT ?? 'production'

const expectedSupabaseHost = `${expectedSupabaseRef}.supabase.co`
const developmentSupabaseHost = `${developmentSupabaseRef}.supabase.co`

test('anonymous production routes and environment isolation', async ({
  page,
  request,
}) => {
  const pageErrors: string[] = []
  const unexpectedSupabaseHosts = new Set<string>()
  const developmentRequests: string[] = []

  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  page.on('request', (browserRequest) => {
    const url = new URL(browserRequest.url())
    if (!url.hostname.endsWith('.supabase.co')) return

    if (url.hostname === developmentSupabaseHost) {
      developmentRequests.push(
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
    applicationContract: 35,
    hostedContract: 35,
    supabaseProjectRef: expectedSupabaseRef,
  })

  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', { name: 'Log in', exact: true }),
  ).toBeVisible()
  await expect(page).toHaveTitle('Log in | Euro 2028 Predictor')
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
  await expect(page).toHaveTitle('Sign up | Euro 2028 Predictor')

  await page.goto('/auth/reset', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveTitle('Reset password | Euro 2028 Predictor')

  await assertSignedOutGate(page, '/')
  await assertSignedOutGate(page, '/predict')

  await page.goto('/__production-not-found-probe__', {
    waitUntil: 'domcontentloaded',
  })
  await expect(
    page.getByRole('heading', {
      name: 'This page has gone walkabout',
      exact: true,
    }),
  ).toBeVisible()
  await expect(page).toHaveTitle('Page not found | Euro 2028 Predictor')

  expect(pageErrors).toEqual([])
  expect(developmentRequests).toEqual([])
  expect([...unexpectedSupabaseHosts]).toEqual([])
})

async function assertSignedOutGate(page: Page, pathname: string) {
  await page.goto(pathname, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL('/auth/login')
  await expect(page).toHaveTitle('Log in | Euro 2028 Predictor')
}
