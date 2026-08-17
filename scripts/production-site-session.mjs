/**
 * Opens a session against the password-protected Netlify site.
 *
 * The mechanism here was MEASURED, not assumed. On 10 August 2026 the
 * disposable Production Access Probe (workflow run 31390824255) ran five
 * candidate exchanges against production from a GitHub runner and reported:
 *
 *   anonymous                          status=401  release_identity=no
 *   basic-auth (empty user)            status=401  release_identity=no
 *   basic-auth (password as user)      status=401  release_identity=no
 *   form-post to / then cookie jar     status=200  release_identity=YES
 *   form-post to target then cookie jar status=200 release_identity=YES
 *
 * and the anonymous 401 carried NO `WWW-Authenticate` header at all — only
 * `content-type: text/html`. So this is a login form, and it is emphatically not
 * HTTP Basic auth. That distinction matters because Netlify also offers
 * Basic-Auth-via-`_headers`, a different feature, and the public material
 * conflates the two constantly. Both Basic candidates above were rejected.
 *
 * Judging a candidate on its status code alone would not have been enough: a
 * login page served with a 200 looks like success. The probe therefore required
 * the body to parse as our release identity, and so does the caller here.
 *
 * SECRETS. Two different values pass through this module and neither may be
 * logged. The password is a repository secret, so GitHub masks it in workflow
 * output. The cookie this returns is a session JWT MINTED AT RUNTIME, so GitHub
 * does NOT mask it — nothing here may print it, and no caller may put it in an
 * environment variable that a diagnostic dump could reach. Pass it as a value
 * inside Node, or write it to a file that is shredded.
 */

const LOGIN_ATTEMPTS = 3
const LOGIN_RETRY_DELAY_MS = 2_000

/**
 * @param {string} origin Site origin, no trailing slash.
 * @param {string} password Site password. Empty means "no protection expected".
 * @returns {Promise<string>} A `Cookie` header value, or '' when no password
 *   was supplied. Never partially authenticated: it either returns a usable
 *   cookie or throws.
 */
export async function resolveSiteCookie(origin, password) {
  if (!password) return ''

  let lastFailure = 'no attempt was made'

  for (let attempt = 1; attempt <= LOGIN_ATTEMPTS; attempt += 1) {
    let response
    try {
      response = await fetch(`${origin}/`, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'euro28-production-smoke/1',
        },
        body: new URLSearchParams({ password }).toString(),
      })
    } catch (error) {
      // Transport only. A wrong password is a finding and is never retried.
      lastFailure = `transport failure: ${error instanceof Error ? error.message : String(error)}`
      if (attempt < LOGIN_ATTEMPTS) {
        console.warn(
          `Site login transport failure (attempt ${attempt}/${LOGIN_ATTEMPTS}). Retrying.`,
        )
        await new Promise((resolve) => setTimeout(resolve, LOGIN_RETRY_DELAY_MS))
        continue
      }
      break
    }

    const cookie = cookieHeaderFrom(response)
    if (cookie) return cookie

    // A response with no session cookie is a rejected password, not a flaky
    // network. Retrying it would only turn one clear failure into three.
    throw new Error(
      `Site login to ${origin} returned HTTP ${response.status} and set no session cookie. ` +
        'The site password is wrong, or the site is no longer password protected.',
    )
  }

  throw new Error(`Site login to ${origin} failed after ${LOGIN_ATTEMPTS} attempts: ${lastFailure}`)
}

/**
 * The cookie name is deliberately not hard-coded. Netlify's is `nf_jwt` today,
 * but pinning it would turn a rename into a confusing authentication failure
 * rather than a clean one, and we gain nothing by asserting it.
 *
 * @param {Response} response
 * @returns {string}
 */
function cookieHeaderFrom(response) {
  const pairs = response.headers
    .getSetCookie()
    .map((entry) => (entry.split(';', 1)[0] ?? '').trim())
    .filter((pair) => pair.includes('=') && !pair.endsWith('='))

  return pairs.join('; ')
}

/**
 * Converts a `Cookie` header into the shape Playwright's `storageState` wants.
 *
 * Playwright needs a file rather than a header, which suits us: the JWT reaches
 * disk under the runner's temporary directory and is shredded afterwards,
 * instead of living in an environment variable for the length of the job.
 *
 * @param {string} cookieHeader
 * @param {string} origin
 * @returns {{cookies: Array<Record<string, unknown>>, origins: []}}
 */
export function storageStateFrom(cookieHeader, origin) {
  const { hostname } = new URL(origin)

  const cookies = cookieHeader
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const separator = pair.indexOf('=')
      return {
        name: pair.slice(0, separator),
        value: pair.slice(separator + 1),
        domain: hostname,
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      }
    })

  return { cookies, origins: [] }
}
