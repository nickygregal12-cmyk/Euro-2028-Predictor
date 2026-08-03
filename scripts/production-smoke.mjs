import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const PRODUCTION_ORIGIN = 'https://euro28predictor.com'
const PRODUCTION_SUPABASE_REF = 'vkfnsqdyhvtwyqkisxhk'
const DEVELOPMENT_SUPABASE_REF = 'iouzoutneyjpugbbtdem'

const origin = normaliseOrigin(
  process.env.EURO28_SMOKE_ORIGIN || PRODUCTION_ORIGIN,
)
const allowNonProduction =
  process.env.EURO28_SMOKE_ALLOW_NON_PRODUCTION === 'true'
const expectedEnvironment =
  process.env.EURO28_SMOKE_EXPECTED_CONTEXT || 'production'
const expectedSupabaseRef =
  process.env.EURO28_SMOKE_EXPECTED_SUPABASE_REF ||
  PRODUCTION_SUPABASE_REF
const expectedCommit = process.env.EURO28_SMOKE_EXPECTED_COMMIT || ''
const expectedContract = parseExpectedContract(
  process.env.EURO28_SMOKE_EXPECTED_CONTRACT,
)

if (origin !== PRODUCTION_ORIGIN && !allowNonProduction) {
  stop(
    `Refusing to smoke-test non-production origin ${origin}. ` +
      'Set EURO28_SMOKE_ALLOW_NON_PRODUCTION=true only for an intentional preview check.',
  )
}

console.log(`Checking ${origin}`)

const root = await fetchText('/')
assertIncludes(root.body, '<div id="root"></div>', 'React root')
// Contract-65 bundles brand the global shell "Football Prediction Hub"
// (PR #357); production remains paused on a pre-rename bundle until its next
// intentional release, so both brands are valid until then. Retire the
// legacy form when production moves past contract 63.
if (
  !root.body.includes('Football Prediction Hub') &&
  !root.body.includes('Euro 2028 Predictor')
) {
  stop('application title is missing both "Football Prediction Hub" and "Euro 2028 Predictor".')
}
verifySecurityHeaders(root.headers)

const releaseResponse = await fetchText('/release.json')
let release
try {
  release = JSON.parse(releaseResponse.body)
} catch (error) {
  stop(`release.json is not valid JSON: ${errorMessage(error)}`)
}

assertEqual(
  release.applicationContract,
  expectedContract,
  'application contract',
)
assertEqual(
  release.hostedContract,
  expectedContract,
  'hosted contract',
)
assertEqual(
  release.environment,
  expectedEnvironment,
  'release environment',
)
assertEqual(
  release.supabaseProjectRef,
  expectedSupabaseRef,
  'Supabase project reference',
)

if (expectedCommit) {
  assertEqual(release.commit, expectedCommit, 'release commit')
}

if (expectedEnvironment === 'production') {
  assertNotEqual(release.commit, 'local', 'production commit identity')
  assertNotEqual(release.deployId, 'local', 'production deploy identity')
}

console.log('Release identity: PASS')

const routes = [
  '/auth/login',
  '/auth/signup',
  '/auth/reset',
  '/join/PRODUCTION-READ-ONLY-PROBE',
  '/predict',
  '/league',
  '/matches',
  '/more',
]

for (const route of routes) {
  const response = await fetchText(route)
  assertEqual(response.body, root.body, `SPA shell for ${route}`)
  console.log(`${route}: PASS`)
}

// An unknown path must serve the same SPA shell but answer 404, not a soft 200
// (SEO-001). This is the hosted proof of the netlify.toml catch-all status;
// tests/app/spaRoutingStatus.test.ts only proves the committed configuration.
const notFoundProbe = '/__production-not-found-probe__'
const notFoundResponse = await fetchText(notFoundProbe, 404)
assertEqual(notFoundResponse.body, root.body, `SPA shell for ${notFoundProbe}`)
console.log(`${notFoundProbe}: PASS (404)`)

const assetPaths = discoverAssets(root.body)
if (assetPaths.length === 0) stop('No JavaScript or CSS assets were found.')

const javascriptBodies = []
for (const assetPath of assetPaths) {
  const asset = await fetchText(assetPath)
  if (assetPath.endsWith('.js')) javascriptBodies.push(asset.body)
  console.log(`${assetPath}: PASS`)
}

