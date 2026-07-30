import type { MatchState } from '../competition/matchState'
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
}

export type MatchCentrePageModelInput = {
  match: Match
  teams: Team[]
  groups: Group[]
  now: string
  fetchedAt: string
  resolvedState: MatchState
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

/**
 * Composes the repository adapter and legacy-screen bridge in one place. The
 * route supplies a shared resolved match state and explicit clock/freshness
 * inputs, while this model preserves the existing screen contract.
 */
export function createMatchCentrePageModel(
  input: MatchCentrePageModelInput,
): MatchCentrePageModel {
  const viewModel = adaptRepositoryMatchToCentre({
    match: input.match,
    teams: input.teams,
    now: input.now,
    fetchedAt: input.fetchedAt,
    resolvedState: input.resolvedState,
  })
  const screen = bridgeExternalMatchToLegacyHeader(viewModel.external)

  return {
    ...screen,
    eyebrow: `${stageLabel(input.match, input.groups)} · ${screen.statusPresentation.label}`,
    countdownLabel:
      screen.temporalState === 'before' ? kickoffLabel(viewModel.external.kickoffAt) : null,
    venueCountryCodeInput: viewModel.external.venue ?? input.match.venue,
    lifecycleContent: matchCentreLifecycleContent(viewModel.external.lifecycle),
  }
}
