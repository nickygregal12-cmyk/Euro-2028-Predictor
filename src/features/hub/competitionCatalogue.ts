import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'

export type HubGameKind =
  | 'league-predictor'
  | 'original-predictor'
  | 'last-man-standing'
  | 'predictor-championship'
  | 'ko-predictor'

export type HubGame = {
  kind: HubGameKind
  /** The database `game_definitions.game_key` this card describes. */
  gameKey: CompetitionGameKey
  name: string
  description: string
  joined: boolean
  status: 'available' | 'joined' | 'coming-soon'
}

export type HubCompetition = {
  competitionSlug: string
  seasonSlug: string
  /**
   * The exact `tournaments.name` of this season's database row, as the C1
   * baseline and C1b catalogue migrations created it. Membership resolution
   * matches on this value alone — `competitions.slug` is not browser-readable
   * and deriving it client-side would silently drift from the server's rule.
   */
  seasonRowName: string
  name: string
  seasonLabel: string
  status: 'live' | 'upcoming' | 'parked' | 'ended'
  summary: string
  games: HubGame[]
}

/**
 * Presentation truth only: names, copy and routes. Membership and game
 * availability are the server's to state — `applyHubMembership` overlays them
 * from the C1b catalogue read, so no entry below may claim `joined` or the
 * `joined` status. `tests/features/hub/competitionCatalogue.test.ts` enforces
 * that. The `parked` status is a product label (Euro returns in January 2028),
 * not a lifecycle read, so it survives the overlay.
 */
export const HUB_COMPETITIONS: HubCompetition[] = [
  {
    competitionSlug: 'premier-league',
    seasonSlug: '2026-27',
    seasonRowName: 'Premier League 2026/27',
    name: 'Premier League',
    seasonLabel: '2026/27',
    status: 'upcoming',
    summary: 'Weekly score predictions, Last Man Standing and the Predictor Championship.',
    games: [
      {
        kind: 'league-predictor',
        gameKey: 'main_predictor',
        name: 'Main Predictor',
        description: 'Predict every score before the matchweek locks at its first kickoff.',
        joined: false,
        status: 'coming-soon',
      },
      {
        kind: 'last-man-standing',
        gameKey: 'last_man_standing',
        name: 'Last Man Standing',
        description: 'Choose one team each round and survive for as long as possible.',
        joined: false,
        status: 'coming-soon',
      },
      {
        kind: 'predictor-championship',
        gameKey: 'predictor_cup',
        name: 'Predictor Championship',
        description: 'Play a head-to-head fixture every matchweek for three, one or zero points.',
        joined: false,
        status: 'coming-soon',
      },
    ],
  },
  {
    competitionSlug: 'scottish-premiership',
    seasonSlug: '2026-27',
    seasonRowName: 'Scottish Premiership 2026/27',
    name: 'Scottish Premiership',
    seasonLabel: '2026/27',
    status: 'upcoming',
    summary: 'A backfilled rehearsal season using the same three domestic game formats.',
    games: [
      {
        kind: 'league-predictor',
        gameKey: 'main_predictor',
        name: 'Main Predictor',
        description: 'Weekly score predictions with late entry starting from zero.',
        joined: false,
        status: 'coming-soon',
      },
      {
        kind: 'last-man-standing',
        gameKey: 'last_man_standing',
        name: 'Last Man Standing',
        description: 'Global entry is closed after the start; new private games can begin later.',
        joined: false,
        status: 'coming-soon',
      },
      {
        kind: 'predictor-championship',
        gameKey: 'predictor_cup',
        name: 'Predictor Championship',
        description:
          'Matchweek head-to-head scoring with playoffs beginning after the split fixtures are known.',
        joined: false,
        status: 'coming-soon',
      },
    ],
  },
  {
    competitionSlug: 'euro',
    seasonSlug: '2028',
    seasonRowName: 'UEFA Euro 2028',
    name: 'Euro 2028',
    seasonLabel: '2028',
    status: 'parked',
    summary: 'The preserved tournament experience returns as a focused competition in January 2028.',
    games: [
      {
        kind: 'original-predictor',
        gameKey: 'original_predictor',
        name: 'Original Predictor',
        description: 'Predict the full tournament before its single opening lock.',
        joined: false,
        status: 'available',
      },
      {
        kind: 'ko-predictor',
        gameKey: 'ko_predictor',
        name: 'KO Predictor',
        description: 'Predict knockout matches as the tournament progresses.',
        joined: false,
        status: 'coming-soon',
      },
      {
        kind: 'last-man-standing',
        gameKey: 'last_man_standing',
        name: 'Last Man Standing',
        description: 'Tournament survival game with its own entry and result state.',
        joined: false,
        status: 'coming-soon',
      },
      {
        kind: 'predictor-championship',
        gameKey: 'predictor_cup',
        name: 'Predictor Championship',
        description: 'Tournament head-to-head competition using the same football points model.',
        joined: false,
        status: 'coming-soon',
      },
    ],
  },
]

export function competitionPath(competition: HubCompetition): string {
  return `/competitions/${competition.competitionSlug}/${competition.seasonSlug}`
}

/**
 * A competition counts as joined while the user holds at least one active game
 * entry in it. Competition membership and game membership are separate records
 * under ADR 0020; the C1b read reports both, and its `competition_member` flag
 * is defined as "any active game membership in the season", so deriving the
 * competition half from the game half here agrees with the server by
 * construction.
 */
export function isJoinedCompetition(competition: HubCompetition): boolean {
  return competition.games.some((game) => game.joined)
}

/**
 * Leaving a competition returns it to Discover rather than hiding it.
 */
export function partitionHubCompetitions(competitions: HubCompetition[]): {
  mine: HubCompetition[]
  discover: HubCompetition[]
} {
  return {
    mine: competitions.filter(isJoinedCompetition),
    discover: competitions.filter((competition) => !isJoinedCompetition(competition)),
  }
}

export function findHubCompetition(
  competitionSlug: string | undefined,
  seasonSlug: string | undefined,
): HubCompetition | null {
  return (
    HUB_COMPETITIONS.find(
      (competition) =>
        competition.competitionSlug === competitionSlug &&
        competition.seasonSlug === seasonSlug,
    ) ?? null
  )
}
