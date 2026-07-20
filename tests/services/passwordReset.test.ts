import { vi, describe, it, expect, beforeEach } from 'vitest'

// Proves the password-reset service wrappers: resetPasswordForEmail is called
// with a redirect back to /auth/update-password and only carries a captchaToken
// when one is supplied (Turnstile Option A parity); updateUser sets the password.

const { resetMock, updateUserMock } = vi.hoisted(() => ({
  resetMock: vi.fn(),
  updateUserMock: vi.fn(),
}))

vi.mock('../../src/services/supabase/client', () => ({
  supabase: {
    auth: { resetPasswordForEmail: resetMock, updateUser: updateUserMock },
  },
}))

import { sendPasswordReset, updatePassword } from '../../src/services/supabase/auth'

describe('sendPasswordReset', () => {
  beforeEach(() => resetMock.mockReset())

  it('sends to the update-password redirect and omits captcha when none given', async () => {
    resetMock.mockResolvedValue({ error: null })
    await sendPasswordReset('a@b.co')
    expect(resetMock).toHaveBeenCalledTimes(1)
    const [email, opts] = resetMock.mock.calls[0]
    expect(email).toBe('a@b.co')
    expect(String(opts.redirectTo)).toContain('/auth/update-password')
    expect(opts.captchaToken).toBeUndefined()
  })

  it('threads a captchaToken when Turnstile supplies one', async () => {
    resetMock.mockResolvedValue({ error: null })
    await sendPasswordReset('a@b.co', 'tok')
    expect(resetMock.mock.calls[0][1].captchaToken).toBe('tok')
  })

  it('propagates a real error', async () => {
    resetMock.mockResolvedValue({ error: { message: 'boom' } })
    await expect(sendPasswordReset('a@b.co')).rejects.toBeTruthy()
  })
})

describe('updatePassword', () => {
  beforeEach(() => updateUserMock.mockReset())

  it('calls updateUser with the new password', async () => {
    updateUserMock.mockResolvedValue({ error: null })
    await updatePassword('new-secret')
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'new-secret' })
  })

  it('propagates a missing-session error (expired link)', async () => {
    updateUserMock.mockResolvedValue({ error: { name: 'AuthSessionMissingError' } })
    await expect(updatePassword('new-secret')).rejects.toBeTruthy()
  })
})
