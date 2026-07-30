import type { CompetitionConfig } from './kinds'
import {
  resolveLockState,
  type FixtureDataSnapshot,
  type LockScopeKind,
  type ResolvedLockState,
} from './lockState'
import {
  resolveMatchState,
  type MatchAdministrationState,
  type MatchLiveData,
  type MatchOfficialState,
  type MatchState,
} from './matchState'

export type CompetitionPhaseState =
  | 'pre_competition'
  | 'stage_in_progress'
  | 'stage_transition'
  | 'knockout_stage'
  | 'final_complete'
  | 'post_competition'

export type CompetitionPhase = {
  state: CompetitionPhaseState
  stageKind: 'groups' | 'league' | 'knockout' | null
}

export type CompetitionDayState =
  | 'no_matches_today'
  | 'before_first_match'
  | 'matches_live'
  | 'between_matches'
  | 'awaiting_confirmation'
  | 'day_complete'

export type CompetitionEntryState =
  | 'not_started'
  | 'incomplete'
  | 'valid_unsubmitted'
  | 'submitted'
  | 'auto_submitted'
  | 'locked'
  | 'no_valid_entry'

export type CompetitionStatus =
  | 'not_open'
  | 'registration_open'
  | 'entered'
  | 'registration_closed'
  | 'waiting_for_draw'
  | 'waiting_for_round'
  | 'action_required'
  | 'round_live'
  | 'round_awaiting_confirmation'
  | 'qualified'
  | 'survived'
  | 'eliminated'
  | 'champion'
  | 'complete'

export type CompetitionProgressData = {
  hasStarted: boolean
  regularStageComplete: boolean
  nextStageReady: boolean
  knockoutStarted: boolean
  finalConfirmed: boolean
  allCompetitionsSettled: boolean
  markedComplete: boolean
}

export type CompetitionLockScopeData = {
  id: string
  type: LockScopeKind
  fixtureData: FixtureDataSnapshot | null
  previouslyLocked: boolean
}

export type CompetitionMatchData = {
  id: string
  lockScopeId: string
  kickoffAt: string | null
  administrationState: MatchAdministrationState
  officialState: MatchOfficialState
  corrected: boolean
}

export type CompetitionLiveMatchData = MatchLiveData & {
  matchId: string
}

export type CompetitionLiveData = {
  feedAvailable: boolean
  matches: readonly CompetitionLiveMatchData[]
}

export type CompetitionUserData = {
  entry: {
    exists: boolean
    complete: boolean
    valid: boolean
    submitted: boolean
    autoSubmitted: boolean
    activeLockScopeId: string | null
  }
  competitions: readonly {
    id: string
    candidateStatuses: readonly CompetitionStatus[]
  }[]
  actions: {
    accountOrEntryBlockingError: boolean
    hasOutstandingPrediction: boolean
    activeLiveMatchIds: readonly string[]
    cupTieBreakRequired: boolean
    lmsSelectionRequired: boolean
    sharedKnockoutPredictionRequired: boolean
    matchAwaitingAttention: boolean
    leagueInviteAvailable: boolean
    urgentWindowMinutes: number
  }
}

export type MatchOverlay = 'feed_unavailable' | 'corrected'

export type ResolvedCompetitionMatch = CompetitionMatchData & {
  state: MatchState
  lockState: ResolvedLockState
  overlays: readonly MatchOverlay[]
}

export type NextUserAction =
  | 'resolve_account_error'
  | 'prediction_deadline'
  | 'follow_live_match'
  | 'complete_cup_tiebreak'
  | 'make_lms_selection'
  | 'make_knockout_prediction'
  | 'complete_entry'
  | 'review_awaiting_match'
  | 'view_recap'
  | 'view_next_fixture'
  | 'review_invite'
  | 'browse'

