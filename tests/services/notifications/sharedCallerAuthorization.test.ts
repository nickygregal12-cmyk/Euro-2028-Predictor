import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  authorized,
  constantTimeEqual,
} from '../../../supabase/functions/_shared/callerAuthorization'

/**
 * The shared Edge Function caller rule.
 *
 * `provider-poll` still carries its own copy, deliberately: it is a live
 * Production function guarding paid provider credentials, and re-pointing its
 * import is not a change to make from a repository that cannot deploy or
 * exercise it. Two copies is a real cost, so this pins them identical — the
 * failure it prevents is one being hardened and the other quietly left behind.
 */

const root = process.cwd()

/**
 * One file's executable code, with comments and whitespace removed.
 *
 * Comments are stripped deliberately. The two files explain their own
 * situations differently and should be free to — what must not diverge is the
 * RULE. Comparing prose would fail on a wording edit that changes nothing, and
 * a guard that cries wolf is one people delete.
 */
function body(path: string): string {
  const source = readFileSync(resolve(root, path), 'utf8')
  const start = source.indexOf('export function constantTimeEqual')
  expect(start, `${path} has no constantTimeEqual`).toBeGreaterThan(-1)
  return source
    .slice(start)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('shared caller authorization', () => {
  it('implements the same rule as the copy provider-poll still uses', () => {
    expect(body('supabase/functions/_shared/callerAuthorization.ts')).toBe(
      body('supabase/functions/provider-poll/authorization.ts'),
    )
  })

  it('refuses a request with no apikey header', () => {
    expect(authorized(new Request('https://x.test'), 'secret')).toBe(false)
  })

  it('refuses a wrong key', () => {
    const request = new Request('https://x.test', {
      headers: { apikey: 'wrong' },
    })
    expect(authorized(request, 'secret')).toBe(false)
  })

  it('refuses a prefix of the key', () => {
    const request = new Request('https://x.test', {
      headers: { apikey: 'sec' },
    })
    expect(authorized(request, 'secret')).toBe(false)
  })

  it('accepts the exact key', () => {
    const request = new Request('https://x.test', {
      headers: { apikey: 'secret' },
    })
    expect(authorized(request, 'secret')).toBe(true)
  })

  it('reads the header case-insensitively', () => {
    // Relied upon rather than assumed: a rewrite to a plain object lookup would
    // be a security change disguised as a refactor.
    const request = new Request('https://x.test', {
      headers: { APIKey: 'secret' },
    })
    expect(authorized(request, 'secret')).toBe(true)
  })

  it('compares equal-length mismatches without early exit', () => {
    expect(constantTimeEqual('abcdef', 'abcdeg')).toBe(false)
    expect(constantTimeEqual('abcdef', 'abcdef')).toBe(true)
  })

  it('treats a length difference as a mismatch', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
    expect(constantTimeEqual('', 'a')).toBe(false)
    expect(constantTimeEqual('', '')).toBe(true)
  })
})
