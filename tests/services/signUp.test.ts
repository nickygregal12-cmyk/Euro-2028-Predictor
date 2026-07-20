import { vi, describe, it, expect, beforeEach } from 'vitest'

// The 2026-07-20 incident: with confirmation ON, sign-up returned NO session and
// the client-side profile insert was rejected by RLS (auth.uid() unset). The fix
// moves profile creation to a server trigger, so sign-up must (a) never touch
// `profiles` from the client and (b) handle the no-session case without throwing.
// This test would have caught the incident: the OLD signUpWithPassword calls
// createMyProfile (→ supabase.from('profiles')) in exactly this scenario.

const { signUpMock, signInMock, fromMock } = vi.hoisted(() => ({
  signUpMock: vi.fn(),
  signInMock: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock('../../src/services/supabase/client', () => ({
  supabase: {
    auth: { signUp: signUpMock, signInWithPassword: signInMock },
    from: fromMock,
  },
}))

import { signUpWithPassword, signInWithPassword } from '../../src/services/supabase/auth'

describe('signUpWithPassword — incident fix', () => {
  beforeEach(() => {
    signUpMock.mockReset()
    signInMock.mockReset()
    fromMock.mockReset()
  })

  it('handles the NO-SESSION case without throwing and never inserts the profile client-side', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null })

    const res = await signUpWithPassword({ email: 'a@b.co', password: 'secret1', displayName: 'Alex' })

    // No session → confirmation pending, surfaced (not an error).
    expect(res).toEqual({ needsConfirmation: true })
    // The incident's failing operation: a client-side profiles insert. Gone.
    expect(fromMock).not.toHaveBeenCalled()
    // Display name is handed to the server trigger via metadata.
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({ options: { data: { display_name: 'Alex' } } }),
    )
  })

  it('reports no confirmation needed when a session comes back', async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 'x' } },
      error: null,
    })
    const res = await signUpWithPassword({ email: 'a@b.co', password: 'secret1', displayName: 'Bo' })
    expect(res).toEqual({ needsConfirmation: false })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('propagates a real sign-up error', async () => {
    signUpMock.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'boom' } })
    await expect(
      signUpWithPassword({ email: 'a@b.co', password: 'secret1', displayName: 'Al' }),
    ).rejects.toBeTruthy()
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
    expect(signInMock).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'secret1',
      options: { captchaToken: 'tok' },
    })
  })
})
