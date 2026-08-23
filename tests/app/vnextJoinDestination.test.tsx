import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VNextJoinDestination } from '../../src/app/vnext/VNextJoinDestination'
import {
  clearPendingJoin,
  getPendingJoin,
  setPendingJoin,
} from '../../src/features/leagues/pendingJoin'

/**
 * THE INVITE DEEP LINK, IN THE vNEXT PRESENTATION.
 *
 * `tests/features/leagues/JoinLandingPage.test.tsx` asserts the same properties
 * against the LEGACY presentation and stays: the flag is a switch and both
 * sides of it have to work. These are the ones a cutover could most plausibly
 * have broken, and the first is an accepted requirement rather than a nicety:
 *
 *   1. a signed-out visitor's code is STORED before the sign-up redirect, and
 *      nothing is resolved on their behalf while they are signed out;
 *   2. the pending redirect is consumed once they arrive signed in;
 *   3. the JOIN dispatches on the server's own `joinWith`, never on the code's
 *      shape — so a competition code never takes the league path;
 *   4. a refusal states itself and offers no button the database would refuse;
 *   5. where a joined container OPENS is the build's rule, not the page's.
 */

const mocks = vi.hoisted(() => ({
  auth: { userId: null as string | null, loading: false },
  resolveInviteCode: vi.fn(),
  joinPrivateCompetition: vi.fn(),
  joinLeague: vi.fn(),
  getOrCreateEntry: vi.fn(),
}))

vi.mock('../../src/features/auth/AuthProvider', () => ({
  useAuth: () => mocks.auth,
}))

vi.mock('../../src/services/supabase/inviteCodes', () => ({
  resolveInviteCode: mocks.resolveInviteCode,
  joinPrivateCompetition: mocks.joinPrivateCompetition,
}))

vi.mock('../../src/services/supabase/leagues', () => ({
  joinLeague: mocks.joinLeague,
}))

vi.mock('../../src/services/supabase/predictions', () => ({
  getOrCreateEntry: mocks.getOrCreateEntry,
}))

function renderInvite(code = 'ABC234DEF567') {
  return render(
    <MemoryRouter initialEntries={[`/join/${code}`]}>
      <Routes>
        <Route path="/join/:code" element={<VNextJoinDestination />} />
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

const SIGNED_IN = '00000000-0000-0000-0000-000000000123'

beforeEach(() => {
  vi.clearAllMocks()
  clearPendingJoin()
  mocks.auth.userId = null
  mocks.auth.loading = false
})

describe('the vNext invite deep link', () => {
  it('stores the exact invite after commit before redirecting a signed-out visitor', async () => {
    renderInvite('ABC234DEF567')

    await screen.findByText('Signup destination')
    expect(getPendingJoin()).toBe('ABC234DEF567')
    // Nothing is resolved on behalf of somebody with no session.
    expect(mocks.resolveInviteCode).not.toHaveBeenCalled()
  })

  it('consumes the pending invite and resolves the code once authenticated', async () => {
    setPendingJoin('ABC234DEF567')
    mocks.auth.userId = SIGNED_IN
    mocks.resolveInviteCode.mockResolvedValue(LEAGUE_INVITE)

    renderInvite('ABC234DEF567')

    expect(await screen.findByText('Office League')).toBeInTheDocument()
    await waitFor(() => expect(getPendingJoin()).toBeNull())
    expect(mocks.resolveInviteCode).toHaveBeenCalledWith('ABC234DEF567')
  })

  it('joins a league through join_league and opens it where this build keeps it', async () => {
    mocks.auth.userId = SIGNED_IN
    mocks.resolveInviteCode.mockResolvedValue(LEAGUE_INVITE)
    mocks.joinLeague.mockResolvedValue({ id: 'lg-1', name: 'Office League' })

    renderInvite('ABC234DEF567')
    fireEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }))

    await screen.findByText('Joined league destination')
    expect(mocks.joinLeague).toHaveBeenCalledWith('ABC234DEF567')
    // No tournament entry is created as a side effect of opening a link.
    expect(mocks.getOrCreateEntry).not.toHaveBeenCalled()
  })

  it('joins a private competition through join_private_competition', async () => {
    mocks.auth.userId = SIGNED_IN
    mocks.resolveInviteCode.mockResolvedValue(LMS_INVITE)
    mocks.joinPrivateCompetition.mockResolvedValue({
      gameCompetitionId: 'comp-1',
      gameKey: 'last_man_standing',
      status: 'active',
    })

    renderInvite('LMS234DEF567')
    fireEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }))

    await screen.findByText('Private play destination')
    expect(mocks.joinPrivateCompetition).toHaveBeenCalledWith('LMS234DEF567')
    // The league path is never taken for a competition code — the dispatch is
    // the server's `joinWith` rather than anything the browser inferred.
    expect(mocks.joinLeague).not.toHaveBeenCalled()
  })

  it('offers no join where the server states a prerequisite', async () => {
    mocks.auth.userId = SIGNED_IN
    mocks.resolveInviteCode.mockResolvedValue({ ...LEAGUE_INVITE, requiresGameEntry: true })

    renderInvite()

    await screen.findByText('Office League')
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).toBeNull()
  })

  it('answers an unknown code without confirming anything about it', async () => {
    mocks.auth.userId = SIGNED_IN
    mocks.resolveInviteCode.mockResolvedValue({ found: false })

    renderInvite('NOPE99')

    // ONE SENTENCE, NO DIAGNOSIS. The server makes unknown, malformed and
    // rotated codes indistinguishable on purpose, and the page must not undo
    // that by naming which it was.
    expect(await screen.findByText('That invitation is not valid')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).toBeNull()
  })

  it('never discloses the size of a private group, even if a server sends one', async () => {
    mocks.auth.userId = SIGNED_IN
    mocks.resolveInviteCode.mockResolvedValue({ ...LEAGUE_INVITE, members: 8, id: 'lg-1' })

    renderInvite()
    await screen.findByText('Office League')

    expect(screen.queryByText(/8 members/i)).toBeNull()
  })

  it('sends a player who is already in to their private play rather than to an id it lacks', async () => {
    mocks.auth.userId = SIGNED_IN
    mocks.resolveInviteCode.mockResolvedValue({ ...LEAGUE_INVITE, alreadyIn: true })

    renderInvite()
    await screen.findByText('Office League')
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).toBeNull()
  })
})