const completeSupabaseUrls = new Set()
for (const body of javascriptBodies) {
  for (const match of body.matchAll(
    /https:\/\/([a-z0-9-]+)\.supabase\.co/g,
  )) {
    completeSupabaseUrls.add(match[0])
  }
}

const expectedSupabaseUrl =
  `https://${expectedSupabaseRef}.supabase.co`
const developmentSupabaseUrl =
  `https://${DEVELOPMENT_SUPABASE_REF}.supabase.co`

if (!completeSupabaseUrls.has(expectedSupabaseUrl)) {
  stop(`Expected Supabase endpoint ${expectedSupabaseUrl} was not found.`)
}

if (
  expectedSupabaseRef !== DEVELOPMENT_SUPABASE_REF &&
  completeSupabaseUrls.has(developmentSupabaseUrl)
) {
  stop('The complete development Supabase endpoint is present in the bundle.')
}

const unexpectedSupabaseUrls = [...completeSupabaseUrls].filter(
  (value) => value !== expectedSupabaseUrl,
)
if (unexpectedSupabaseUrls.length > 0) {
  stop(
    `Unexpected Supabase endpoints: ${unexpectedSupabaseUrls.join(', ')}`,
  )
}

console.log('Supabase endpoint isolation: PASS')
console.log('PRODUCTION ANONYMOUS HTTP SMOKE: PASSED')

/**
 * Transport failures are retried; findings are not.
 *
 * A dropped socket or a TLS reset says nothing about the deployment — but it
 * used to fail the whole smoke, including against production. A red that means
 * nothing is worse than no check, because it teaches people to ignore red.
 *
 * Only the `catch` path below retries. A wrong status, a wrong header, a wrong
 * release identity or an unexpected redirect are real findings and still fail
 * on the first response: retrying those would mask exactly what this smoke
 * exists to catch. A genuine outage still fails, a few seconds later.
 */
const TRANSPORT_ATTEMPTS = 3
const TRANSPORT_RETRY_DELAY_MS = 2_000

async function fetchText(pathname, expectedStatus = 200) {
  const url = new URL(pathname, `${origin}/`)
  let response
  let lastTransportError

  for (let attempt = 1; attempt <= TRANSPORT_ATTEMPTS; attempt += 1) {
    try {
      response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
        headers: { 'user-agent': 'euro28-production-smoke/1' },
      })
      break
    } catch (error) {
      lastTransportError = error
      if (attempt < TRANSPORT_ATTEMPTS) {
        console.warn(
          `Transport failure for ${url} (attempt ${attempt}/${TRANSPORT_ATTEMPTS}): ` +
            `${errorMessage(error)}. Retrying.`,
        )
        await delay(TRANSPORT_RETRY_DELAY_MS)
      }
    }
  }

  if (!response) {
    stop(
      `Request failed for ${url} after ${TRANSPORT_ATTEMPTS} attempts: ` +
        `${errorMessage(lastTransportError)}`,
    )
  }

  if (response.status !== expectedStatus) {
    stop(
      `${url} returned HTTP ${response.status}; expected ${expectedStatus}.`,
    )
  }

  const finalUrl = new URL(response.url)
  if (finalUrl.origin !== origin) {
    stop(`${url} redirected to unexpected origin ${finalUrl.origin}.`)
  }

  return {
    body: await response.text(),
    headers: response.headers,
  }
}

/**
 * The security headers committed in netlify.toml.
 *
 * Read from the repository the smoke is running out of, so the deployed
 * response can be compared against what this commit intends to serve rather
 * than against a second hand-maintained copy.
 */
function committedHeaders() {
  const config = readFileSync(
    fileURLToPath(new URL('../netlify.toml', import.meta.url)),
    'utf8',
  )
  const block = config.slice(config.indexOf('[headers.values]'))
  const values = new Map()
  for (const [, name, value] of block.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"/gm)) {
    values.set(name.toLowerCase(), value)
  }
  if (values.size === 0) stop('netlify.toml declares no security headers to compare against.')
  return values
}

