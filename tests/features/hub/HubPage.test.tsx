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
}))

vi.mock('../../../src/services/supabase/competitionGames', () => ({
  fetchHubMembership: mocks.fetchHubMembership,
}))

vi.mock('../../../src/services/supabase/seasonFixtureList', () => ({
  fetchSeasonFixtureList: mocks.fetchSeasonFixtureList,
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
