/**
 * Breach-corpus password check — the free replacement for Supabase's Pro-only
 * leaked-password protection (`AUTH-002`).
 *
 * WHY THIS EXISTS AT ALL. `AUTH-002` has been open since the live advisors
 * reconfirmed it on 6 August 2026, and its recorded closure reads "enable
 * leaked-password protection in both projects". That closure cannot be
 * performed: the toggle is a Pro-plan-and-above feature and this project is on
 * the free tier, so the setting is not merely off, it is unavailable. This is
 * the mitigation, not the closure — `AUTH-002` stays open and the advisor will
 * keep flagging it, because the advisor reads the toggle rather than the
 * implementation.
 *
 * TWO ROUTES WERE RULED OUT BEFORE THIS ONE, and they are recorded so the time
 * is not spent again:
 *
 *   - A Postgres trigger on `auth.users` cannot work. Only salted bcrypt hashes
 *     are stored; the database never receives the plaintext, so it has nothing
 *     to hash for a breach lookup. There is no database-level route to this
 *     control at all.
 *   - The Password Verification auth hook is the wrong hook. It fires on
 *     sign-IN, and its payload carries a `valid` boolean and a user id — not
 *     the password. It also runs unauthenticated, so leaning on it adds a
 *     surface rather than a control.
 *
 * HOW THE LOOKUP AVOIDS DISCLOSING THE PASSWORD. HaveIBeenPwned's range API is
 * k-anonymous: the SHA-1 is computed here, and only the first five hex
 * characters are sent. The service replies with every hash suffix sharing that
 * prefix — 500 to 1,000 of them — and the comparison happens on this device.
 * Neither the password nor enough of its hash to identify it leaves the
 * browser. `Add-Padding` makes every response a uniform size, so a network
 * observer cannot infer the bucket from the response length either.
 *
 * SHA-1 IS CORRECT HERE and is not a security defect to be "fixed" later. It is
 * not being used to protect anything — it is the corpus's index, chosen by the
 * service. Substituting a stronger digest would simply fail to match.
 *
 * IT FAILS OPEN, DELIBERATELY. Every failure path returns 0, which the caller
 * reads as "no reason to warn". HIBP being unreachable, offline, rate-limited
 * or blocked by a corporate proxy must never become an outage on the signup
 * form: the compensating controls — Turnstile, the contract-145 atomic limiter,
 * the minimum length — all still stand without it. The consequence is that 0
 * conflates "not in the corpus" with "could not ask", and that conflation is
 * the price of not making account creation depend on a third party. It is
 * stated here rather than discovered later.
 *
 * WHAT THIS IS NOT. It is bypassable — anyone can call the Supabase auth
 * endpoint directly and never load this file. That is close to irrelevant for
 * the threat it addresses. The risk is not an attacker choosing a breached
 * password, which harms only their own account; it is an ordinary honest user
 * reusing a password already sitting in a credential-stuffing list, and that
 * population uses the form, every time.
 */

/**
 * The origin the check calls.
 *
 * Exported because `contentSecurityPolicyParity.test.ts` compares the committed
 * `connect-src` against what the application actually reaches, rather than
 * against a hand-maintained second list. This mirrors how
 * `ALLOWED_SENTRY_INGEST_SUFFIXES` already anchors the Sentry hosts: the code
 * that makes the request is the authority for the permission it needs, so the
 * two cannot drift apart in silence.
 */
export const PWNED_PASSWORDS_ORIGIN = 'https://api.pwnedpasswords.com'

/** How many hex characters of the digest are sent. Fixed by the service. */
const PREFIX_LENGTH = 5

/**
 * Parse a range response for one suffix.
 *
 * Pure, and separate from the request for the reason `AGENTS.md` gives: response
 * parsing is testable against fixtures without a network wrapper in the way. The
 * body is `SUFFIX:COUNT` per line with CRLF endings, and the suffixes come back
 * upper-case.
 */
export function countInRangeResponse(body: string, suffix: string): number {
  const wanted = suffix.toUpperCase()
  for (const line of body.split('\n')) {
    const [candidate, count] = line.trim().split(':')
    if (candidate !== wanted) continue
    const parsed = count === undefined ? Number.NaN : Number.parseInt(count, 10)
    // A malformed count on a matching line still means the password was found.
    // Reporting 0 there would turn a hit into a miss, which is the one direction
    // this function must never fail in.
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  }
  return 0
}

/** SHA-1 of a string as upper-case hex, or null where Web Crypto is unavailable. */
async function sha1Hex(value: string): Promise<string | null> {
  // `crypto.subtle` is undefined outside a secure context, and absent in some
  // test environments. Both are fail-open cases rather than errors to throw at
  // somebody creating an account.
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null

  const digest = await subtle.digest('SHA-1', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/**
 * How many times this password appears in the Pwned Passwords corpus.
 *
 * Returns 0 when it is absent AND when the check could not run — see the
 * fail-open note above. Never throws.
 */
export async function pwnedCount(password: string): Promise<number> {
  // An empty password is the form's own validation problem, not a corpus
  // question, and asking would spend a request to learn nothing.
  if (!password) return 0

  try {
    const hash = await sha1Hex(password)
    if (!hash) return 0

    const response = await fetch(
      `${PWNED_PASSWORDS_ORIGIN}/range/${hash.slice(0, PREFIX_LENGTH)}`,
      {
        // Uniform response size, so the prefix bucket cannot be inferred from
        // the length of the reply.
        headers: { 'Add-Padding': 'true' },
      },
    )
    if (!response.ok) return 0

    return countInRangeResponse(await response.text(), hash.slice(PREFIX_LENGTH))
  } catch {
    // Network failure, CSP refusal, DNS, abort — all fail open. See above.
    return 0
  }
}

/** The check as the forms consume it, so a test can substitute one. */
export type PwnedPasswordCheck = (password: string) => Promise<number>