/** A CSP string as directive name → set of sources. */
function cspDirectives(policy) {
  const parsed = new Map()
  for (const directive of policy.split(';')) {
    const [name, ...sources] = directive.trim().split(/\s+/)
    if (name) parsed.set(name.toLowerCase(), new Set(sources))
  }
  return parsed
}

/**
 * Every committed directive must be served, with exactly the sources committed.
 *
 * A missing directive and an extra source are both weakenings, and neither was
 * detectable before: the deployed policy was checked for four named directives
 * out of thirteen and for the absence of 'unsafe-eval'. A served policy that had
 * lost `script-src` entirely, or widened `connect-src` to `*`, passed.
 */
function verifyContentSecurityPolicyParity(served, committed) {
  const servedDirectives = cspDirectives(served)
  const committedDirectives = cspDirectives(committed)

  for (const [name, expected] of committedDirectives) {
    const actual = servedDirectives.get(name)
    if (!actual) {
      stop(`Content-Security-Policy is missing the committed directive ${name}.`)
    }

    const missing = [...expected].filter((source) => !actual.has(source))
    const extra = [...actual].filter((source) => !expected.has(source))

    if (missing.length > 0) {
      stop(`CSP ${name} is missing committed sources: ${missing.join(' ')}.`)
    }
    if (extra.length > 0) {
      stop(`CSP ${name} serves sources that are not committed: ${extra.join(' ')}.`)
    }
  }
}

function verifySecurityHeaders(headers) {
  // Absolute requirements first. These hold whatever netlify.toml says, so a
  // change that weakened both the committed policy and the deployment together
  // still fails here — parity alone would call that a match.
  assertEqual(headers.get('x-frame-options'), 'DENY', 'X-Frame-Options')
  assertEqual(
    headers.get('x-content-type-options'),
    'nosniff',
    'X-Content-Type-Options',
  )
  assertEqual(
    headers.get('referrer-policy'),
    'strict-origin-when-cross-origin',
    'Referrer-Policy',
  )

  const hsts = headers.get('strict-transport-security') || ''
  assertIncludes(hsts.toLowerCase(), 'max-age=31536000', 'HSTS max-age')
  assertIncludes(hsts.toLowerCase(), 'includesubdomains', 'HSTS subdomains')

  const csp = headers.get('content-security-policy') || ''
  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ]) {
    assertIncludes(csp, directive, `CSP directive ${directive}`)
  }

  if (csp.includes("'unsafe-eval'")) {
    stop("Content-Security-Policy permits 'unsafe-eval'.")
  }

  // Then parity with what this commit declares. `netlify.toml` is the only
  // place the policy is written, but it is not the only place a header can come
  // from — a `_headers` file, a dashboard override or a proxy in front can all
  // change what a browser actually receives, and only the received policy
  // protects anyone.
  const committed = committedHeaders()

  const committedCsp = committed.get('content-security-policy')
  if (!committedCsp) stop('netlify.toml declares no Content-Security-Policy.')
  verifyContentSecurityPolicyParity(csp, committedCsp)

  // Two headers were declared and never verified against a real response.
  for (const name of ['permissions-policy', 'x-xss-protection']) {
    assertEqual(headers.get(name), committed.get(name), `${name} (committed parity)`)
  }

  console.log('Security headers: PASS')
}

function discoverAssets(html) {
  return [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)]
    .map((match) => match[1])
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort()
}

function normaliseOrigin(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    stop(`Invalid smoke origin: ${value}`)
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    stop('Smoke origin must be an HTTPS origin without credentials.')
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    stop('Smoke origin must not contain a path, query or fragment.')
  }

  return url.origin
}

function parseExpectedContract(value) {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    stop(
      'EURO28_SMOKE_EXPECTED_CONTRACT must be an explicit positive integer.',
    )
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    stop('EURO28_SMOKE_EXPECTED_CONTRACT is outside the safe integer range.')
  }

  return parsed
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    stop(`${label} expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}.`)
  }
}

function assertNotEqual(actual, unwanted, label) {
  if (actual === unwanted) {
    stop(`${label} unexpectedly equals ${JSON.stringify(unwanted)}.`)
  }
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    stop(`${label} is missing ${JSON.stringify(expected)}.`)
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

/** @param {number} ms */
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function stop(message) {
  console.error(`STOP: ${message}`)
  process.exit(1)
}
