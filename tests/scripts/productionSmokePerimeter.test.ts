import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { siteConfiguration } from '../../src/app/site/siteConfiguration'
import { euroLandingPresentation } from '../../src/features/landing/euroLandingModel'
import { at } from '../support/indexed'

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
const browserSpec = readFileSync(resolve(root, 'production-smoke/anonymous.spec.ts'), 'utf8')
const browserConfig = readFileSync(resolve(root, 'playwright.production.config.ts'), 'utf8')

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

describe('the checked routes are derived, not restated', () => {
  const netlify = readFileSync(resolve(root, 'netlify.toml'), 'utf8')

  it('reads the 200 rules out of netlify.toml', () => {
    expect(smoke).toContain('function committedOkRoutes()')
    expect(smoke).toContain('const routes = committedOkRoutes()')
  })

  it('keeps no hand-written route list beside it', () => {
    // The hand-written list drifted: it demanded 200 for `/predict`, a retired
    // tournament path that netlify.toml deliberately 404s. A second copy is the
    // defect, so a reintroduced literal list is what this catches.
    // Anchored to a top-level declaration: the accumulator inside the
    // derivation is indented and is not what this is about.
    expect(smoke).not.toMatch(/^const routes = \[/m)
  })

  it('does not expect the retired tournament path', () => {
    expect(smoke).not.toMatch(/'\/predict'/)
    expect(netlify).not.toContain('from = "/predict"')
  })

  it('substitutes parameters and wildcards rather than skipping those rules', () => {
    // Dropping them would quietly stop checking every competition and league
    // route, which is most of the application's surface.
    expect(smoke).toContain('.replace(/:[A-Za-z]+/g, ROUTE_PROBE)')
    expect(smoke).toContain('.replace(/\\/\\*$/, `/${ROUTE_PROBE}`)')
  })

  it('refuses to pass vacuously when no rule is found', () => {
    expect(smoke).toContain('netlify.toml declares no 200 redirect rules to check.')
  })
})

describe('each production origin must serve its own product', () => {
  /*
   * This block used to be called "the dual-brand allowance is retired" and
   * pinned one hard-coded assertion: the body must contain
   * `Football Prediction Hub`, and `Euro 2028 Predictor` must not survive as an
   * accepted ALTERNATIVE. That intent — no origin may pass on either brand —
   * is preserved below and strengthened; only the mechanism changed.
   *
   * It had to change because ADR 0026's site-variant seam made
   * `Euro 2028 Predictor` the CURRENT title of the Euro deployment, which is
   * the same string the contract-63 cleanup had just retired as legacy. The
   * hard-coded check then asserted the Hub's brand against the Euro site, and
   * failed the first Euro production build after the split — run 31574100495,
   * 12 August 2026, against a deploy serving the expected commit at the
   * expected contract.
   */

  it('derives the expected product from the origin rather than hard-coding one', () => {
    expect(smoke).toContain("['https://euro28predictor.com', 'Euro 2028 Predictor']")
    expect(smoke).toContain("['https://predictorhub.netlify.app', 'Predictor Hub']")
    expect(smoke).toContain('assertServesItsOwnProduct(root.body)')
  })

  it('leaves no hard-coded brand at the assertion site', () => {
    // A literal there is what made the check origin-blind: whichever origin the
    // workflow pointed at was measured against the other site's brand.
    expect(smoke).not.toMatch(
      /assertIncludes\(\s*root\.body,\s*'(Football Prediction Hub|Euro 2028 Predictor)'/,
    )
  })

  it('still refuses to accept either brand on one origin', () => {
    // The original hazard: a disjunction that lets a Hub build pass on the Euro
    // domain, or the reverse. Neither brand may appear as an alternative.
    expect(smoke).not.toMatch(/includes\('Football Prediction Hub'\)\s*\|\|/)
    expect(smoke).not.toMatch(/includes\('Euro 2028 Predictor'\)\s*\|\|/)
    expect(smoke).not.toMatch(/!root\.body\.includes\('Euro 2028 Predictor'\)/)
  })

  it('fails when an origin serves the other deployment as well as its own', () => {
    // The assertion that catches an unset VITE_SITE_VARIANT, which fails closed
    // to the Hub and would otherwise publish the weekly platform on the Euro
    // domain with every other check in this smoke still passing.
    expect(smoke).toContain('served ${JSON.stringify(other)} as well as')
    expect(smoke).toContain('an unset value fails closed to the Hub.')
  })

  it('draws the perimeter from the same map, so a brand and an origin cannot disagree', () => {
    // One list decides both which origins may be smoked and what each must
    // serve. Two lists could disagree about what "production" means, and the
    // origin guard is the half that would win silently.
    expect(smoke).toContain('if (!PRODUCTION_SITES.has(origin) && !allowNonProduction)')
    expect(smoke).toContain('EVERY_PRODUCT = [...new Set(PRODUCTION_SITES.values())]')
  })

  it('refuses an origin whose product nothing declares', () => {
    expect(smoke).toContain('no expected product is declared for ${origin}')
  })
})

/**
 * THE THREE COPIES, COMPARED AGAINST THE ONE SOURCE.
 *
 * The HTTP smoke, the browser spec and the Playwright configuration each carry
 * the production origins literally, and the browser spec also carries each
 * site's product name and landing heading. They are literal because Playwright
 * reads a config and a spec before any bundling — the reason
 * `playwright.euro.config.ts` gives for restating its own spec list — and
 * because `production-smoke.mjs` is plain JavaScript that cannot import a
 * TypeScript module at all.
 *
 * That makes drift the hazard, and it is a quiet one: a site added to the smoke
 * and missed in the config produces "refusing to browser-smoke non-production
 * origin", which reads as a caller mistake; a renamed product produces a red
 * production smoke against a correct deploy, which is exactly what happened on
 * 12 August 2026. So the copies are compared here against
 * `siteConfiguration()` and the landing models, which are the authorities that
 * decide what each build actually serves.
 */
describe('the smoke copies agree with the site authority', () => {
  const origins = ['https://euro28predictor.com', 'https://predictorhub.netlify.app']

  it('names the same production origins in all three places', () => {
    for (const origin of origins) {
      expect(smoke, `${origin} missing from production-smoke.mjs`).toContain(`'${origin}'`)
      expect(browserSpec, `${origin} missing from anonymous.spec.ts`).toContain(`'${origin}'`)
      expect(browserConfig, `${origin} missing from the Playwright config`).toContain(
        `'${origin}'`,
      )
    }
  })

  it('pins each origin to the product name its variant actually builds', () => {
    // Not a second copy of the names: they come from the configuration the
    // running application reads, so a rename moves both together or fails here.
    const hub = siteConfiguration('hub').brand.productName
    const euro = siteConfiguration('euro').brand.productName

    expect(smoke).toContain(`['https://predictorhub.netlify.app', '${hub}']`)
    expect(smoke).toContain(`['https://euro28predictor.com', '${euro}']`)
    expect(browserSpec).toContain(`appName: '${hub}'`)
    expect(browserSpec).toContain(`appName: '${euro}'`)
  })

  it('maps each origin to the variant that deployment builds', () => {
    // `docs/ops/netlify-deploy-access.md` records the declarations:
    // predictorhub is VITE_SITE_VARIANT=hub, euro28predictor is =euro.
    expect(browserSpec).toContain("['https://euro28predictor.com', 'euro']")
    expect(browserSpec).toContain("['https://predictorhub.netlify.app', 'hub']")
  })

  it('expects each build own landing heading, from the model that produces it', () => {
    // The Euro deployment fails closed to the same headline whether contract
    // 143 answers `hidden` or the read does not answer at all, and asserting
    // the model's value rather than a transcription is what keeps that true.
    expect(euroLandingPresentation('unknown').headline).toBe(
      euroLandingPresentation('hidden').headline,
    )
    expect(browserSpec).toContain(
      `landingHeading: '${euroLandingPresentation('hidden').headline}'`,
    )

    const hubLanding = readFileSync(resolve(root, 'src/features/landing/LandingPage.tsx'), 'utf8')
    const hubHeading = 'Make every match mean more.'
    expect(hubLanding, 'the Hub hero heading moved').toContain(hubHeading)
    expect(browserSpec).toContain(`landingHeading: '${hubHeading}'`)
  })

  it('refuses an unknown origin in the browser spec too, rather than guessing', () => {
    expect(browserSpec).toContain('this smoke does not guess which product an origin serves')
  })

  it('dispatches only origins the smoke will accept', () => {
    // The workflow chooses the origin and the script decides whether to smoke
    // it. An origin the workflow can select but the script does not know is a
    // run that dies on "refusing to smoke-test non-production origin" — a
    // caller error by its wording, a configuration defect in fact.
    const selectable = [...workflow.matchAll(/'(https:\/\/[^']+)'/g)].map((match) => at(match, 1))
    expect(selectable.length, 'the workflow selects no origin at all').toBeGreaterThan(0)
    for (const origin of selectable) {
      expect(smoke, `the workflow can dispatch ${origin} and the smoke would refuse it`).toContain(
        `'${origin}'`,
      )
    }
    // Both sites, so adding an input option without its origin fails here.
    for (const origin of origins) expect(selectable).toContain(origin)
  })
})
