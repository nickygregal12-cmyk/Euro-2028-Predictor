import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchCentreDataNotice } from '../../../src/features/matches/MatchCentreDataNotice'
import { presentMatchLifecycle } from '../../../src/domain/tournament/matchCentrePresentation'
import type { MatchSourceMetadata } from '../../../src/domain/tournament/matchCentreContract'

const verified: MatchSourceMetadata = {
  provider: 'mock',
  providerFixtureId: 'fixture-1',
  fetchedAt: '2028-06-10T18:00:00.000Z',
  providerUpdatedAt: '2028-06-10T18:00:00.000Z',
  isStale: false,
  freshnessSeconds: 10,
  dataQuality: 'verified',
}

describe('MatchCentreDataNotice', () => {
  it('renders nothing for verified fresh data', () => {
    const { container } = render(
      <MatchCentreDataNotice
        status={presentMatchLifecycle('LIVE_FIRST_HALF')}
        source={verified}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('warns when a live feed is delayed', () => {
    render(
      <MatchCentreDataNotice
        status={presentMatchLifecycle('LIVE_SECOND_HALF')}
        source={{ ...verified, isStale: true, freshnessSeconds: 420, dataQuality: 'delayed' }}
      />,
    )

    expect(screen.getByText('Live match data delayed')).toBeInTheDocument()
    expect(screen.getByText(/Last updated 7 min ago/)).toBeInTheDocument()
    expect(screen.getByText(/may change when the feed refreshes/)).toBeInTheDocument()
  })

  it('uses an error notice when live data is unavailable', () => {
    render(
      <MatchCentreDataNotice
        status={presentMatchLifecycle('SUSPENDED')}
        source={{ ...verified, dataQuality: 'unavailable' }}
      />,
    )

    expect(screen.getByText('Live match data unavailable')).toBeInTheDocument()
    expect(screen.getByText(/Latest verified match data is unavailable/)).toBeInTheDocument()
  })

  it('labels repository-only data as provisional without claiming it is live', () => {
    render(
      <MatchCentreDataNotice
        status={presentMatchLifecycle('SCHEDULED')}
        source={{ ...verified, provider: 'repository', dataQuality: 'provisional' }}
      />,
    )

    expect(screen.getByText('Match data is provisional')).toBeInTheDocument()
    expect(screen.queryByText(/may change when the feed refreshes/)).not.toBeInTheDocument()
  })
})
