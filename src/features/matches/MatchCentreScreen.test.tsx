import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { groupStake } from '../../domain/tournament/matchCentre'
import { MatchCentreScreen } from './MatchCentreScreen'

const baseProps = {
  eyebrow: 'Group A · Match 2',
  venue: 'Wembley Stadium',
  venueCountryCode: 'gb-eng',
  home: { name: 'Scotland', countryCode: 'gb-sct' },
  away: { name: 'Spain', countryCode: 'es' },
  temporalState: 'before' as const,
  result: null,
  stake: { kind: 'group' as const, stake: groupStake(null, null) },
  scope: { type: 'overall' as const },
  leagues: [],
  said: { revealed: false as const, predicted: 0, total: 0 },
  scoreEvents: [],
}

describe('MatchCentreScreen resilience controls', () => {
  it('exposes bounded adjacent-match navigation', () => {
    const previous = vi.fn()
    const next = vi.fn()

    render(
      <MatchCentreScreen
        {...baseProps}
        onPreviousMatch={previous}
        onNextMatch={next}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(previous).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledOnce()
  })

  it('disables an unavailable adjacent direction', () => {
    render(<MatchCentreScreen {...baseProps} onNextMatch={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('offers an in-place retry when prediction context fails', () => {
    const retry = vi.fn()

    render(
      <MatchCentreScreen
        {...baseProps}
        saidError="Could not load predictions."
        onRetrySaid={retry}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry predictions' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('announces the prediction-context loading state', () => {
    render(<MatchCentreScreen {...baseProps} saidLoading />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading prediction context…',
    )
  })
})
