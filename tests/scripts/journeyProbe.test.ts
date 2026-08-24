import { describe, expect, it } from 'vitest'
// eslint-disable-next-line -- a .mjs script module resolved by Vitest, like its siblings
import { evaluateJourney, JOURNEY_CHECKS } from '../../scripts/journey-probe/checks.mjs'

/**
 * The synthetic journey probe's judgement, proved without a network.
 *
 * Every check is exercised by handing it a response that BREAKS the thing it
 * guards. A probe whose checks were only ever run against a healthy deployment
 * would be a green tick nobody had earned — the same fault stage 5 found in a
 * boundary assertion that agreed with the code by construction.
 */

type Check = {
  id: string
  step: string
  path: string
  failure: (response: { status: number; body: string }) => string | null
}

const checks = JOURNEY_CHECKS as readonly Check[]
const check = (id: string): Check => {
  const found = checks.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no check named ${id}`)
  return found
}

/** A response that passes everything, so each case below breaks exactly one thing. */
function healthy(path: string): { status: number; body: string } {
  const shell = '<div id="root"></div><script type="module" src="/assets/x.js"></script>'
  if (path === '/robots.txt') {
    return { status: 200, body: 'User-agent: *\nDisallow: /join/\nAllow: /\n' }
  }
  if (path.startsWith('/join/')) {
    return { status: 200, body: `<meta name="robots" content="noindex, nofollow">${shell}` }
  }
  return { status: 200, body: shell }
}

function pass(id: string) {
  const target = check(id)
  return {
    id,
    response: healthy(target.path),
    milliseconds: 12,
  }
}

describe('the journey checks', () => {
  it('passes a healthy deployment on every step', () => {
    const result = evaluateJourney(checks.map((candidate) => pass(candidate.id)))
    expect(result.ok).toBe(true)
    expect(result.steps).toHaveLength(checks.length)
  })

  it('describes each step as something a person does', () => {
    for (const candidate of checks) {
      expect(candidate.step.length).toBeGreaterThan(10)
      // "returns 200" is a thing a server does. The record is read by a human
      // deciding whether players are affected, so the steps are in their terms.
      expect(candidate.step).not.toMatch(/\b(200|HTTP|endpoint|status code)\b/i)
    }
  })

  describe('each check bites', () => {
    it('catches a landing page that does not answer', () => {
      expect(check('landing-answers').failure({ status: 503, body: '' })).toMatch(/503/)
    })

    it('catches a landing page that answers with something that is not the app', () => {
      const reason = check('landing-answers').failure({
        status: 200,
        body: '<html><body>Netlify: page not found</body></html>',
      })
      expect(reason).toMatch(/not the application shell/)
    })

    it('catches an invitation that lost its noindex marker', () => {
      // The regression that matters: the rewrite silently reverts to index.html,
      // which still answers 200 and still looks like the app.
      const reason = check('invite-unfurls').failure({
        status: 200,
        body: '<div id="root"></div><script type="module" src="/a.js"></script>',
      })
      expect(reason).toMatch(/noindex/)
    })

    it('catches an invitation that began publishing the code', () => {
      const withUrl = check('invite-discloses-nothing').failure({
        status: 200,
        body: '<meta property="og:url" content="https://x/join/ABC123">',
      })
      expect(withUrl).toMatch(/og:url/)

      const withCanonical = check('invite-discloses-nothing').failure({
        status: 200,
        body: '<link rel="canonical" href="https://x/join/ABC123">',
      })
      expect(withCanonical).toMatch(/canonical/)
    })

    it('catches robots.txt no longer disallowing invitations', () => {
      const reason = check('crawlers-told-to-stay-out-of-invites').failure({
        status: 200,
        body: 'User-agent: *\nAllow: /\n',
      })
      expect(reason).toMatch(/no longer disallows \/join\//)
    })
  })
})

describe('evaluateJourney', () => {
  it('reports a step that never got an answer as a failure with its cause', () => {
    const results = checks.map((candidate) => pass(candidate.id))
    const first = results[0]
    if (first === undefined) throw new Error('no checks to break')
    const broken = [{ ...first, transportError: 'ECONNREFUSED' }, ...results.slice(1)]

    const result = evaluateJourney(broken)
    expect(result.ok).toBe(false)
    expect(result.steps[0]?.reason).toMatch(/No answer: ECONNREFUSED/)
  })

  it('REFUSES a report that quietly dropped a step', () => {
    // A probe that skipped a step and still said "healthy" is worse than one that
    // failed, because the green becomes evidence of the wrong thing.
    const short = checks.slice(1).map((candidate) => pass(candidate.id))
    expect(() => evaluateJourney(short)).toThrow(/was reported without/)
  })

  it('refuses a result naming a check that does not exist', () => {
    expect(() => evaluateJourney([{ id: 'invented', response: healthy('/'), milliseconds: 1 }])).toThrow(
      /No journey check is named invented/,
    )
  })

  it('is not ok when any single step failed', () => {
    const results = checks.map((candidate) => pass(candidate.id))
    const last = results[results.length - 1]
    if (last === undefined) throw new Error('no checks')
    const broken = [
      ...results.slice(0, -1),
      { ...last, response: { status: 500, body: '' } },
    ]
    expect(evaluateJourney(broken).ok).toBe(false)
  })
})
