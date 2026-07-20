import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileScreen } from '../../../src/features/profile/ProfileScreen'
import type { ScoreEvent } from '../../../src/domain/tournament/scoreEvents'

const SCO = { name: 'Scotland', countryCode: 'gb-sct' }
const EVENTS: ScoreEvent[] = [
  { id: '1', category: 'group_matches', explanation: 'Sco 2–1 Eng · exact score', points: 5 },
]

describe('ProfileScreen — full', () => {
  it('renders the stat grid, champion, and the reused points breakdown', () => {
    render(
      <ProfileScreen
        kind="full"
        header={{ displayName: 'Alex Turner', isOwn: true, champion: SCO, championEliminated: false, leaguesCount: 3 }}
        stats={{ totalPoints: 148, rank: 4, exactScores: 9, correctResults: 14, scoredMatches: 30, accuracyPercent: 77 }}
        events={EVENTS}
        locked
      />,
    )
    expect(screen.getByText('Alex Turner')).toBeInTheDocument()
    expect(screen.getByText('148')).toBeInTheDocument() // Points
    expect(screen.getByText('4th')).toBeInTheDocument() // Overall rank (ordinal)
    expect(screen.getByText('77%')).toBeInTheDocument() // Accuracy
    expect(screen.getByText('3 leagues')).toBeInTheDocument()
    // Points breakdown component is embedded (category label rendered).
    expect(screen.getByText('Group matches')).toBeInTheDocument()
    // Own profile → Edit, not H2H.
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'H2H' })).not.toBeInTheDocument()
    // Post-lock → view-full-entry row present.
    expect(screen.getByRole('button', { name: /view full entry/i })).toBeInTheDocument()
  })

  it('handles a new user: zero history shows dashes for rank + accuracy, no champion', () => {
    render(
      <ProfileScreen
        kind="full"
        header={{ displayName: 'Ng', isOwn: true, champion: null, championEliminated: false, leaguesCount: 0 }}
        stats={{ totalPoints: 0, rank: null, exactScores: 0, correctResults: 0, scoredMatches: 0, accuracyPercent: null }}
        events={[]}
        locked={false}
      />,
    )
    expect(screen.getByText('Ng')).toBeInTheDocument()
    expect(screen.getByText('No champion picked yet')).toBeInTheDocument()
    expect(screen.getByText('0 leagues')).toBeInTheDocument()
    // rank + accuracy dashes (two en-dashes present)
    expect(screen.getAllByText('–').length).toBeGreaterThanOrEqual(2)
    // Pre-lock → no view-full-entry row.
    expect(screen.queryByRole('button', { name: /view full entry/i })).not.toBeInTheDocument()
  })

  it("another player's profile shows H2H, not Edit", () => {
    render(
      <ProfileScreen
        kind="full"
        header={{ displayName: 'José Peña', isOwn: false, champion: SCO, championEliminated: true, leaguesCount: 1 }}
        stats={{ totalPoints: 96, rank: 96, exactScores: 3, correctResults: 8, scoredMatches: 24, accuracyPercent: 46 }}
        events={EVENTS}
        locked
      />,
    )
    expect(screen.getByRole('button', { name: 'H2H' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })
})

describe('ProfileScreen — reveal-gated hidden state', () => {
  it('shows only name, leagues, entry status + the lock explainer (no stats/breakdown)', () => {
    render(
      <ProfileScreen kind="hidden" displayName="José Peña" leaguesCount={2} hasEntry lockDateLabel="9 June 2028" />,
    )
    expect(screen.getByText('José Peña')).toBeInTheDocument()
    expect(screen.getByText(/2 leagues · Entry in/)).toBeInTheDocument()
    expect(screen.getByText(/hidden until entries lock on 9 June 2028/)).toBeInTheDocument()
    // No breakdown, no stat values leaked.
    expect(screen.queryByText('Group matches')).not.toBeInTheDocument()
    expect(screen.queryByText('Accuracy')).not.toBeInTheDocument()
  })
})
