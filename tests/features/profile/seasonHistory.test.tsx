import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SeasonHistorySection } from '../../../src/features/profile/SeasonHistorySection'
import type { CompetitionRelevance } from '../../../src/features/hub/playerCompetitions'

/**
 * Season history, over contract 156's archive (`MIG-UI-08`).
 *
 * THE PROPERTIES THAT MATTER, and each of them is a way this could have lied:
 *
 *   1. a season still being played is NOT listed, and is never rendered as a
 *      season of zeros -- which would be a lie about a season the player is
 *      currently winning;
 *   2. nothing is recomputed. The numbers on screen are the ones the archive
 *      stored, and there is no derived percentile or career total anywhere;
 *   3. one unreadable season does not blank the others, and is reported as
 *      unreadable rather than dropped;
 *   4. the limit of what can be found is stated, because `get_season_wrapped`
 *      is addressed by one season id and nothing lists which ones a player has.
 */

const mocks = vi.hoisted(() => ({ fetchSeasonWrapped: vi.fn() }))

vi.mock('../../../src/services/supabase/seasonWrapped', () => ({
  fetchSeasonWrapped: mocks.fetchSeasonWrapped,
}))

function competition(name: string, tournamentId: string): CompetitionRelevance {
  return {
    competition: {
      competitionSlug: name.toLowerCase().replace(/\s+/g, '-'),
      seasonSlug: '2026-27',
      seasonRowName: `${name} 2026/27`,
      tournamentId,
      name,
      seasonLabel: '2026/27',
      status: 'ended',
      summary: '',
      games: [],
    },
    tournamentId,
    followed: true,
    favourite: false,
    favouriteTeamId: null,
    joinedGames: [],
    games: [],
  }
}

const FINALISED = {
  finalised: true,
  season: { points: 412, rank: 7, fieldSize: 1204, matchweeksPlayed: 38 },
  bestMatchweek: { ordinal: 21, points: 24 },
  accuracy: { fixturesPredicted: 200, exactScores: 40, correctOutcomes: 120 },
  jokersPlayed: 5,
  finalisedAt: '2027-05-25T18:00:00Z',
}

describe('season history', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a finished season exactly as the archive stored it', async () => {
    mocks.fetchSeasonWrapped.mockResolvedValue(FINALISED)

    render(<SeasonHistorySection competitions={[competition('Premier League', 'season-1')]} />)

    expect(await screen.findByText('412')).toBeInTheDocument()
    expect(screen.getByText('7 of 1204')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
    // Percentages are the two stored counts divided, and nothing else.
    expect(screen.getByText('40 (20%)')).toBeInTheDocument()
    expect(screen.getByText('120 (60%)')).toBeInTheDocument()
  })

  it('does not list a season that has not finished, and shows no zeros for it', async () => {
    mocks.fetchSeasonWrapped.mockResolvedValue({ finalised: false })

    render(<SeasonHistorySection competitions={[competition('Premier League', 'season-1')]} />)

    expect(await screen.findByText(/No season you play in has finished yet/)).toBeInTheDocument()
    expect(screen.queryByText('Premier League')).toBeNull()
  })

  it('keeps a readable season when another one fails', async () => {
    mocks.fetchSeasonWrapped.mockImplementation(async (id: string) => {
      if (id === 'season-2') throw new Error('network')
      return FINALISED
    })

    render(
      <SeasonHistorySection
        competitions={[
          competition('Premier League', 'season-1'),
          competition('Scottish Premiership', 'season-2'),
        ]}
      />,
    )

    expect(await screen.findByText('412')).toBeInTheDocument()
    // Reported, not silently dropped: "could not read" and "never finished" are
    // different sentences.
    expect(screen.getByText(/Scottish Premiership 2026\/27 could not be/)).toBeInTheDocument()
  })

  it('states that an unpublished season cannot be looked up', async () => {
    mocks.fetchSeasonWrapped.mockResolvedValue({ finalised: false })

    render(<SeasonHistorySection competitions={[competition('Premier League', 'season-1')]} />)

    expect(
      await screen.findByText(/no longer listed cannot be looked up yet/),
    ).toBeInTheDocument()
  })

  it('asks for nothing when the player is in no competition', () => {
    render(<SeasonHistorySection competitions={[]} />)

    expect(mocks.fetchSeasonWrapped).not.toHaveBeenCalled()
    expect(screen.getByText(/No season you play in has finished yet/)).toBeInTheDocument()
  })

  it('prints a rank without a field size rather than inventing one', async () => {
    mocks.fetchSeasonWrapped.mockResolvedValue({
      ...FINALISED,
      season: { points: 12, rank: 3, fieldSize: null, matchweeksPlayed: 2 },
    })

    render(<SeasonHistorySection competitions={[competition('Premier League', 'season-1')]} />)

    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(screen.queryByText(/of null/)).toBeNull()
  })
})
