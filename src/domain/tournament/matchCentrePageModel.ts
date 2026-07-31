import type { MatchState } from '../competition/matchState'
import type { MatchLifecycleState } from './matchCentreContract'
import type { Group, Match, Team } from '../../services/supabase/tournamentData'
import { adaptRepositoryMatchToCentre } from './matchCentreRepositoryAdapter'
import { bridgeExternalMatchToLegacyHeader } from './matchCentreLegacyBridge'
import {
  matchCentreLifecycleContent,
  type MatchCentreLifecycleContent,
} from './matchCentreLifecycleContent'

const ROUND_LABEL: Record<Match['round'], string> = {
  group: 'Group',
  r16: 'Round of 16',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  final: 'Final',
  league: 'League match',
}

export type MatchCentrePageModelInput = {
  match: Match
  teams: Team[]
  groups: Group[]
  now?: string
  fetchedAt?: string
  matchState?: MatchState
}

export type MatchCentrePageModel = ReturnType<typeof bridgeExternalMatchToLegacyHeader> & {
  eyebrow: string
  countdownLabel: string | null
  venueCountryCodeInput: string
  lifecycleContent: MatchCentreLifecycleContent
}

function stageLabel(match: Match, groups: Group[]): string {
  if (match.round !== 'group') return ROUND_LABEL[match.round]
  const letter = groups.find((group) => group.id === match.groupId)?.letter
  return letter ? `Group ${letter}` : 'Group stage'
}

function kickoffLabel(kickoffAt: string): string {
  const parsed = new Date(kickoffAt)
  if (Number.isNaN(parsed.getTime())) return 'Kick-off time to be confirmed'
  return `Kick-off ${parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })}`
}

const COUNTDOWN_LIFECYCLES = new Set<MatchLifecycleState>([
  'SCHEDULED',
  'PRE_MATCH',
  'POSTPONED',
  'SUSPENDED',
])

export function shouldShowMatchCentreCountdown(lifecycle: MatchLifecycleState): boolean {
  return COUNTDOWN_LIFECYCLES.has(lifecycle)
}

/**
 * Composes the shared state-aware repository adapter and screen compatibility
 * bridge in one place. A passed kickoff without authoritative feed data remains
 * upcoming on the existing surface, while the engine state is no longer
 * recomputed or discarded here.
 */
export function createMatchCentrePageModel(
  input: MatchCentrePageModelInput,
): MatchCentrePageModel {
  const viewModel = adaptRepositoryMatchToCentre({
    match: input.match,
    teams: input.teams,
    now: input.now,
    fetchedAt: input.fetchedAt,
    matchState: input.matchState,
  })
  const screen = bridgeExternalMatchToLegacyHeader(viewModel.external)

  return {
    ...screen,
    eyebrow: stageLabel(input.match, input.groups),
    countdownLabel:
      input.match.kickoffAt && shouldShowMatchCentreCountdown(screen.lifecycle)
        ? kickoffLabel(input.match.kickoffAt)
        : null,
    venueCountryCodeInput: input.match.venue,
    lifecycleContent: matchCentreLifecycleContent(screen.lifecycle),
  }
}
