import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminResultsPage } from '../../../src/features/admin/AdminResultsPage'

const mocks = vi.hoisted(() => ({
  tournamentReload: vi.fn(),
  useTournamentData: vi.fn(),
  fetchResults: vi.fn(),
  fetchRevisions: vi.fn(),
  confirmResult: vi.fn(),
  correctResult: vi.fn(),
  clearResult: vi.fn(),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => mocks.useTournamentData(),
}))

vi.mock('../../../src/services/supabase/adminResults', () => ({
  fetchAdminMatchResults: mocks.fetchResults,
  fetchAdminMatchResultRevisions: mocks.fetchRevisions,
  confirmAdminMatchResult: mocks.confirmResult,
  correctAdminMatchResult: mocks.correctResult,
  clearAdminMatchResult: mocks.clearResult,
}))

const match = {
  id: 'match-1',
  matchRef: 'GA-1',
  round: 'group' as const,
  groupId: 'group-a',
  matchday: 1,
  homeSource: 'A1',
  awaySource: 'A2',
  homeTeamId: 'team-1',
  awayTeamId: 'team-2',
  matchDate: '2028-06-09',
  kickoffAt: null,
  venue: 'Cardiff',
  homeScore: null,
  awayScore: null,
}

const scheduledResult = {
  matchId: 'match-1',
  state: 'scheduled' as const,
  method: null,
  home90: null,
  away90: null,
  home120: null,
  away120: null,
  homePenalties: null,
  awayPenalties: null,
  winnerTeamId: null,
  version: 0,
  confirmedAt: null,
  correctedAt: null,
  reason: null,
}

function readyTournament(overrides = {}) {
  return {
    status: 'ready' as const,
    reload: mocks.tournamentReload,
    data: {
      tournament: {
        id: 'tournament-1',
        name: 'UEFA Euro 2028',
        year: 2028,
        startsOn: '2028-06-09',
        endsOn: '2028-07-09',
        lockAt: null,
      },
      groups: [{ id: 'group-a', letter: 'A' }],
      teams: [
        { id: 'team-1', name: 'Team A1', groupId: 'group-a', slot: 1 },
        { id: 'team-2', name: 'Team A2', groupId: 'group-a', slot: 2 },
      ],
      matches: [{ ...match, ...overrides }],
    },
  }
}

describe('AdminResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useTournamentData.mockReturnValue(readyTournament())
    mocks.fetchResults.mockResolvedValue([scheduledResult])
    mocks.fetchRevisions.mockResolvedValue([])
    mocks.confirmResult.mockResolvedValue(undefined)
    mocks.correctResult.mockResolvedValue(undefined)
    mocks.clearResult.mockResolvedValue(undefined)
  })

  it('does not write until the administrator confirms the review dialog', async () => {
    render(<AdminResultsPage />)

    const editor = await screen.findByRole('region', {
      name: /Team A1 v Team A2/,
    })
    await screen.findByText('No result revisions yet.')
    const regulation = within(editor).getByRole('group', {
      name: '90-minute score',
    })
    fireEvent.change(within(regulation).getByLabelText('Team A1'), {
      target: { value: '2' },
    })
    fireEvent.change(within(regulation).getByLabelText('Team A2'), {
      target: { value: '1' },
    })
    fireEvent.click(
      within(editor).getByRole('button', {
        name: 'Review confirm result',
      }),
    )

    const dialog = screen.getByRole('dialog', {
      name: 'Review: Confirm result',
    })
    expect(dialog).toHaveTextContent('2–1')
    expect(mocks.confirmResult).not.toHaveBeenCalled()

    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Confirm result',
        exact: true,
      }),
    )

    await waitFor(() =>
      expect(mocks.confirmResult).toHaveBeenCalledWith({
        matchId: 'match-1',
        method: 'regulation',
        home90: 2,
        away90: 1,
        home120: null,
        away120: null,
        homePenalties: null,
        awayPenalties: null,
        reason: null,
      }),
    )
    expect(mocks.tournamentReload).toHaveBeenCalledOnce()
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Confirm result saved',
    )
  })

  it('fails closed when a fixture participant is unresolved', async () => {
    mocks.useTournamentData.mockReturnValue(
      readyTournament({ awayTeamId: null }),
    )
    render(<AdminResultsPage />)

    const editor = await screen.findByRole('region', {
      name: /Team A1 v A2/,
    })
    await screen.findByText('No result revisions yet.')
    expect(
      within(editor).getByText(/participants are unresolved/i),
    ).toBeVisible()
    expect(
      within(editor).getByRole('button', {
        name: 'Review confirm result',
      }),
    ).toBeDisabled()
  })

  it('refuses to expose controls when the result query is incomplete', async () => {
    mocks.fetchResults.mockResolvedValue([])
    render(<AdminResultsPage />)

    expect(
      await screen.findByText('Result administration is incomplete'),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Review confirm result' }),
    ).not.toBeInTheDocument()
  })
})
