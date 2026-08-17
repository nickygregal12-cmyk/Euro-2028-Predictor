export type ConsensusCount = {
  picks: number
}

export type ChampionConsensus = ConsensusCount & {
  teamId: string
}

export type FinalConsensus = ConsensusCount & {
  teamAId: string
  teamBId: string
}

export type GoldenBootConsensus = ConsensusCount & {
  playerId: string
  teamId: string | null
}

export type MatchConsensusSignal = {
  matchId: string
  matchRef: string
  homeTeamId: string | null
  awayTeamId: string | null
  predictions: number
  homePicks: number
  drawPicks: number
  awayPicks: number
}

export type AgreedMatchConsensus = MatchConsensusSignal & {
  dominantOutcome: 'home' | 'draw' | 'away'
  dominantPicks: number
}

export type DividedMatchConsensus = MatchConsensusSignal & {
  topTwoGap: number
}

export type TrustedTeamConsensus = {
  teamId: string
  predictedWins: number
}

export type GoalDistributionPoint = {
  totalGoals: number
  entries: number
}

export type GoalsSpread = {
  minimum: number | null
  median: number | null
  maximum: number | null
  average: number | null
  distinctTotals: number
  distribution: GoalDistributionPoint[]
}

export type UniqueConsensusPick =
  | { kind: 'champion'; teamId: string }
  | { kind: 'final'; teamAId: string; teamBId: string }
  | { kind: 'golden_boot'; playerId: string }
  | {
      kind: 'exact_score'
      matchId: string
      matchRef: string
      homeScore: number
      awayScore: number
    }

export type PredictionConsensus = {
  serverNow: string
  lockedAt: string
  submittedEntries: number
  championRace: ChampionConsensus[]
  peoplesFinal: FinalConsensus[]
  goldenBoot: GoldenBootConsensus[]
  mostAgreedMatch: AgreedMatchConsensus | null
  mostDividedMatch: DividedMatchConsensus | null
  mostTrustedTeam: TrustedTeamConsensus | null
  goalsSpread: GoalsSpread
  onlyYou: UniqueConsensusPick[]
}

type RecordValue = Record<string, unknown>

function recordOf(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} was malformed.`)
  }
  return value as RecordValue
}

function stringOf(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} was malformed.`)
  }
  return value
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null
  return stringOf(value, label)
}

function integerOf(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
    throw new Error(`${label} was malformed.`)
  }
  return value
}

function nullableInteger(value: unknown, label: string): number | null {
  if (value === null) return null
  return integerOf(value, label)
}

