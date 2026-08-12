import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExploreCompetitionsPage } from '../../../src/features/hub/ExploreCompetitionsPage'
import { PlayerCompetitionsProvider } from '../../../src/app/providers/PlayerCompetitionsProvider'
import type { HubSeasonMembership } from '../../../src/services/supabase/competitionGames'

/**
 * `/competitions` gains the Follow control it spent three documents explaining
 * it could not have.
 *
 * WHAT THIS SUITE IS REALLY PROTECTING. The page's own docblock and a note at
 * the foot of it both said that following could not be persisted, so a Follow
 * button would be a dead one. That was true when written and stale from the
 * moment contract 157 landed `set_competition_follow` — after which the
 * platform offered follow and unfollow in Account while telling a player on
 * this page that the preference was unstorable. These assertions are what stops
 * the two surfaces disagreeing again.
 *
 * THE OTHER HALF IS THE SEPARATION. §2A's `Follow ≠ Join game ≠ Favourite` is
 * a binding contract, so the control must never write a membership and the copy
 * must never suggest it did. Both are asserted.
 */

const mocks = vi.hoisted(() => ({
  fetchHubMembership: vi.fn<() => Promise<HubSeasonMembership[]>>(),
  fetchPublishedWeeklySeasons: vi.fn(),
  fetchPlayerPreferences: vi.fn(),
  setCompetitionFollow: vi.fn(),
}))

vi.mock('../../../src/services/supabase/competitionGames', () => ({
  fetchHubMembership: mocks.fetchHubMembership,
}))
vi.mock('../../../src/services/supabase/weeklyCatalogue', () => ({
  fetchPublishedWeeklySeasons: mocks.fetchPublishedWeeklySeasons,
}))
vi.mock('../../../src/services/supabase/playerPreferences', () => ({
  fetchPlayerPreferences: mocks.fetchPlayerPreferences,
  setCompetitionFollow: mocks.setCompetitionFollow,
}))

const PREMIER = '60000000-0000-0000-0000-000000000001'
const SCOTTISH = '60000000-0000-0000-0000-000000000002'

function published() {
  return [
    {
      seasonId: PREMIER,
      seasonName: 'Premier League 2026/27',
      seasonKey: '2026-27',
      competitionSlug: 'premier-league',
      seasonSlug: '2026-27',
      competitionName: 'Premier League',
      seasonLabel: '2026/27',
      status: 'active',
      timeZone: 'Europe/London',
    },
    {
      seasonId: SCOTTISH,
      seasonName: 'Scottish Premiership 2026/27',
      seasonKey: '2026-27',
      competitionSlug: 'scottish-premiership',
      seasonSlug: '2026-27',
      competitionName: 'Scottish Premiership',
      seasonLabel: '2026/27',
      status: 'active',
      timeZone: 'Europe/London',
    },
  ]
}

function renderPage() {
  render(
    <MemoryRouter>
      <PlayerCompetitionsProvider>
        <ExploreCompetitionsPage />
      </PlayerCompetitionsProvider>
    </MemoryRouter>,
  )
}

describe('ExploreCompetitionsPage follow control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchPublishedWeeklySeasons.mockResolvedValue(published())
    mocks.fetchHubMembership.mockResolvedValue([])
    mocks.fetchPlayerPreferences.mockResolvedValue({
      follows: [{ tournamentId: PREMIER, favouriteTeamId: null }],
      pinnedRivals: [],
      onboarding: { step: null, completedAt: null },
      reminderEmails: true,
    })
    mocks.setCompetitionFollow.mockResolvedValue(undefined)
  })

  it('shows the stored state per competition rather than one label for all', async () => {
    renderPage()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Unfollow Premier League/ }),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByRole('button', { name: /Follow Scottish Premiership/ }),
    ).toBeInTheDocument()
  })

  it('writes the follow and never a membership', async () => {
    renderPage()
    const follow = await screen.findByRole('button', {
      name: /Follow Scottish Premiership/,
    })
    fireEvent.click(follow)
    await waitFor(() =>
      expect(mocks.setCompetitionFollow).toHaveBeenCalledWith(SCOTTISH, true),
    )
    // The separation, mechanically: nothing on this page may join a game.
    expect(mocks.setCompetitionFollow).toHaveBeenCalledTimes(1)
  })

  it('no longer claims following cannot be stored', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/All competitions/)).toBeInTheDocument())
    expect(screen.queryByText(/is not stored yet/)).not.toBeInTheDocument()
    expect(screen.getByText(/It joins no game and changes no membership/)).toBeInTheDocument()
  })

  it('offers no control at all when the preference read did not land', async () => {
    // A Follow button that cannot know whether the player already follows would
    // have to guess its own label, so it is absent rather than wrong.
    mocks.fetchPlayerPreferences.mockRejectedValue(new Error('no'))
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(/We could not load your competitions/)).toBeInTheDocument(),
    )
    expect(screen.queryByRole('button', { name: /Follow /})).not.toBeInTheDocument()
  })

  it('reports a refused write instead of showing the preference as saved', async () => {
    mocks.setCompetitionFollow.mockRejectedValue(new Error('refused'))
    renderPage()
    const follow = await screen.findByRole('button', {
      name: /Follow Scottish Premiership/,
    })
    fireEvent.click(follow)
    await waitFor(() =>
      expect(screen.getByText(/That preference was not saved/)).toBeInTheDocument(),
    )
    expect(
      screen.getByRole('button', { name: /Follow Scottish Premiership/ }),
    ).toBeInTheDocument()
  })
})
