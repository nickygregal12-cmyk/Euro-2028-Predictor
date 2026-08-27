import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { resolveSiteCookie } from './production-site-session.mjs'

const PRODUCTION_ORIGIN = 'https://euro28predictor.com'
const PRODUCTION_SUPABASE_REF = 'vkfnsqdyhvtwyqkisxhk'
const DEVELOPMENT_SUPABASE_REF = 'iouzoutneyjpugbbtdem'

/**
 * Transport failures are retried; findings are not.
 *
 * A dropped socket or a TLS reset says nothing about the deployment — but it
 * used to fail the whole smoke, including against production. A red that means
 * nothing is worse than no check, because it teaches people to ignore red.
 *
 * Only the `catch` path in `fetchText` retries. A wrong status, a wrong header,
 * a wrong release identity or an unexpected redirect are real findings and
 * still fail on the first response: retrying those would mask exactly what this
 * smoke exists to catch. A genuine outage still fails, a few seconds later.
 *
 * These live at the top of the module on purpose. The checks below run at
 * import time, so a `const` declared next to `fetchText` further down is still
 * in its temporal dead zone when the first check calls it — the function
 * declaration hoists, the constant does not.
 */
const TRANSPORT_ATTEMPTS = 3
const TRANSPORT_RETRY_DELAY_MS = 2_000

/**
 * Stands in for a route parameter or wildcard segment. Any value works: the
 * assertion is that the edge serves the SPA shell, and which entity the slug
 * names is decided client-side after the shell loads.
 */
const ROUTE_PROBE = 'PRODUCTION-READ-ONLY-PROBE'

/**
 * Which product each production origin must serve, and — just as importantly —
 * which one it must NOT.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A MAP AND NOT A CONSTANT, AND WHY THE ABSENCE HALF MATTERS
 * ---------------------------------------------------------------------------
 *
 * This assertion used to be one hard-coded string, `Football Prediction Hub`,
 * with a comment retiring a "dual-brand allowance" that had accepted
 * `Euro 2028 Predictor` as a LEGACY title from the contract-63 era. That was
 * correct when both Netlify projects shipped the same product.
 *
 * ADR 0026's site-variant seam then made `Euro 2028 Predictor` the CURRENT and
 * correct title of the Euro deployment — resurrecting the very string the
 * comment had just declared obsolete, for an entirely different reason. From
 * that moment the smoke asserted the Hub's brand against the Euro site. It
 * failed on the first Euro production build after the split: run 31574100495,
 * 12 August 2026, `STOP: application title is missing "Football Prediction
 * Hub"`, against a deploy serving the expected commit at the expected contract.
 *
 * So the expectation is now derived from the origin under test. The **absence**
 * check is the part worth having: `validate-netlify-environment.mjs` refuses a
 * VITE_SITE_VARIANT that is neither `hub` nor `euro`, but an ABSENT value fails
 * closed to the Hub — so a wiped variable would silently publish the weekly
 * platform onto euro28predictor.com and every other check here would pass. This
 * is the assertion that catches it.
 *
 * IT IS ALSO THE PERIMETER. The same map decides which origins this script will
 * smoke at all, so a production site cannot be reachable by the origin guard
 * and unknown to the brand check — the two would then disagree about what
 * "production" means. `playwright.production.config.ts` and
 * `production-smoke/anonymous.spec.ts` carry the same list, and
 * `tests/scripts/productionSmokePerimeter` compares all three against
 * `siteConfiguration()`, which is what the running application reads.
 */
const PRODUCTION_SITES = new Map([
  ['https://euro28predictor.com', 'Euro 2028 Predictor'],
  ['https://predictorhub.netlify.app', 'Predictor Hub'],
])

const EVERY_PRODUCT = [...new Set(PRODUCTION_SITES.values())]

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

if (!PRODUCTION_SITES.has(origin) && !allowNonProduction) {
  stop(
    `Refusing to smoke-test non-production origin ${origin}. ` +
      'Set EURO28_SMOKE_ALLOW_NON_PRODUCTION=true only for an intentional preview check.',
  )
}

