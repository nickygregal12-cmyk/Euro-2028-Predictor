import type { MatchState } from '../competition/matchState'
import type { Match, Team } from '../../services/supabase/tournamentData'
import {
  calculateSourceMetadata,
  createEmptyMatchEnrichment,
  type MatchCentreViewModel,
  type MatchLifecycleState,
  type PredictorMatchData,
} from './matchCentreContract'
import { authoritativeMatchScore, hasAuthoritativeResult } from './authoritativeMatchResult'

export type RepositoryMatchAdapterInput = {
  match: Match
  teams: Team[]
  now: string
  fetchedAt: string
  resolvedState: MatchState
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

/** Immutable legacy oracle retained for differential evidence only. */
export function legacyRepositoryLifecycle(match: Match, now: string): MatchLifecycleState {
  if (hasAuthoritativeResult(match)) return 'FULL_TIME'
  if (!match.kickoffAt) return 'SCHEDULED'

  const kickoffMs = Date.parse(match.kickoffAt)
  const nowMs = Date.parse(now)
  if (!Number.isFinite(kickoffMs) || !Number.isFinite(nowMs)) return 'SCHEDULED'

  const secondsUntilKickoff = Math.floor((kickoffMs - nowMs) / 1000)
  if (secondsUntilKickoff > 0 && secondsUntilKickoff <= 60 * 60) return 'PRE_MATCH'

  // The repository fixture record has no authoritative live status. Never infer
  // a live period only because kickoff has passed.
  return 'SCHEDULED'
}

function scheduledLifecycle(match: Match, now: string): MatchLifecycleState {
  if (!match.kickoffAt) return 'SCHEDULED'
  const kickoffMs = Date.parse(match.kickoffAt)
  const nowMs = Date.parse(now)
  if (!Number.isFinite(kickoffMs) || !Number.isFinite(nowMs)) return 'SCHEDULED'
  const secondsUntilKickoff = Math.floor((kickoffMs - nowMs) / 1000)
  return secondsUntilKickoff > 0 && secondsUntilKickoff <= 60 * 60
    ? 'PRE_MATCH'
    : 'SCHEDULED'
}

function repositoryLifecycle(
  match: Match,
  resolvedState: MatchState,
  now: string,
): MatchLifecycleState {
  if (hasAuthoritativeResult(match)) return 'FULL_TIME'

  switch (resolvedState) {
    case 'confirmed':
    case 'scored':
      return 'FULL_TIME'
    case 'postponed':
      return 'POSTPONED'
    case 'suspended':
      return 'SUSPENDED'
    case 'abandoned':
    case 'cancelled':
      return 'CANCELLED'
    case 'in_play_feed':
      return 'LIVE_FIRST_HALF'
    case 'scheduled_editable':
    case 'scheduled_locked':
      return scheduledLifecycle(match, now)
    case 'in_play_no_feed':
    case 'full_time_unconfirmed':
      // Preserve the repository contract: without an authoritative feed or
      // confirmed result, a passed kickoff must not be presented as live or FT.
      return 'SCHEDULED'
  }
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
  const teamsById = new Map(input.teams.map((team) => [team.id, team]))
  const homeTeam = input.match.homeTeamId
    ? teamsById.get(input.match.homeTeamId)
    : undefined
  const awayTeam = input.match.awayTeamId
    ? teamsById.get(input.match.awayTeamId)
    : undefined
  const result = authoritativeMatchScore(input.match)
  const lifecycle = repositoryLifecycle(input.match, input.resolvedState, input.now)

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
      score: result
        ? {
            home: result.home,
            away: result.away,
            ...(input.match.homeScore120 !== null &&
            input.match.homeScore120 !== undefined
              ? { homeExtraTime: input.match.homeScore120 }
              : {}),
            ...(input.match.awayScore120 !== null &&
            input.match.awayScore120 !== undefined
              ? { awayExtraTime: input.match.awayScore120 }
              : {}),
            ...(input.match.homePenalties !== null &&
            input.match.homePenalties !== undefined
              ? { homePenalties: input.match.homePenalties }
              : {}),
            ...(input.match.awayPenalties !== null &&
            input.match.awayPenalties !== undefined
              ? { awayPenalties: input.match.awayPenalties }
              : {}),
          }
        : null,
      events: [],
      lineups: { home: null, away: null },
      statistics: [],
      source: calculateSourceMetadata({
        provider: 'repository',
        providerFixtureId: null,
        fetchedAt: input.fetchedAt,
        now: input.now,
        staleAfterSeconds: Number.MAX_SAFE_INTEGER,
        provisional: lifecycle !== 'FULL_TIME',
      }),
    },
    predictor: mergePredictor(input.predictor),
    enrichment: createEmptyMatchEnrichment(),
  }
}
