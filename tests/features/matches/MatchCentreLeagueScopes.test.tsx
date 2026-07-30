import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  MatchCentreScreen,
  type MatchCentreScreenProps,
} from '../../../src/features/matches/MatchCentreScreen'

function baseProps(
  overrides: Partial<MatchCentreScreenProps> = {},
): MatchCentreScreenProps {
  return {
    eyebrow: 'Group A · Upcoming',
    venue: 'Hampden Park',
    venueCountryCode: 'gb-sct',
    home: { name: 'Scotland', countryCode: 'gb-sct' },
    away: { name: 'England', countryCode: 'gb-eng' },
    result: null,
    stake: {
      kind: 'group',
      stake: {
        kind: 'group',
        pick: null,
        outcome: 'unknown',
        points: null,
      },
    },
    scope: { type: 'overall' },
    leagues: [],
    said: { revealed: false, predicted: 1, total: 2 },
    saidLoading: false,
    scoreEvents: [],
    ...overrides,
  }
}

describe('MatchCentreScreen league scope availability', () => {
  it('renders a successful no-leagues result without an unavailable warning', () => {
    render(
      <MatchCentreScreen
        {...baseProps({ leagueScopesStatus: 'ready', leagues: [] })}
      />,
    )

    expect(screen.queryByText('League scopes unavailable')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Overall' })).not.toBeInTheDocument()
    expect(screen.getByText('What everyone said')).toBeVisible()
  })

  it('shows a safe warning and preserves overall predictions when league scopes fail', () => {
    const retry = vi.fn()
    render(
      <MatchCentreScreen
        {...baseProps({
          leagueScopesStatus: 'unavailable',
          leagueScopesMessage: 'Could not load your league scopes. Please try again.',
          onRetryLeagueScopes: retry,
        })}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('League scopes unavailable')
    expect(screen.getByText('What everyone said')).toBeVisible()
    expect(screen.getByText(/1 of 2 have predicted this match/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Overall' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry league scopes' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('renders the scope selector only after a successful league response', () => {
    render(
      <MatchCentreScreen
        {...baseProps({
          leagueScopesStatus: 'ready',
          leagues: [{ id: 'league-1', name: 'Weekend League' }],
        })}
      />,
    )

    const selector = screen.getByRole('button', { name: 'Overall' })
    expect(selector).toBeVisible()

    fireEvent.click(selector)
    expect(screen.getByRole('dialog', { name: 'Prediction scope' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Weekend League' })).toBeInTheDocument()
  })
})
