// THE JOURNEY A NEW PLAYER ACTUALLY TAKES, EXPRESSED AS DATA.
//
// The repository already proves a great deal about a deployment: the perimeter
// answers (production-anonymous-smoke), the headers and CSP match what is
// committed, the release identity is the expected one, the routes return what
// they should (production-smoke). All of that is INFRASTRUCTURE. None of it
// walks anybody through anything.
//
// This walks the acquisition journey: a stranger follows a link, decides whether
// to join, and looks up how the game is scored before trusting it with a summer.
// Each step is a thing a person does, not a thing a server has.
//
// PURE, AND DELIBERATELY SO. A check is a description plus a predicate over an
// already-fetched response. Nothing here opens a socket, so every step can be
// proved to bite in a unit test rather than against a deployment that happens to
// be healthy today. `run.mjs` supplies the fetching.
//
// ANONYMOUS AND READ-ONLY, ALWAYS. No credential, no account, no mutation. The
// journey a stranger can take is exactly the journey worth probing, and it is
// also the only one that needs no permission to probe.

/**
 * @typedef {object} ProbeResponse
 * @property {number} status
 * @property {string} body
 *
 * Deliberately no header accessor: not one check reads a header, and a field
 * carried "in case" is a field the next person has to satisfy in every fixture.
 * Add it with the first check that needs it.
 */

/**
 * @typedef {object} JourneyCheck
 * @property {string} id           Stable identifier; the record is keyed by it.
 * @property {string} step         What the PERSON is doing, in their terms.
 * @property {string} path         The path to fetch.
 * @property {(response: ProbeResponse) => string | null} failure
 *   The reason this step failed, or null when it passed. A string rather than a
 *   boolean because a record saying "failed" and nothing else sends the next
 *   person back to reproduce it by hand.
 */

/**
 * Text that proves a document is the application shell rather than an error page.
 * @param {string} body
 */
function looksLikeTheApp(body) {
  return body.includes('<div id="root"') && /<script[^>]+type="module"/.test(body)
}

/** @type {readonly JourneyCheck[]} */
export const JOURNEY_CHECKS = [
  {
    id: 'landing-answers',
    step: 'A stranger opens the site for the first time',
    path: '/',
    failure: (response) => {
      if (response.status !== 200) return `The landing page answered ${response.status}.`
      if (!looksLikeTheApp(response.body)) {
        return 'The landing page answered, but it is not the application shell.'
      }
      return null
    },
  },
  {
    id: 'invite-unfurls',
    step: 'They follow an invitation somebody sent them',
    path: '/join/PROBE0',
    failure: (response) => {
      if (response.status !== 200) return `The invitation answered ${response.status}.`
      if (!looksLikeTheApp(response.body)) {
        return 'The invitation answered, but it is not the application shell.'
      }
      // The invite document is deliberately noindex, and deliberately says it is
      // an invitation. Both are the SEC-001 and SEO-002 shape from stage 3, and a
      // rewrite that silently reverted to serving index.html would still return
      // 200 and still look like the app — so the marker is what distinguishes it.
      if (!/name="robots"[^>]+noindex/i.test(response.body)) {
        return 'The invitation is being served without its noindex marker, so /join/ is ' +
          'no longer getting the invite document.'
      }
      return null
    },
  },
  {
    id: 'invite-discloses-nothing',
    step: 'The invitation they were sent gives away no private league',
    path: '/join/PROBE0',
    failure: (response) => {
      // A guessed code must not be distinguishable from a real one by the card.
      // The probe uses a code that does not exist, so ANY league-shaped content
      // here is a disclosure regression rather than a coincidence.
      if (/og:url/i.test(response.body)) {
        return 'The invitation now publishes an og:url, which puts the code in the card.'
      }
      if (/rel="canonical"/i.test(response.body)) {
        return 'The invitation now publishes a canonical link, which puts the code in the card.'
      }
      return null
    },
  },
  {
    id: 'crawlers-told-to-stay-out-of-invites',
    step: 'A search engine is told not to index invitations',
    path: '/robots.txt',
    failure: (response) => {
      if (response.status !== 200) return `robots.txt answered ${response.status}.`
      if (!response.body.includes('Disallow: /join/')) {
        return 'robots.txt no longer disallows /join/, so a posted invite is crawlable.'
      }
      return null
    },
  },
]

/**
 * @typedef {object} ProbeResult
 * @property {string} id
 * @property {ProbeResponse | null} response
 *   Null exactly when `transportError` is set: a step that never got an answer
 *   has no response to judge, and saying otherwise in the type would push the
 *   pretence down into the code that reads it.
 * @property {number} milliseconds
 * @property {string} [transportError]
 */

/**
 * @typedef {object} JourneyStep
 * @property {string} id
 * @property {string} step
 * @property {string} path
 * @property {boolean} ok
 * @property {string} [reason]
 * @property {number} milliseconds
 */

/**
 * Fold fetched responses into a record.
 *
 * Takes results rather than fetching, so the whole judgement is testable. A
 * result carrying `transportError` is a step that never got an answer, which is
 * a failure with a different cause and is reported as one.
 *
 * @param {readonly ProbeResult[]} results
 * @returns {{ ok: boolean, steps: JourneyStep[] }}
 */
export function evaluateJourney(results) {
  const steps = results.map((result) => {
    const check = JOURNEY_CHECKS.find((candidate) => candidate.id === result.id)
    if (!check) throw new Error(`No journey check is named ${result.id}.`)

    const reason =
      result.transportError || result.response === null
        ? `No answer: ${result.transportError ?? 'no response'}`
        : check.failure(result.response)

    return {
      id: check.id,
      step: check.step,
      path: check.path,
      ok: reason === null,
      ...(reason === null ? {} : { reason }),
      milliseconds: result.milliseconds,
    }
  })

  const missing = JOURNEY_CHECKS.filter(
    (check) => !steps.some((step) => step.id === check.id),
  )
  if (missing.length > 0) {
    // A probe that quietly skipped a step and still reported "healthy" would be
    // worse than one that failed: the green would be evidence of the wrong thing.
    throw new Error(
      `The journey was reported without ${missing.map((check) => check.id).join(', ')}.`,
    )
  }

  return { ok: steps.every((step) => step.ok), steps }
}
