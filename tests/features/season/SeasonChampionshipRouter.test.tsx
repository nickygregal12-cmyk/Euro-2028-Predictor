import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/features/season/SeasonGameRouteBundle', () => ({
  SeasonChampionshipRoute: () => <p>Championship index</p>,
  SeasonChampionshipFixtureRoute: () => <p>My fixture</p>,
  SeasonChampionshipTableRoute: () => <p>Championship table</p>,
  SeasonChampionshipFixturesRoute: () => <p>Championship fixtures</p>,
}))

import { SeasonChampionshipRouter } from '../../../src/features/season/SeasonChampionshipRouter'

const PARENT = '/competitions/:competitionSlug/:seasonSlug/games/championship/*'
const BASE = '/competitions/scottish-premiership/2026-27/games/championship'

function renderPath(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={PARENT} element={<SeasonChampionshipRouter />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SeasonChampionshipRouter', () => {
  it('keeps the Championship index as the wildcard root', () => {
    renderPath(BASE)
    expect(screen.getByText('Championship index')).toBeTruthy()
  })

  it('routes a selected Championship to My Fixture', () => {
    renderPath(`${BASE}/private-1`)
    expect(screen.getByText('My fixture')).toBeTruthy()
  })

  it('routes the selected instance table', () => {
    renderPath(`${BASE}/private-1/table`)
    expect(screen.getByText('Championship table')).toBeTruthy()
  })

  it('routes the selected instance fixtures', () => {
    renderPath(`${BASE}/private-1/fixtures`)
    expect(screen.getByText('Championship fixtures')).toBeTruthy()
  })
})
