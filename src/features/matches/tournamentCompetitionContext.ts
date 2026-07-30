import {
  resolveCompetitionContext,
  type CompetitionContext,
  type CompetitionLiveData,
  type CompetitionMatchData,
  type CompetitionProgressData,
  type CompetitionUserData,
} from '../../domain/competition/context'
import type { TournamentCompetitionConfig } from '../../domain/competition/kinds'
import type { FixtureDataSnapshot } from '../../domain/competition/lockState'
import type { Match, TournamentData } from '../../services/supabase/tournamentData'

export type TournamentFixtureFreshness = {
  observedAt: string
  validUntil: string
}

export type TournamentCompetitionContextInput = {
  data: TournamentData
  lockScopeId: string
  submitted: boolean
  entryComplete?: boolean
  nowServer: Date
  timeZone: string
  fixtureFreshness: TournamentFixtureFreshness | null
  liveData?: CompetitionLiveData
}

function parseInstant(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isoInstant(value: Date): string | null {
  const time = value.getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function dateOnlyInstant(value: string | null | undefined, endOfDay: boolean): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = Date.parse(`${value}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function safeTimeZone(value: string): string {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).format(new Date(0))
    return value
  } catch {
    return 'UTC'
  }
}

export function tournamentFixtureInstant(match: Match): string {
  // Preserve the repository fallback used by Matches and Match Centre. ISO
  // date-only values parse as midnight UTC.
  return match.kickoffAt ?? match.matchDate
}

function hasStoredResult(match: Match): boolean {
  return (
    (match.homeScore !== null && match.awayScore !== null) ||
    match.resultState === 'confirmed' ||
    match.resultState === 'corrected'
  )
}

function hasStarted(match: Match, nowMs: number): boolean {
  if (hasStoredResult(match)) return true
  const kickoffAt = parseInstant(tournamentFixtureInstant(match))
  return Number.isFinite(nowMs) && kickoffAt !== null && kickoffAt <= nowMs
}

function tournamentConfig(
  data: TournamentData,
  nowServer: Date,
  timeZone: string,
): TournamentCompetitionConfig {
  const knownKickoffs = data.matches
    .map(tournamentFixtureInstant)
    .filter((kickoffAt) => parseInstant(kickoffAt) !== null)
    .sort((left, right) => Date.parse(left) - Date.parse(right))
  const nowISO = isoInstant(nowServer) ?? new Date(0).toISOString()
  const startsAt =
    dateOnlyInstant(data.tournament.startsOn, false) ?? knownKickoffs[0] ?? nowISO
  const endsAt =
    dateOnlyInstant(data.tournament.endsOn, true) ?? knownKickoffs.at(-1) ?? startsAt
  const matchdays = new Set(
    data.matches
      .filter((match) => match.round === 'group' && match.matchday !== null)
      .map((match) => match.matchday),
  )
  const knockoutRounds = new Set(
    data.matches.filter((match) => match.round !== 'group').map((match) => match.round),
  )

  return {
    id: data.tournament.id,
    name: data.tournament.name,
    kind: 'tournament',
    timeZone,
    bounds: { startsAt, endsAt },
    primaryStage: 'groups',
    progression: 'groups_to_knockout',
    groupStage: {
      groupCount: Math.max(1, data.groups.length),
      matchdayCount: Math.max(1, matchdays.size),
    },
    knockoutStage: {
      roundCount: Math.max(1, knockoutRounds.size),
    },
    lockPolicy: {
      scope: 'entry',
      scopeCount: 1,
      bufferMinutes: 0,
    },
  }
}

function fixtureSnapshot(
  data: TournamentData,
  freshness: TournamentFixtureFreshness | null,
): FixtureDataSnapshot | null {
  if (freshness === null || data.matches.length === 0) return null
  return {
    observedAt: freshness.observedAt,
    validUntil: freshness.validUntil,
    fixtures: data.matches.map((match) => ({
      id: match.id,
      kickoffAt: tournamentFixtureInstant(match),
    })),
  }
}

function competitionProgress(data: TournamentData, nowServer: Date): CompetitionProgressData {
  const nowMs = nowServer.getTime()
  const groupMatches = data.matches.filter((match) => match.round === 'group')
  const knockoutMatches = data.matches.filter((match) => match.round !== 'group')
  const finalMatches = data.matches.filter((match) => match.round === 'final')
  const finalConfirmed = finalMatches.some(hasStoredResult)

  return {
    hasStarted: data.matches.some((match) => hasStarted(match, nowMs)),
    regularStageComplete:
      groupMatches.length > 0 && groupMatches.every((match) => hasStoredResult(match)),
    nextStageReady: knockoutMatches.some(
      (match) => match.homeTeamId !== null && match.awayTeamId !== null,
    ),
    knockoutStarted: knockoutMatches.some((match) => hasStarted(match, nowMs)),
    finalConfirmed,
    allCompetitionsSettled: finalConfirmed,
    markedComplete:
      finalConfirmed &&
      (parseInstant(dateOnlyInstant(data.tournament.endsOn, true)) ?? Number.POSITIVE_INFINITY) <=
        nowMs,
  }
}

function competitionMatches(data: TournamentData, lockScopeId: string): CompetitionMatchData[] {
  return data.matches.map((match) => ({
    id: match.id,
    lockScopeId,
    kickoffAt: tournamentFixtureInstant(match),
    administrationState: 'scheduled',
    officialState: hasStoredResult(match) ? 'confirmed' : 'unconfirmed',
    corrected: match.resultState === 'corrected',
  }))
}

function competitionUserData(input: {
  submitted: boolean
  entryComplete: boolean
  lockScopeId: string
  liveData: CompetitionLiveData
}): CompetitionUserData {
  const valid = input.entryComplete || input.submitted
  return {
    entry: {
      exists: true,
      complete: valid,
      valid,
      submitted: input.submitted,
      autoSubmitted: false,
      activeLockScopeId: input.lockScopeId,
    },
    competitions: [],
    actions: {
      accountOrEntryBlockingError: false,
      hasOutstandingPrediction: !valid,
      activeLiveMatchIds: input.liveData.matches
        .filter((match) => match.state === 'in_play' || match.state === 'suspended')
        .map((match) => match.matchId),
      cupTieBreakRequired: false,
      lmsSelectionRequired: false,
      sharedKnockoutPredictionRequired: false,
      matchAwaitingAttention: false,
      leagueInviteAvailable: false,
      urgentWindowMinutes: 0,
    },
  }
}

/** Shared repository-to-competition adapter for Stage B tournament surfaces. */
export function resolveTournamentCompetitionContext(
  input: TournamentCompetitionContextInput,
): CompetitionContext {
  const timeZone = safeTimeZone(input.timeZone)
  const nowMs = input.nowServer.getTime()
  const lockAtMs = parseInstant(input.data.tournament.lockAt)
  const liveData = input.liveData ?? { feedAvailable: false, matches: [] }

  return resolveCompetitionContext(
    tournamentConfig(input.data, input.nowServer, timeZone),
    {
      progress: competitionProgress(input.data, input.nowServer),
      lockScopes: [
        {
          id: input.lockScopeId,
          type: 'entry',
          fixtureData: fixtureSnapshot(input.data, input.fixtureFreshness),
          previouslyLocked:
            lockAtMs !== null && Number.isFinite(nowMs) && nowMs >= lockAtMs,
        },
      ],
      matches: competitionMatches(input.data, input.lockScopeId),
    },
    liveData,
    competitionUserData({
      submitted: input.submitted,
      entryComplete: input.entryComplete ?? input.submitted,
      lockScopeId: input.lockScopeId,
      liveData,
    }),
    input.nowServer,
  )
}
