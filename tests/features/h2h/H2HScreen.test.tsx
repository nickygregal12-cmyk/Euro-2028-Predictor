import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { H2HScreen, type H2HPlayerView } from '../../../src/features/h2h/H2HScreen'

const player = (displayName: string, totalPoints: number): H2HPlayerView => ({
  displayName,
  champion: null,
  championEliminated: false,
  totalPoints,
  exactScores: displayName === 'You' ? 4 : 2,
  koPicksAlive: 0,
  maxPossible: displayName === 'You' ? 220 : 205,
  bracketHealth: {
    securedPoints: displayName === 'You' ? 35 : 20,
    possiblePoints: displayName === 'You' ? 85 : 70,
    lostPoints: displayName === 'You' ? 15 : 45,
    totalPredictedPoints: 135,
    milestones: [],
  },
})

describe('H2HScreen', () => {
  it('renders authoritative totals and milestone-based bracket health', () => {
    render(
      <H2HScreen
        you={player('You', 148)}
        rival={player('Profile Rival', 137)}
        split={{
          champion: { agree: false, mine: null, theirs: null },
          sharedFinalists: [],
          mineOnlyFinalists: [],
          theirsOnlyFinalists: [],
        }}
        rankHistory={<div>Rank history fixture</div>}
      />,
    )

    expect(screen.getByText(/148/)).toBeVisible()
    expect(screen.getByText(/137/)).toBeVisible()
    expect(screen.getByText('Rank history fixture')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Knockout value secured, alive and lost' })).toBeVisible()
    expect(
      screen.getByRole('img', {
        name: 'You: 35 knockout points secured, 85 still possible, 15 lost.',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('img', {
        name: 'Profile Rival: 20 knockout points secured, 70 still possible, 45 lost.',
      }),
    ).toBeVisible()
    expect(screen.queryByText('KO picks alive')).not.toBeInTheDocument()
  })
})
