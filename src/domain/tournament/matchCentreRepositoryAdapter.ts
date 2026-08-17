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
  now?: string | undefined
  fetchedAt?: string | undefined
  matchState?: MatchState | undefined
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

/**
 * Maps the shared competition-engine match state back to the existing Match
 * Centre lifecycle contract. No-feed states deliberately remain scheduled: the
 * legacy screen must not imply a live match or full-time result without an
 * authoritative provider or confirmed repository result.
 */
export function lifecycleFromResolvedMatchState(
  match: Match,
  state: MatchState,
  now: string,
): MatchLifecycleState {
  switch (state) {
    case 'confirmed':
    case 'scored':
      return 'FULL_TIME'
    case 'in_play_feed':
      return 'LIVE_FIRST_HALF'
    case 'suspended':
      return 'SUSPENDED'
    case 'postponed':
      return 'POSTPONED'
    case 'abandoned':
    case 'cancelled':
      return 'CANCELLED'
    case 'scheduled_editable':
    case 'scheduled_locked':
      return scheduledLifecycle(match, now)
    case 'in_play_no_feed':
    case 'full_time_unconfirmed':
      return 'SCHEDULED'
  }
}

function compatibilityMatchState(match: Match): MatchState {
  return hasAuthoritativeResult(match) ? 'confirmed' : 'scheduled_locked'
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
  // Production callers inject the captured clock and shared state. Isolated
  // legacy callers without either fail closed deterministically; there is no
  // ambient Date read hidden in this adapter.
  const now = input.now ?? input.fetchedAt ?? input.match.kickoffAt ?? kickoffFor(input.match)
  const fetchedAt = input.fetchedAt ?? now
  const teamsById = new Map(input.teams.map((team) => [team.id, team]))
  const homeTeam = input.match.homeTeamId
    ? teamsById.get(input.match.homeTeamId)
    : undefined
  const awayTeam = input.match.awayTeamId
    ? teamsById.get(input.match.awayTeamId)
    : undefined
  const result = authoritativeMatchScore(input.match)
  const lifecycle = lifecycleFromResolvedMatchState(
    input.match,
    input.matchState ?? compatibilityMatchState(input.match),
    now,
  )

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
