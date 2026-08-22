import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { VNextMatchCentreDestination } from '../../src/app/vnext/VNextMatchesDestination'
import { matchCentreIntentRoute } from '../../src/app/vnext/matchCentreNavigation'
import {
  competitionGameRoute,
  competitionSectionRoute,
} from '../../src/app/weeklyRoutes'

const bridge = vi.hoisted(() => ({
  gameCompetitionId: 'game-competition-main',
  predictorReachable: true,
  screenProps: null as null | Record<string, unknown>,
}))

const seasonGameCompetitionId = vi.hoisted(() => vi.fn(() => bridge.gameCompetitionId))
const routeEnabled = vi.hoisted(() => vi.fn(() => bridge.predictorReachable))

vi.mock('../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'player-1', loading: false }),
}))

vi.mock('../../src/features/hub/useSeasonGameCompetitionId', () => ({
  useSeasonGameCompetitionId: seasonGameCompetitionId,
}))

vi.mock('../../src/app/routeFlags', () => ({
  isNextUi: routeEnabled,
}))

vi.mock('../../src/app/vnext/seam', () => ({
  useViewerFormatting: () => undefined,
  useShellIntentNavigation: () => vi.fn(),
}))

vi.mock('../../src/app/vnext/VNextAppRoot', () => ({
  VNextAppRoot: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../src/vnext/integration/matches/VNextMatchesScreen', () => ({
  VNextMatchesScreen: () => null,
}))

vi.mock('../../src/vnext/integration/matches/VNextMatchCentreScreen', () => ({
  VNextMatchCentreScreen: (props: Record<string, unknown>) => {
    bridge.screenProps = props
    const onIntent = props.onIntent as
      | ((intent: { kind: 'link'; link: 'match-predictor' }) => void)
      | undefined
    return (
      <button type="button" onClick={() => onIntent?.({ kind: 'link', link: 'match-predictor' })}>
        Open the Match Predictor
      </button>
    )
  },
}))

function renderDestination() {
  return render(
    <MemoryRouter initialEntries={['/competitions/premier-league/2027-28/matches/fixture-9']}>
      <Routes>
        <Route
          path="/competitions/:competitionSlug/:seasonSlug/matches/:fixtureId"
          element={<VNextMatchCentreDestination />}
        />
        <Route
          path="/competitions/:competitionSlug/:seasonSlug/games/match-predictor"
          element={<div>Predictor destination</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Match Centre prediction bridge', () => {
  it('passes the cached Match Predictor membership and route capability into the connected screen', () => {
    renderDestination()

    expect(seasonGameCompetitionId).toHaveBeenCalledWith(
      'premier-league',
      '2027-28',
      'main_predictor',
    )
    expect(routeEnabled).toHaveBeenCalledWith('seasonMatchPredictor')
    expect(bridge.screenProps).toMatchObject({
      gameCompetitionId: 'game-competition-main',
      predictorReachable: true,
    })
  })

  it('turns the Match Predictor intent into a real application navigation', () => {
    renderDestination()

    fireEvent.click(screen.getByRole('button', { name: 'Open the Match Predictor' }))

    expect(screen.getByText('Predictor destination')).toBeTruthy()
  })

  it('maps every related Match Centre link through existing route helpers', () => {
    const context = { competitionSlug: 'premier-league', seasonSlug: '2027-28' }

    expect(
      matchCentreIntentRoute(context, { kind: 'link', link: 'match-predictor' }),
    ).toBe(competitionGameRoute(context, 'match-predictor'))
    expect(
      matchCentreIntentRoute(context, { kind: 'link', link: 'competition-matches' }),
    ).toBe(competitionSectionRoute(context, 'matches'))
    expect(matchCentreIntentRoute(context, { kind: 'back' })).toBeNull()
  })
})
