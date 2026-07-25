import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GoldenBootPicker } from '../../../src/features/predict/GoldenBootPicker'

const baseProps = {
  points: 25,
  query: 'Mbappé',
  onQueryChange: vi.fn(),
  results: [],
  selected: null,
  onSelect: vi.fn(),
  onClear: vi.fn(),
  emptyNote: 'Player search available once squads are confirmed — closer to the tournament.',
}

describe('GoldenBootPicker search availability', () => {
  it('shows a genuine empty note only after an available empty search', () => {
    render(<GoldenBootPicker {...baseProps} />)

    expect(screen.getByText(/Player search available once squads are confirmed/)).toBeVisible()
    expect(screen.queryByText('Player search unavailable')).not.toBeInTheDocument()
  })

  it('replaces the false empty note with an unavailable warning and retry', () => {
    const retry = vi.fn()
    render(
      <GoldenBootPicker
        {...baseProps}
        unavailableMessage="Could not search players. Please try again."
        onRetry={retry}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Player search unavailable')
    expect(screen.getByRole('alert')).toHaveTextContent('Could not search players')
    expect(screen.queryByText(/Player search available once squads are confirmed/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry player search' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('keeps the loading state separate from empty and unavailable states', () => {
    render(
      <GoldenBootPicker
        {...baseProps}
        loading
        unavailableMessage="Could not search players. Please try again."
      />,
    )

    expect(screen.getByText('Searching…')).toBeVisible()
    expect(screen.queryByText('Player search unavailable')).not.toBeInTheDocument()
    expect(screen.queryByText(/Player search available once squads are confirmed/)).not.toBeInTheDocument()
  })
})
