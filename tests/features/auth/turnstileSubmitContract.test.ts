import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()
const forms = [
  'src/features/auth/LoginForm.tsx',
  'src/features/auth/SignUpForm.tsx',
  'src/features/auth/ResetRequestForm.tsx',
] as const

function source(path: (typeof forms)[number]): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

describe('AUTH-003 Turnstile submit contract', () => {
  it('never disables auth submit merely because the CAPTCHA token is absent', () => {
    for (const path of forms) {
      const form = source(path)
      expect(form, path).not.toMatch(/disabled=\{[^}]*turnstileEnabled[^}]*captchaToken/)
    }
  })

  it('turns a missing CAPTCHA token into visible validation on every protected form', () => {
    for (const path of forms) {
      const form = source(path)
      expect(form, path).toContain('captchaValidation')
      expect(form, path).toMatch(/turnstileEnabled && !captchaToken[\s\S]*setCaptchaValidation\(/)
      expect(form, path).toMatch(/captchaValidation \? <Alert variant="error">/)
    }
  })

  it('keeps ordinary local field validation ahead of the CAPTCHA refusal', () => {
    const login = source('src/features/auth/LoginForm.tsx')
    expect(login.indexOf('emailError(email)')).toBeLessThan(
      login.indexOf('turnstileEnabled && !captchaToken'),
    )
    expect(login).toContain("password ? undefined : 'Please enter your password.'")

    const signup = source('src/features/auth/SignUpForm.tsx')
    expect(signup.indexOf('validateSignUp(values)')).toBeLessThan(
      signup.indexOf('turnstileEnabled && !captchaToken'),
    )

    const reset = source('src/features/auth/ResetRequestForm.tsx')
    expect(reset.indexOf('emailError(email)')).toBeLessThan(
      reset.indexOf('turnstileEnabled && !captchaToken'),
    )
  })

  it('still refuses protected submissions without a token rather than bypassing verification', () => {
    for (const path of forms) {
      const form = source(path)
      expect(form, path).toMatch(
        /if \(turnstileEnabled && !captchaToken\) \{[\s\S]*setCaptchaValidation\([\s\S]*return\n\s*\}/,
      )
    }
  })
})
