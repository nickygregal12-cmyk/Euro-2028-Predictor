import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VNextWelcomeDestination } from '../../src/app/vnext/VNextWelcomeDestination'
import { SiteProvider } from '../../src/app/site/SiteProvider'
import { siteConfiguration } from '../../src/app/site/siteConfiguration'
import { clearPendingJoin, setPendingJoin } from '../../src/features/leagues/pendingJoin'

/**
 * FIRST SIGN-IN, IN THE vNEXT PRESENTATION, AS THE ROUTE BEHAVES.
 *
 * `tests/features/welcome/WelcomePage.test.tsx` asserts the same four route
 * properties against the LEGACY presentation, and it stays: the flag is a
 * switch and both sides of it have to work. These are the same properties
 * against the vNext one, because the whole risk of cutting a journey over is
 * that the new screen is beautiful and the journey around it stopped working:
 *
 *   1. the journey RESUMES from the server rather than restarting;
 *   2. a pending invite survives sign-up AND onboarding, and is where Finish
 *      goes;
 *   3. a player who has already been welcomed is not shown setup again;
 *   4. the COMMIT is the shared authority's, including its partial failure —
 *      the one thing a second presentation could most easily have reinvented.
 *
 * The screen is rendered for real, against the same service mocks the legacy
 * suite uses. A test that stubbed `VNextOnboardingScreen` would prove the
 * element was chosen and nothing about whether the journey completes.
 */

const mocks = vi.hoisted(() => ({
  markWelcomed: vi.fn(),
  auth: {
    userId: 'account-1' as string | null,
    loading: false,
    displayName: 'Welcome Tester' as string | null,
    welcomeStatus: 'needed' as 'loading' | 'needed' | 'seen',
  },
  variant: 'hub' as 'hub' | 'euro',
  fetchPublishedWeeklySeasons: vi.fn(),
  fetchHubMembership: vi.fn(),
  fetchPlayerPreferences: vi.fn(),
  setOnboardingProgress: vi.fn(),
  setCompetitionFollow: vi.fn(),
  registerBonusCompetition: vi.fn(),
}))

vi.mock('../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ ...mocks.auth, markWelcomed: mocks.markWelcomed }),
}))

