import { competitionRoute } from '../../app/weeklyRoutes'
import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'

export type HubGameKind =
  | 'league-predictor'
  | 'original-predictor'
  | 'last-man-standing'
  | 'predictor-championship'
  | 'ko-predictor'

export type HubGame = {
  kind: HubGameKind
  gameKey: CompetitionGameKey
  name: string
  description: string
  joined: boolean
  status: 'available' | 'joined' | 'coming-soon'
}

export type HubCompetition = {
  competitionSlug: string
  seasonSlug: string
  seasonRowName: string
  name: string
  seasonLabel: string
  status: 'live' | 'upcoming' | 'parked' | 'ended'
  summary: string
  games: HubGame[]
}

/**
 * Weekly frontend presentation catalogue. Only currently published domestic
 * seasons belong here. Euro 2028 is intentionally absent from the weekly
 * client while its server-owned publication state and route guard remain a
 * separate requirement; removing it here reduces exposure but does not claim
 * EURO-001–EURO-004 complete.
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
        name: 'Match Predictor',
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
        name: 'Match Predictor',
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
]

export function competitionPath(competition: HubCompetition): string {
  return competitionRoute(competition)
}

export function isJoinedCompetition(competition: HubCompetition): boolean {
  return competition.games.some((game) => game.joined)
}

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
