import { describe, expect, it } from 'vitest'
import {
  catalogueFromPublishedSeasons,
  competitionPath,
  findHubCompetition,
  isJoinedCompetition,
  partitionHubCompetitions,
  seasonLabelFromKey,
  type HubCompetition,
} from '../../../src/features/hub/competitionCatalogue'
import {
  TWENTY_COMPETITION_CATALOGUE,
  TWENTY_COMPETITION_MEMBERSHIP,
  TWENTY_COMPETITION_SEASONS,
} from '../../../src/dev/scaleFixture'

function competition(overrides: Partial<HubCompetition> = {}): HubCompetition {
  return {
    competitionSlug: 'premier-league',
    seasonSlug: '2026-27',
    seasonRowName: 'Premier League 2026/27',
    tournamentId: 'season-premier-league',
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
    const { mine, discover } = partitionHubCompetitions(TWENTY_COMPETITION_CATALOGUE)

    expect(mine.length + discover.length).toBe(TWENTY_COMPETITION_CATALOGUE.length)
    expect([...mine, ...discover].map(competitionPath).sort()).toEqual(
      TWENTY_COMPETITION_CATALOGUE.map(competitionPath).sort(),
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

describe('the catalogue the server publishes', () => {
  const catalogue = TWENTY_COMPETITION_CATALOGUE

  it('gives every competition a unique route', () => {
    const paths = catalogue.map(competitionPath)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('resolves every catalogue entry from its own slugs', () => {
    for (const entry of catalogue) {
      expect(findHubCompetition(catalogue, entry.competitionSlug, entry.seasonSlug)).toBe(entry)
    }
  })

  it('returns null for an unknown competition rather than guessing', () => {
    expect(findHubCompetition(catalogue, 'not-a-competition', '2026-27')).toBeNull()
    expect(findHubCompetition(catalogue, undefined, undefined)).toBeNull()
  })

  it('takes every route slug from the server and never derives one from a name', () => {
    // Contract 147 returns `competition_slug`. The proof that nothing is
    // derived is that a season whose slug disagrees with its name still routes
    // to the SLUG — a name-derived one would produce "the fa cup" and 404.
    const built = catalogueFromPublishedSeasons(
      [
        {
          competitionSlug: 'top-flight',
          seasonKey: '2026-27',
          competitionId: 'competition-1',
          competitionName: 'The FA Cup',
          seasonId: 'season-1',
          seasonName: 'The FA Cup 2026/27',
          status: 'active',
          timeZone: 'Europe/London',
        },
      ],
      [],
    )

    expect(built).toHaveLength(1)
    expect(built[0]?.competitionSlug).toBe('top-flight')
    expect(competitionPath(built[0] as HubCompetition)).toBe('/competitions/top-flight/2026-27')
  })

  it('never hard-codes a membership claim — membership is the server’s to state', () => {
    // The Hub shipped for a while with `joined: true` written into a frontend
    // array, so the interface disagreed with the player's actual entries.
    // `catalogueFromPublishedSeasons` builds shape only; `applyHubMembership`
    // overlays the real memberships from the C1b read.
    for (const entry of catalogue) {
      for (const game of entry.games) {
        expect(game.joined, `${entry.competitionSlug}/${game.kind}`).toBe(false)
        expect(game.status, `${entry.competitionSlug}/${game.kind}`).not.toBe('joined')
      }
    }
  })

  it('names a distinct database season row for every entry', () => {
    const names = catalogue.map((entry) => entry.seasonRowName)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) {
      expect(name.trim().length).toBeGreaterThan(0)
    }
  })

  it('takes whether a season SERVES a game from the server, never from a frontend list', () => {
    // The three weekly formats are a platform fact (ADR 0012–0014) and are
    // always listed, so "this competition has not opened Last Man Standing" is
    // sayable. Whether each is actually OPEN is `get_competition_games`, and a
    // season the read did not answer for opens none of them — which is the
    // difference between reporting and inventing.
    const [first] = catalogue
    expect(first?.games.map((game) => game.kind)).toEqual([
      'league-predictor',
      'last-man-standing',
      'predictor-championship',
    ])
    expect(first?.games.every((game) => game.status === 'available')).toBe(true)

    const unread = catalogueFromPublishedSeasons(TWENTY_COMPETITION_SEASONS.slice(0, 1), [])
    expect(unread[0]?.games.map((game) => game.status)).toEqual([
      'coming-soon',
      'coming-soon',
      'coming-soon',
    ])
    expect(unread[0]?.summary).toContain('No games are open')
  })

  it('scales to twenty published competitions with no frontend edit', () => {
    // The whole acceptance property of the scalability contract: twenty
    // seasons in, twenty routable competitions out, from server rows alone.
    expect(TWENTY_COMPETITION_SEASONS).toHaveLength(20)
    expect(catalogueFromPublishedSeasons(TWENTY_COMPETITION_SEASONS, TWENTY_COMPETITION_MEMBERSHIP))
      .toHaveLength(20)
  })

  it('formats a season key as football writes it, without inventing an identity', () => {
    expect(seasonLabelFromKey('2026-27')).toBe('2026/27')
    // The KEY is what routes and reads are addressed by, and is unchanged.
    expect(catalogue[0]?.seasonSlug).toBe('2026-27')
  })
})
