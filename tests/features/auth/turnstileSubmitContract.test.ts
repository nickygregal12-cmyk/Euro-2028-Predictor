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

  // The refusal is asserted by SHAPE-INDEPENDENT POSITION rather than by one
  // `if` block. Two spellings are in use and both honour the contract: a
  // dedicated early-return guard, and a combined pass that derives every
  // validation, publishes them together and returns when any is set — which
  // reports a missing password and a missing token in one go instead of
  // revealing them one refusal at a time. Pinning the first spelling made this
  // fail on the second while verification was never actually bypassed, so what
  // is checked is the property that matters: between deciding the token is
  // missing and calling `onSubmit`, the form must publish the refusal and
  // return.
  it('still refuses protected submissions without a token rather than bypassing verification', () => {
    for (const path of forms) {
      const form = source(path)
      const decides = form.indexOf('turnstileEnabled && !captchaToken')
      const submits = form.indexOf('onSubmit(')

      expect(decides, `${path}: no CAPTCHA refusal decision`).toBeGreaterThan(-1)
      expect(submits, `${path}: no onSubmit call`).toBeGreaterThan(decides)

      const beforeSubmit = form.slice(decides, submits)
      expect(beforeSubmit, `${path}: refusal is never shown`).toContain('setCaptchaValidation(')
      expect(beforeSubmit, `${path}: submission is not stopped`).toMatch(/\breturn\b/)
    }
  })
})
