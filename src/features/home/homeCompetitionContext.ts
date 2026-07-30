import type { CompetitionContext } from '../../domain/competition/context'
import type { HomePhase } from '../../domain/tournament/homeDashboard'
import type { TournamentData } from '../../services/supabase/tournamentData'
import { resolveTournamentCompetitionContext } from '../shared/tournamentCompetitionContext'

export type HomeCompetitionContextInput = {
  data: TournamentData
  submitted: boolean
  entryComplete: boolean
  nowServer: Date
  /** The viewer's device zone. Renders clock times; never decides a day. */
  viewerTimeZone: string
  /**
   * The competition's own calendar zone. Optional until a season row carries it
   * (Stage C `display_timezone`); until then it falls back to the viewer's zone,
   * which is the behaviour this seam preserves exactly. Supplying it is the one
   * change that makes day grouping stop depending on where the viewer is.
   */
  competitionTimeZone?: string
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
