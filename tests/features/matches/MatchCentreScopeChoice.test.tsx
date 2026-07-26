import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MatchCentreScopeChoice } from '../../../src/features/matches/MatchCentreScopeChoice'

describe('MatchCentreScopeChoice', () => {
  const leagues = [
    { id: 'work', name: 'Work League' },
    { id: 'family', name: 'Family League' },
  ]

  it('does not render a native select', () => {
    const { container } = render(
      <MatchCentreScopeChoice
        scope={{ type: 'overall' }}
        leagues={leagues}
        onScopeChange={() => undefined}
      />,
    )

    expect(container.querySelector('select')).toBeNull()
    expect(screen.getByRole('button', { name: /overall/i })).toBeInTheDocument()
  })

  it('maps a league choice back to a MatchScope', () => {
    const onScopeChange = vi.fn()
    render(
      <MatchCentreScopeChoice
        scope={{ type: 'overall' }}
        leagues={leagues}
        onScopeChange={onScopeChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /overall/i }))
    fireEvent.click(screen.getByRole('radio', { name: 'Family League' }))

    expect(onScopeChange).toHaveBeenCalledWith({
      type: 'league',
      id: 'family',
      name: 'Family League',
    })
  })

  it('maps Overall back to the overall scope', () => {
    const onScopeChange = vi.fn()
    render(
      <MatchCentreScopeChoice
        scope={{ type: 'league', id: 'work', name: 'Work League' }}
        leagues={leagues}
        onScopeChange={onScopeChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /work league/i }))
    fireEvent.click(screen.getByRole('radio', { name: 'Overall' }))

    expect(onScopeChange).toHaveBeenCalledWith({ type: 'overall' })
  })
})
