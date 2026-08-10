/**
 * Waits for production to be serving the exact release the caller expects.
 *
 * This used to be an inline `curl` loop in `production-smoke.yml`. It moved
 * here when the site became password protected, because the poll now needs a
 * session and the session cookie is a runtime-minted JWT that GitHub does not
 * mask. Keeping the whole exchange inside one Node process means the JWT never
 * becomes a shell variable, never reaches a `run:` line and never risks a
 * diagnostic dump.
 *
 * It asserts identity, not merely reachability: a 200 that is really the login
 * page, or a 200 from a previous release, both fail here.
 */

import process from 'node:process'
import { resolveSiteCookie } from './production-site-session.mjs'

const ATTEMPTS = 120
const DELAY_MS = 5_000

const origin = (process.env.EURO28_SMOKE_ORIGIN || 'https://euro28predictor.com').replace(/\/+$/, '')
const expectedEnvironment = process.env.EURO28_SMOKE_EXPECTED_CONTEXT || 'production'
const expectedSupabaseRef = process.env.EURO28_SMOKE_EXPECTED_SUPABASE_REF || ''
const expectedCommit = process.env.EURO28_SMOKE_EXPECTED_COMMIT || ''
const expectedContract = Number(process.env.EURO28_SMOKE_EXPECTED_CONTRACT)
const sitePassword = process.env.EURO28_SITE_PASSWORD || ''

if (!/^[0-9a-f]{40}$/.test(expectedCommit)) {
  stop('EURO28_SMOKE_EXPECTED_COMMIT must be an exact 40-character Git SHA.')
}

if (!Number.isInteger(expectedContract) || expectedContract < 1) {
  stop('EURO28_SMOKE_EXPECTED_CONTRACT must be a positive integer.')
}

if (!expectedSupabaseRef) {
  stop('EURO28_SMOKE_EXPECTED_SUPABASE_REF must name the expected Supabase project.')
}

const cookie = await resolveSiteCookie(origin, sitePassword)
console.log(
  cookie
    ? `Authenticated against ${origin}; waiting for contract ${expectedContract} at ${expectedCommit}.`
    : `No site password supplied; polling ${origin} anonymously.`,
)

let lastReason = 'no attempt was made'

for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  const reason = await checkOnce()
  if (reason === null) {
    console.log(`Production is serving the expected release (attempt ${attempt}/${ATTEMPTS}).`)
    process.exit(0)
  }

  lastReason = reason
  console.log(`Not the expected release yet (attempt ${attempt}/${ATTEMPTS}): ${reason}`)
  if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
}

stop(`Netlify production did not publish the expected release identity. Last reason: ${lastReason}`)

/**
 * @returns {Promise<string | null>} null when the release matches, otherwise a
 *   short reason. The reason never contains a response body: an unauthenticated
 *   body is a login page and an authenticated one is site content.
 */
async function checkOnce() {
  let response
  try {
    response = await fetch(`${origin}/release.json`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'user-agent': 'euro28-production-smoke/1',
        ...(cookie ? { cookie } : {}),
      },
    })
  } catch (error) {
    return `transport failure: ${error instanceof Error ? error.message : String(error)}`
  }

  if (response.status !== 200) return `HTTP ${response.status}`

  let release
  try {
    release = JSON.parse(await response.text())
  } catch {
    // The single most valuable check here. A password-protected site answers a
    // login page, and Netlify can serve it with a 200. A poll that trusted the
    // status alone would call that a successful release.
    return 'response was not JSON, which is what a login page looks like from here'
  }

  const mismatches = []
  if (release.environment !== expectedEnvironment) {
    mismatches.push(`environment ${JSON.stringify(release.environment)}`)
  }
  if (release.applicationContract !== expectedContract) {
    mismatches.push(`applicationContract ${JSON.stringify(release.applicationContract)}`)
  }
  if (release.hostedContract !== expectedContract) {
    mismatches.push(`hostedContract ${JSON.stringify(release.hostedContract)}`)
  }
  if (release.supabaseProjectRef !== expectedSupabaseRef) {
    mismatches.push(`supabaseProjectRef ${JSON.stringify(release.supabaseProjectRef)}`)
  }
  if (release.commit !== expectedCommit) {
    mismatches.push(`commit ${JSON.stringify(release.commit)}`)
  }
  if (release.commit === 'local' || release.deployId === 'local') {
    mismatches.push('release identity reports a local build')
  }

  return mismatches.length === 0 ? null : mismatches.join(', ')
}

/** @param {string} message */
function stop(message) {
  console.error(`STOP: ${message}`)
  process.exit(1)
}
