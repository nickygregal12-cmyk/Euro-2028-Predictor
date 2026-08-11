import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WelcomePage } from '../../../src/features/welcome/WelcomePage'
import { clearPendingJoin, setPendingJoin } from '../../../src/features/leagues/pendingJoin'

/**
 * First sign-in, as the route behaves.
 *
 * WHAT THESE ASSERTIONS REPLACE. This suite used to describe a single static
 * orientation screen with three buttons — the page that existed because the
 * four onboarding steps beside it had nowhere to save an answer. Contract 157
 * supplies that, and the page now mounts the real journey. The properties worth
 * protecting have changed with it, and they are these:
 *
 *   1. the journey RESUMES from the server, rather than restarting;
 *   2. a pending invite survives sign-up AND onboarding, and is where Finish
 *      goes;
 *   3. a player who has already been welcomed is not shown setup again;
 *   4. a failed catalogue read is never a trap.
 *
 * The steps' own behaviour is `onboardingSteps.test.tsx`; the resume arithmetic
 * is `onboardingResume.test.ts`. This file is about the route.
 */

const mocks = vi.hoisted(() => ({
  markWelcomed: vi.fn(),
  auth: {
    displayName: 'Welcome Tester',
    welcomeStatus: 'needed' as 'loading' | 'needed' | 'seen',
  },
  fetchPublishedWeeklySeasons: vi.fn(),
  fetchHubMembership: vi.fn(),
  fetchPlayerPreferences: vi.fn(),
  setOnboardingProgress: vi.fn(),
  setCompetitionFollow: vi.fn(),
  registerBonusCompetition: vi.fn(),
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ ...mocks.auth, markWelcomed: mocks.markWelcomed }),
}))

vi.mock('../../../src/services/supabase/weeklyCatalogue', () => ({
  fetchPublishedWeeklySeasons: mocks.fetchPublishedWeeklySeasons,
}))
vi.mock('../../../src/services/supabase/competitionGames', () => ({
  fetchHubMembership: mocks.fetchHubMembership,
}))
vi.mock('../../../src/services/supabase/playerPreferences', () => ({
  fetchPlayerPreferences: mocks.fetchPlayerPreferences,
  setOnboardingProgress: mocks.setOnboardingProgress,
  setCompetitionFollow: mocks.setCompetitionFollow,
}))
vi.mock('../../../src/services/supabase/bonusGames', () => ({
  registerBonusCompetition: mocks.registerBonusCompetition,
}))
vi.mock('../../../src/services/supabase/seasonClubs', () => ({
  fetchSeasonClubs: vi.fn(() => Promise.resolve([])),
}))

const SEASON = {
  competitionSlug: 'premier-league',
  seasonKey: '2026-27',
  competitionId: 'competition-1',
  competitionName: 'Premier League',
  seasonId: 'season-1',
  seasonName: 'Premier League 2026/27',
  status: 'active' as const,
  timeZone: 'Europe/London',
}

const MEMBERSHIP = {
  seasonName: 'Premier League 2026/27',
  tournamentId: 'season-1',
  seasonStatus: 'active' as const,
  seasonGames: {
    competitionMember: false,
    serverNow: null,
    games: [
      {
        id: 'game-mp',
        gameKey: 'main_predictor' as const,
        active: true,
        displayName: 'Match Predictor',
        registrationOpensAt: null,
        registrationClosesAt: null,
        completedAt: null,
        allowRejoin: true,
        membership: null,
      },
    ],
  },
}

