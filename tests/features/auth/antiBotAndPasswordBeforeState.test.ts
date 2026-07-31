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

  it('has no composition, breach or strength check beyond length', () => {
    // Length is the entire client-side policy. Recorded because "we validate
    // passwords" is true and misleading: a six-character dictionary word passes.
    const source = read('src/features/auth/authValidation.ts')

    expect(source).toMatch(/password\.length < PASSWORD_MIN/)
    expect(source).not.toMatch(/entropy|breach|pwned|haveibeenpwned|zxcvbn/i)
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
