import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SeasonAdminPage } from '../../../src/features/admin/SeasonAdminPage'
import type { HubSeasonMembership } from '../../../src/services/supabase/competitionGames'
import type { SeasonMatchweekFixtures } from '../../../src/services/supabase/seasonFixturesModel'
import type {
  SeasonOpenOutcome,
  SeasonResultOutcome,
} from '../../../src/services/supabase/seasonAdmin'

const mocks = vi.hoisted(() => ({
  fetchHubMembership: vi.fn<() => Promise<HubSeasonMembership[]>>(),
  fetchSeasonMatchweekFixtures: vi.fn<() => Promise<SeasonMatchweekFixtures>>(),
  openSeasonCompetition: vi.fn<() => Promise<SeasonOpenOutcome>>(),
  recordSeasonFixtureResult: vi.fn<() => Promise<SeasonResultOutcome>>(),
  fetchAdministeredSeasons: vi.fn(),
}))

// The seasons this page administers come from its OWN read, which includes
// drafts — deliberately not the published catalogue, because opening a draft is
// what an administrator is here for and contract 147 excludes drafts from the
// player-facing one.
vi.mock('../../../src/services/supabase/administeredSeasons', () => ({
  fetchAdministeredSeasons: mocks.fetchAdministeredSeasons,
}))

vi.mock('../../../src/services/supabase/competitionGames', () => ({
  fetchHubMembership: mocks.fetchHubMembership,
}))

vi.mock('../../../src/services/supabase/seasonFixtures', () => ({
  fetchSeasonMatchweekFixtures: mocks.fetchSeasonMatchweekFixtures,
}))

// Contract 138's queues have their own suite; here they only need to not tear
// the page down while they load.
vi.mock('../../../src/services/supabase/providerReviewQueues', () => ({
  fetchProviderReviewQueues: () => new Promise(() => {}),
  acknowledgeReviewItems: vi.fn(),
}))

vi.mock('../../../src/services/supabase/seasonAdmin', () => ({
  openSeasonCompetition: mocks.openSeasonCompetition,
  recordSeasonFixtureResult: mocks.recordSeasonFixtureResult,
}))

const LMS_ID = '70000000-0000-0000-0000-000000000201'

function membership(): HubSeasonMembership {
  return {
    seasonName: 'Premier League 2026/27',
    tournamentId: 'season-1',
    seasonStatus: 'active',
    seasonGames: {
      competitionMember: true,
      serverNow: '2026-08-09T09:00:00Z',
      games: [
        {
          id: LMS_ID,
          gameKey: 'last_man_standing',
          active: true,
          displayName: null,
          registrationOpensAt: null,
          registrationClosesAt: null,
          completedAt: null,
          allowRejoin: false,
          membership: null,
        },
      ],
    },
  }
}

function matchweek(status = 'scheduled'): SeasonMatchweekFixtures {
  return {
    matchweek: 1,
    matchweekCount: 38,
    fixtures: [
      {
        id: 'fixture-1',
        kickoffAt: '2026-08-08T14:00:00Z',
        status,
        homeName: 'Arsenal',
        awayName: 'Everton',
        homeScore: status === 'played' ? 3 : null,
        awayScore: status === 'played' ? 0 : null,
      },
    ],
  }
}

beforeEach(() => {
  // A DRAFT season, which is the case that matters: it is absent from the
  // player-facing catalogue and must still be administrable.
  mocks.fetchAdministeredSeasons.mockResolvedValue([
    {
      id: 'season-1',
      name: 'Premier League 2026/27',
      seasonKey: '2026-27',
      status: 'draft',
    },
  ])
  vi.clearAllMocks()
  mocks.fetchHubMembership.mockResolvedValue([membership()])
  mocks.fetchSeasonMatchweekFixtures.mockResolvedValue(matchweek())
})

describe('the competition administration surface', () => {
  it('offers Confirm on a fixture with no result, and neither Correct nor Clear', async () => {
    render(<SeasonAdminPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Correct' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
    // Twice on purpose: the visible row heading, and the visually hidden
    // fieldset legend that gives "Home"/"Away"/"Reason" their fixture.
    expect(screen.getAllByText('Arsenal v Everton')).toHaveLength(2)
  })

  it('offers Correct and Clear once the server holds a result, and not Confirm', async () => {
    // Confirming over an existing result is refused so the correction's audit
    // trail survives. The interface does not offer a control the server would
    // reject — the dead-button defect the competition dashboard already had.
    mocks.fetchSeasonMatchweekFixtures.mockResolvedValue(matchweek('played'))
    render(<SeasonAdminPage />)

    await waitFor(() => expect(screen.getByText('3 - 0')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Correct' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull()
  })

  it('sends the scores as typed and re-reads the matchweek afterwards', async () => {
    mocks.recordSeasonFixtureResult.mockResolvedValue({
      fixtureId: 'fixture-1',
      action: 'confirm',
      revision: 1,
    })
    render(<SeasonAdminPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Home'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Away'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() =>
      expect(mocks.recordSeasonFixtureResult).toHaveBeenCalledWith(
        expect.objectContaining({ fixtureId: 'fixture-1', action: 'confirm', home: 2, away: 1 }),
      ),
    )
    // The write returns what it did, not the matchweek's new state. Patching
    // the list from its return value would be a second copy of the truth.
    await waitFor(() => expect(mocks.fetchSeasonMatchweekFixtures).toHaveBeenCalledTimes(2))
  })

  it('reports a refused write as the rule it met, not as "try again"', async () => {
    mocks.recordSeasonFixtureResult.mockRejectedValue({ code: '22023' })
    render(<SeasonAdminPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(screen.getByText(/reason is required/i)).toBeTruthy())
  })

  it('does not dress an idempotent no-op as a success', async () => {
    mocks.openSeasonCompetition.mockResolvedValue({
      outcome: 'already_open',
      reason: null,
      gameKey: 'last_man_standing',
      setupWritten: null,
      windows: null,
      raw: {},
    })
    render(<SeasonAdminPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open for play' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Open for play' }))

    await waitFor(() => expect(screen.getByText(/Nothing was changed/)).toBeTruthy())
  })

  it('states what it deliberately does not offer, and why', async () => {
    // An operator who cannot see a capability assumes it does not exist. Both
    // remaining absences are granted server-side and missing here because no
    // browser read exposes what they would act on.
    //
    // Provider REVIEW used to be on this list and is not any more: contract 138
    // gave the five ingestion queues a read, so the panel above shows them. What
    // is still absent is the approve/reject decision over a staged calendar,
    // whose list nobody can inspect.
    render(<SeasonAdminPage />)
    await waitFor(() => expect(screen.getByText(/Not offered here/)).toBeTruthy())
    expect(screen.getByText(/enumerates a competition’s entrants/)).toBeTruthy()
    expect(screen.getByText(/staged provider calendar/)).toBeTruthy()
  })

  it('says there is no season rather than spinning for ever', async () => {
    // A permanent skeleton reads as a slow environment rather than an absent
    // season, and the two need different actions from an operator.
    mocks.fetchHubMembership.mockResolvedValue([])
    render(<SeasonAdminPage />)

    await waitFor(() => expect(screen.getByText(/holds no season row named/)).toBeTruthy())
    expect(screen.getByText(/no season here to read a matchweek from/)).toBeTruthy()
    expect(mocks.fetchSeasonMatchweekFixtures).not.toHaveBeenCalled()
  })
})
