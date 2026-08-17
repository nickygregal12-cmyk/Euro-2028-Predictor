import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  authorized,
  constantTimeEqual,
} from '../../supabase/functions/provider-poll/authorization'

/**
 * The `provider-poll` authorisation rule, executed rather than read.
 *
 * WHAT THIS EXISTS FOR. Before this file the only thing that ever RAN the rule
 * was one step in `.github/workflows/database-parity.yml`, which curls the
 * deployed function with no `apikey` and asserts a 401. The two tests that named
 * the rule asserted on text: `databaseParityWorkflow.test.ts` checks the YAML
 * contains `test "$status" = '401'`, and `providerPollContract.test.ts` reads
 * `index.ts` as a string. So the suite could tell you the workflow file mentions
 * 401, and nothing could tell you what the function does with a key that is a
 * prefix of the real one.
 *
 * The deployed probe is still the better evidence for the wire behaviour, because
 * it exercises the real function over real HTTP. It covers exactly one request
 * shape, and only when that workflow's path filter matches. These cases cover the
 * shapes it cannot reach, on every run.
 *
 * Everything here is fabricated. No credential, environment variable or hosted
 * value is involved, and the rule takes both sides as arguments.
 */

const SECRET = 'sk_provider_poll_7f3a9c2e5b81d64f'

function requestWith(headers: Record<string, string>): Request {
  return new Request('https://example.test/functions/v1/provider-poll', {
    method: 'POST',
    headers,
  })
}

describe('provider-poll authorises the caller', () => {
  it('accepts the exact dedicated caller key', () => {
    expect(authorized(requestWith({ apikey: SECRET }), SECRET)).toBe(true)
  })

  it('refuses a request carrying no apikey header at all', () => {
    // The case the deployed probe covers, asserted here as behaviour rather than
    // as a string in a YAML file.
    expect(authorized(requestWith({}), SECRET)).toBe(false)
    expect(authorized(requestWith({ 'content-type': 'application/json' }), SECRET)).toBe(false)
  })

  it('refuses an empty apikey, and does not treat it as absent-and-fine', () => {
    expect(authorized(requestWith({ apikey: '' }), SECRET)).toBe(false)
  })

  it('refuses a prefix of the key, which is what a guessing attacker submits', () => {
    expect(authorized(requestWith({ apikey: SECRET.slice(0, -1) }), SECRET)).toBe(false)
    expect(authorized(requestWith({ apikey: SECRET.slice(0, 4) }), SECRET)).toBe(false)
  })

  it('refuses a key of the right length with the wrong last byte', () => {
    const nearMiss = `${SECRET.slice(0, -1)}${SECRET.endsWith('f') ? 'e' : 'f'}`
    expect(nearMiss).toHaveLength(SECRET.length)
    expect(nearMiss).not.toBe(SECRET)
    expect(authorized(requestWith({ apikey: nearMiss }), SECRET)).toBe(false)
  })

  it('refuses a key that only differs in case', () => {
    expect(authorized(requestWith({ apikey: SECRET.toUpperCase() }), SECRET)).toBe(false)
  })

  it('refuses a longer key that starts with the whole secret', () => {
    expect(authorized(requestWith({ apikey: `${SECRET}extra` }), SECRET)).toBe(false)
  })

  it('reads the header case-insensitively, which the rule relies on', () => {
    // Supabase's gateway forwards `apikey` lower-case, and `Headers` lookup is
    // case-insensitive. Pinning it means a future rewrite to a plain object
    // cannot quietly become a security change disguised as a refactor.
    expect(authorized(requestWith({ APIKey: SECRET }), SECRET)).toBe(true)
  })

  it('would authorise an empty header against an empty configured secret, which is why the key resolver throws instead of returning one', () => {
    // Stated as it is rather than as it ought to be. The rule is pure string
    // equality, so an empty configured secret matches an empty `apikey` — this
    // does NOT refuse every caller, and naming it that way would be a test
    // claiming more than it proves.
    expect(authorized(requestWith({ apikey: '' }), '')).toBe(true)
    expect(authorized(requestWith({ apikey: 'anything' }), '')).toBe(false)
    // It is unreachable rather than guarded here: `index.ts` resolves the key
    // through `callerSecretKey()`, whose lookups are falsy-checked and which
    // throws `Missing named Supabase secret key` rather than handing an empty
    // string to this function. The protection lives there, and this case is
    // pinned so a change that started tolerating an empty key would have to
    // change a test that says so out loud.
  })
})

describe('the comparison does not leak where two keys diverge', () => {
  it('is true only for identical strings', () => {
    expect(constantTimeEqual('', '')).toBe(true)
    expect(constantTimeEqual(SECRET, SECRET)).toBe(true)
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
  })

  it('is false whenever the lengths differ, in either direction', () => {
    // Named for what it proves. An earlier draft of this called itself "folds a
    // length difference into the result rather than returning early" and
    // asserted only these four results — which are false either way, so it
    // could not tell the folded implementation from an early `return false`.
    // Replacing the accumulator line with `if (leftBytes.length !==
    // rightBytes.length) return false` left it green. The behavioural claim and
    // the timing claim are now separate, below.
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
    expect(constantTimeEqual('abcd', 'abc')).toBe(false)
    expect(constantTimeEqual('', 'a')).toBe(false)
    expect(constantTimeEqual('a', '')).toBe(false)
  })

  it('does not return early on a length difference, which would leak the secret’s length', () => {
    /*
     * A STRUCTURAL GUARD, AND ITS LIMIT IS THE POINT. Timing cannot be asserted
     * reliably in this suite — a wall-clock comparison across two string lengths
     * is exactly the flaky test that gets deleted a month later, and deleting it
     * would remove the only thing watching this property.
     *
     * So this pins the shape instead: the length difference must reach the same
     * accumulator the byte comparison uses, and the function must not contain a
     * `return` before that loop. That detects the known regression — swapping the
     * fold for an early exit — and it does NOT prove constant time. It cannot,
     * and it should not be read as doing so.
     */
    const source = readFileSync(
      resolve(import.meta.dirname, '../../supabase/functions/provider-poll/authorization.ts'),
      'utf8',
    )
    const body = source.slice(
      source.indexOf('export function constantTimeEqual'),
      source.indexOf('export function authorized'),
    )
    expect(body).toContain('let mismatch = leftBytes.length ^ rightBytes.length')
    const loopStart = body.indexOf('for (const')  >= 0 ? body.indexOf('for (const') : body.indexOf('for (')
    expect(loopStart).toBeGreaterThan(-1)
    // Exactly one `return`, and it is after the loop.
    expect(body.match(/\breturn\b/g) ?? []).toHaveLength(1)
    expect(body.indexOf('return')).toBeGreaterThan(loopStart)
  })

  it('examines the whole input, so a first-byte difference is not special', () => {
    expect(constantTimeEqual('xbc', 'abc')).toBe(false)
    expect(constantTimeEqual('abx', 'abc')).toBe(false)
  })

  it('compares UTF-8 bytes, so multi-byte characters cannot collide', () => {
    // Two different characters that share a leading byte must not compare equal,
    // which a naive per-code-unit loop over a truncated length could allow.
    expect(constantTimeEqual('é', 'e')).toBe(false)
    expect(constantTimeEqual('é', 'é')).toBe(true)
    expect(constantTimeEqual('🔑', '🔑')).toBe(true)
    expect(constantTimeEqual('🔑', '🔒')).toBe(false)
  })
})
