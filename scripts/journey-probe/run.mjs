#!/usr/bin/env node
// Walks the acquisition journey against one origin and writes the record.
//
//   node scripts/journey-probe/run.mjs --origin https://deploy-preview-1--x.netlify.app
//   node scripts/journey-probe/run.mjs --origin ... --write config/journey-probe-record.json
//
// ANONYMOUS AND READ-ONLY. No credential is read, sent or accepted — not even
// optionally, because an optional one becomes a required one the first time
// somebody debugs a failure. Production currently answers 401 to everyone
// (production-anonymous-smoke asserts exactly that), so pointing this at
// production without its password reports a journey nobody can take. That is a
// true answer to a question worth asking, and the runner says so rather than
// pretending the site is broken.
//
// TRANSPORT FAILURES ARE RETRIED; FINDINGS ARE NOT. The same rule
// production-smoke.mjs arrived at, and for the same reason: a dropped socket
// says nothing about the deployment, while a red that means nothing teaches
// people to ignore red. A wrong status or a missing marker fails first time.

import { writeFileSync } from 'node:fs'
import { evaluateJourney, JOURNEY_CHECKS } from './checks.mjs'

const TRANSPORT_ATTEMPTS = 3
const TIMEOUT_MS = 20_000

/** @param {string} name */
function argument(name) {
  const flag = `--${name}=`
  const inline = process.argv.find((value) => value.startsWith(flag))
  if (inline) return inline.slice(flag.length)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

/** @param {number} ms */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @param {string} origin
 * @param {string} path
 */
async function fetchStep(origin, path) {
  let lastTransportError = ''

  for (let attempt = 1; attempt <= TRANSPORT_ATTEMPTS; attempt++) {
    const started = Date.now()
    try {
      const response = await fetch(`${origin}${path}`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': 'euro28-journey-probe' },
      })
      const body = await response.text()
      return {
        milliseconds: Date.now() - started,
        response: { status: response.status, body },
      }
    } catch (error) {
      lastTransportError = error instanceof Error ? error.message : String(error)
      if (attempt < TRANSPORT_ATTEMPTS) await delay(attempt * 1000)
    }
  }

  return { milliseconds: 0, transportError: lastTransportError, response: null }
}

async function main() {
  const origin = (argument('origin') ?? '').replace(/\/$/, '')
  if (!origin) {
    console.error('STOP: --origin is required, e.g. --origin https://example.netlify.app')
    process.exitCode = 1
    return
  }

  const results = []
  for (const check of JOURNEY_CHECKS) {
    const fetched = await fetchStep(origin, check.path)
    results.push({ id: check.id, ...fetched })
  }

  const journey = evaluateJourney(results)
  const record = {
    // A snapshot, and the document that renders it must say so. `checkedAt` is
    // the moment this describes; it is never "now" to a reader.
    checkedAt: new Date().toISOString(),
    origin,
    ok: journey.ok,
    steps: journey.steps,
  }

  const target = argument('write')
  if (target) {
    writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`)
    console.log(`Wrote ${target}`)
  }

  for (const step of journey.steps) {
    const mark = step.ok ? 'ok  ' : 'FAIL'
    console.log(`${mark} ${step.step} (${step.path}, ${step.milliseconds}ms)`)
    if (!step.ok) console.log(`     ${step.reason}`)
  }
  console.log(journey.ok ? '\nThe journey is walkable.' : '\nThe journey is broken.')

  if (!journey.ok) process.exitCode = 1
}

await main()
