import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SeasonStandingsPage } from '../../../src/features/season/SeasonStandingsPage'
import type { SeasonStandingsGateway } from '../../../src/features/season/standingsModel'
import type { SeasonLeaderboardPage } from '../../../src/services/supabase/seasonLeaderboard'

/**
 * The standings table, on the one line most players came for.
 */

function row(overrides: Record<string, unknown> = {}) {
  return {
    position: 1,
    rank: 1,
    tied: false,
    displayName: 'Someone',
    points: 40,
    matchweeksPlayed: 3,
    isYou: false,
    ...overrides,
  }
}

function page(overrides: Partial<SeasonLeaderboardPage> = {}): SeasonLeaderboardPage {
  return {
    rows: [row(), row({ position: 2, rank: 2, displayName: 'You', points: 31, isYou: true })],
    totalCount: 12,
    pageSize: 50,
    hasMore: false,
    nextCursor: null,
    you: null,
    ...overrides,
  } as SeasonLeaderboardPage
}

function gatewayFor(read: SeasonLeaderboardPage): SeasonStandingsGateway {
  return { load: async () => read }
}

describe('the season standings page', () => {
  it('states where the caller stands rather than leaving them to find their row', async () => {
    render(
      <SeasonStandingsPage gameName="Main Predictor" gateway={gatewayFor(page())} />,
    )

    await waitFor(() => expect(screen.getByText(/You are 2 of 12 on 31 points\./)).toBeTruthy())
  })

  it('spells a shared rank out in words rather than printing "=2"', async () => {
    render(
      <SeasonStandingsPage
        gameName="Main Predictor"
        gateway={gatewayFor(
          page({
            rows: [
              row(),
              row({ position: 2, rank: 2, tied: true, displayName: 'You', points: 31, isYou: true }),
            ],
          }),
        )}
      />,
    )

    await waitFor(() => expect(screen.getByText(/You are joint 2 of 12/)).toBeTruthy())
  })

  it('uses the pinned row when the caller has paged past themselves', async () => {
    // The model pins the caller's row when it falls outside the loaded pages;
    // the sentence must not depend on how far they paged.
    render(
      <SeasonStandingsPage
        gameName="Main Predictor"
        gateway={gatewayFor(
          page({
            rows: [row()],
            you: {
              position: 44,
              rank: 44,
              tied: false,
              displayName: 'You',
              points: 12,
              matchweeksPlayed: 3,
            },
          } as Partial<SeasonLeaderboardPage>),
        )}
      />,
    )

    await waitFor(() => expect(screen.getByText(/You are 44 of 12 on 12 points\./)).toBeTruthy())
  })

  it('says nothing about a caller who holds no settled matchweek', async () => {
    render(
      <SeasonStandingsPage
        gameName="Main Predictor"
        gateway={gatewayFor(page({ rows: [row()], you: null }))}
      />,
    )

    await waitFor(() => expect(screen.getByText(/12 players/)).toBeTruthy())
    expect(screen.queryByText(/You are /)).toBeNull()
  })
})