export type CompetitionContext = {
  competitionId: string
  competitionKind: CompetitionConfig['kind']
  competitionPhase: CompetitionPhase
  dayState: CompetitionDayState
  entryState: CompetitionEntryState
  lockConfigurationValid: boolean
  lockScopes: Readonly<Record<string, ResolvedLockState>>
  matches: readonly ResolvedCompetitionMatch[]
  liveMatches: readonly ResolvedCompetitionMatch[]
  completedToday: readonly ResolvedCompetitionMatch[]
  awaitingConfirmation: readonly ResolvedCompetitionMatch[]
  upcomingToday: readonly ResolvedCompetitionMatch[]
  nextMatch: ResolvedCompetitionMatch | null
  nextUserAction: NextUserAction
  competitions: Readonly<Record<string, CompetitionStatus>>
}

function parseInstant(value: string | null): number | null {
  if (value === null || value.trim().length === 0) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function dateKey(date: Date, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value
    return year && month && day ? `${year}-${month}-${day}` : null
  } catch {
    return null
  }
}

function resolveCompetitionPhase(config: CompetitionConfig, progress: CompetitionProgressData): CompetitionPhase {
  if (progress.markedComplete && progress.finalConfirmed && progress.allCompetitionsSettled) {
    return { state: 'post_competition', stageKind: null }
  }
  if (progress.finalConfirmed) return { state: 'final_complete', stageKind: null }
  if (progress.knockoutStarted) return { state: 'knockout_stage', stageKind: 'knockout' }
  if (progress.regularStageComplete && !progress.nextStageReady) {
    return { state: 'stage_transition', stageKind: config.primaryStage }
  }
  if (progress.hasStarted) return { state: 'stage_in_progress', stageKind: config.primaryStage }
  return { state: 'pre_competition', stageKind: null }
}

const STATUS_PRIORITY: readonly CompetitionStatus[] = [
  'complete',
  'champion',
  'eliminated',
  'registration_open',
  'registration_closed',
  'not_open',
  'action_required',
  'round_live',
  'round_awaiting_confirmation',
  'waiting_for_draw',
  'qualified',
  'survived',
  'waiting_for_round',
  'entered',
]

export function resolveCompetitionStatus(candidateStatuses: readonly CompetitionStatus[]): CompetitionStatus {
  for (const status of STATUS_PRIORITY) {
    if (candidateStatuses.includes(status)) return status
  }
  return 'not_open'
}

function isTerminalMatchState(state: MatchState): boolean {
  return ['confirmed', 'scored', 'postponed', 'abandoned', 'cancelled'].includes(state)
}

function resolveDayState(
  phase: CompetitionPhase,
  matchesToday: readonly ResolvedCompetitionMatch[],
  liveMatches: readonly ResolvedCompetitionMatch[],
  completedToday: readonly ResolvedCompetitionMatch[],
  awaitingConfirmation: readonly ResolvedCompetitionMatch[],
  upcomingToday: readonly ResolvedCompetitionMatch[],
): CompetitionDayState {
  if (phase.state === 'post_competition') return 'day_complete'
  if (liveMatches.length > 0) return 'matches_live'
  if (awaitingConfirmation.length > 0) return 'awaiting_confirmation'
  if (completedToday.length > 0 && upcomingToday.length > 0) return 'between_matches'
  if (upcomingToday.length > 0) return 'before_first_match'
  if (matchesToday.length > 0 && matchesToday.every((match) => isTerminalMatchState(match.state))) return 'day_complete'
  return 'no_matches_today'
}

function resolveEntryState(entry: CompetitionUserData['entry'], activeLock: ResolvedLockState): CompetitionEntryState {
  if (!entry.exists) return activeLock.locked ? 'no_valid_entry' : 'not_started'
  if (activeLock.locked) return entry.valid ? 'locked' : 'no_valid_entry'
  if (!entry.complete || !entry.valid) return 'incomplete'
  if (entry.submitted) return entry.autoSubmitted ? 'auto_submitted' : 'submitted'
  return 'valid_unsubmitted'
}

