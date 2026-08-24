import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JoinLandingPage } from '../../../src/features/leagues/JoinLandingPage'
import {
  clearPendingJoin,
  getPendingJoin,
  setPendingJoin,
} from '../../../src/features/leagues/pendingJoin'

/**
 * The invite deep link, `/join/:code` — now for any container (`MIG-UI-07`).
 *
 * WHAT CHANGED AND WHY THE ASSERTIONS MOVED WITH IT. This page used to call
 * `get_league_preview`, and before joining it created an Original Predictor
 * entry — a compatibility step for the preserved Euro invite, which predates
 * game ids. Contract 155 resolves any code and states the prerequisite instead,
 * so the invitee is TOLD which game to join rather than being silently entered
 * into one. Creating a tournament membership as a side effect of opening a link
 * is exactly the invisible entry the separation rules exist to prevent, and the
 * assertion that used to demand it now forbids it.
 *
 * The pending-invite boundary is unchanged and still pinned: the code is stored
 * before the signed-out redirect, and consumed on arrival signed in.
 */

const mocks = vi.hoisted(() => ({
  auth: { userId: null as string | null, loading: false },
  resolveInviteCode: vi.fn(),
  joinPrivateCompetition: vi.fn(),
  joinLeague: vi.fn(),
  getOrCreateEntry: vi.fn(),
  recordProductEvent: vi.fn(),
  landing: { kind: 'ready' as 'checking' | 'ready' | 'sign-up' },
  landingOverride: false,
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => mocks.auth,
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

vi.mock('../../../src/services/analytics/productEvents', () => ({
  recordProductEvent: mocks.recordProductEvent,
}))

// Driven rather than inferred, so the once-only guard can actually be exercised.
// The real hook derives `kind` from auth; the default passes straight through to
// that behaviour, and only the guard case overrides it.
vi.mock('../../../src/features/leagues/useInviteLanding', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../src/features/leagues/useInviteLanding')
  >()
  return {
    ...actual,
    useInviteLanding: (code?: string) => {
      const real = actual.useInviteLanding(code)
      return mocks.landingOverride ? { ...real, kind: mocks.landing.kind } : real
    },
  }
})

function Harness({ code = 'ABC234DEF567' }: { code?: string }) {
  return (
    <MemoryRouter initialEntries={[`/join/${code}`]}>
      <Routes>
        <Route path="/join/:code" element={<JoinLandingPage />} />
        <Route path="/auth/signup" element={<p>Signup destination</p>} />
        <Route path="/leagues" element={<p>Private play destination</p>} />
        <Route path="/league/:leagueId" element={<p>Joined league destination</p>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderInvite(code = 'ABC234DEF567') {
  return render(
    <MemoryRouter initialEntries={[`/join/${code}`]}>
      <Routes>
        <Route path="/join/:code" element={<JoinLandingPage />} />
        <Route path="/auth/signup" element={<p>Signup destination</p>} />
        <Route path="/leagues" element={<p>Private play destination</p>} />
        <Route path="/league/:leagueId" element={<p>Joined league destination</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const LEAGUE_INVITE = {
  found: true,
  kind: 'league',
  name: 'Office League',
  season: 'Premier League 2026/27',
  game: 'Match Predictor',
  alreadyIn: false,
  requiresGameEntry: false,
  joinWith: 'join_league',
}

const LMS_INVITE = {
  found: true,
  kind: 'competition',
  name: 'Sunday Survivors',
  season: 'Premier League 2026/27',
  game: 'Last Man Standing',
  gameKey: 'last_man_standing',
  alreadyIn: false,
  isOwner: false,
  closed: false,
  joinWith: 'join_private_competition',
}

describe('the invite deep link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearPendingJoin()
    mocks.auth.userId = null
    mocks.auth.loading = false
  })

  it('stores the exact invite after commit before redirecting a signed-out visitor', async () => {
    renderInvite('ABC234DEF567')

    await screen.findByText('Signup destination')
    expect(getPendingJoin()).toBe('ABC234DEF567')
    expect(mocks.resolveInviteCode).not.toHaveBeenCalled()
  })

  it('consumes the pending invite and resolves the code once authenticated', async () => {
    setPendingJoin('ABC234DEF567')
    mocks.auth.userId = '00000000-0000-0000-0000-000000000123'
    mocks.resolveInviteCode.mockResolvedValue(LEAGUE_INVITE)

    renderInvite('ABC234DEF567')

    await screen.findByRole('heading', { name: 'Office League' })
    await waitFor(() => expect(getPendingJoin()).toBeNull())
    expect(mocks.resolveInviteCode).toHaveBeenCalledWith('ABC234DEF567')
  })

  it('joins a league through join_league and opens it', async () => {
    mocks.auth.userId = '00000000-0000-0000-0000-000000000123'
    mocks.resolveInviteCode.mockResolvedValue(LEAGUE_INVITE)
    mocks.joinLeague.mockResolvedValue({ id: 'lg-1', name: 'Office League' })

    renderInvite('ABC234DEF567')
    fireEvent.click(await screen.findByRole('button', { name: 'Join league' }))

    await screen.findByText('Joined league destination')
    expect(mocks.joinLeague).toHaveBeenCalledWith('ABC234DEF567')
    // No tournament entry is created as a side effect of opening a link.
    expect(mocks.getOrCreateEntry).not.toHaveBeenCalled()
  })

  it('joins a private competition through join_private_competition', async () => {
    mocks.auth.userId = '00000000-0000-0000-0000-000000000123'
    mocks.resolveInviteCode.mockResolvedValue(LMS_INVITE)
    mocks.joinPrivateCompetition.mockResolvedValue({
      gameCompetitionId: 'comp-1',
      gameKey: 'last_man_standing',
      status: 'active',
    })

    renderInvite('LMS234DEF567')
    fireEvent.click(await screen.findByRole('button', { name: 'Join competition' }))

    await screen.findByText('Private play destination')
    expect(mocks.joinPrivateCompetition).toHaveBeenCalledWith('LMS234DEF567')
    // The league path is never taken for a competition code.
    expect(mocks.joinLeague).not.toHaveBeenCalled()
  })

  it('tells an invitee to join the underlying game rather than offering a join that would fail', async () => {
    mocks.auth.userId = '00000000-0000-0000-0000-000000000123'
    mocks.resolveInviteCode.mockResolvedValue({ ...LEAGUE_INVITE, requiresGameEntry: true })

    renderInvite()

    expect(await screen.findByText(/Join that game first/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join league' })).toBeNull()
  })

  it('says nothing about a launched Championship beyond it being closed', async () => {
    mocks.auth.userId = '00000000-0000-0000-0000-000000000123'
    mocks.resolveInviteCode.mockResolvedValue({ ...LMS_INVITE, closed: true })

    renderInvite()

    expect(await screen.findByText(/closed to new entrants/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join competition' })).toBeNull()
  })

  it('answers an unknown code with one uninformative sentence', async () => {
    mocks.auth.userId = '00000000-0000-0000-0000-000000000123'
    mocks.resolveInviteCode.mockResolvedValue({ found: false })

    renderInvite('NOPE99')

    expect(await screen.findByText(/doesn’t match anything/)).toBeInTheDocument()
  })

  it('never discloses the size of a private group, even if a server sends one', async () => {
    // Contract 159 stopped the resolver returning a member count at all, for
    // the reason contract 158 gave about `get_league_preview`: it is what turns
    // a guessed code into a positively identified group. The decoder drops the
    // field, so a server that regressed and sent one could still not surface it.
    mocks.auth.userId = '00000000-0000-0000-0000-000000000123'
    mocks.resolveInviteCode.mockResolvedValue({ ...LEAGUE_INVITE, members: 8, id: 'lg-1' })

    renderInvite()
    await screen.findByRole('heading', { name: 'Office League' })

    expect(screen.queryByText(/8 members/i)).toBeNull()
    expect(screen.queryByText(/\b8\b/)).toBeNull()
  })

  it('sends a player who is already in to their private play rather than to an id it lacks', async () => {
    mocks.auth.userId = '00000000-0000-0000-0000-000000000123'
    mocks.resolveInviteCode.mockResolvedValue({ ...LEAGUE_INVITE, alreadyIn: true })

    renderInvite()
    fireEvent.click(await screen.findByRole('button', { name: 'Go to your private play' }))

    expect(await screen.findByText('Private play destination')).toBeInTheDocument()
  })
})

describe('opening an invitation is counted', () => {
  // RENDERED, NOT READ. A source-text assertion that the call exists would keep
  // passing after the effect stopped running -- the wrong dependency array, an
  // early return moved above it, a ref that never resets. These mount the page.
  beforeEach(() => {
    vi.clearAllMocks()
    clearPendingJoin()
    mocks.auth.userId = null
    mocks.auth.loading = false
    mocks.landingOverride = false
  })

  it('counts a signed-out arrival, which is the branch most likely to be lost', async () => {
    mocks.auth.userId = null
    mocks.resolveInviteCode.mockResolvedValue(LEAGUE_INVITE)
    renderInvite()

    await waitFor(() => {
      expect(mocks.recordProductEvent).toHaveBeenCalledWith('invite_opened', {
        signedIn: false,
      })
    })
  })

  it('counts a signed-in arrival as signed in', async () => {
    mocks.auth.userId = 'player-1'
    mocks.resolveInviteCode.mockResolvedValue(LEAGUE_INVITE)
    renderInvite()

    await waitFor(() => {
      expect(mocks.recordProductEvent).toHaveBeenCalledWith('invite_opened', {
        signedIn: true,
      })
    })
  })

  it('counts one arrival once even if the landing decides twice', async () => {
    // WHAT THE `counted` REF ACTUALLY PROTECTS, driven rather than assumed.
    //
    // The effect depends on `landing.kind`, so during an ordinary visit it runs
    // once anyway and a test that merely re-renders proves nothing -- an
    // earlier version of this case passed with the ref deleted, which is why it
    // is written this way now. The ref earns its place when the landing resolves
    // more than once: auth settling late, a session expiring mid-visit. Then a
    // second decision would count a second arrival and inflate the very
    // denominator `invite_opened` exists to provide.
    mocks.auth.userId = 'player-1'
    mocks.resolveInviteCode.mockResolvedValue(LEAGUE_INVITE)

    mocks.landingOverride = true
    mocks.landing.kind = 'checking'
    const { rerender } = renderInvite()
    expect(mocks.recordProductEvent).not.toHaveBeenCalled()

    mocks.landing.kind = 'ready'
    rerender(<Harness />)
    await waitFor(() => expect(mocks.recordProductEvent).toHaveBeenCalledTimes(1))

    // A second, different decision. Without the ref this counts again.
    mocks.landing.kind = 'sign-up'
    rerender(<Harness />)
    await waitFor(() => expect(screen.queryByText('Signup destination')).not.toBeNull())
    expect(mocks.recordProductEvent).toHaveBeenCalledTimes(1)
  })

  it('never carries the code that made the invitation work', async () => {
    // The code is a bearer credential. The event type has nowhere to put one,
    // and this proves no caller found a way regardless.
    mocks.auth.userId = 'player-1'
    mocks.resolveInviteCode.mockResolvedValue(LEAGUE_INVITE)
    renderInvite('SECRETCODE99')

    await waitFor(() => expect(mocks.recordProductEvent).toHaveBeenCalled())
    for (const call of mocks.recordProductEvent.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('SECRETCODE99')
    }
  })
})