/**
 * Which brand this origin must serve. A known production origin answers for
 * itself; a preview must SAY, because guessing would let a preview of the wrong
 * variant pass. There is deliberately no default for an unknown origin, and the
 * absence is refused inside `assertServesItsOwnProduct` rather than here — a
 * stop at import time would pre-empt the transport-retry path that
 * `productionSmokeResilience` drives against an unreachable origin, and would
 * make every preview check declare a brand before it could fail honestly. The
 * run still cannot pass without it: that assertion is unconditional.
 */
const expectedBrand =
  process.env.EURO28_SMOKE_EXPECTED_BRAND || PRODUCTION_SITES.get(origin) || ''

/**
 * The site session, opened once and attached to every request below.
 *
 * Declared here rather than beside `fetchText` for the reason at the top of
 * this file: the checks run at import time, so a `const` further down would
 * still be in its temporal dead zone when the first check calls it.
 *
 * An empty password means "no protection expected" and leaves every request
 * anonymous, which is what a preview check against an open origin wants.
 */
const siteCookie = await resolveSiteCookie(
  origin,
  process.env.EURO28_SITE_PASSWORD || '',
)

console.log(`Checking ${origin}${siteCookie ? ' with a site session' : ' anonymously'}`)

const root = await fetchText('/')
assertIncludes(root.body, '<div id="root"></div>', 'React root')
assertServesItsOwnProduct(root.body)
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

const routes = committedOkRoutes()

/**
 * The document each address is expected to serve, fetched once and reused.
 *
 * `/index.html` is seeded from the root fetch above rather than requested
 * again: `/` is a 200 redirect to it, and it is already the body every other
 * check in this file compares against.
 */
const servedDocuments = new Map([['/index.html', root.body]])

