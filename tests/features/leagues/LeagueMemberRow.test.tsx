import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LeagueMemberRow } from '../../../src/features/leagues/LeagueMemberRow'

function renderRow(options: { revealed: boolean }) {
  const onProfile = vi.fn()
  const onHeadToHead = vi.fn()
  render(
    <LeagueMemberRow
      rank={1}
      name="Rival Player"
      totalPoints={37}
      hasEntry
      expanded
      onToggle={() => {}}
      revealed={options.revealed}
      stats={{ exact: 3, correct: 7, maxLeft: 100 }}
      onProfile={onProfile}
      onHeadToHead={onHeadToHead}
    />,
  )
  return { onProfile, onHeadToHead }
}

describe('LeagueMemberRow profile reveal actions', () => {
  it('offers the safe Profile action before lock while keeping H2H hidden', () => {
    const { onProfile, onHeadToHead } = renderRow({ revealed: false })

    expect(screen.getByText('Stats are hidden until entries lock.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Profile' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Head to head' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    expect(onProfile).toHaveBeenCalledTimes(1)
    expect(onHeadToHead).not.toHaveBeenCalled()
  })

  it('offers both Profile and H2H after lock', () => {
    const { onHeadToHead } = renderRow({ revealed: true })

    expect(screen.getByRole('button', { name: 'Profile' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Head to head' }))
    expect(onHeadToHead).toHaveBeenCalledTimes(1)
  })
})
