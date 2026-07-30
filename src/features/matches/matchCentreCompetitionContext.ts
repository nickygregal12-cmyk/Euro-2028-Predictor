import type { MatchState } from '../../domain/competition/matchState'
import type { ResolvedCompetitionMatch } from '../../domain/competition/context'
import type { TournamentData } from '../../services/supabase/tournamentData'
import { resolveTournamentCompetitionContext } from './tournamentCompetitionContext'

const ENTRY_LOCK_SCOPE_ID = 'match-centre-entry'

export type MatchCentreCompetitionContextInput = {
  data: TournamentData
  matchId: string
  submitted: boolean
  nowServer: Date
  timeZone: string
  fetchedAt: string
}

export type MatchCentreCompetitionContextResult = {
  match: ResolvedCompetitionMatch | null
  state: MatchState
}

/** Resolves the route fixture through the shared competition and lock authority. */
export function resolveMatchCentreCompetitionContext(
  input: MatchCentreCompetitionContextInput,
): MatchCentreCompetitionContextResult {
  const context = resolveTournamentCompetitionContext({
    data: input.data,
    lockScopeId: ENTRY_LOCK_SCOPE_ID,
    submitted: input.submitted,
    nowServer: input.nowServer,
    timeZone: input.timeZone,
    fixtureFreshness: {
      observedAt: input.fetchedAt,
      validUntil: input.fetchedAt,
    },
  })
  const match = context.matches.find((candidate) => candidate.id === input.matchId) ?? null

  return {
    match,
    // A missing resolved fixture is a fail-closed scheduled state. The page has
    // already validated that the repository match exists before this is used.
    state: match?.state ?? 'scheduled_locked',
  }
}