vi.mock('../../src/services/supabase/weeklyCatalogue', () => ({
  fetchPublishedWeeklySeasons: mocks.fetchPublishedWeeklySeasons,
}))
vi.mock('../../src/services/supabase/competitionGames', () => ({
  fetchHubMembership: mocks.fetchHubMembership,
}))
vi.mock('../../src/services/supabase/playerPreferences', () => ({
  fetchPlayerPreferences: mocks.fetchPlayerPreferences,
  setOnboardingProgress: mocks.setOnboardingProgress,
  setCompetitionFollow: mocks.setCompetitionFollow,
}))
vi.mock('../../src/services/supabase/bonusGames', () => ({
  registerBonusCompetition: mocks.registerBonusCompetition,
}))
vi.mock('../../src/services/supabase/seasonClubs', () => ({
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
    serverNow: '2026-08-20T09:00:00.000Z',
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

/**
 * THE REAL SITE CONFIGURATION, BOTH OF THEM.
 *
 * `siteConfiguration()` is deliberately a function of its arguments alone so a
 * test can construct both products in one process — which is exactly what the
 * Euro case below needs, and is stronger than a hand-shaped stub: a mock would
 * have to be told what `servesDomesticCompetitions` is, and a mock that was
 * told wrongly would prove nothing.
 */
function renderWelcome() {
  return render(
    <SiteProvider configuration={siteConfiguration(mocks.variant)}>
      <MemoryRouter initialEntries={['/welcome']}>
        <Routes>
          <Route path="/welcome" element={<VNextWelcomeDestination />} />
          <Route path="/join/:code" element={<p>Invite destination</p>} />
          <Route path="/" element={<p>Hub destination</p>} />
        </Routes>
      </MemoryRouter>
    </SiteProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  clearPendingJoin()
  mocks.auth.userId = 'account-1'
  mocks.auth.loading = false
  mocks.auth.displayName = 'Welcome Tester'
  mocks.auth.welcomeStatus = 'needed'
  mocks.variant = 'hub'
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

describe('the vNext onboarding journey at /welcome', () => {
  it('opens the vNext journey and stamps the profile welcomed once', async () => {
    renderWelcome()

    expect(
      await screen.findByRole('heading', { name: 'Welcome, Welcome Tester' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
    expect(mocks.markWelcomed).toHaveBeenCalledTimes(1)
  })

  it('resumes at the step the server recorded rather than restarting', async () => {
    mocks.fetchPlayerPreferences.mockResolvedValue({
      onboarding: { step: 'games', completedAt: null },
      follows: [{ tournamentId: 'season-1', favouriteTeamId: null, followedAt: null }],
      pinnedRivals: [],
    })

    renderWelcome()

    expect(await screen.findByText('Step 3 of 4')).toBeInTheDocument()
    expect(screen.getByText('Premier League')).toBeInTheDocument()
  })

  it('sends a player who has already been welcomed away rather than round again', async () => {
    mocks.auth.welcomeStatus = 'seen'

    renderWelcome()

    expect(await screen.findByText('Hub destination')).toBeInTheDocument()
    expect(mocks.markWelcomed).not.toHaveBeenCalled()
  })

  it('stamps progress on a forward move and NOT on a step back', async () => {
    mocks.fetchPlayerPreferences.mockResolvedValue({
      onboarding: { step: 'clubs', completedAt: null },
      follows: [],
      pinnedRivals: [],
    })

    renderWelcome()
    await screen.findByText('Step 2 of 4')

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mocks.setOnboardingProgress).toHaveBeenCalledWith('games'))

    mocks.setOnboardingProgress.mockClear()

    // A HOST THAT STAMPED EVERY REPORT WOULD WALK STORED PROGRESS BACKWARDS
    // and resume the player there on their next sign-in. `direction` exists so
    // it cannot, and this is the assertion that keeps it that way.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    await screen.findByText('Step 2 of 4')
    expect(mocks.setOnboardingProgress).not.toHaveBeenCalled()
  })

  it('commits through the shared authority and hands a pending invite back', async () => {
    setPendingJoin('AUTH28')
    mocks.fetchPlayerPreferences.mockResolvedValue({
      onboarding: { step: 'review', completedAt: null },
      follows: [{ tournamentId: 'season-1', favouriteTeamId: null, followedAt: null }],
      pinnedRivals: [],
    })

    renderWelcome()
    await screen.findByText('Step 4 of 4')
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }))

    expect(await screen.findByText('Invite destination')).toBeInTheDocument()
    // The follow the resume carried is re-asserted and completion is stamped —
    // the same order `commitOnboarding.ts` owns for both presentations.
    expect(mocks.setCompetitionFollow).toHaveBeenCalledWith('season-1', true, null)
    expect(mocks.setOnboardingProgress).toHaveBeenCalledWith('review', true)
  })

  it('lands on the Hub when there is no invite waiting', async () => {
    mocks.fetchPlayerPreferences.mockResolvedValue({
      onboarding: { step: 'review', completedAt: null },
      follows: [],
      pinnedRivals: [],
    })

    renderWelcome()
    await screen.findByText('Step 4 of 4')
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }))

    expect(await screen.findByText('Hub destination')).toBeInTheDocument()
  })

  it('names what was refused and keeps the player on the screen', async () => {
    mocks.setCompetitionFollow.mockRejectedValue(new Error('refused'))
    mocks.fetchPlayerPreferences.mockResolvedValue({
      onboarding: { step: 'review', completedAt: null },
      follows: [{ tournamentId: 'season-1', favouriteTeamId: null, followedAt: null }],
      pinnedRivals: [],
    })

    renderWelcome()
    await screen.findByText('Step 4 of 4')
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }))

    // NAMED, NOT SUMMARISED. "Some things did not save" leaves a player with no
    // idea what to check.
    expect(await screen.findByText(/Following Premier League/)).toBeInTheDocument()
    expect(screen.queryByText('Hub destination')).toBeNull()
    // And onboarding still completed, so nobody is trapped in setup by it.
    expect(mocks.setOnboardingProgress).toHaveBeenCalledWith('review', true)
  })

  it('runs the tournament first-run screen on the Euro build, not the domestic steps', async () => {
    // The four steps are DOMESTIC — follow weekly competitions, favourite one
    // of their clubs, join their games. The cutover flags reach both
    // deployments from one `netlify.toml`, so the variant is asked here.
    mocks.variant = 'euro'

    renderWelcome()

    await waitFor(() => expect(mocks.markWelcomed).toHaveBeenCalled())
    expect(screen.queryByText('Step 1 of 4')).toBeNull()
    expect(mocks.fetchPublishedWeeklySeasons).not.toHaveBeenCalled()
  })
})