function renderWelcome() {
  return render(
    <MemoryRouter initialEntries={['/welcome']}>
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/join/:code" element={<p>Invite destination</p>} />
        <Route path="/" element={<p>Hub destination</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('first sign-in runs the onboarding journey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearPendingJoin()
    mocks.auth.displayName = 'Welcome Tester'
    mocks.auth.welcomeStatus = 'needed'
    mocks.fetchPublishedWeeklySeasons.mockResolvedValue([SEASON])
    mocks.fetchHubMembership.mockResolvedValue([MEMBERSHIP])
    mocks.fetchPlayerPreferences.mockResolvedValue({
      onboarding: { step: null, completedAt: null },
      follows: [],
      pinnedRivals: [],
    })
    mocks.setOnboardingProgress.mockResolvedValue(undefined)
    mocks.setCompetitionFollow.mockResolvedValue(undefined)
    mocks.registerBonusCompetition.mockResolvedValue(undefined)
  })

  it('opens the multi-step journey and stamps the profile welcomed once', async () => {
    renderWelcome()

    expect(await screen.findByRole('heading', { name: 'Set up your season' })).toBeVisible()
    expect(screen.getByText('Welcome, Welcome Tester')).toBeVisible()
    expect(mocks.markWelcomed).toHaveBeenCalledTimes(1)
  })

  it('resumes at the step the server recorded rather than restarting', async () => {
    mocks.fetchPlayerPreferences.mockResolvedValue({
      onboarding: { step: 'games', completedAt: null },
      follows: [{ tournamentId: 'season-1', favouriteTeamId: null, followedAt: null }],
      pinnedRivals: [],
    })

    renderWelcome()

    // The games step, not the first one — and the competition the player had
    // already followed is carried into it.
    expect(await screen.findByRole('heading', { name: 'Choose your games' })).toBeVisible()
    expect(screen.getByText('Premier League')).toBeVisible()
  })

  it('resumes at the first step when the stored step is one this build removed', async () => {
    mocks.fetchPlayerPreferences.mockResolvedValue({
      onboarding: { step: 'a-step-that-no-longer-exists', completedAt: null },
      follows: [],
      pinnedRivals: [],
    })

    renderWelcome()

    expect(
      await screen.findByRole('heading', { name: 'Choose your competitions' }),
    ).toBeVisible()
  })

  it('records progress as the player advances, not only at the end', async () => {
    renderWelcome()
    await screen.findByRole('heading', { name: 'Set up your season' })

    fireEvent.click(screen.getByRole('button', { name: /Skip for now|Continue/ }))

    await waitFor(() => expect(mocks.setOnboardingProgress).toHaveBeenCalledWith('clubs'))
  })

  it('hands a pending invite back at the end instead of going to the Hub', async () => {
    setPendingJoin('AUTH28')
    mocks.fetchPlayerPreferences.mockResolvedValue({
      onboarding: { step: 'review', completedAt: null },
      follows: [],
      pinnedRivals: [],
    })

    renderWelcome()
    await screen.findByRole('heading', { name: 'Review your choices' })
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }))

    expect(await screen.findByText('Invite destination')).toBeVisible()
    expect(mocks.setOnboardingProgress).toHaveBeenCalledWith('review', true)
  })

  it('lands on the Hub when there is no invite waiting', async () => {
    mocks.fetchPlayerPreferences.mockResolvedValue({
      onboarding: { step: 'review', completedAt: null },
      follows: [],
      pinnedRivals: [],
    })

    renderWelcome()
    await screen.findByRole('heading', { name: 'Review your choices' })
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }))

    expect(await screen.findByText('Hub destination')).toBeVisible()
  })

  it('never traps a player when the catalogue read fails', async () => {
    mocks.fetchPublishedWeeklySeasons.mockRejectedValue(new Error('network'))

    renderWelcome()

    expect(await screen.findByText(/couldn’t load the competitions/i)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Skip setup for now' }))
    expect(await screen.findByText('Hub destination')).toBeVisible()
  })

  it('does not replay setup, or the invite, for somebody already welcomed', async () => {
    setPendingJoin('AUTH28')
    mocks.auth.welcomeStatus = 'seen'

    renderWelcome()

    expect(await screen.findByText('Hub destination')).toBeVisible()
    expect(mocks.markWelcomed).not.toHaveBeenCalled()
  })
})
