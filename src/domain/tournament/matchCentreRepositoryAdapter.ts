import type { Match, Team } from '../../services/supabase/tournamentData'
import {
  calculateSourceMetadata,
  createEmptyMatchEnrichment,
  type MatchCentreViewModel,
  type MatchLifecycleState,
  type PredictorMatchData,
} from './matchCentreContract'

export type RepositoryMatchAdapterInput = {
  match: Match
  teams: Team[]
  now?: string
  fetchedAt?: string
  predictor?: Partial<PredictorMatchData>
}

const EMPTY_PREDICTOR: PredictorMatchData = {
  userPrediction: null,
  points: { status: 'pending', value: null },
  leaguePredictionSplit: null,
  liveRankImpact: null,
  groupTableImpact: null,
  thirdPlaceTableImpact: null,
  bracketImpact: null,
}

function repositoryLifecycle(match: Match, now: string): MatchLifecycleState {
  if (match.homeScore !== null && match.awayScore !== null) return 'FULL_TIME'
  if (!match.kickoffAt) return 'SCHEDULED'

  const kickoffMs = Date.parse(match.kickoffAt)
  const nowMs = Date.parse(now)
  if (!Number.isFinite(kickoffMs) || !Number.isFinite(nowMs)) return 'SCHEDULED'

  const secondsUntilKickoff = Math.floor((kickoffMs - nowMs) / 1000)
  if (secondsUntilKickoff > 0 && secondsUntilKickoff <= 60 * 60) return 'PRE_MATCH'

  // The repository fixture record has no authoritative live status. Never infer
  // a live period only because kickoff has passed: an absent or delayed provider
  // feed must fail closed rather than showing a convincing live match.
  return 'SCHEDULED'
}

function kickoffFor(match: Match): string {
  if (match.kickoffAt) return match.kickoffAt
  return `${match.matchDate}T00:00:00.000Z`
}

function teamName(team: Team | undefined, source: string): string {
  return team?.name ?? (source || 'TBC')
}

function mergePredictor(input?: Partial<PredictorMatchData>): PredictorMatchData {
  return {
    ...EMPTY_PREDICTOR,
    ...input,
    points: {
      ...EMPTY_PREDICTOR.points,
      ...input?.points,
    },
  }
}

export function adaptRepositoryMatchToCentre(
  input: RepositoryMatchAdapterInput,
): MatchCentreViewModel {
  const now = input.now ?? new Date().toISOString()
  const fetchedAt = input.fetchedAt ?? now
  const teamsById = new Map(input.teams.map((team) => [team.id, team]))
  const homeTeam = input.match.homeTeamId
    ? teamsById.get(input.match.homeTeamId)
    : undefined
  const awayTeam = input.match.awayTeamId
    ? teamsById.get(input.match.awayTeamId)
    : undefined
  const hasResult = input.match.homeScore !== null && input.match.awayScore !== null
  const lifecycle = repositoryLifecycle(input.match, now)

  return {
    external: {
      fixtureId: input.match.id,
      matchRef: input.match.matchRef,
      kickoffAt: kickoffFor(input.match),
      lifecycle,
      clockLabel: null,
      venue: input.match.venue || null,
      referee: null,
      home: {
        id: input.match.homeTeamId,
        name: teamName(homeTeam, input.match.homeSource),
        countryCode: null,
      },
      away: {
        id: input.match.awayTeamId,
        name: teamName(awayTeam, input.match.awaySource),
        countryCode: null,
      },
      score: hasResult
        ? { home: input.match.homeScore as number, away: input.match.awayScore as number }
        : null,
      events: [],
      lineups: { home: null, away: null },
      statistics: [],
      source: calculateSourceMetadata({
        provider: 'repository',
        providerFixtureId: null,
        fetchedAt,
        now,
        staleAfterSeconds: Number.MAX_SAFE_INTEGER,
        provisional: lifecycle !== 'FULL_TIME',
      }),
    },
    predictor: mergePredictor(input.predictor),
    enrichment: createEmptyMatchEnrichment(),
  }
}
