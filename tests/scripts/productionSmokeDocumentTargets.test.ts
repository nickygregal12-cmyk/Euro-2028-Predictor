import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { at } from '../support/indexed'

/**
 * A 200 redirect is a promise about WHICH DOCUMENT an address serves, and the
 * production smoke has to check the promise that was made rather than the one
 * that used to be made.
 *
 * ---------------------------------------------------------------------------
 * THE DEFECT THIS PINS, AND WHY IT SURVIVED FOR DAYS
 * ---------------------------------------------------------------------------
 *
 * `scripts/production-smoke.mjs` derives its route list from netlify.toml —
 * deliberately, so it cannot drift from a hand-maintained copy — and then
 * compared every one of those addresses against the body served at `/`. That
 * was correct for exactly as long as every 200 rule pointed at `/index.html`.
 *
 * Two rules since stopped doing so, both on purpose:
 *
 *   * `/join/:code` → `/join.html`, the invite share card, so a pasted invite
 *     unfurls as an invitation instead of as the site's own marketing card;
 *   * `/status` → `/status.html`, the static status document, which has to stay
 *     readable on the one occasion anybody reads it — when the app will not
 *     boot.
 *
 * `tests/app/spaRoutingStatus.test.ts` already knew: its own comment records
 * that `to` "was always captured by the pattern below and never declared,
 * because until now every rule pointed at the same document". The hosted smoke
 * was never taught the same thing. So Scheduled Production Health went red on a
 * CORRECT deployment and stayed red, every run from 25 August 2026 onward,
 * failing at `/join/...` with a diff whose two sides were each exactly right.
 *
 * That is the worst shape a check can take: a permanent red on a healthy
 * production, which is indistinguishable from a real outage right up until
 * everybody has learned to ignore it.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS ASSERTED HERE
 * ---------------------------------------------------------------------------
 *
 * The smoke executes its checks at import time against a live origin, so it is
 * read as source rather than invoked — the same approach as
 * `productionSmokeResilience` and `productionSmokePerimeter`.
 *
 * The half that is NOT source-reading is the one that matters most: the
 * committed configuration is parsed for real, and the suite fails if no 200
 * rule points anywhere but `/index.html`. Without that, every assertion below
 * would still pass against a repository where the distinction had quietly
 * disappeared, and a vacuous guard is how this defect gets reintroduced.
 */

const root = process.cwd()
const smoke = readFileSync(resolve(root, 'scripts/production-smoke.mjs'), 'utf8')
const netlifyConfig = readFileSync(resolve(root, 'netlify.toml'), 'utf8')

const INDEX_DOCUMENT = '/index.html'

type Redirect = { from: string; to: string; status: number }

const redirects: Redirect[] = [
  ...netlifyConfig.matchAll(
    /\[\[redirects\]\]\s*\n\s*from = "([^"]+)"\s*\n\s*to = "([^"]+)"\s*\n\s*status = (\d+)/g,
  ),
].map((match) => ({ from: at(match, 1), to: at(match, 2), status: Number(at(match, 3)) }))

const okRedirects = redirects.filter((rule) => rule.status === 200)
const perAddressDocuments = okRedirects.filter((rule) => rule.to !== INDEX_DOCUMENT)

describe('the committed configuration still needs this distinction', () => {
  it('parses the redirect table it is reasoning about', () => {
    expect(okRedirects.length).toBeGreaterThan(20)
  })

  it('declares at least one 200 rule that serves a document of its own', () => {
    // The anti-vacuity assertion. If this ever fails, the guard below has
    // stopped guarding anything and should be reconsidered rather than deleted:
    // the reason a per-address document existed is a product reason, and it
    // going away is a product change somebody should have to notice.
    expect(
      perAddressDocuments.map((rule) => `${rule.from} -> ${rule.to}`),
      'no 200 redirect points anywhere but /index.html, so the smoke could not tell the difference',
    ).not.toHaveLength(0)
  })

  it('points every 200 rule at a document the build writes to the publish root', () => {
    for (const rule of okRedirects) {
      expect(rule.to, `${rule.from} serves a non-document target`).toMatch(/^\/[\w.-]+\.html$/)
    }
  })
})

describe('the smoke compares each address against its own target', () => {
  it('keeps the redirect target when it derives the route list', () => {
    const derivation = smoke.slice(smoke.indexOf('function committedOkRoutes()'))
    // The target used to be captured by the regex and thrown away in the
    // destructuring — `[, from, , status]`. That single skipped slot is the
    // whole defect, so it is what this pins.
    expect(derivation).toContain('for (const [, from, to, status] of config.matchAll(')
    expect(derivation).toMatch(/routes\.push\(\{[\s\S]*?\bto,/)
  })

  it('expects the target document rather than the root document', () => {
    const loop = smoke.slice(
      smoke.indexOf('const routes = committedOkRoutes()'),
      smoke.indexOf('const notFoundProbe'),
    )
    expect(loop).toContain('for (const { from, to } of routes) {')
    expect(loop).toContain('const expected = await servedDocument(to)')
    expect(loop).toContain('assertEqual(response.body, expected,')
    // The precise regression: every address compared against `/`.
    expect(loop).not.toContain('assertEqual(response.body, root.body')
  })

  it('names the target in the failure, so a red says which document was wanted', () => {
    expect(smoke).toContain('`document served at ${from} (expected ${to})`')
  })

  it('fetches each distinct target at most once, and never refetches the root', () => {
    expect(smoke).toContain("const servedDocuments = new Map([['/index.html', root.body]])")
    const reader = smoke.slice(
      smoke.indexOf('async function servedDocument(target)'),
      smoke.indexOf('function committedOkRoutes()'),
    )
    expect(reader).toContain('const cached = servedDocuments.get(target)')
    expect(reader).toContain('if (cached !== undefined) return cached')
    expect(reader).toContain('servedDocuments.set(target, body)')
  })
})

describe('the checks that must not have moved', () => {
  it('still proves the catch-all serves the SPA shell with a 404', () => {
    // SEO-001. The catch-all points at /index.html, so `root.body` is still the
    // right expectation here and this is not an oversight in the change above.
    const probe = smoke.slice(smoke.indexOf('const notFoundProbe'))
    expect(probe).toContain('await fetchText(notFoundProbe, 404)')
    expect(probe).toContain('assertEqual(notFoundResponse.body, root.body')
  })

  it('still fetches the target with the default expectation of 200', () => {
    // A target that 404s — a redirect pointing at a document the build stopped
    // emitting — must fail the run rather than be compared as an empty body.
    const reader = smoke.slice(
      smoke.indexOf('async function servedDocument(target)'),
      smoke.indexOf('function committedOkRoutes()'),
    )
    expect(reader).toContain('await fetchText(target)')
    expect(reader).not.toContain('fetchText(target, ')
  })
})
