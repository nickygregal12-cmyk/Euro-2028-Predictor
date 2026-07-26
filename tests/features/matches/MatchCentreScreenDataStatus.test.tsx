import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchCentreScreen, type MatchCentreScreenProps } from '../../../src/features/matches/MatchCentreScreen'
import { calculateSourceMetadata } from '../../../src/domain/tournament/matchCentreContract'
import { presentMatchLifecycle } from '../../../src/domain/tournament/matchCentrePresentation'

function baseProps(): MatchCentreScreenProps {
  return {
    eyebrow: 'Group A · Upcoming',
    venue: 'Wembley Stadium',
    venueCountryCode: 'gb-eng',
    home: { name: 'Scotland', countryCode: 'gb-sct' },
    away: { name: 'Germany', countryCode: 'de' },
    temporalState: 'before',
    result: null,
    stake: {
      kind: 'group',
      stake: { kind: 'group', pick: null, outcome: 'unknown', points: null },
    },
    scope: { type: 'overall' },
    leagues: [],
    said: { revealed: false, predicted: 0, total: 0 },
    scoreEvents: [],
  }
}

describe('MatchCentreScreen data status integration', () => {
  it('shows provider availability messaging and the normalized live label', () => {
    render(
      <MatchCentreScreen
        {...baseProps()}
        temporalState="during"
        statusPresentation={presentMatchLifecycle('LIVE_SECOND_HALF')}
        matchSource={calculateSourceMetadata({
          provider: 'test-provider',
          providerFixtureId: 'fixture-1',
          fetchedAt: '2028-06-10T20:00:00.000Z',
          now: '2028-06-10T20:01:00.000Z',
          staleAfterSeconds: 30,
          unavailable: true,
        })}
      />,
    )

    expect(screen.getByText('Live match data unavailable')).toBeInTheDocument()
    expect(screen.getByText(/latest verified match data is unavailable/i)).toBeInTheDocument()
    expect(screen.getByText(/Live · second half/)).toBeInTheDocument()
  })

  it('retains the existing screen behaviour when normalized source props are absent', () => {
    render(<MatchCentreScreen {...baseProps()} />)

    expect(screen.getByText('vs')).toBeInTheDocument()
    expect(screen.queryByText(/match data unavailable/i)).not.toBeInTheDocument()
  })
})
