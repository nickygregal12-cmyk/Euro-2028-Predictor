import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from '../../../src/features/home/HomePage'
import type { HomeModel } from '../../../src/features/home/useHomeData'

const mocks = vi.hoisted(() => ({
  state: null as unknown,
}))

vi.mock('../../../src/features/home/useHomeData', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/features/home/useHomeData')>()
  return {
    ...original,
    useHomeData: () => mocks.state,
  }
})

vi.mock('../../../src/features/share/useShareModel', () => ({
  useShareModel: () => ({ model: null, variants: [] }),
}))

function duringModel(overrides: Partial<HomeModel> = {}): HomeModel {
  return {
    phase: 'during',
    displayName: 'Dashboard Tester',
    totalPoints: 12,
    pointsToday: 5,
    rank: 2,
    entryCount: 8,
    bestLeague: null,
    unavailable: [],
    today: { kind: 'none' },
    catchUp: null,
    entryPercent: 100,
    groupsPredicted: 36,
    groupsTotal: 36,
    submitted: true,
    champion: null,
    hasAnyLeague: false,
    lockAt: null,
    startsOn: null,
    ...overrides,
  }
}

function renderPage(model: HomeModel) {
  mocks.state = { status: 'ready', model }
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage partial availability', () => {
  it('warns without hiding available tournament content', () => {
    renderPage(
      duringModel({
        totalPoints: null,
        rank: null,
        entryCount: null,
        unavailable: ['leaderboard'],
      }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Some dashboard data is unavailable',
    )
    expect(screen.getByText('Points unavailable')).toBeVisible()
    expect(screen.getByText('No fixtures scheduled.')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Share your standing/ }),
    ).not.toBeInTheDocument()
  })

  it('does not show an availability warning for loaded zero values', () => {
    renderPage(
      duringModel({
        totalPoints: 0,
        pointsToday: 0,
        rank: null,
        entryCount: 4,
      }),
    )

    expect(screen.queryByText('Some dashboard data is unavailable')).not.toBeInTheDocument()
    expect(screen.getByText('Points')).toBeVisible()
    expect(screen.getByText('No league yet')).toBeVisible()
  })
})