for (const { from, to } of routes) {
  const expected = await servedDocument(to)
  const response = await fetchText(from)
  assertEqual(response.body, expected, `document served at ${from} (expected ${to})`)
  console.log(`${from}: PASS`)
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

async function fetchText(pathname, expectedStatus = 200) {
  const url = new URL(pathname, `${origin}/`)
  let response
  let lastTransportError

  for (let attempt = 1; attempt <= TRANSPORT_ATTEMPTS; attempt += 1) {
    try {
      response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'user-agent': 'euro28-production-smoke/1',
          ...(siteCookie ? { cookie: siteCookie } : {}),
        },
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
  // THE SITE-WIDE BLOCK SPECIFICALLY, not the first one in the file.
  // `netlify.toml` now declares more than one `[[headers]]` rule — `/sw.js`
  // gets its own cache directive — and slicing from the first
  // `[headers.values]` would read that one's values first and let a future
  // path-scoped block shadow a security header that is only declared for `/*`.
  // The security headers this compares against are the site-wide ones.
  const siteWide = config.indexOf('for = "/*"')
  if (siteWide === -1) stop('netlify.toml declares no site-wide [[headers]] rule.')
  const block = config.slice(config.indexOf('[headers.values]', siteWide))
  const values = new Map()
  for (const [, name, value] of block.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"/gm)) {
    values.set(name.toLowerCase(), value)
  }
  if (values.size === 0) stop('netlify.toml declares no security headers to compare against.')
  return values
}

/**
 * The body served at one of netlify.toml's redirect TARGETS, fetched at most
 * once per target.
 *
 * A target is a real file in the publish directory — `/index.html`,
 * `/join.html`, `/status.html` — so Netlify serves it directly and the
 * catch-all never sees the request. That is what makes it usable as the
 * expectation: it is the document the deployment holds, read from the
 * deployment, rather than a second description of what the document should
 * contain.
 */
async function servedDocument(target) {
  const cached = servedDocuments.get(target)
  if (cached !== undefined) return cached

  const { body } = await fetchText(target)
  servedDocuments.set(target, body)
  return body
}

/**
 * Every route netlify.toml says must answer 200, derived rather than restated,
 * WITH THE DOCUMENT EACH ONE POINTS AT.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TARGET IS RETURNED AND NOT DISCARDED
 * ---------------------------------------------------------------------------
 *
 * This function used to return bare paths and the caller compared every one of
 * them against `/`. That held for as long as every 200 rule pointed at
 * `/index.html`, and it stopped holding twice:
 *
 *   * `/join/:code` → `/join.html` (#1007), the invite share card — the SAME
 *     document re-headed at build time, so a crawler unfurling a pasted invite
 *     shows an invitation rather than the site's own card;
 *   * `/status` → `/status.html` (#1018), the static status document, which has
 *     to stay readable on the one occasion anybody reads it: when the
 *     application does not boot.
 *
 * Both are deliberate, both are tested in the committed configuration by
 * `tests/app/spaRoutingStatus.test.ts` — whose own comment says `to` "was
 * always captured and never declared, because until now every rule pointed at
 * the same document" — and neither was ever taught to this file. So the
 * scheduled production health check went red on a correct deployment and stayed
 * red: every run from 25 August onward failed at `/join/...` with a diff whose
 * two sides were both exactly right.
 *
 * Comparing each address against its OWN target is not merely a repair. It is a
 * stronger assertion than the one it replaces: `/join/:code` now has to serve
 * the invite card rather than merely serve something, so a build that stopped
 * emitting `join.html` and fell back to `index.html` fails here instead of
 * silently unfurling the wrong preview.
 *
 * This list used to be written out by hand here, and it drifted. It still
 * demanded 200 for `/predict` — a route the application no longer declares and
 * which netlify.toml deliberately sends to the 404 catch-all, along with the
 * other retired Euro/tournament paths. Nothing caught it, because the smoke
 * could not run against the password-protected site at all; the first
 * authenticated run, on 10 August 2026, failed on exactly that line.
 *
 * Deriving it removes the whole class rather than the one instance, and it is
 * the same principle `committedHeaders()` above already applies: compare the
 * deployment against the configuration this commit intends to serve, never
 * against a second hand-maintained copy of it.
 *
 * `tests/app/spaRoutingStatus.test.ts` separately proves netlify.toml agrees
 * with the routes `src/App.tsx` declares, so the chain runs application →
 * configuration → deployment with no hand-copied link in it.
 */
function committedOkRoutes() {
  const config = readFileSync(
    fileURLToPath(new URL('../netlify.toml', import.meta.url)),
    'utf8',
  )

  const routes = []
  for (const [, from, to, status] of config.matchAll(
    /\[\[redirects\]\]\s*\n\s*from = "([^"]+)"\s*\n\s*to = "([^"]+)"\s*\n\s*status = (\d+)/g,
  )) {
    // The catch-all is a 404 by design (SEO-001) and is probed separately.
    if (status !== '200') continue
    // The root is already fetched as the document every other route resolves to.
    if (from === '/') continue

    routes.push({
      from: from.replace(/:[A-Za-z]+/g, ROUTE_PROBE).replace(/\/\*$/, `/${ROUTE_PROBE}`),
      to,
    })
  }

  if (routes.length === 0) stop('netlify.toml declares no 200 redirect rules to check.')
  return routes
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

/**
 * The served document must name the product this origin is for, and must not
 * name the other one.
 *
 * An unknown host is refused rather than waved through: this smoke exists to
 * check a named production origin, and quietly skipping the strongest
 * variant assertion for an origin nobody listed is how it would rot again.
 *
 * @param {string} body
 */
function assertServesItsOwnProduct(body) {
  if (!expectedBrand) {
    stop(
      `no expected product is declared for ${origin}. Add it to PRODUCTION_SITES, ` +
        'or set EURO28_SMOKE_EXPECTED_BRAND for a preview, rather than smoking ' +
        'an origin whose variant nothing checks.',
    )
  }

  assertIncludes(body, expectedBrand, `application title for ${origin}`)

  for (const other of EVERY_PRODUCT) {
    if (other === expectedBrand) continue
    if (body.includes(other)) {
      stop(
        `${origin} served ${JSON.stringify(other)} as well as ` +
          `${JSON.stringify(expectedBrand)}. The deployments must be separate ` +
          'products; check VITE_SITE_VARIANT on this Netlify project, because ' +
          'an unset value fails closed to the Hub.',
      )
    }
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
