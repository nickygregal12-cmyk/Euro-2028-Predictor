export const MATCH_LIFECYCLE_STATES = [
  'SCHEDULED',
  'PRE_MATCH',
  'LIVE_FIRST_HALF',
  'HALF_TIME',
  'LIVE_SECOND_HALF',
  'EXTRA_TIME',
  'PENALTIES',
  'FULL_TIME',
  'POSTPONED',
  'SUSPENDED',
  'CANCELLED',
] as const

export type MatchLifecycleState = (typeof MATCH_LIFECYCLE_STATES)[number]

export type MatchDataQuality = 'verified' | 'provisional' | 'delayed' | 'unavailable'

export type MatchSourceMetadata = {
  provider: string
  providerFixtureId: string | null
  fetchedAt: string
  providerUpdatedAt: string | null
  isStale: boolean
  freshnessSeconds: number
  dataQuality: MatchDataQuality
}

export type MatchTeam = {
  id: string | null
  name: string
  countryCode: string | null
}

export type MatchScore = {
  home: number
  away: number
  homeExtraTime?: number | null
  awayExtraTime?: number | null
  homePenalties?: number | null
  awayPenalties?: number | null
}

export type MatchEventKind = 'goal' | 'card' | 'substitution' | 'period' | 'other'

export type MatchEvent = {
  id: string
  kind: MatchEventKind
  minute: number | null
  addedMinute: number | null
  teamId: string | null
  playerName: string | null
  secondaryPlayerName: string | null
  label: string
  sequence: number
}

export type MatchLineupPlayer = {
  playerId: string | null
  name: string
  shirtNumber: number | null
  position: string | null
  starter: boolean
}

export type MatchLineup = {
  formation: string | null
  confirmed: boolean
  players: MatchLineupPlayer[]
}

export type MatchStatistic = {
  key: string
  label: string
  home: number | string | null
  away: number | string | null
}

export type ExternalMatchData = {
  fixtureId: string
  matchRef: string
  kickoffAt: string
  lifecycle: MatchLifecycleState
  clockLabel: string | null
  venue: string | null
  referee: string | null
  home: MatchTeam
  away: MatchTeam
  score: MatchScore | null
  events: MatchEvent[]
  lineups: {
    home: MatchLineup | null
    away: MatchLineup | null
  }
  statistics: MatchStatistic[]
  source: MatchSourceMetadata
}

export type PredictorMatchData = {
  userPrediction: {
    homeScore: number
    awayScore: number
    joker: boolean
  } | null
  points: {
    status: 'pending' | 'provisional' | 'final' | 'unavailable'
    value: number | null
  }
  leaguePredictionSplit: {
    home: number
    draw: number
    away: number
    total: number
  } | null
  liveRankImpact: number | null
  groupTableImpact: string | null
  thirdPlaceTableImpact: string | null
  bracketImpact: string | null
}

export type OptionalMatchEnrichment = {
  injuries: string[] | null
  predictedLineups: {
    home: MatchLineup | null
    away: MatchLineup | null
  } | null
  expectedGoals: {
    home: number | null
    away: number | null
  } | null
  advancedPossession: {
    home: number | null
    away: number | null
  } | null
  headToHeadSummary: string | null
  qualificationProbability: {
    home: number | null
    away: number | null
  } | null
}

export type MatchCentreViewModel = {
  external: ExternalMatchData
  predictor: PredictorMatchData
  enrichment: OptionalMatchEnrichment
}

export type UnknownMatchStatusReporter = (input: {
  provider: string
  providerStatus: string
}) => void

const STATUS_ALIASES: Record<string, MatchLifecycleState> = {
  NS: 'SCHEDULED',
  TBD: 'SCHEDULED',
  SCHEDULED: 'SCHEDULED',
  PRE: 'PRE_MATCH',
  PRE_MATCH: 'PRE_MATCH',
  '1H': 'LIVE_FIRST_HALF',
  FIRST_HALF: 'LIVE_FIRST_HALF',
  LIVE_FIRST_HALF: 'LIVE_FIRST_HALF',
  HT: 'HALF_TIME',
  HALF_TIME: 'HALF_TIME',
  '2H': 'LIVE_SECOND_HALF',
  SECOND_HALF: 'LIVE_SECOND_HALF',
  LIVE_SECOND_HALF: 'LIVE_SECOND_HALF',
  ET: 'EXTRA_TIME',
  EXTRA_TIME: 'EXTRA_TIME',
  P: 'PENALTIES',
  PEN: 'PENALTIES',
  PENALTIES: 'PENALTIES',
  FT: 'FULL_TIME',
  AET: 'FULL_TIME',
  FULL_TIME: 'FULL_TIME',
  PST: 'POSTPONED',
  POSTPONED: 'POSTPONED',
  SUSP: 'SUSPENDED',
  SUSPENDED: 'SUSPENDED',
  CANC: 'CANCELLED',
  CANCELLED: 'CANCELLED',
}

export function normalizeMatchLifecycleState(
  providerStatus: string | null | undefined,
  provider: string,
  reportUnknownStatus?: UnknownMatchStatusReporter,
): MatchLifecycleState {
  const normalized = providerStatus?.trim().toUpperCase() ?? ''
  const known = STATUS_ALIASES[normalized]
  if (known) return known

  reportUnknownStatus?.({ provider, providerStatus: normalized || 'EMPTY' })
  return 'SCHEDULED'
}

export function calculateSourceMetadata(input: {
  provider: string
  providerFixtureId?: string | null
  fetchedAt: string
  providerUpdatedAt?: string | null
  now?: string
  staleAfterSeconds: number
  unavailable?: boolean
  provisional?: boolean
}): MatchSourceMetadata {
  const nowMs = Date.parse(input.now ?? new Date().toISOString())
  const fetchedMs = Date.parse(input.fetchedAt)
  const freshnessSeconds = Math.max(0, Math.floor((nowMs - fetchedMs) / 1000))
  const isStale = freshnessSeconds > input.staleAfterSeconds

  const dataQuality: MatchDataQuality = input.unavailable
    ? 'unavailable'
    : isStale
      ? 'delayed'
      : input.provisional
        ? 'provisional'
        : 'verified'

  return {
    provider: input.provider,
    providerFixtureId: input.providerFixtureId ?? null,
    fetchedAt: input.fetchedAt,
    providerUpdatedAt: input.providerUpdatedAt ?? null,
    isStale,
    freshnessSeconds,
    dataQuality,
  }
}

export function createEmptyMatchEnrichment(): OptionalMatchEnrichment {
  return {
    injuries: null,
    predictedLineups: null,
    expectedGoals: null,
    advancedPossession: null,
    headToHeadSummary: null,
    qualificationProbability: null,
  }
}

export function orderMatchEvents(events: MatchEvent[]): MatchEvent[] {
  return [...events].sort((left, right) => {
    const leftMinute = left.minute ?? Number.MAX_SAFE_INTEGER
    const rightMinute = right.minute ?? Number.MAX_SAFE_INTEGER
    if (leftMinute !== rightMinute) return leftMinute - rightMinute

    const leftAdded = left.addedMinute ?? 0
    const rightAdded = right.addedMinute ?? 0
    if (leftAdded !== rightAdded) return leftAdded - rightAdded

    return left.sequence - right.sequence
  })
}
