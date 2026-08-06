import { describe, expect, it } from 'vitest'
import {
  HUB_COMPETITIONS,
  competitionPath,
  findHubCompetition,
  isJoinedCompetition,
  partitionHubCompetitions,
  type HubCompetition,
} from '../../../src/features/hub/competitionCatalogue'

function competition(overrides: Partial<HubCompetition> = {}): HubCompetition {
  return {
    competitionSlug: 'premier-league',
    seasonSlug: '2026-27',
    seasonRowName: 'Premier League 2026/27',
    name: 'Premier League',
    seasonLabel: '2026/27',
    status: 'upcoming',
    summary: 'A summary.',
    games: [],
    ...overrides,
  }
}

const joinedGame = {
  kind: 'league-predictor',
  gameKey: 'main_predictor',
  name: 'Main Predictor',
  description: 'A description.',
  joined: true,
  status: 'joined',
} as const

const availableGame = {
  kind: 'last-man-standing',
  gameKey: 'last_man_standing',
  name: 'Last Man Standing',
  description: 'A description.',
  joined: false,
  status: 'available',
} as const

describe('isJoinedCompetition', () => {
  it('treats a competition with any joined game as joined', () => {
    expect(isJoinedCompetition(competition({ games: [availableGame, joinedGame] }))).toBe(true)
  })

  it('treats a competition with no joined game as not joined', () => {
    expect(isJoinedCompetition(competition({ games: [availableGame] }))).toBe(false)
  })

  it('treats a competition with no games at all as not joined', () => {
    expect(isJoinedCompetition(competition({ games: [] }))).toBe(false)
  })
})

describe('partitionHubCompetitions', () => {
  it('splits joined competitions from the rest', () => {
    const mineInput = competition({ competitionSlug: 'mine', games: [joinedGame] })
    const discoverInput = competition({ competitionSlug: 'discover', games: [availableGame] })

    const { mine, discover } = partitionHubCompetitions([mineInput, discoverInput])

    expect(mine).toEqual([mineInput])
    expect(discover).toEqual([discoverInput])
  })

  it('keeps a competition the user has not joined visible in Discover rather than hiding it', () => {
    const { mine, discover } = partitionHubCompetitions([competition({ games: [availableGame] })])

    expect(mine).toHaveLength(0)
    expect(discover).toHaveLength(1)
  })

  it('returns every competition exactly once across both sides', () => {
    const { mine, discover } = partitionHubCompetitions(HUB_COMPETITIONS)

    expect(mine.length + discover.length).toBe(HUB_COMPETITIONS.length)
    expect([...mine, ...discover].map(competitionPath).sort()).toEqual(
      HUB_COMPETITIONS.map(competitionPath).sort(),
    )
  })

  it('preserves catalogue order within each side', () => {
    const first = competition({ competitionSlug: 'first', games: [joinedGame] })
    const second = competition({ competitionSlug: 'second', games: [availableGame] })
    const third = competition({ competitionSlug: 'third', games: [joinedGame] })

    const { mine } = partitionHubCompetitions([first, second, third])

    expect(mine.map((entry) => entry.competitionSlug)).toEqual(['first', 'third'])
  })
})

describe('the shipped catalogue', () => {
  it('gives every competition a unique route', () => {
    const paths = HUB_COMPETITIONS.map(competitionPath)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('resolves every catalogue entry from its own slugs', () => {
    for (const entry of HUB_COMPETITIONS) {
      expect(findHubCompetition(entry.competitionSlug, entry.seasonSlug)).toBe(entry)
    }
  })

  it('returns null for an unknown competition rather than guessing', () => {
    expect(findHubCompetition('la-liga', '2026-27')).toBeNull()
    expect(findHubCompetition(undefined, undefined)).toBeNull()
  })

  it('keeps the joined flag consistent with the joined status', () => {
    for (const entry of HUB_COMPETITIONS) {
      for (const game of entry.games) {
        expect(game.joined).toBe(game.status === 'joined')
      }
    }
  })

  it('never hard-codes a membership claim — membership is the server’s to state', () => {
    // The Hub shipped for a while with `joined: true` written into this file,
    // so the interface disagreed with the player's actual entries. The
    // catalogue is presentation copy; `applyHubMembership` overlays the real
    // memberships from the C1b read.
    for (const entry of HUB_COMPETITIONS) {
      for (const game of entry.games) {
        expect(game.joined, `${entry.competitionSlug}/${game.kind}`).toBe(false)
        expect(game.status, `${entry.competitionSlug}/${game.kind}`).not.toBe('joined')
      }
    }
  })

  it('names a distinct database season row for every entry', () => {
    const names = HUB_COMPETITIONS.map((entry) => entry.seasonRowName)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) {
      expect(name.trim().length).toBeGreaterThan(0)
    }
  })

  it('offers the three domestic games in both rehearsal seasons', () => {
    for (const slug of ['premier-league', 'scottish-premiership']) {
      const entry = findHubCompetition(slug, '2026-27')
      expect(entry).not.toBeNull()
      expect(entry?.games.map((game) => game.kind).sort()).toEqual([
        'last-man-standing',
        'league-predictor',
        'predictor-championship',
      ])
    }
  })
})
