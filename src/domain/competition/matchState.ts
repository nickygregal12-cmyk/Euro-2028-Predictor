import type { ResolvedLockState } from './lockState'

export const FEEDLESS_FULL_TIME_HEURISTIC_MINUTES = 120

export type MatchState =
  | 'scheduled_editable'
  | 'scheduled_locked'
  | 'in_play_feed'
  | 'in_play_no_feed'
  | 'suspended'
  | 'full_time_unconfirmed'
  | 'confirmed'
  | 'scored'
  | 'postponed'
  | 'abandoned'
  | 'cancelled'

export type MatchAdministrationState = 'scheduled' | 'postponed' | 'abandoned' | 'cancelled'
export type MatchOfficialState = 'unconfirmed' | 'confirmed' | 'scored'
export type MatchFeedState = 'not_started' | 'in_play' | 'suspended' | 'full_time'

export type MatchLiveData = {
  state: MatchFeedState
  homeScore: number | null
  awayScore: number | null
  minute: number | null
}

export type MatchStateInput = {
  kickoffAt: string | null
  administrationState: MatchAdministrationState
  officialState: MatchOfficialState
  lockState: ResolvedLockState
  liveData: MatchLiveData | null
}

function parseInstant(value: string | null): number | null {
  if (value === null || value.trim().length === 0) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasUsableLiveFeed(liveData: MatchLiveData): boolean {
  return (
    liveData.homeScore !== null &&
    liveData.awayScore !== null &&
    liveData.minute !== null &&
    Number.isInteger(liveData.homeScore) &&
    Number.isInteger(liveData.awayScore) &&
    Number.isInteger(liveData.minute) &&
    liveData.homeScore >= 0 &&
    liveData.awayScore >= 0 &&
    liveData.minute >= 0
  )
}

/** Resolves one fixture from supplied time and data only. */
export function resolveMatchState(input: MatchStateInput, now: Date): MatchState {
  if (input.administrationState !== 'scheduled') return input.administrationState
  if (input.officialState === 'scored') return 'scored'
  if (input.officialState === 'confirmed') return 'confirmed'

  if (input.liveData?.state === 'suspended') return 'suspended'
  if (input.liveData?.state === 'full_time') return 'full_time_unconfirmed'
  if (input.liveData?.state === 'in_play') {
    return hasUsableLiveFeed(input.liveData) ? 'in_play_feed' : 'in_play_no_feed'
  }

  const nowMs = now.getTime()
  const kickoffAt = parseInstant(input.kickoffAt)
  if (!Number.isFinite(nowMs) || kickoffAt === null) return 'scheduled_locked'

  if (nowMs >= kickoffAt + FEEDLESS_FULL_TIME_HEURISTIC_MINUTES * 60_000) {
    return 'full_time_unconfirmed'
  }
  if (nowMs >= kickoffAt) return 'in_play_no_feed'
  return input.lockState.locked ? 'scheduled_locked' : 'scheduled_editable'
}
