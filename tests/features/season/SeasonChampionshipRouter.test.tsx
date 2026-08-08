import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/features/season/SeasonGameRouteBundle', () => ({
  SeasonChampionshipRoute: () => <p>Championship index</p>,
  SeasonChampionshipFixtureRoute: () => <p>My fixture</p>,
  SeasonChampionshipTableRoute: () => <p>Championship table</p>,
  SeasonChampionshipFixturesRoute: () => <p>Championship fixtures</p>,
}))

import { SeasonChampionshipRouter } from '../../../src/features/season/SeasonChampionshipRouter'

function renderPath(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SeasonChampionshipRouter />
    </MemoryRouter>,
  )
}

describe('SeasonChampionshipRouter', () => {
  it('keeps the Championship index as the wildcard root', () => {
    renderPath('/competitions/scottish-premiership/2026-27/games/championship/')
    expect(screen.getByText('Championship index')).toBeTruthy()
  })

  it('routes a selected Championship to My Fixture', () => {
    renderPath('/competitions/scottish-premiership/2026-27/games/championship/private-1')
    expect(screen.getByText('My fixture')).toBeTruthy()
  })

  it('routes the selected instance table and fixtures independently', () => {
    renderPath('/competitions/scottish-premiership/2026-27/games/championship/private-1/table')
    expect(screen.getByText('Championship table')).toBeTruthy()

    renderPath('/competitions/scottish-premiership/2026-27/games/championship/private-1/fixtures')
    expect(screen.getByText('Championship fixtures')).toBeTruthy()
  })
})
