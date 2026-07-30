import type { CompetitionContext } from '../../domain/competition/context'
import type { HomePhase } from '../../domain/tournament/homeDashboard'
import type { TournamentData } from '../../services/supabase/tournamentData'
import { resolveTournamentCompetitionContext } from '../shared/tournamentCompetitionContext'

export type HomeCompetitionContextInput = {
  data: TournamentData
  submitted: boolean
  entryComplete: boolean
  nowServer: Date
  timeZone: string
  localDateISO?: string
}

export type HomeCompetitionContextResult = {
  context: CompetitionContext
  phase: HomePhase
  todayISO: string
  lockAt: string | null
}

function legacyPhase(
  context: CompetitionContext,
  input: { hasResults: boolean; submitted: boolean },
): HomePhase {
  if (input.hasResults) return 'during'
  if (
    input.submitted &&
    ['submitted', 'auto_submitted', 'locked'].includes(context.entryState)
  ) {
    return 'preSubmitted'
  }
  return 'preIncomplete'
}

export function resolveHomeCompetitionContext(
  input: HomeCompetitionContextInput,
): HomeCompetitionContextResult {
  const resolved = resolveTournamentCompetitionContext(input)
  const hasResults = input.data.matches.some((match) => match.homeScore !== null)
  return {
    ...resolved,
    phase: legacyPhase(resolved.context, { hasResults, submitted: input.submitted }),
  }
}
