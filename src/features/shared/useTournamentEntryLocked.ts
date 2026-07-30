import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import { resolveTournamentCompetitionContext } from './tournamentCompetitionContext'

/**
 * Resolves the Original Predictor entry lock through the shared competition
 * context. Feature surfaces consume this adapter rather than comparing a stored
 * timestamp against their own clock.
 */
export function useTournamentEntryLocked(fallback = false): boolean {
  const data = useTournamentData()
  const predictions = usePredictions()

  if (data.status !== 'ready') return fallback

  const nowServer = new Date()
  const resolved = resolveTournamentCompetitionContext({
    data: data.data,
    submitted: predictions.submittedAt !== null,
    entryComplete: false,
    nowServer,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  })

  return isEntryLocked(resolved.context)
}
