import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JoinLandingPage } from '../../../src/features/leagues/JoinLandingPage'
import {
  clearPendingJoin,
  getPendingJoin,
} from '../../../src/features/leagues/pendingJoin'
import { RedirectIfAuthed, RequireAuth, RequireWelcome } from '../../../src/app/Providers'

/**
 * An invite link survives everything between the tap and the join.
 *
 * WHY THIS IS A SEPARATE TEST FROM `JoinLandingPage.test.tsx`. That one proves
 * the landing page stores the code when signed out and consumes it when signed
 * in — each end of the journey, separately. The failure this guards against
 * lives between them: the invite is stored by one component, read by a ROUTE
 * GATE in `app/Providers.tsx`, and read again by the onboarding screen, and
 * none of those three had a test that they hand off to each other. A gate that
 * sent a freshly signed-up visitor to Home instead of back to the invite would
 * pass every existing test in this repository, and the person who sent the
 * invite would be told nobody joined.
 *
 * It composes the REAL gates against the REAL landing page, in the nesting
 * `App.tsx` actually uses — `/join/:code` public and outside both `RequireAuth`
 * and `RequireWelcome`, so it can serve a signed-out visitor at all.
 */

const mocks = vi.hoisted(() => ({
  auth: {
    userId: null as string | null,
    loading: false,
    welcomeStatus: 'welcomed' as 'loading' | 'needed' | 'welcomed',
  },
  resolveInviteCode: vi.fn(),
  joinPrivateCompetition: vi.fn(),
  joinLeague: vi.fn(),
  getOrCreateEntry: vi.fn(),
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => mocks.auth,
  useOptionalAuth: () => mocks.auth,
}))

vi.mock('../../../src/services/supabase/inviteCodes', () => ({
  resolveInviteCode: mocks.resolveInviteCode,
  joinPrivateCompetition: mocks.joinPrivateCompetition,
}))

vi.mock('../../../src/services/supabase/leagues', () => ({
  joinLeague: mocks.joinLeague,
}))

vi.mock('../../../src/services/supabase/predictions', () => ({
  getOrCreateEntry: mocks.getOrCreateEntry,
}))

const CODE = 'ABC234DEF567'

const LEAGUE_INVITE = {
  found: true,
  kind: 'league',
  name: 'Office League',
  season: 'Premier League 2026/27',
  game: 'Match Predictor',
}

/**
 * The relevant slice of `App.tsx`'s route table, with the real gates.
 *
 * The nesting is the part under test, so it mirrors the application rather than
 * being convenient: `/join/:code` is public and sits OUTSIDE `RequireAuth` and
 * `RequireWelcome`; the auth screens sit under `RedirectIfAuthed`; Home sits
 * under both gates.
 */
function renderJourney(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/join/:code" element={<JoinLandingPage />} />

        <Route element={<RedirectIfAuthed />}>
          <Route path="/auth/login" element={<p>Log in screen</p>} />
          <Route path="/auth/signup" element={<p>Sign up screen</p>} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/welcome" element={<p>Onboarding</p>} />
          <Route element={<RequireWelcome />}>
            <Route path="/" element={<p>Home</p>} />
          </Route>
        </Route>

        <Route path="/leagues" element={<p>Private play destination</p>} />
        <Route path="/league/:leagueId" element={<p>Joined league destination</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  clearPendingJoin()
  mocks.auth.userId = null
  mocks.auth.loading = false
  mocks.auth.welcomeStatus = 'welcomed'
  mocks.resolveInviteCode.mockReset()
  mocks.joinLeague.mockReset()
  mocks.resolveInviteCode.mockResolvedValue(LEAGUE_INVITE)
  mocks.joinLeague.mockResolvedValue({ leagueId: 'league-1' })
})

describe('an invite opened while signed out', () => {
  it('is remembered before the visitor is sent to sign up', async () => {
    const { unmount } = renderJourney(`/join/${CODE}`)

    await screen.findByText('Sign up screen')
    expect(getPendingJoin()).toBe(CODE)
    unmount()
  })

  it('is what the auth gate returns to, rather than Home', async () => {
    // The visitor has now created an account. The gate above the auth screens
    // is what decides where they land, and Home is the wrong answer: they came
    // from somebody's invitation.
    renderJourney(`/join/${CODE}`)
    await screen.findByText('Sign up screen')

    mocks.auth.userId = 'account-1'
    const { unmount } = renderJourney('/auth/login')

    await screen.findByText(/Office League/)
    expect(screen.queryByText('Home')).not.toBeInTheDocument()
    unmount()
  })

  it('reaches the authoritative join screen, which states what is being joined', async () => {
    renderJourney(`/join/${CODE}`)
    await screen.findByText('Sign up screen')

    mocks.auth.userId = 'account-1'
    renderJourney('/auth/login')

    // The landing page is the authority on what the code resolves to — the
    // league, the season and the game it belongs to. Nothing about that comes
    // from the link.
    await screen.findByText(/Office League/)
    expect(mocks.resolveInviteCode).toHaveBeenCalledWith(CODE)
  })
})

describe('a never-welcomed visitor', () => {
  /**
   * Scoped to the GATE, and the stand-in route says so. What onboarding itself
   * does with a held invite is `WelcomePage.test.tsx`'s question; what this
   * asserts is narrower and was untested — that being detoured to onboarding
   * does not discard the invitation on the way.
   */
  it('is detoured to onboarding with the invite still held', async () => {
    renderJourney(`/join/${CODE}`)
    await screen.findByText('Sign up screen')
    expect(getPendingJoin()).toBe(CODE)

    // Signed in but not yet welcomed. Home is gated; the invite must still be
    // held, because onboarding is a detour and not a destination.
    mocks.auth.userId = 'account-1'
    mocks.auth.welcomeStatus = 'needed'
    renderJourney('/')

    await screen.findByText('Onboarding')
    expect(getPendingJoin()).toBe(CODE)
  })
})

describe('the invite is spent exactly once', () => {
  it('is cleared when the join lands, so a later log in does not resume it', async () => {
    renderJourney(`/join/${CODE}`)
    await screen.findByText('Sign up screen')

    mocks.auth.userId = 'account-1'
    const joined = renderJourney(`/join/${CODE}`)
    await waitFor(() => expect(getPendingJoin()).toBeNull())
    joined.unmount()

    // Without the clear, every subsequent sign-in would bounce the player into
    // a league they are already in — the same invitation, for ever.
    renderJourney('/auth/login')
    await screen.findByText('Home')
  })
})
