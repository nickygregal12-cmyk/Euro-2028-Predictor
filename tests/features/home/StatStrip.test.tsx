import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatStrip, type StatStripProps } from '../../../src/features/home/StatStrip'

const actions = {
  onPoints: vi.fn(),
  onToday: vi.fn(),
  onRank: vi.fn(),
  onLeague: vi.fn(),
}

function renderStrip(overrides: Partial<StatStripProps> = {}) {
  render(
    <StatStrip
      totalPoints={0}
      pointsToday={0}
      rank={null}
      entryCount={4}
      bestLeagueRank={null}
      hasLeague={false}
      leagueDataAvailable
      {...actions}
      {...overrides}
    />,
  )
}

describe('StatStrip availability states', () => {
  it('labels unavailable remote figures instead of presenting false zeroes', () => {
    renderStrip({
      totalPoints: null,
      pointsToday: null,
      entryCount: null,
      hasLeague: null,
      leagueDataAvailable: false,
    })

    expect(screen.getByText('Points unavailable')).toBeVisible()
    expect(screen.getByText('Today unavailable')).toBeVisible()
    expect(screen.getByText('Rank unavailable')).toBeVisible()
    expect(screen.getByText('Leagues unavailable')).toBeVisible()
    expect(screen.queryByText('No league yet')).not.toBeInTheDocument()
  })

  it('preserves genuine zero and empty-league states', () => {
    renderStrip()

    expect(screen.getByText('Points')).toBeVisible()
    expect(screen.getByText('Points today')).toBeVisible()
    expect(screen.getByText('Overall rank')).toBeVisible()
    expect(screen.getByText('No league yet')).toBeVisible()
    expect(screen.queryByText('Points unavailable')).not.toBeInTheDocument()
  })

  it('renders loaded ranks with their population', () => {
    renderStrip({
      totalPoints: 12,
      pointsToday: 5,
      rank: 2,
      entryCount: 8,
      bestLeagueRank: 1,
      hasLeague: true,
    })

    expect(screen.getByText('2nd')).toBeVisible()
    expect(screen.getByText('of 8 overall')).toBeVisible()
    expect(screen.getByText('1st')).toBeVisible()
    expect(screen.getByText('Best league')).toBeVisible()
  })
})
