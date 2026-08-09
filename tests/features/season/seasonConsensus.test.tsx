import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ConsensusHiddenError,
  mapSeasonConsensus,
} from '../../../src/services/supabase/seasonConsensusModel'
import { SeasonConsensusPanel } from '../../../src/features/season/SeasonConsensusPanel'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    suppressed: false,
    matchweek: 2,
    minimum_entries: 10,
    submitted_entries: 24,
    locked_at: '2026-08-08T13:30:00Z',
    fixtures: [
      {
        id: 'f1',
        kickoff_at: '2026-08-08T14:00:00Z',
        home_name: 'Rangers',
        away_name: 'Hibernian',
        result_home: 2,
        result_away: 1,
        predicted: 24,
        home_win: 12,
        draw: 6,
        away_win: 6,
        top_scores: [
          { home: 2, away: 1, picks: 5 },
          { home: 1, away: 1, picks: 4 },
        ],
      },
    ],
    ...overrides,
  }
}

describe('decoding the season consensus', () => {
  it('derives the three shares from the counts the server sent', () => {
    const consensus = mapSeasonConsensus(payload())
    expect(consensus.fixtures[0]?.shares).toEqual({ homeWin: 50, draw: 25, awayWin: 25 })
  })

  it('keeps the suppressed answer distinct from a full one', () => {
    // Too small a cohort is a payload with counts, not a refusal — the surface
    // can honestly say how many played and how many are needed.
    const consensus = mapSeasonConsensus(
      payload({ suppressed: true, submitted_entries: 6, fixtures: [] }),
    )
    expect(consensus.suppressed).toBe(true)
    expect(consensus.submittedEntries).toBe(6)
  })

  it('drops a fixture whose counts disagree with themselves', () => {
    // A bar normalised over a wrong denominator is a confident picture of
    // nothing, so the fixture is dropped rather than repaired.
    const broken = payload()
    broken.fixtures[0]!.home_win = 20
    expect(mapSeasonConsensus(broken).fixtures).toHaveLength(0)
  })

  it('shows a score only when the server holds both halves of one', () => {
    const partial = payload()
    partial.fixtures[0]!.result_away = null as unknown as number
    const fixture = mapSeasonConsensus(partial).fixtures[0]
    expect(fixture?.resultHome).toBeNull()
  })

  it('refuses a payload it cannot identify rather than rendering an empty one', () => {
    expect(() => mapSeasonConsensus({ fixtures: [] })).toThrow()
  })
})

describe('the consensus panel', () => {
  it('renders nothing at all before the matchweek locks', async () => {
    // Not a placeholder and not a countdown: a panel promising other players'
    // predictions is an invitation to wait for information a player should not
    // be waiting for.
    const { container } = render(
      <SeasonConsensusPanel
        matchweek={2}
        load={() => Promise.reject(new ConsensusHiddenError())}
      />,
    )
    await waitFor(() => expect(container.querySelector('section')).toBeNull())
  })

  it('says how many played and how many are needed when the cohort is short', async () => {
    render(
      <SeasonConsensusPanel
        matchweek={30}
        load={() =>
          Promise.resolve(
            mapSeasonConsensus(payload({ suppressed: true, submitted_entries: 6, fixtures: [] })),
          )
        }
      />,
    )
    await waitFor(() => expect(screen.getByText(/6 players predicted/)).toBeTruthy())
    expect(screen.getByText(/10 are needed/)).toBeTruthy()
  })

  it('distinguishes a failure from the lock, and says the card is unaffected', async () => {
    render(
      <SeasonConsensusPanel
        matchweek={2}
        load={() => Promise.reject(new Error('network'))}
      />,
    )
    await waitFor(() => expect(screen.getByText(/could not be loaded/)).toBeTruthy())
    expect(screen.getByText(/points are unaffected/)).toBeTruthy()
  })

  it('describes the shares once, on the bar, rather than three unlabelled blocks', async () => {
    render(
      <SeasonConsensusPanel
        matchweek={2}
        load={() => Promise.resolve(mapSeasonConsensus(payload()))}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getByRole('img', {
          name: 'Rangers win 50%, draw 25%, Hibernian win 25%',
        }),
      ).toBeTruthy(),
    )
  })
})
