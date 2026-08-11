import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HubPage } from '../../../src/features/hub/HubPage'
import { PlayerCompetitionsProvider } from '../../../src/app/providers/PlayerCompetitionsProvider'
import type { HubSeasonMembership } from '../../../src/services/supabase/competitionGames'

/**
 * The Hub, as the personalised dashboard the 10 August authority requires.
 *
 * WHAT THESE ASSERTIONS REPLACE. This file used to test a competition
 * catalogue: "My competitions" and "Discover", each a large card listing every
 * game whether or not the player was in it. Home is explicitly not a catalogue
 * — discovery must not compete with outstanding actions, and on a platform of
 * many competitions Home defaults to the player's own. The old page did the
 * opposite of both.
 *
 * The three membership states it did protect are kept, because they are still
 * the property that matters most: a failed read must never be dressed as "you
 * have joined nothing".
 */

const mocks = vi.hoisted(() => ({
  fetchHubMembership: vi.fn<() => Promise<HubSeasonMembership[]>>(),
  fetchSeasonFixtureList: vi.fn(),
  fetchPublishedWeeklySeasons: vi.fn(),
}))

vi.mock('../../../src/services/supabase/competitionGames', () => ({
  fetchHubMembership: mocks.fetchHubMembership,
}))

vi.mock('../../../src/services/supabase/seasonFixtureList', () => ({
  fetchSeasonFixtureList: mocks.fetchSeasonFixtureList,
}))

// Which seasons the server publishes, and where each one lives (contract 147).
// There is no static catalogue behind this any more: a competition the mock
// does not return does not exist for the shell, which is the property.
vi.mock('../../../src/services/supabase/weeklyCatalogue', () => ({
  fetchPublishedWeeklySeasons: mocks.fetchPublishedWeeklySeasons,
}))

// The Matchweek Recap's two contracts (151 and 150) and the league list it
// needs. None is under test here — each has its own model suite — and a player
// with no settled matchweek renders no recap, which is the state these
// assertions are about.
vi.mock('../../../src/services/supabase/seasonPlayerProfile', () => ({
  fetchSeasonPlayerProfile: vi.fn(() => Promise.reject(new Error('not under test'))),
}))
vi.mock('../../../src/services/supabase/seasonLeagueMovement', () => ({
  fetchSeasonLeagueMovement: vi.fn(() => Promise.reject(new Error('not under test'))),
}))
vi.mock('../../../src/services/supabase/gameLeagues', () => ({
  fetchMyGameLeagues: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'player-1', displayName: 'Alex' }),
}))

// The Hub asks each joined game what it needs; none of those reads is under
// test here, and a rejected promise is the state the panel handles.
vi.mock('../../../src/features/hub/loadCompetitionWeek', () => ({
  loadCompetitionWeek: vi.fn(() => Promise.reject(new Error('not under test'))),
  playsAnyGame: () => true,
}))

function joinedPremierLeague(): HubSeasonMembership {
  return {
    seasonName: 'Premier League 2026/27',
    tournamentId: '60000000-0000-0000-0000-000000000001',
    seasonStatus: 'active',
    seasonGames: {
      competitionMember: true,
      serverNow: '2026-08-06T12:00:00Z',
      games: [
        {
          id: '60000000-0000-0000-0000-000000000101',
          gameKey: 'main_predictor',
          active: true,
          displayName: 'Main Predictor',
          registrationOpensAt: null,
          registrationClosesAt: null,
          completedAt: null,
          allowRejoin: false,
          membership: {
            status: 'active',
            joinedAt: '2026-08-01T10:00:00Z',
            leftAt: null,
            disqualifiedAt: null,
          },
        },
      ],
    },
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <PlayerCompetitionsProvider>
        <HubPage />
      </PlayerCompetitionsProvider>
    </MemoryRouter>,
  )
}

describe('the Hub is a dashboard, not a catalogue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchPublishedWeeklySeasons.mockResolvedValue([
      {
        competitionSlug: 'premier-league',
        seasonKey: '2026-27',
        competitionId: '60000000-0000-0000-0000-000000000010',
        competitionName: 'Premier League',
        seasonId: '60000000-0000-0000-0000-000000000001',
        seasonName: 'Premier League 2026/27',
        status: 'active',
        timeZone: 'Europe/London',
      },
    ])
    mocks.fetchSeasonFixtureList.mockResolvedValue({
      competition: { id: 'c', name: 'Premier League', seasonKey: '2026-27', timeZone: 'UTC' },
      window: { from: '2026-08-01T00:00:00Z', to: '2026-08-20T00:00:00Z' },
      serverNow: null,
      fixtures: [],
    })
  })

  it('claims no membership while the read is loading', () => {
    mocks.fetchHubMembership.mockReturnValue(new Promise(() => {}))
    renderPage()

    // Not an empty dashboard, and not a catalogue of everything published.
    expect(screen.queryByText(/Choose your competition/i)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
  })

  it('reports a failed read as a failure rather than as "you have joined nothing"', async () => {
    mocks.fetchHubMembership.mockRejectedValue(new Error('network'))
    renderPage()

    await waitFor(() =>
      expect(screen.getByText('We could not load your competitions')).toBeInTheDocument(),
    )
    expect(screen.queryByText(/Pick a competition to play in/i)).toBeNull()
  })

  it('sends a player who plays in nothing to discovery, not to a wall of cards', async () => {
    mocks.fetchHubMembership.mockResolvedValue([])
    renderPage()

    await waitFor(() =>
      expect(screen.getByText('Pick a competition to play in')).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: 'Browse competitions' })).toHaveAttribute(
      'href',
      '/competitions',
    )
  })

  it('leads with what needs doing and keeps discovery quiet and last', async () => {
    mocks.fetchHubMembership.mockResolvedValue([joinedPremierLeague()])
    renderPage()

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Next' })).toBeInTheDocument(),
    )

    // The player's own competition is a compact row, not a card advertising
    // every game in it.
    const competitions = screen.getByRole('heading', { name: 'Your competitions' })
    expect(competitions).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Premier League/ })).toHaveAttribute(
      'href',
      '/competitions/premier-league/2026-27',
    )

    // Discovery is present, and is a single quiet link rather than a section of
    // equal-weight cards for competitions the player does not play in.
    expect(screen.getByRole('link', { name: 'All competitions' })).toHaveAttribute(
      'href',
      '/competitions',
    )
    expect(screen.queryByRole('heading', { name: 'Discover' })).toBeNull()
  })
})