function resolveNextUserAction(input: {
  userData: CompetitionUserData
  entryState: CompetitionEntryState
  scopeLocks: Readonly<Record<string, ResolvedLockState>>
  liveMatches: readonly ResolvedCompetitionMatch[]
  awaitingConfirmation: readonly ResolvedCompetitionMatch[]
  completedToday: readonly ResolvedCompetitionMatch[]
  nextMatch: ResolvedCompetitionMatch | null
  nowMs: number
}): NextUserAction {
  const actions = input.userData.actions
  if (actions.accountOrEntryBlockingError) return 'resolve_account_error'

  const urgentWindow = Number.isFinite(actions.urgentWindowMinutes) && actions.urgentWindowMinutes >= 0
    ? actions.urgentWindowMinutes * 60_000
    : 0
  const urgentLock = Object.values(input.scopeLocks).some((lock) => {
    const lockAt = parseInstant(lock.lockAt)
    return !lock.locked && lockAt !== null && lockAt <= input.nowMs + urgentWindow
  })
  if (actions.hasOutstandingPrediction && urgentLock) return 'prediction_deadline'

  const activeLiveIds = new Set(actions.activeLiveMatchIds)
  if (input.liveMatches.some((match) => activeLiveIds.has(match.id))) return 'follow_live_match'
  if (actions.cupTieBreakRequired) return 'complete_cup_tiebreak'
  if (actions.lmsSelectionRequired) return 'make_lms_selection'
  if (actions.sharedKnockoutPredictionRequired) return 'make_knockout_prediction'
  if (input.entryState === 'incomplete' || input.entryState === 'valid_unsubmitted') return 'complete_entry'
  if (actions.matchAwaitingAttention || input.awaitingConfirmation.length > 0) return 'review_awaiting_match'
  if (input.completedToday.length > 0) return 'view_recap'
  if (input.nextMatch !== null) return 'view_next_fixture'
  if (actions.leagueInviteAvailable) return 'review_invite'
  return 'browse'
}

function validateLockConfiguration(config: CompetitionConfig, scopes: readonly CompetitionLockScopeData[]): boolean {
  if (scopes.length !== config.lockPolicy.scopeCount) return false
  const ids = new Set<string>()
  for (const scope of scopes) {
    if (scope.id.trim().length === 0 || ids.has(scope.id) || scope.type !== config.lockPolicy.scope) return false
    ids.add(scope.id)
  }
  return true
}

