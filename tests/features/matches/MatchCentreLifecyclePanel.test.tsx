import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchCentreLifecyclePanel } from '../../../src/features/matches/MatchCentreLifecyclePanel'

const content = {
  heading: 'Match suspended',
  summary:
    'Play has stopped. Scores and prediction impact must not be treated as final until the fixture status is resolved.',
  emphasis: 'danger' as const,
  showPredictionContext: true,
  showMatchImpact: false,
}

describe('MatchCentreLifecyclePanel', () => {
  it('renders domain-owned lifecycle copy with the requested emphasis', () => {
    render(<MatchCentreLifecyclePanel content={content} />)

    expect(screen.getByRole('heading', { name: 'Match suspended' })).toBeInTheDocument()
    expect(screen.getByText(/scores and prediction impact must not be treated as final/i)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Match suspended' })).toHaveAttribute(
      'data-emphasis',
      'danger',
    )
  })
})
