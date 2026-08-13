import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PASSWORD_MIN } from '../../../src/features/auth/authValidation'

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

describe('password floor and breach protection', () => {
  it('is six characters, which is Supabase’s current mirrored floor', () => {
    expect(PASSWORD_MIN).toBe(6)
  })

  it('still has no composition or strength check beyond length', () => {
    const source = read('src/features/auth/authValidation.ts')
    expect(source).toMatch(/password\.length < PASSWORD_MIN/)
    expect(source).not.toMatch(/entropy|zxcvbn/i)
  })

  it('refuses a password found in the breach corpus on sign-up and reset', () => {
    for (const form of [
      'src/features/auth/SignUpForm.tsx',
      'src/features/auth/UpdatePasswordForm.tsx',
    ]) {
      const source = read(form)
      expect(source, `${form} must run the breach check`).toMatch(/checkPwnedPassword/)
      expect(source, `${form} must block on a hit`).toMatch(/BREACHED_PASSWORD_MESSAGE/)
    }
  })

  it('fails the breach lookup open so an external outage cannot stop auth', () => {
    const source = read('src/services/auth/pwnedPassword.ts')
    expect(source).toMatch(/catch\s*\{[\s\S]*?return 0/)
    expect(source).toMatch(/if \(!response\.ok\) return 0/)
  })

  it('sends only a hash prefix, never the password', () => {
    const source = read('src/services/auth/pwnedPassword.ts')
    expect(source).toMatch(/hash\.slice\(0, PREFIX_LENGTH\)/)
    expect(source).toMatch(/PREFIX_LENGTH = 5/)
  })

  it('applies the same floor to a reset as to sign-up', () => {
    const source = read('src/features/auth/authValidation.ts')
    const uses = [...source.matchAll(/length < PASSWORD_MIN/g)]
    expect(uses.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Turnstile client contract', () => {
  it('is optional in local/non-production code paths', () => {
    const source = read('src/features/auth/turnstileConfig.ts')
    expect(source).toMatch(/turnstileEnabled/)
    expect(source).toMatch(/TURNSTILE_SITE_KEY !== null/)
  })

  it('sends the captcha token only when a key is configured', () => {
    const source = read('src/services/supabase/auth.ts')
    expect(source).toMatch(/\.\.\.\(\s*captchaToken\s*\?/)
  })
})

describe('Turnstile production deploy gate — after-state', () => {
  const validator = read('scripts/validate-netlify-environment.mjs')

  it('still fails a build on missing Supabase configuration', () => {
    expect(validator).toMatch(/VITE_SUPABASE_URL/)
    expect(validator).toMatch(/is missing VITE_SUPABASE_URL/)
  })

  it('requires a Turnstile site key in production', () => {
    expect(validator).toMatch(/VITE_TURNSTILE_SITE_KEY/)
    expect(validator).toMatch(/Production Netlify build is missing VITE_TURNSTILE_SITE_KEY/)
    expect(validator).toMatch(/verifyProductionTurnstile\(env\)/)
  })

  it('blocks Cloudflare test site keys from production', () => {
    expect(validator).toMatch(/TURNSTILE_TEST_SITE_KEYS/)
    expect(validator).toContain('1x00000000000000000000AA')
    expect(validator).toMatch(/Production Netlify build supplies a Cloudflare Turnstile test site key/)
  })

  it('keeps the site key public and build-time, not a secret in source', () => {
    expect(read('src/features/auth/turnstileConfig.ts')).toMatch(
      /import\.meta\.env\.VITE_TURNSTILE_SITE_KEY/,
    )
  })
})
