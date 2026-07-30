import {
  resolveCompetitionContext,
  type CompetitionContext,
  type CompetitionMatchData,
  type CompetitionProgressData,
  type CompetitionUserData,
} from '../../domain/competition/context'
import type { TournamentCompetitionConfig } from '../../domain/competition/kinds'
import type { FixtureDataSnapshot } from '../../domain/competition/lockState'
import type { FixtureGroup } from '../../domain/tournament/matchesTab'
import type { Match, TournamentData } from '../../services/supabase/tournamentData'

const ENTRY_LOCK_SCOPE_ID = 'matches-entry'

export type MatchesCompetitionContextInput = {
  data: TournamentData
  groups: FixtureGroup<Match>[]
  submitted: boolean
  nowServer: Date
  timeZone: string
}

export type MatchesCompetitionContextResult = {
  context: CompetitionContext
  currentGroupIndex: number
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

function effectiveKickoffAt(match: Match): string {
  // Preserve the legacy date-only fallback exactly. Date.parse/new Date treat an
  // ISO date-only value as midnight UTC, which is the ordering contract captured
  // by the pre-migration differential fixture.
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
  const kickoffAt = parseInstant(effectiveKickoffAt(match))
  return Number.isFinite(nowMs) && kickoffAt !== null && kickoffAt <= nowMs
}

function tournamentConfig(
  data: TournamentData,
  nowServer: Date,
  timeZone: string,
): TournamentCompetitionConfig {
  const knownKickoffs = data.matches
    .map(effectiveKickoffAt)
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

function fixtureSnapshot(data: TournamentData, nowServer: Date): FixtureDataSnapshot | null {
  const observedAt = isoInstant(nowServer)
  if (observedAt === null || data.matches.length === 0) return null

  return {
    observedAt,
    // The in-memory TournamentData read is resolved immediately. Future provider
    // ingestion can supply a wider source-authored freshness window here.
    validUntil: observedAt,
    fixtures: data.matches.map((match) => ({
      id: match.id,
      kickoffAt: effectiveKickoffAt(match),
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

function competitionMatches(data: TournamentData): CompetitionMatchData[] {
  return data.matches.map((match) => ({
    id: match.id,
    lockScopeId: ENTRY_LOCK_SCOPE_ID,
    kickoffAt: effectiveKickoffAt(match),
    administrationState: 'scheduled',
    officialState: hasStoredResult(match) ? 'confirmed' : 'unconfirmed',
    corrected: match.resultState === 'corrected',
  }))
}

function competitionUserData(submitted: boolean): CompetitionUserData {
  return {
    entry: {
      exists: true,
      complete: submitted,
      valid: submitted,
      submitted,
      autoSubmitted: false,
      activeLockScopeId: ENTRY_LOCK_SCOPE_ID,
    },
    competitions: [],
    actions: {
      accountOrEntryBlockingError: false,
      hasOutstandingPrediction: !submitted,
      activeLiveMatchIds: [],
      cupTieBreakRequired: false,
      lmsSelectionRequired: false,
      sharedKnockoutPredictionRequired: false,
      matchAwaitingAttention: false,
      leagueInviteAvailable: false,
      urgentWindowMinutes: 0,
    },
  }
}

function currentFrontIndex(
  groups: FixtureGroup<Match>[],
  context: CompetitionContext,
  nowServer: Date,
): number {
  if (groups.length === 0) return 0
  const nowMs = nowServer.getTime()
  const resolvedById = new Map(context.matches.map((match) => [match.id, match]))
  const index = groups.findIndex((group) =>
    group.matches.some((match) => {
      const kickoffAt = parseInstant(resolvedById.get(match.id)?.kickoffAt)
      return kickoffAt !== null && kickoffAt >= nowMs
    }),
  )
  return index === -1 ? groups.length - 1 : index
}

/**
 * Adapts the tournament-shaped Matches tab input into the shared competition
 * context and maps it back to the unchanged current-front index contract.
 * Match-card temporal presentation remains owned by the later Match Centre
 * migration; this adapter changes only Matches grouping navigation authority.
 */
export function resolveMatchesCompetitionContext(
  input: MatchesCompetitionContextInput,
): MatchesCompetitionContextResult {
  const timeZone = safeTimeZone(input.timeZone)
  const nowMs = input.nowServer.getTime()
  const lockAtMs = parseInstant(input.data.tournament.lockAt)
  const context = resolveCompetitionContext(
    tournamentConfig(input.data, input.nowServer, timeZone),
    {
      progress: competitionProgress(input.data, input.nowServer),
      lockScopes: [
        {
          id: ENTRY_LOCK_SCOPE_ID,
          type: 'entry',
          fixtureData: fixtureSnapshot(input.data, input.nowServer),
          previouslyLocked:
            lockAtMs !== null && Number.isFinite(nowMs) && nowMs >= lockAtMs,
        },
      ],
      matches: competitionMatches(input.data),
    },
    { feedAvailable: false, matches: [] },
    competitionUserData(input.submitted),
    input.nowServer,
  )

  return {
    context,
    currentGroupIndex: currentFrontIndex(input.groups, context, input.nowServer),
  }
}
