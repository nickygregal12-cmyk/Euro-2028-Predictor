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

  // Capture time once at the feature boundary and pass it into the pure engine.
  const nowServer = new Date()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const resolved = resolveTournamentCompetitionContext({
    data: data.data,
    submitted: predictions.submittedAt !== null,
    entryComplete: false,
    nowServer,
    timeZone,
  })

  return isEntryLocked(resolved.context)
}