export function resolveCompetitionContext(
  config: CompetitionConfig,
  competitionData: {
    progress: CompetitionProgressData
    lockScopes: readonly CompetitionLockScopeData[]
    matches: readonly CompetitionMatchData[]
  },
  liveData: CompetitionLiveData,
  userData: CompetitionUserData,
  nowServer: Date,
): CompetitionContext {
  const nowMs = nowServer.getTime()
  const lockConfigurationValid = validateLockConfiguration(config, competitionData.lockScopes)

  const scopeLocks: Record<string, ResolvedLockState> = {}
  for (const scope of competitionData.lockScopes) {
    scopeLocks[scope.id] = resolveLockState(
      {
        ...scope,
        fixtureData: lockConfigurationValid ? scope.fixtureData : null,
        bufferMinutes: config.lockPolicy.bufferMinutes,
      },
      nowServer,
    )
  }

  const liveByMatch = new Map(liveData.matches.map((match) => [match.matchId, match]))
  const scopeById = new Map(competitionData.lockScopes.map((scope) => [scope.id, scope]))

  const matches = competitionData.matches.map<ResolvedCompetitionMatch>((match) => {
    const scope = scopeById.get(match.lockScopeId)
    const lockState = resolveLockState(
      {
        id: scope?.id ?? match.lockScopeId,
        type: scope?.type ?? config.lockPolicy.scope,
        fixtureData: lockConfigurationValid ? (scope?.fixtureData ?? null) : null,
        bufferMinutes: config.lockPolicy.bufferMinutes,
        previouslyLocked: scope?.previouslyLocked ?? false,
        matchGuard: { matchId: match.id, kickoffAt: match.kickoffAt },
      },
      nowServer,
    )
    const matchLiveData = liveData.feedAvailable ? (liveByMatch.get(match.id) ?? null) : null
    const state = resolveMatchState(
      {
        kickoffAt: match.kickoffAt,
        administrationState: match.administrationState,
        officialState: match.officialState,
        lockState,
        liveData: matchLiveData,
      },
      nowServer,
    )
    const overlays: MatchOverlay[] = []
    const kickoffAt = parseInstant(match.kickoffAt)
    if (!liveData.feedAvailable && kickoffAt !== null && Number.isFinite(nowMs) && nowMs >= kickoffAt) {
      overlays.push('feed_unavailable')
    }
    if (match.corrected) overlays.push('corrected')
    return { ...match, state, lockState, overlays }
  })

  const phase = resolveCompetitionPhase(config, competitionData.progress)
  const today = dateKey(nowServer, config.competitionTimeZone)
  const matchesToday = today === null
    ? []
    : matches.filter((match) => {
        const kickoffAt = parseInstant(match.kickoffAt)
        return kickoffAt !== null && dateKey(new Date(kickoffAt), config.competitionTimeZone) === today
      })
  const liveMatches = matchesToday.filter((match) =>
    ['in_play_feed', 'in_play_no_feed', 'suspended'].includes(match.state),
  )
  const completedToday = matchesToday.filter((match) => ['confirmed', 'scored'].includes(match.state))
  const awaitingConfirmation = matchesToday.filter((match) => match.state === 'full_time_unconfirmed')
  const upcomingToday = matchesToday.filter((match) =>
    ['scheduled_editable', 'scheduled_locked'].includes(match.state),
  )

  const nextMatch = matches
    .filter((match) => {
      const kickoffAt = parseInstant(match.kickoffAt)
      return kickoffAt !== null && kickoffAt >= nowMs && ['scheduled_editable', 'scheduled_locked'].includes(match.state)
    })
    .sort((left, right) => (parseInstant(left.kickoffAt) ?? 0) - (parseInstant(right.kickoffAt) ?? 0))[0] ?? null

  const activeScopeId = userData.entry.activeLockScopeId ?? competitionData.lockScopes[0]?.id ?? null
  const activeLock = activeScopeId === null
    ? resolveLockState(
        {
          id: 'missing-active-scope',
          type: config.lockPolicy.scope,
          fixtureData: null,
          bufferMinutes: config.lockPolicy.bufferMinutes,
          previouslyLocked: false,
        },
        nowServer,
      )
    : (scopeLocks[activeScopeId] ??
      resolveLockState(
        {
          id: activeScopeId,
          type: config.lockPolicy.scope,
          fixtureData: null,
          bufferMinutes: config.lockPolicy.bufferMinutes,
          previouslyLocked: false,
        },
        nowServer,
      ))
  const entryState = resolveEntryState(userData.entry, activeLock)

  const competitions: Record<string, CompetitionStatus> = {}
  for (const competition of userData.competitions) {
    competitions[competition.id] = resolveCompetitionStatus(competition.candidateStatuses)
  }

  const dayState = resolveDayState(
    phase,
    matchesToday,
    liveMatches,
    completedToday,
    awaitingConfirmation,
    upcomingToday,
  )
  const nextUserAction = resolveNextUserAction({
    userData,
    entryState,
    scopeLocks,
    liveMatches,
    awaitingConfirmation,
    completedToday,
    nextMatch,
    nowMs,
  })

  return {
    competitionId: config.id,
    competitionKind: config.kind,
    competitionPhase: phase,
    dayState,
    entryState,
    lockConfigurationValid,
    lockScopes: scopeLocks,
    matches,
    liveMatches,
    completedToday,
    awaitingConfirmation,
    upcomingToday,
    nextMatch,
    nextUserAction,
    competitions,
  }
}
