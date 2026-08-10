import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PASSWORD_MIN } from '../../../src/features/auth/authValidation'

/**
 * The anti-bot and password floor, before `ACQ-R09` is mitigated.
 *
 * `ACQ-R09` names three things — *"stronger floor, leaked-password protection
 * and mandatory production Turnstile validation"* — and describes the controls
 * as *"insufficiently fail-closed for launch"*. That phrasing is exact, and the
 * code agrees with it: nothing here is broken, and everything here is optional.
 *
 * The sharp finding is not the floor. It is that **Turnstile is the one piece of
 * configuration whose absence is treated as a valid production setup.**
 * `scripts/validate-netlify-environment.mjs` exists precisely to fail a build on
 * missing or wrong environment configuration — it rejects a missing
 * `VITE_SUPABASE_URL`, a missing anon key, and a key belonging to the wrong
 * project — and it does not know Turnstile exists. So a production build with no
 * site key passes every gate this repository has and ships with anti-bot
 * protection silently off.
 *
 * These assertions pin that state so the mitigation must arrive as a visible
 * edit here, in the same shape as `inviteCodeEnumeration` for `ACQ-R10`. Nothing
 * is fixed: raising the client floor without the matching Supabase setting is
 * theatre, and arming the build gate is a decision about when production is
 * allowed to fail, which belongs to the owner.
 *
 * ── PARTIAL TRANSITION, 10 August 2026 ──────────────────────────────────────
 *
 * **One of `ACQ-R09`'s three items has moved, and this is that visible edit.**
 * Leaked-password protection now exists as a client-side breach-corpus check
 * (`src/services/auth/pwnedPassword.ts`), so the "no breach check" assertion
 * below is replaced by its after-state. The other two items are untouched and
 * their before-state assertions are left exactly as written:
 *
 *   - **the floor is still six.** Raising it is `AUD-03`, and it is an owner
 *     task rather than a code one — the client mirror says it mirrors
 *     Supabase's server rule, and moving it alone would make that comment false
 *     while changing nothing an attacker experiences. The dashboard setting
 *     moves first;
 *   - **the deploy gate still does not know Turnstile exists.** Unchanged, for
 *     the reason recorded below.
 *
 * `AUTH-002` is REDUCED, not closed, and the register says so. The check is
 * bypassable by calling the Supabase auth endpoint directly, and the hosted
 * toggle it was supposed to be closed by is a Pro-plan feature this project
 * cannot enable at all. What it does cover is the population the finding is
 * actually about: an ordinary user reusing a password that is already in a
 * credential-stuffing list, who uses the form every time.
 */

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

