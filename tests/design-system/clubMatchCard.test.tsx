import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ClubMatchCard, type ClubMatchCardProps } from '../../src/design-system/ClubMatchCard'

/**
 * The club-football sibling of MatchCard (ADR 0020). The rendering
 * differences that carry domain meaning are what get asserted: club identity
 * instead of flags, a matchweek eyebrow, and — decisively — no per-fixture
 * Joker control, because the domestic Joker doubles a whole matchweek.
 */

afterEach(cleanup)

const ARSENAL = { name: 'Arsenal', tokens: { monogram: 'ARS', primary: '#EF0107' } }
const NEWCASTLE = {
  name: 'Newcastle',
  tokens: { monogram: 'NEW', primary: '#241F20', secondary: '#FFFFFF', pattern: 'stripes' as const },
}

function props(overrides: Partial<ClubMatchCardProps> = {}): ClubMatchCardProps {
  return {
    state: 'editable',
    matchweek: 5,
    kickoff: 'Sat 15:00',
    home: ARSENAL,
    away: NEWCASTLE,
    homeScore: null,
    awayScore: null,
    ...overrides,
  }
}

describe('ClubMatchCard', () => {
  it('renders labelled score inputs and club identities when editable', () => {
    render(<ClubMatchCard {...props()} />)
    expect(screen.getByLabelText('Arsenal score')).toBeInTheDocument()
    expect(screen.getByLabelText('Newcastle score')).toBeInTheDocument()
    // ClubIdentity exposes the full club name; one image per club.
    expect(screen.getAllByRole('img', { name: 'Arsenal' })).toHaveLength(1)
    expect(screen.getAllByRole('img', { name: 'Newcastle' })).toHaveLength(1)
    expect(screen.getByText('Matchweek 5')).toBeInTheDocument()
  })

  it('never renders a per-fixture Joker control in any state', () => {
    // The domestic Joker doubles the whole matchweek (ADR 0020); a per-
    // fixture Joker button on this card would resurrect the rejected rule.
    for (const state of ['editable', 'locked', 'scored'] as const) {
      const { container, unmount } = render(
        <ClubMatchCard
          {...props({
            state,
            countdown: '24m',
            result: { home: 1, away: 0 },
            score: { kind: 'correct', points: 3, jokerDoubled: false },
          })}
        />,
      )
      expect(container.textContent).not.toMatch(/joker(?! 2×)/i)
      expect(screen.queryByRole('button', { name: /joker/i })).toBeNull()
      unmount()
    }
  })

  it('shows the locked state with a countdown and no venue text', () => {
    render(<ClubMatchCard {...props({ state: 'locked', countdown: '24m', venue: 'Emirates Stadium' })} />)
    expect(screen.getByText(/Kicks off in 24m/)).toBeInTheDocument()
    expect(screen.queryByText('Emirates Stadium')).toBeNull()
    expect(screen.getByTitle('Predictions locked')).toBeInTheDocument()
  })

  it('shows the result, the prediction and the points pill when scored', () => {
    render(
      <ClubMatchCard
        {...props({
          state: 'scored',
          homeScore: 2,
          awayScore: 0,
          result: { home: 2, away: 0 },
          score: { kind: 'exact', points: 5, jokerDoubled: false },
        })}
      />,
    )
    expect(screen.getByText('You predicted 2 – 0')).toBeInTheDocument()
    expect(screen.getByText('Exact score +5')).toBeInTheDocument()
  })

  it('reports a matchweek-Joker doubling on the pill without owning the Joker', () => {
    render(
      <ClubMatchCard
        {...props({
          state: 'scored',
          homeScore: 1,
          awayScore: 0,
          result: { home: 3, away: 1 },
          score: { kind: 'correct', points: 6, jokerDoubled: true },
        })}
      />,
    )
    expect(screen.getByText(/Result · joker 2× · \+6/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /joker/i })).toBeNull()
  })
})
