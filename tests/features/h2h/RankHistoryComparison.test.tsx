import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RankHistoryComparison } from '../../../src/features/h2h/RankHistoryComparison'

const point = (key: 'MD1' | 'MD2', order: number, rank: number, totalPoints: number) => ({
  key,
  order,
  rank,
  totalPoints,
  capturedAt: '2028-06-15T20:00:00Z',
})

describe('RankHistoryComparison', () => {
  it('renders a labelled chart and complete accessible table', () => {
    render(
      <RankHistoryComparison
        youName="E2E Tester"
        rivalName="Profile Rival"
        history={{
          you: [point('MD1', 1, 4, 18), point('MD2', 2, 2, 39)],
          rival: [point('MD1', 1, 7, 12)],
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Seven tournament checkpoints' })).toBeVisible()
    expect(screen.getByRole('img', { name: /^Rank history comparison/ })).toBeVisible()
    expect(screen.getByRole('table', { name: 'Rank and total points at each checkpoint' })).toBeVisible()
    expect(screen.getByRole('row', { name: /Matchday 1 4th 18 pts 7th 12 pts/ })).toBeVisible()
    expect(screen.getByRole('row', { name: /Matchday 2 2nd 39 pts/ })).toBeVisible()
    expect(screen.getByRole('row', { name: /Final/ })).toBeVisible()
  })

  it('shows a truthful empty state before the first checkpoint', () => {
    render(
      <RankHistoryComparison
        youName="E2E Tester"
        rivalName="Profile Rival"
        history={{ you: [], rival: [] }}
      />,
    )

    expect(screen.getByText(/appears after the first completed tournament checkpoint/i)).toBeVisible()
    expect(screen.queryByRole('img', { name: /^Rank history comparison/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
