import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { matchCentreLifecycleContent } from '../../../src/domain/tournament/matchCentreLifecycleContent'
import { MatchCentreLifecycleSections } from '../../../src/features/matches/MatchCentreLifecycleSections'

describe('MatchCentreLifecycleSections', () => {
  it('shows prediction context but withholds match impact before kick-off', () => {
    render(
      <MatchCentreLifecycleSections
        content={matchCentreLifecycleContent('SCHEDULED')}
        predictionContext={<section>Prediction context</section>}
        matchImpact={<section>Match impact</section>}
      />,
    )

    expect(screen.getByText('Prediction context')).toBeInTheDocument()
    expect(screen.queryByText('Match impact')).not.toBeInTheDocument()
  })

  it('shows prediction and impact content during live play', () => {
    render(
      <MatchCentreLifecycleSections
        content={matchCentreLifecycleContent('LIVE_SECOND_HALF')}
        predictionContext={<section>Prediction context</section>}
        matchImpact={<section>Match impact</section>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Second half' })).toBeInTheDocument()
    expect(screen.getByText('Prediction context')).toBeInTheDocument()
    expect(screen.getByText('Match impact')).toBeInTheDocument()
  })

  it('withholds match impact when play is suspended', () => {
    render(
      <MatchCentreLifecycleSections
        content={matchCentreLifecycleContent('SUSPENDED')}
        predictionContext={<section>Prediction context</section>}
        matchImpact={<section>Match impact</section>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Match suspended' })).toBeInTheDocument()
    expect(screen.getByText('Prediction context')).toBeInTheDocument()
    expect(screen.queryByText('Match impact')).not.toBeInTheDocument()
  })
})
