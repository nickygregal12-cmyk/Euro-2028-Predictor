import { vi, describe, it, expect, beforeEach } from 'vitest'

const { signUpMock, signInMock, oauthMock, fromMock } = vi.hoisted(() => ({
  signUpMock: vi.fn(),
  signInMock: vi.fn(),
  oauthMock: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock('../../src/services/supabase/client', () => ({
  db: {
    auth: {
      signUp: signUpMock,
      signInWithPassword: signInMock,
      signInWithOAuth: oauthMock,
    },
    from: fromMock,
  },
}))

import {
  signInWithGoogle,
  signUpWithPassword,
  signInWithPassword,
} from '../../src/services/supabase/auth'

describe('signUpWithPassword — incident fix', () => {
  beforeEach(() => {
    signUpMock.mockReset()
    signInMock.mockReset()
    oauthMock.mockReset()
    fromMock.mockReset()
  })

  it('handles the NO-SESSION case without throwing and never inserts the profile client-side', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null })
    const res = await signUpWithPassword({ email: 'a@b.co', password: 'secret1', displayName: 'Alex' })
    expect(res).toEqual({ needsConfirmation: true })
    expect(fromMock).not.toHaveBeenCalled()
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({ options: { data: { display_name: 'Alex' } } }),
    )
  })

  it('reports no confirmation needed when a session comes back', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'u1' }, session: { access_token: 'x' } }, error: null })
    const res = await signUpWithPassword({ email: 'a@b.co', password: 'secret1', displayName: 'Bo' })
    expect(res).toEqual({ needsConfirmation: false })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('propagates a real sign-up error', async () => {
    signUpMock.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'boom' } })
    await expect(signUpWithPassword({ email: 'a@b.co', password: 'secret1', displayName: 'Al' })).rejects.toBeTruthy()
  })

  it('threads the Turnstile captchaToken into signUp only when provided', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'u1' }, session: {} }, error: null })
    await signUpWithPassword({ email: 'a@b.co', password: 'secret1', displayName: 'Al', captchaToken: 'tok' })
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({ options: { data: { display_name: 'Al' }, captchaToken: 'tok' } }),
    )
  })
})

describe('signInWithPassword — captcha threading', () => {
  beforeEach(() => signInMock.mockReset())

  it('omits options when there is no captcha token', async () => {
    signInMock.mockResolvedValue({ error: null })
    await signInWithPassword('a@b.co', 'secret1')
    expect(signInMock).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret1' })
  })

  it('passes captchaToken in options when provided', async () => {
    signInMock.mockResolvedValue({ error: null })
    await signInWithPassword('a@b.co', 'secret1', 'tok')
    expect(signInMock).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret1', options: { captchaToken: 'tok' } })
  })
})

describe('signInWithGoogle', () => {
  it('uses Supabase OAuth and returns only to this deployment origin', async () => {
    oauthMock.mockResolvedValue({ data: { provider: 'google' }, error: null })
    await signInWithGoogle()
    expect(oauthMock).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  })

  it('propagates provider startup errors', async () => {
    oauthMock.mockResolvedValue({ data: null, error: { message: 'provider disabled' } })
    await expect(signInWithGoogle()).rejects.toBeTruthy()
  })
})