function nullableNumber(value: unknown, label: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} was malformed.`)
  }
  return value
}

function timestampOf(value: unknown, label: string): string {
  const timestamp = stringOf(value, label)
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`${label} was malformed.`)
  return timestamp
}

function boundedArray<T>(
  value: unknown,
  limit: number,
  label: string,
  mapper: (item: unknown, index: number) => T,
): T[] {
  if (!Array.isArray(value) || value.length > limit) {
    throw new Error(`${label} was malformed.`)
  }
  return value.map(mapper)
}

function mapChampion(value: unknown, index: number): ChampionConsensus {
  const row = recordOf(value, `Champion row ${index + 1}`)
  return {
    teamId: stringOf(row.team_id, 'Champion team'),
    picks: integerOf(row.picks, 'Champion picks', 1),
  }
}

function mapFinal(value: unknown, index: number): FinalConsensus {
  const row = recordOf(value, `Final row ${index + 1}`)
  const teamAId = stringOf(row.team_a_id, 'Final team A')
  const teamBId = stringOf(row.team_b_id, 'Final team B')
  if (teamAId === teamBId) throw new Error('Predicted final was malformed.')
  return {
    teamAId,
    teamBId,
    picks: integerOf(row.picks, 'Final picks', 1),
  }
}

function mapBoot(value: unknown, index: number): GoldenBootConsensus {
  const row = recordOf(value, `Golden Boot row ${index + 1}`)
  return {
    playerId: stringOf(row.player_id, 'Golden Boot player'),
    teamId: nullableString(row.team_id, 'Golden Boot team'),
    picks: integerOf(row.picks, 'Golden Boot picks', 1),
  }
}

function mapBaseMatch(value: unknown, label: string): MatchConsensusSignal {
  const row = recordOf(value, label)
  const predictions = integerOf(row.predictions, `${label} prediction count`, 1)
  const homePicks = integerOf(row.home_picks, `${label} home picks`)
  const drawPicks = integerOf(row.draw_picks, `${label} draw picks`)
  const awayPicks = integerOf(row.away_picks, `${label} away picks`)
  if (homePicks + drawPicks + awayPicks !== predictions) {
    throw new Error(`${label} outcome counts were malformed.`)
  }
  return {
    matchId: stringOf(row.match_id, `${label} match id`),
    matchRef: stringOf(row.match_ref, `${label} match reference`),
    homeTeamId: nullableString(row.home_team_id, `${label} home team`),
    awayTeamId: nullableString(row.away_team_id, `${label} away team`),
    predictions,
    homePicks,
    drawPicks,
    awayPicks,
  }
}

function mapAgreed(value: unknown): AgreedMatchConsensus | null {
  if (value === null) return null
  const row = recordOf(value, 'Most agreed match')
  const base = mapBaseMatch(row, 'Most agreed match')
  const outcome = row.dominant_outcome
  if (outcome !== 'home' && outcome !== 'draw' && outcome !== 'away') {
    throw new Error('Most agreed outcome was malformed.')
  }
  const dominantPicks = integerOf(row.dominant_picks, 'Most agreed picks', 1)
  if (dominantPicks > base.predictions) throw new Error('Most agreed picks were malformed.')
  return { ...base, dominantOutcome: outcome, dominantPicks }
}

function mapDivided(value: unknown): DividedMatchConsensus | null {
  if (value === null) return null
  const row = recordOf(value, 'Most divided match')
  const base = mapBaseMatch(row, 'Most divided match')
  return {
    ...base,
    topTwoGap: integerOf(row.top_two_gap, 'Most divided gap'),
  }
}

function mapTrusted(value: unknown): TrustedTeamConsensus | null {
  if (value === null) return null
  const row = recordOf(value, 'Most trusted team')
  return {
    teamId: stringOf(row.team_id, 'Trusted team'),
    predictedWins: integerOf(row.predicted_wins, 'Trusted predicted wins', 1),
  }
}

function mapGoals(value: unknown): GoalsSpread {
  const row = recordOf(value, 'Goals spread')
  const distribution = boundedArray(
    row.distribution,
    40,
    'Goals distribution',
    (item, index) => {
      const point = recordOf(item, `Goals distribution row ${index + 1}`)
      return {
        totalGoals: integerOf(point.total_goals, 'Predicted goals total'),
        entries: integerOf(point.entries, 'Goals distribution entries', 1),
      }
    },
  )
  for (let index = 1; index < distribution.length; index += 1) {
    const previous = distribution[index - 1]
    const current = distribution[index]
    if (previous === undefined || current === undefined) {
      throw new Error('Goals distribution ordering was malformed.')
    }
    if (previous.totalGoals >= current.totalGoals) {
      throw new Error('Goals distribution ordering was malformed.')
    }
  }
  return {
    minimum: nullableInteger(row.minimum, 'Minimum goals'),
    median: nullableInteger(row.median, 'Median goals'),
    maximum: nullableInteger(row.maximum, 'Maximum goals'),
    average: nullableNumber(row.average, 'Average goals'),
    distinctTotals: integerOf(row.distinct_totals, 'Distinct goal totals'),
    distribution,
  }
}

function mapUniquePick(value: unknown, index: number): UniqueConsensusPick {
  const row = recordOf(value, `Only-you row ${index + 1}`)
  switch (row.kind) {
    case 'champion':
      return { kind: 'champion', teamId: stringOf(row.team_id, 'Unique champion') }
    case 'final': {
      const teamAId = stringOf(row.team_a_id, 'Unique final team A')
      const teamBId = stringOf(row.team_b_id, 'Unique final team B')
      if (teamAId === teamBId) throw new Error('Unique final was malformed.')
      return { kind: 'final', teamAId, teamBId }
    }
    case 'golden_boot':
      return {
        kind: 'golden_boot',
        playerId: stringOf(row.player_id, 'Unique Golden Boot player'),
      }
    case 'exact_score':
      return {
        kind: 'exact_score',
        matchId: stringOf(row.match_id, 'Unique score match'),
        matchRef: stringOf(row.match_ref, 'Unique score reference'),
        homeScore: integerOf(row.home_score, 'Unique home score'),
        awayScore: integerOf(row.away_score, 'Unique away score'),
      }
    default:
      throw new Error('Only-you pick kind was malformed.')
  }
}

export function mapPredictionConsensus(value: unknown): PredictionConsensus {
  const payload = recordOf(value, 'Prediction consensus')
  return {
    serverNow: timestampOf(payload.server_now, 'Consensus server time'),
    lockedAt: timestampOf(payload.locked_at, 'Consensus lock time'),
    submittedEntries: integerOf(payload.submitted_entries, 'Submitted entry count'),
    championRace: boundedArray(payload.champion_race, 10, 'Champion race', mapChampion),
    peoplesFinal: boundedArray(payload.peoples_final, 10, "People's final", mapFinal),
    goldenBoot: boundedArray(payload.golden_boot, 10, 'Golden Boot consensus', mapBoot),
    mostAgreedMatch: mapAgreed(payload.most_agreed_match),
    mostDividedMatch: mapDivided(payload.most_divided_match),
    mostTrustedTeam: mapTrusted(payload.most_trusted_team),
    goalsSpread: mapGoals(payload.goals_spread),
    onlyYou: boundedArray(payload.only_you, 6, 'Only-you picks', mapUniquePick),
  }
}
