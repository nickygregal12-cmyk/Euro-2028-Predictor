import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { resolveSiteCookie } from './production-site-session.mjs'

const PRODUCTION_SUPABASE_REF = 'vkfnsqdyhvtwyqkisxhk'
const ALLOWED_ORIGINS = new Set([
  'https://euro28predictor.com',
  'https://predictorhub.netlify.app',
])

const origin = normaliseOrigin(process.env.EURO28_HEALTH_ORIGIN || '')
const password = process.env.EURO28_SITE_PASSWORD || ''

if (!ALLOWED_ORIGINS.has(origin)) {
  stop(`Refusing to health-check unknown origin ${origin || '(missing)'}.`)
}
if (!password) {
  stop('EURO28_SITE_PASSWORD is required for the protected production health check.')
}

const cookie = await resolveSiteCookie(origin, password)
const release = await fetchRelease(origin, cookie)
const servedContract = positiveInteger(release.applicationContract, 'application contract')

// Do not compare to main: repository main may legitimately be ahead of the
// currently published production bundle. The existing production smoke already
// asserts applicationContract === hostedContract; by feeding it the contract
// actually served at the start of this run, this scheduled check detects
// internal production drift without turning an undeployed main commit red.
const smokePath = fileURLToPath(new URL('./production-smoke.mjs', import.meta.url))
const exitCode = await runNode(smokePath, {
  ...process.env,
  EURO28_SMOKE_ORIGIN: origin,
  EURO28_SMOKE_EXPECTED_CONTEXT: 'production',
  EURO28_SMOKE_EXPECTED_SUPABASE_REF: PRODUCTION_SUPABASE_REF,
  EURO28_SMOKE_EXPECTED_CONTRACT: String(servedContract),
  EURO28_SMOKE_EXPECTED_COMMIT: '',
})

if (exitCode !== 0) {
  process.exit(exitCode)
}

console.log(`SCHEDULED PRODUCTION HEALTH: PASS (${origin})`)

async function fetchRelease(siteOrigin, cookieHeader) {
  let response
  try {
    response = await fetch(`${siteOrigin}/release.json`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'user-agent': 'euro28-production-health/1',
        cookie: cookieHeader,
      },
    })
  } catch (error) {
    stop(`release.json transport failure: ${errorMessage(error)}`)
  }

  if (response.status !== 200) {
    stop(`release.json returned HTTP ${response.status}; expected 200.`)
  }

  const finalUrl = new URL(response.url)
  if (finalUrl.origin !== siteOrigin) {
    stop(`release.json redirected to unexpected origin ${finalUrl.origin}.`)
  }

  let release
  try {
    release = await response.json()
  } catch (error) {
    stop(`release.json is not valid JSON: ${errorMessage(error)}`)
  }

  if (!release || typeof release !== 'object') {
    stop('release.json did not contain an object.')
  }
  return release
}

function positiveInteger(value, label) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    stop(`Served ${label} is not a positive integer.`)
  }
  return parsed
}

function runNode(scriptPath, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      env,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`production smoke terminated by ${signal}`))
        return
      }
      resolve(code ?? 1)
    })
  })
}

function normaliseOrigin(value) {
  try {
    const url = new URL(value)
    return url.origin
  } catch {
    return ''
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function stop(message) {
  console.error(`STOP: ${message}`)
  process.exit(1)
}
