import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import {
  SeasonChampionshipIndexPage,
  SeasonChampionshipPlayerPage,
} from '../../../src/features/season/SeasonChampionshipPages'
import type {
  ChampionshipDiscovery,
  ChampionshipPlayerView,
} from '../../../src/services/supabase/seasonCupPlayer'

const PRIVATE_ID = 'd3fa0007-2026-4808-8000-000000000001'
const NICKY = '698e8c98-0f39-42a3-bd56-6f7cb98f446d'
const ALEX = 'cd0e2446-4a7b-437f-858e-fb58d8329994'

const discovery: ChampionshipDiscovery = {
  tournamentId: '6a64a59b-b721-443e-a864-0fd52db1edbd',
  serverNow: '2026-08-08T00:10:00Z',
  instances: [
    {
      competitionId: PRIVATE_ID,
      visibility: 'private',
      availabilityStatus: 'active',
      entered: true,
      entrantCount: 8,
      completedAt: null,
      registrationClosesAt: '2026-08-07T22:48:48Z',
      phaseKind: 'initial',
      groupOrdinal: 1,
      currentFixture: {
        fixtureId: 'fixture-1',
        windowSequence: 1,
        windowLabel: 'Matchweek 2',
        locksAt: '2026-08-08T14:00:00Z',
        matchday: 1,
        isHome: true,
        opponent: { userId: ALEX, displayName: 'Alex Turner' },
        status: 'pending',
        myPoints: null,
        opponentPoints: null,
        result: null,
      },
    },
  ],
}

const playerView: ChampionshipPlayerView = {
  competitionId: PRIVATE_ID,
  entered: true,
  phaseReady: true,
  visibility: 'private',
  availabilityStatus: 'active',
  phaseKind: 'initial',
  group: {
    id: 'group-1',
    ordinal: 1,
    size: 8,
    phaseKind: 'initial',
    parentGroupId: null,
  },
  members: [
    { userId: NICKY, displayName: 'Nicky Gregal', isYou: true },
    { userId: ALEX, displayName: 'Alex Turner', isYou: false },
  ],
  table: [
    {
      userId: NICKY,
      isYou: true,
      groupRank: 1,
      tablePoints: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      windowPoints: 0,
      exacts: 0,
      corrects: 0,
      scorelineError: 0,
    },
    {
      userId: ALEX,
      isYou: false,
      groupRank: 2,
      tablePoints: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      windowPoints: 0,
      exacts: 0,
      corrects: 0,
      scorelineError: 0,
    },
  ],
  fixtures: [
    {
      fixtureId: 'fixture-1',
      windowSequence: 1,
      windowLabel: 'Matchweek 2',
      opensAt: '2026-08-07T22:48:48Z',
      locksAt: '2026-08-08T14:00:00Z',
      matchday: 1,
      home: { userId: NICKY, displayName: 'Nicky Gregal' },
      away: { userId: ALEX, displayName: 'Alex Turner' },
      isMyFixture: true,
      isHome: true,
      status: 'pending',
      homePoints: null,
      awayPoints: null,
      result: null,
    },
    {
      fixtureId: 'fixture-2',
      windowSequence: 1,
      windowLabel: 'Matchweek 2',
      opensAt: '2026-08-07T22:48:48Z',
      locksAt: '2026-08-08T14:00:00Z',
      matchday: 1,
      home: { userId: 'player-3', displayName: 'Bo' },
      away: { userId: 'player-4', displayName: 'Priya Shah' },
      isMyFixture: false,
      isHome: false,
      status: 'pending',
      homePoints: null,
      awayPoints: null,
      result: null,
    },
  ],
}

function renderIndex() {
  render(
    <MemoryRouter>
      <SeasonChampionshipIndexPage
        gateway={{ load: async () => discovery }}
        hrefFor={(competitionId) => `/championship/${competitionId}`}
      />
    </MemoryRouter>,
  )
}

function renderPlayer(mode: 'fixture' | 'table' | 'fixtures') {
  render(
    <MemoryRouter>
      <SeasonChampionshipPlayerPage
        gateway={{ load: async () => playerView }}
        mode={mode}
      />
    </MemoryRouter>,
  )
}

describe('Predictor Championship instance UI', () => {
  it('discovers an entered private Championship and names the real next opponent', async () => {
    renderIndex()

    expect(await screen.findByText('Private Championship')).toBeTruthy()
    expect(screen.getByText(/You vs Alex Turner/)).toBeTruthy()
    const link = screen.getByRole('link', { name: /Your Championship/ })
    expect(link.getAttribute('href')).toBe(`/championship/${PRIVATE_ID}`)
  })

  it('renders Nicky Gregal v Alex Turner as the server-owned current fixture', async () => {
    renderPlayer('fixture')

    expect(await screen.findByText('My Fixture')).toBeTruthy()
    expect(screen.getByText('Matchweek 2')).toBeTruthy()
    expect(screen.getByText('Nicky Gregal')).toBeTruthy()
    expect(screen.getByText('Alex Turner')).toBeTruthy()
    expect(screen.getByText(/Match Predictor card for Matchweek 2/)).toBeTruthy()
  })

  it('uses the server-ranked table but replaces opaque ids with disclosed display names', async () => {
    renderPlayer('table')

    expect(await screen.findByText('Table')).toBeTruthy()
    expect(screen.getByText('Nicky Gregal')).toBeTruthy()
    expect(screen.getByText('Alex Turner')).toBeTruthy()
    expect(screen.getByText('You')).toBeTruthy()
  })

  it('shows the whole group round and marks the caller fixture', async () => {
    renderPlayer('fixtures')

    expect(await screen.findByText('Fixtures')).toBeTruthy()
    expect(screen.getByText('Matchweek 2')).toBeTruthy()
    expect(screen.getByText('Your fixture')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Priya Shah')).toBeTruthy())
  })
})