describe('password floor — before-state', () => {
  it('is six characters, which is Supabase’s default rather than a chosen policy', () => {
    // ACQ-R09 asks for a "stronger floor". Six is the platform default, and the
    // source comment says so — it was inherited, not decided. NIST SP 800-63B
    // puts the minimum at eight for user-chosen secrets.
    expect(PASSWORD_MIN).toBe(6)
  })

  it('still has no composition or strength check beyond length', () => {
    // Length remains the entire LOCAL policy. Unchanged, and still worth
    // pinning: a six-character dictionary word that happens not to be in the
    // breach corpus passes every check this application makes.
    const source = read('src/features/auth/authValidation.ts')

    expect(source).toMatch(/password\.length < PASSWORD_MIN/)
    expect(source).not.toMatch(/entropy|zxcvbn/i)
  })

  it('now refuses a password found in the breach corpus — after-state', () => {
    // The replaced assertion. It read `.not.toMatch(/breach|pwned/)` and pinned
    // the absence of any breach check; that absence is what changed, so the
    // assertion is inverted rather than deleted. Deleting it would leave no
    // trace that the control was ever missing, and no test that fails if it is
    // quietly removed again.
    //
    // Asserted at BOTH forms deliberately. The reset flow is the easier one to
    // forget and the more important one to have: it is where somebody who has
    // just been told their password was compromised chooses the next one, and a
    // sign-up-only check would let them choose another breached password.
    for (const form of [
      'src/features/auth/SignUpForm.tsx',
      'src/features/auth/UpdatePasswordForm.tsx',
    ]) {
      const source = read(form)
      expect(source, `${form} must run the breach check`).toMatch(/checkPwnedPassword/)
      expect(source, `${form} must block on a hit`).toMatch(/BREACHED_PASSWORD_MESSAGE/)
    }
  })

  it('fails open, so an unreachable corpus cannot stop account creation', () => {
    // The property that makes the control safe to ship. If this inverts, a HIBP
    // outage becomes a signup outage — and the compensating controls (Turnstile,
    // the contract-145 atomic limiter, the length floor) all still stand without
    // it, so failing closed would trade a real availability loss for very
    // little.
    const source = read('src/services/auth/pwnedPassword.ts')

    expect(source).toMatch(/catch\s*\{[\s\S]*?return 0/)
    expect(source).toMatch(/if \(!response\.ok\) return 0/)
  })

  it('sends only a hash prefix, never the password', () => {
    // k-anonymity. A regression here would keep working perfectly while
    // disclosing every candidate password to a third party, which is the kind of
    // defect that is never noticed from behaviour.
    const source = read('src/services/auth/pwnedPassword.ts')

    expect(source).toMatch(/hash\.slice\(0, PREFIX_LENGTH\)/)
    expect(source).toMatch(/PREFIX_LENGTH = 5/)
  })

  it('applies the same floor to a reset as to sign-up', () => {
    // Worth pinning: a stronger sign-up floor that the reset flow does not share
    // would let an existing account move *down* to six characters.
    const source = read('src/features/auth/authValidation.ts')
    const uses = [...source.matchAll(/length < PASSWORD_MIN/g)]

    expect(uses.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Turnstile — before-state', () => {
  it('is opt-in, so an unset key disables it silently rather than failing', () => {
    // The fail-open. No key means no widget, no token, and an auth flow that
    // proceeds exactly as if anti-bot protection had never been designed.
    const source = read('src/features/auth/turnstileConfig.ts')

    expect(source).toMatch(/turnstileEnabled/)
    expect(source).toMatch(/TURNSTILE_SITE_KEY !== null/)
    // The comment states the posture outright. If that line changes, the
    // posture has changed and this test should be revisited deliberately.
    expect(source).toMatch(/OFF by default and opt-in/i)
  })

  it('sends the captcha token only when a key happens to be configured', () => {
    // Conditional spread in the service layer: the token is absent rather than
    // empty when Turnstile is off, which is why Supabase accepts the call.
    const source = read('src/services/supabase/auth.ts')

    expect(source).toMatch(/\.\.\.\(\s*captchaToken\s*\?/)
  })
})

describe('the deploy gate does not know Turnstile exists', () => {
  /**
   * This is the finding worth acting on.
   *
   * The environment validator is the control that stops a build reaching an
   * environment it is not configured for. It fails closed on the Supabase
   * variables. It has no opinion on the one variable that carries anti-bot
   * protection, so "not configured" and "deliberately disabled" are the same
   * state to every automated check in the repository.
   */
  const validator = read('scripts/validate-netlify-environment.mjs')

  it('fails a build on a missing Supabase variable', () => {
    // The positive control. Without this, the assertion below could pass
    // because the validator checks nothing at all.
    expect(validator).toMatch(/VITE_SUPABASE_URL/)
    expect(validator).toMatch(/is missing VITE_SUPABASE_URL/)
  })

  it('says nothing about the Turnstile site key, in any context', () => {
    // Pinned, not fixed. Requiring the key in the production context is the
    // mitigation, and arming it decides when a production build is allowed to
    // fail — a scheduling decision, not a code one, and production deploys are
    // already paused on the contract gate.
    expect(validator).not.toMatch(/TURNSTILE/i)
  })

  it('confirms the site key is a build-time public value, so a gate could see it', () => {
    // Establishes the mitigation is actually available: the key is a VITE_
    // variable compiled into the bundle, so the prebuild validator can read it
    // from the same environment it already reads the Supabase values from.
    expect(read('src/features/auth/turnstileConfig.ts')).toMatch(
      /import\.meta\.env\.VITE_TURNSTILE_SITE_KEY/,
    )
  })
})
