export type HubGameKind =
  | 'league-predictor'
  | 'original-predictor'
  | 'last-man-standing'
  | 'predictor-championship'
  | 'ko-predictor'

export type HubGame = {
  kind: HubGameKind
  name: string
  description: string
  joined: boolean
  status: 'available' | 'joined' | 'coming-soon'
}

export type HubCompetition = {
  competitionSlug: string
  seasonSlug: string
  name: string
  seasonLabel: string
  status: 'live' | 'upcoming' | 'parked'
  summary: string
  games: HubGame[]
}

export const HUB_COMPETITIONS: HubCompetition[] = [
  {
    competitionSlug: 'premier-league',
    seasonSlug: '2026-27',
    name: 'Premier League',
    seasonLabel: '2026/27',
    status: 'upcoming',
    summary: 'Weekly score predictions, Last Man Standing and the Predictor Championship.',
    games: [
      {
        kind: 'league-predictor',
        name: 'Main Predictor',
        description: 'Predict every score before the matchweek locks at its first kickoff.',
        joined: true,
        status: 'joined',
      },
      {
        kind: 'last-man-standing',
        name: 'Last Man Standing',
        description: 'Choose one team each round and survive for as long as possible.',
        joined: true,
        status: 'joined',
      },
      {
        kind: 'predictor-championship',
        name: 'Predictor Championship',
        description: 'Play a head-to-head fixture every matchweek for three, one or zero points.',
        joined: true,
        status: 'joined',
      },
    ],
  },
  {
    competitionSlug: 'scottish-premiership',
    seasonSlug: '2026-27',
    name: 'Scottish Premiership',
    seasonLabel: '2026/27',
    status: 'live',
    summary: 'A backfilled rehearsal season using the same three domestic game formats.',
    games: [
      {
        kind: 'league-predictor',
        name: 'Main Predictor',
        description: 'Weekly score predictions with late entry starting from zero.',
        joined: false,
        status: 'available',
      },
      {
        kind: 'last-man-standing',
        name: 'Last Man Standing',
        description: 'Global entry is closed after the start; new private games can begin later.',
        joined: false,
        status: 'available',
      },
      {
        kind: 'predictor-championship',
        name: 'Predictor Championship',
        description: 'Matchweek head-to-head scoring with playoffs beginning after the split fixtures are known.',
        joined: false,
        status: 'available',
      },
    ],
  },
  {
    competitionSlug: 'euro',
    seasonSlug: '2028',
    name: 'Euro 2028',
    seasonLabel: '2028',
    status: 'parked',
    summary: 'The preserved tournament experience returns as a focused competition in January 2028.',
    games: [
      {
        kind: 'original-predictor',
        name: 'Original Predictor',
        description: 'Predict the full tournament before its single opening lock.',
        joined: true,
        status: 'joined',
      },
      {
        kind: 'ko-predictor',
        name: 'KO Predictor',
        description: 'Predict knockout matches as the tournament progresses.',
        joined: false,
        status: 'coming-soon',
      },
      {
        kind: 'last-man-standing',
        name: 'Last Man Standing',
        description: 'Tournament survival game with its own entry and result state.',
        joined: false,
        status: 'coming-soon',
      },
      {
        kind: 'predictor-championship',
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
