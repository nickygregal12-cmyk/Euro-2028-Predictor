/**
 * Writes a Playwright `storageState` file carrying the site session cookie, so
 * the browser smoke can reach a password-protected origin.
 *
 * A file rather than an environment variable, deliberately. The cookie is a
 * runtime-minted JWT that GitHub does not mask, and an environment variable
 * survives for the whole job and can be caught by any diagnostic that dumps the
 * environment. A file can be written under the runner's temporary directory and
 * shredded in an `always()` step, which is what `production-smoke.yml` does.
 *
 * Usage: node scripts/write-production-storage-state.mjs <output-path>
 */

import { writeFileSync } from 'node:fs'
import process from 'node:process'
import { resolveSiteCookie, storageStateFrom } from './production-site-session.mjs'

const [outputPath] = process.argv.slice(2)

if (!outputPath) {
  console.error('STOP: an output path is required.')
  process.exit(1)
}

const origin = (process.env.EURO28_SMOKE_ORIGIN || 'https://euro28predictor.com').replace(/\/+$/, '')
const sitePassword = process.env.EURO28_SITE_PASSWORD || ''

if (!sitePassword) {
  console.error(
    'STOP: EURO28_SITE_PASSWORD is empty. Refusing to write an unauthenticated storage state, ' +
      'because the browser smoke would then fail on the login page and report it as a broken release.',
  )
  process.exit(1)
}

const cookie = await resolveSiteCookie(origin, sitePassword)
const state = storageStateFrom(cookie, origin)

if (state.cookies.length === 0) {
  console.error('STOP: the site login returned no usable cookie.')
  process.exit(1)
}

writeFileSync(outputPath, JSON.stringify(state), { mode: 0o600 })

// Cookie NAMES only. The values are the session.
console.log(
  `Wrote a storage state for ${origin} carrying ${state.cookies.length} cookie(s): ` +
    `${state.cookies.map((entry) => entry.name).join(', ')}.`,
)
