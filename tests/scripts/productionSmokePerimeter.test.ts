import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Production is password protected, so the release smoke has to authenticate.
 * The hazard in that change is subtle and worth pinning: an authenticated-only
 * smoke would be WEAKER than the accidental red it replaced.
 *
 * Before it could authenticate, the smoke failed on 401 — and that failure at
 * least proved an anonymous visitor was refused. Fixing the gate could easily
 * have discarded that property as a side effect, leaving a green smoke that
 * would stay green if the site were made public tomorrow.
 *
 * So both halves are asserted here: a credential-free request must be REQUIRED
 * to be refused, and the authenticated pass must never leak the session.
 */

const root = process.cwd()
const workflow = readFileSync(resolve(root, '.github/workflows/production-smoke.yml'), 'utf8')
const session = readFileSync(resolve(root, 'scripts/production-site-session.mjs'), 'utf8')
const waiter = readFileSync(resolve(root, 'scripts/wait-for-production-release.mjs'), 'utf8')
const smoke = readFileSync(resolve(root, 'scripts/production-smoke.mjs'), 'utf8')

describe('the anonymous half still asserts the perimeter', () => {
  it('makes a credential-free request and requires exactly 401', () => {
    expect(workflow).toContain('Refuse to continue if the site is not protected')
    expect(workflow).toMatch(/if \[ "\$\{status\}" != '401' \]/)
  })

  it('stops rather than warns when the site answers anything else', () => {
    const step = workflow.slice(
      workflow.indexOf('Refuse to continue if the site is not protected'),
      workflow.indexOf('Resolve the expected release identity'),
    )
    expect(step).toContain('exit 1')
    // A 200 means the perimeter is gone. Publishing is the owner's decision,
    // so discovering it must fail the run rather than be downgraded to a
    // warning annotation or swallowed by a `|| true`.
    expect(step).not.toMatch(/::warning|\|\| true|continue-on-error/i)
  })

  it('runs before anything authenticates, so a lost perimeter is never masked', () => {
    expect(workflow.indexOf('Refuse to continue if the site is not protected')).toBeLessThan(
      workflow.indexOf('EURO28_SITE_PASSWORD'),
    )
  })
})

describe('the authenticated half never leaks the session', () => {
  it('keeps the runtime-minted cookie out of the workflow environment', () => {
    // The password is a repository secret and GitHub masks it. The cookie this
    // exchange returns is minted at runtime and is NOT masked, so it must never
    // become an environment variable or reach a run: line.
    expect(workflow).not.toMatch(/EURO28_SMOKE_COOKIE|nf_jwt/)
  })

  it('passes the browser session as a shredded file rather than a value', () => {
    expect(workflow).toContain('EURO28_SMOKE_STORAGE_STATE=${RUNNER_TEMP}/production-storage-state.json')
    const shred = workflow.slice(workflow.indexOf('Shred the browser session'))
    expect(shred).toContain('shred --remove --zero')
    expect(shred).toContain('always()')
  })

  it('never prints a cookie value from any of the session code paths', () => {
    for (const [name, source] of [
      ['production-site-session.mjs', session],
      ['wait-for-production-release.mjs', waiter],
      ['production-smoke.mjs', smoke],
    ] as const) {
      const logs = [...source.matchAll(/console\.(log|warn|error)\(([\s\S]*?)\n/g)].map(
        (match) => match[2],
      )
      for (const line of logs) {
        // The leak shape is interpolating the cookie-bearing variable itself.
        // Deciding a message on whether a cookie EXISTS is fine and is done
        // deliberately, so this pins the value rather than the word.
        expect(line, `${name} logs a cookie value`).not.toMatch(
          /\$\{\s*(site)?[Cc]ookie\s*\}/,
        )
      }
    }
  })
})

describe('identity is asserted, not just reachability', () => {
  it('refuses a 200 that is really the login page', () => {
    // Netlify can serve the password form with a 200. A poll that trusted the
    // status alone would report that as a successful release.
    expect(waiter).toContain('response was not JSON, which is what a login page looks like from here')
  })

  it('requires the exact commit and contract rather than any release', () => {
    expect(waiter).toContain('release.commit !== expectedCommit')
    expect(waiter).toContain('release.applicationContract !== expectedContract')
    expect(waiter).toContain('release.hostedContract !== expectedContract')
  })

  it('treats a wrong password as a finding rather than retrying it', () => {
    const loginFailure = session.slice(session.indexOf('const cookie = cookieHeaderFrom(response)'))
    expect(loginFailure).toContain('set no session cookie')
    expect(loginFailure).toContain('throw new Error')
  })
})

describe('the dual-brand allowance is retired', () => {
  it('accepts only the current brand now that production is past contract 63', () => {
    expect(smoke).toContain("assertIncludes(root.body, 'Football Prediction Hub', 'application title')")
    // The legacy title may still be named in the comment that records the
    // retirement; it must not survive as an accepted alternative.
    expect(smoke).not.toMatch(/!root\.body\.includes\('Euro 2028 Predictor'\)/)
  })
})
