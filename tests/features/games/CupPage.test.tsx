import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CupPage } from '../../../src/features/games/CupPage'
import type { CupRead } from '../../../src/services/supabase/cupModel'

const mocks = vi.hoisted(() => ({
  fetchMyCup: vi.fn<() => Promise<CupRead>>(),
}))

vi.mock('../../../src/services/supabase/cup', () => ({
  fetchMyCup: mocks.fetchMyCup,
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: { tournament: { id: 'tournament-1' } },
  }),
}))

function read(overrides: Partial<CupRead> = {}): CupRead {
  return {
    serverNow: '2028-06-05T12:00:00Z',
    competitionId: 'comp-cup',
    registrationClosesAt: '2028-06-06T12:00:00Z',
    drawCompletedAt: null,
    entrant: { joinedAt: '2028-06-01T09:00:00Z', outcome: 'active' },
    entrantCount: 7,
    groupCount: 0,
    myGroup: null,
    myFixtures: [],
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <CupPage />
    </MemoryRouter>,
  )
}

describe('CupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gates non-entrants towards the Games hub', async () => {
    mocks.fetchMyCup.mockResolvedValue(read({ entrant: null }))
    renderPage()

    expect(await screen.findByText('You haven’t entered the Predictor Cup')).toBeTruthy()
  })

  it('shows the waiting-for-draw state before the draw', async () => {
    mocks.fetchMyCup.mockResolvedValue(read())
    renderPage()

    expect(await screen.findByText('Waiting for the draw')).toBeTruthy()
    expect(screen.getByText(/The field \(7 so far\) closes/)).toBeTruthy()
  })

  it('renders the drawn group and the caller’s ties', async () => {
    mocks.fetchMyCup.mockResolvedValue(
      read({
        drawCompletedAt: '2028-06-06T13:00:00Z',
        groupCount: 2,
        myGroup: {
          ordinal: 1,
          size: 4,
          members: [
            { userId: 'user-1', displayName: 'Alpha', drawNumber: 1 },
            { userId: 'user-2', displayName: 'Beta', drawNumber: 2 },
            { userId: 'user-3', displayName: 'Gamma', drawNumber: 3 },
            { userId: 'user-4', displayName: 'Delta', drawNumber: 4 },
          ],
        },
        myFixtures: [
          {
            fixtureId: 'fix-1',
            stage: 'group',
            matchday: 1,
            windowLabel: 'Cup Matchday 1',
            windowOpensAt: '2028-06-07T12:00:00Z',
            windowLocksAt: '2028-06-09T13:00:00Z',
            opponent: { userId: 'user-2', displayName: 'Beta' },
          },
        ],
      }),
    )
    renderPage()

    expect(await screen.findByText('Group 1')).toBeTruthy()
    expect(screen.getByText('#1 Alpha')).toBeTruthy()
    expect(screen.getByText('Beta', { selector: 'strong' })).toBeTruthy()
    expect(screen.getByText(/Predictions lock/)).toBeTruthy()
  })
})
