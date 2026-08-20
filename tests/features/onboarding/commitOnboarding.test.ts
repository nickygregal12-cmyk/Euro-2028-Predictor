import { describe, expect, it, vi } from 'vitest'
import { commitOnboarding } from '../../../src/features/onboarding/commitOnboarding'
import type { OnboardingCommitWrites } from '../../../src/features/onboarding/commitOnboarding'
import type { PlayerCompetitions } from '../../../src/features/hub/playerCompetitions'

/**
 * WHAT FINISHING SETUP WRITES, AND IN WHAT ORDER.
 *
 * This was the body of `OnboardingJourney.finish` and had no test of its own —
 * it could only be exercised through the component that held it. It moved out
 * when `/welcome` gained a second presentation, and the move is only safe if
 * the rules it carries are asserted rather than assumed, because BOTH hosts now
 * depend on them:
 *
 *   • a refused follow does not stop the game entries;
 *   • a refused game entry does not stop the rest, or the completion stamp;
 *   • completion is written either way, so a player is never trapped in setup;
 *   • a game with no `game_competition_id` on the membership row is REPORTED
 *     rather than joined by a guessed id.
 */

type Recorded = {
  readonly follows: string[]
  readonly entries: string[]
  readonly completions: [string, boolean | undefined][]
}

function writesWith(
  refuse: { follow?: string; entry?: string } = {},
): { writes: OnboardingCommitWrites; recorded: Recorded } {
  const recorded: Recorded = { follows: [], entries: [], completions: [] }
  const writes: OnboardingCommitWrites = {
    setCompetitionFollow: vi.fn(async (tournamentId: string) => {
      if (refuse.follow === tournamentId) throw new Error('refused')
      recorded.follows.push(tournamentId)
    }),
    registerBonusCompetition: vi.fn(async (id: string) => {
      if (refuse.entry === id) throw new Error('refused')
      recorded.entries.push(id)
    }),
    setOnboardingProgress: vi.fn(async (step: string, completed?: boolean) => {
      recorded.completions.push([step, completed])
    }),
  }
  return { writes, recorded }
}

/**
 * A membership read carrying only what the commit reads.
 *
 * Cast through `unknown` deliberately, and narrowly: a commit that started
 * reading `shortcuts`, `overflow` or `relevanceSource` would fail here rather
 * than quietly depend on a fixture nobody meant as a contract.
 */
function player(): PlayerCompetitions {
  return {
    catalogue: [
      {
        seasonRowName: 'premier-league-2026-27',
        tournamentId: 'tournament-pl',
        name: 'Premier League',
        games: [
          { gameKey: 'main_predictor', name: 'Match Predictor', joined: false },
          { gameKey: 'lms', name: 'Last Man Standing', joined: true },
          { gameKey: 'bonus_cup', name: 'Predictor Championship', joined: false },
        ],
      },
    ],
    mine: [
      {
        competition: { seasonRowName: 'premier-league-2026-27' },
        games: [
          { gameKey: 'main_predictor', id: 'game-competition-mp' },
          { gameKey: 'lms', id: 'game-competition-lms' },
          // `bonus_cup` deliberately has NO membership row, so it has no id.
        ],
      },
    ],
  } as unknown as PlayerCompetitions
}

const DRAFT = {
  followed: ['premier-league-2026-27'],
  games: { 'premier-league-2026-27': ['main_predictor'] },
  favourites: { 'premier-league-2026-27': 'team-arsenal' },
} as never

describe('committing onboarding', () => {
  it('writes the follow with its favourite club, then the game entry, then completion', async () => {
    const { writes, recorded } = writesWith()

    const outcome = await commitOnboarding({ draft: DRAFT, player: player(), writes })

    expect(outcome).toEqual({ kind: 'saved' })
    expect(writes.setCompetitionFollow).toHaveBeenCalledWith(
      'tournament-pl',
      true,
      'team-arsenal',
    )
    expect(recorded.entries).toEqual(['game-competition-mp'])
    // Completion is stamped with `true`, which is what makes it completion
    // rather than progress. The server stamps it once and never rewrites it.
    expect(recorded.completions).toEqual([['review', true]])
  })

  it('reports a refused follow and still enters the games and finishes', async () => {
    const { writes, recorded } = writesWith({ follow: 'tournament-pl' })

    const outcome = await commitOnboarding({ draft: DRAFT, player: player(), writes })

    expect(outcome).toEqual({ kind: 'partial', refused: ['Following Premier League'] })
    expect(recorded.entries).toEqual(['game-competition-mp'])
    expect(recorded.completions).toEqual([['review', true]])
  })

  it('reports a refused game entry by name and still finishes', async () => {
    const { writes, recorded } = writesWith({ entry: 'game-competition-mp' })

    const outcome = await commitOnboarding({ draft: DRAFT, player: player(), writes })

    expect(outcome).toEqual({
      kind: 'partial',
      refused: ['Match Predictor in Premier League'],
    })
    expect(recorded.follows).toEqual(['tournament-pl'])
    expect(recorded.completions).toEqual([['review', true]])
  })

  it('never joins a game whose membership row carried no id', async () => {
    const { writes, recorded } = writesWith()

    const outcome = await commitOnboarding({
      draft: {
        followed: ['premier-league-2026-27'],
        games: { 'premier-league-2026-27': ['bonus_cup'] },
        favourites: {},
      } as never,
      player: player(),
      writes,
    })

    // A join sent to a constructed id would be a join to a competition nobody
    // chose, so the absence is reported instead.
    expect(outcome).toEqual({
      kind: 'partial',
      refused: ['Predictor Championship in Premier League'],
    })
    expect(recorded.entries).toEqual([])
  })

  it('leaves a game the player is already in alone', async () => {
    const { writes, recorded } = writesWith()

    await commitOnboarding({
      draft: {
        followed: ['premier-league-2026-27'],
        games: { 'premier-league-2026-27': ['lms'] },
        favourites: {},
      } as never,
      player: player(),
      writes,
    })

    // `joined` is a server fact on the offer. Re-registering it would be a
    // write nobody asked for, and a chance to fail for no gain.
    expect(recorded.entries).toEqual([])
  })

  it('follows nothing, joins nothing and still completes when the draft is empty', async () => {
    const { writes, recorded } = writesWith()

    const outcome = await commitOnboarding({
      draft: { followed: [], games: {}, favourites: {} } as never,
      player: player(),
      writes,
    })

    // Following nothing is a COMPLETE outcome. The only thing onboarding
    // insists on is that it happened.
    expect(outcome).toEqual({ kind: 'saved' })
    expect(recorded.follows).toEqual([])
    expect(recorded.completions).toEqual([['review', true]])
  })
})
