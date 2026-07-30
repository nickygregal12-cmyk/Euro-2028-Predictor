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

// Preserve the identifier captured by Home's pre-migration differential contract.
// The shared adapter may serve multiple tournament surfaces, but changing this
// key would create observable context drift without changing lock semantics.
const ENTRY_LOCK_SCOPE_ID = 'home-entry'
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const NO_LIVE_DATA: CompetitionLiveData = { feedAvailable: false, matches: [] }

export type TournamentCompetitionContextInput = {
  data: TournamentData
  submitted: boolean
  entryComplete: boolean
  nowServer: Date
  timeZone: string
  localDateISO?: string
  liveData?: CompetitionLiveData
}

export type TournamentCompetitionContextResult = {
  context: CompetitionContext
  todayISO: string
  lockAt: string | null
}

function parseInstant(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
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

function dateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : date.toISOString().slice(0, 10)
}

function injectedDateKey(value: string | undefined): string | null {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value) ? value : null
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
  const kickoffAt = parseInstant(match.kickoffAt)
  return kickoffAt !== null && kickoffAt <= nowMs
}

function tournamentConfig(
  data: TournamentData,
  nowServer: Date,
  timeZone: string,
): TournamentCompetitionConfig {
  const knownKickoffs = data.matches
    .map((match) => match.kickoffAt)
    .filter((kickoffAt): kickoffAt is string => parseInstant(kickoffAt) !== null)
    .sort((left, right) => Date.parse(left) - Date.parse(right))
  const nowISO = nowServer.toISOString()
  const startsAt = dateOnlyInstant(data.tournament.startsOn, false) ?? knownKickoffs[0] ?? nowISO
  const endsAt = dateOnlyInstant(data.tournament.endsOn, true) ?? knownKickoffs.at(-1) ?? startsAt
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
    knockoutStage: { roundCount: Math.max(1, knockoutRounds.size) },
    lockPolicy: { scope: 'entry', scopeCount: 1, bufferMinutes: 0 },
  }
}

function fixtureSnapshot(data: TournamentData, nowServer: Date): FixtureDataSnapshot | null {
  const fixtures = data.matches.flatMap((match) =>
    parseInstant(match.kickoffAt) === null ? [] : [{ id: match.id, kickoffAt: match.kickoffAt }],
  )
  if (fixtures.length === 0) return null
  const observedAt = nowServer.toISOString()
  return { observedAt, validUntil: observedAt, fixtures }
}

function competitionProgress(data: TournamentData, nowServer: Date): CompetitionProgressData {
  const nowMs = nowServer.getTime()
  const groupMatches = data.matches.filter((match) => match.round === 'group')
  const knockoutMatches = data.matches.filter((match) => match.round !== 'group')
  const finalMatches = data.matches.filter((match) => match.round === 'final')
  const finalConfirmed = finalMatches.some(hasStoredResult)

  return {
    hasStarted: data.matches.some((match) => hasStarted(match, nowMs)),
    regularStageComplete: groupMatches.length > 0 && groupMatches.every(hasStoredResult),
    nextStageReady: knockoutMatches.some(
      (match) => match.homeTeamId !== null && match.awayTeamId !== null,
    ),
    knockoutStarted: knockoutMatches.some((match) => hasStarted(match, nowMs)),
    finalConfirmed,
    allCompetitionsSettled: finalConfirmed,
    markedComplete:
      finalConfirmed &&
      (parseInstant(dateOnlyInstant(data.tournament.endsOn, true)) ?? Number.POSITIVE_INFINITY) <= nowMs,
  }
}

function competitionMatches(data: TournamentData): CompetitionMatchData[] {
  return data.matches.map((match) => ({
    id: match.id,
    lockScopeId: ENTRY_LOCK_SCOPE_ID,
    kickoffAt: match.kickoffAt ?? null,
    administrationState: 'scheduled',
    officialState: hasStoredResult(match) ? 'confirmed' : 'unconfirmed',
    corrected: match.resultState === 'corrected',
  }))
}

function competitionUserData(input: {
  submitted: boolean
  entryComplete: boolean
}): CompetitionUserData {
  const valid = input.entryComplete || input.submitted
  return {
    entry: {
      exists: true,
      complete: valid,
      valid,
      submitted: input.submitted,
      autoSubmitted: false,
      activeLockScopeId: ENTRY_LOCK_SCOPE_ID,
    },
    competitions: [],
    actions: {
      accountOrEntryBlockingError: false,
      hasOutstandingPrediction: !valid,
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

export function resolveTournamentCompetitionContext(
  input: TournamentCompetitionContextInput,
): TournamentCompetitionContextResult {
  const timeZone = safeTimeZone(input.timeZone)
  const lockAtMs = parseInstant(input.data.tournament.lockAt)
  const nowMs = input.nowServer.getTime()
  const context = resolveCompetitionContext(
    tournamentConfig(input.data, input.nowServer, timeZone),
    {
      progress: competitionProgress(input.data, input.nowServer),
      lockScopes: [
        {
          id: ENTRY_LOCK_SCOPE_ID,
          type: 'entry',
          fixtureData: fixtureSnapshot(input.data, input.nowServer),
          previouslyLocked: lockAtMs !== null && Number.isFinite(nowMs) && nowMs >= lockAtMs,
        },
      ],
      matches: competitionMatches(input.data),
    },
    input.liveData ?? NO_LIVE_DATA,
    competitionUserData(input),
    input.nowServer,
  )

  return {
    context,
    todayISO: injectedDateKey(input.localDateISO) ?? dateKey(input.nowServer, timeZone),
    lockAt: input.data.tournament.lockAt,
  }
}
