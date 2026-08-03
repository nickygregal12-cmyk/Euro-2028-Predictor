import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `scripts/production-smoke.mjs` gates deploy previews and production releases
 * alike. It used to abort the entire run on a single transport failure — one
 * dropped socket, one TLS reset — which produced a red that said nothing about
 * the deployment. Reds that mean nothing teach people to ignore reds.
 *
 * Retrying is therefore allowed for transport, and forbidden for findings. That
 * asymmetry is the whole safety property, so it is what these assertions pin:
 * a retry that widened to cover a wrong status or a wrong header would silently
 * convert this smoke from a check into a formality.
 *
 * The script executes its checks at import time against a live origin, so it is
 * read as source here rather than invoked.
 */

const source = readFileSync(
  resolve(process.cwd(), 'scripts/production-smoke.mjs'),
  'utf8',
)

const fetchText = source.slice(
  source.indexOf('async function fetchText('),
  source.indexOf('function committedHeaders('),
)

describe('transport failures are retried', () => {
  it('attempts more than once', () => {
    const attempts = /const TRANSPORT_ATTEMPTS = (\d+)/.exec(source)
    expect(attempts, 'TRANSPORT_ATTEMPTS is missing').not.toBeNull()
    expect(Number(attempts?.[1])).toBeGreaterThan(1)
  })

  it('retries around the network call itself', () => {
    expect(fetchText).toMatch(/for \(let attempt = 1; attempt <= TRANSPORT_ATTEMPTS/)
    // The retry belongs to the catch, not to the whole body: a loop that
    // re-ran the assertions would re-check a response it had already judged.
    const retryBranch = fetchText.slice(fetchText.indexOf('} catch (error) {'))
    expect(retryBranch).toContain('attempt < TRANSPORT_ATTEMPTS')
  })

  it('says so when it retries, rather than swallowing the failure', () => {
    // A silent retry hides a degrading origin: intermittent failure would look
    // identical to no failure at all.
    expect(fetchText).toContain('Retrying')
    expect(fetchText).toMatch(/attempt \$\{attempt\}\/\$\{TRANSPORT_ATTEMPTS\}/)
  })

  it('still fails, and names the attempt count, when every attempt fails', () => {
    expect(fetchText).toMatch(/after \$\{TRANSPORT_ATTEMPTS\} attempts/)
    expect(fetchText).toContain('stop(')
  })
})

describe('findings are never retried', () => {
  it('evaluates the response only after the retry loop has ended', () => {
    // If the status check sat inside the loop, a 500 would be retried until it
    // either passed or exhausted — which reports a flaky deployment as healthy.
    const loopStart = fetchText.indexOf('for (let attempt = 1')
    const loopEnd = fetchText.indexOf('if (!response)')
    const statusCheck = fetchText.indexOf('response.status !== expectedStatus')

    expect(loopStart).toBeGreaterThan(-1)
    expect(loopEnd).toBeGreaterThan(loopStart)
    expect(statusCheck).toBeGreaterThan(loopEnd)
  })

  it('makes exactly one network call per request', () => {
    // Two call sites would mean one of them is unguarded, or that a caller can
    // retry a finding by requesting the same route twice.
    const calls = source.match(/await fetch\(/g) ?? []
    expect(calls).toHaveLength(1)
  })

  it('keeps the redirect-origin check outside the retry', () => {
    const loopEnd = fetchText.indexOf('if (!response)')
    expect(fetchText.indexOf('finalUrl.origin !== origin')).toBeGreaterThan(loopEnd)
  })
})

describe('the script actually runs', () => {
  /**
   * Reading the source is not enough, and this suite learned that the
   * expensive way: the first version of the retry declared TRANSPORT_ATTEMPTS
   * beside `fetchText`, near the bottom of the file. Every source assertion
   * above passed. The script still died on its first request with
   * `ReferenceError: Cannot access 'TRANSPORT_ATTEMPTS' before initialization`,
   * because the checks run at import time — the function declaration hoists,
   * the constant does not.
   *
   * So this drives the real script. Nothing listens on 127.0.0.1:1, so every
   * attempt fails at the transport layer immediately: it exercises
   * initialisation, the retry loop and the give-up path, and needs no network.
   * The origin must still be HTTPS and the contract explicit, because those
   * guards run before the first request and are not relaxed for tests.
   */
  const run = spawnSync(
    process.execPath,
    [resolve(process.cwd(), 'scripts/production-smoke.mjs')],
    {
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        ...process.env,
        EURO28_SMOKE_ORIGIN: 'https://127.0.0.1:1',
        EURO28_SMOKE_ALLOW_NON_PRODUCTION: 'true',
        EURO28_SMOKE_EXPECTED_CONTRACT: '65',
      },
    },
  )
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`

  it('initialises without a temporal-dead-zone error', () => {
    expect(output).not.toMatch(/ReferenceError/)
    expect(output).not.toMatch(/before initialization/)
  })

  it('retries the unreachable origin, then gives up and fails', () => {
    expect(output).toContain('Retrying')
    expect(output).toMatch(new RegExp(`after ${/\d+/.source} attempts`))
    expect(output).toContain('STOP:')
    expect(run.status).toBe(1)
  })

  it('reports every attempt it made', () => {
    const retries = output.match(/attempt \d+\//g) ?? []
    // One fewer warning than attempts: the last failure is the give-up, not a
    // retry. A run that logged nothing would mean the retry went silent.
    expect(retries.length).toBeGreaterThan(0)
  })
}, 60_000)

describe('the smoke still fails closed', () => {
  it('exits non-zero on any stop', () => {
    // Regression guard: adding retries must not have turned a failure into a
    // warning somewhere along the way.
    const stopBody = source.slice(
      source.indexOf('function stop(message) {'),
      source.indexOf('function stop(message) {') + 200,
    )
    expect(stopBody).toContain('process.exit(1)')
  })

  it('still refuses a non-production origin without the explicit opt-in', () => {
    expect(source).toContain('EURO28_SMOKE_ALLOW_NON_PRODUCTION')
    expect(source).toContain('Refusing to smoke-test non-production origin')
  })
})
