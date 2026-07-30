import { useEffect, useState } from 'react'
import { Alert, Button } from '../../design-system'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { useAuth } from '../auth/AuthProvider'
import { useTournamentEntryLocked } from '../shared/useTournamentEntryLocked'
import { fetchExistingEntrySubmissionStatus } from '../../services/supabase/entrySubmissionStatus'
import type { EntrySubmissionStatus } from '../../services/supabase/predictions'
import { userFacingError } from '../../shared/errors/userFacingError'
import { ReviewPage } from './ReviewPage'
import s from '../shared.module.css'

type OutcomeState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; outcome: EntrySubmissionStatus | null }
  | { status: 'error'; message: string }

const PENDING_POLL_MS = 5_000

function formatTimestamp(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function ReviewWorkspacePage() {
  const { userId } = useAuth()
  const tournament = useTournamentData()
  const predictions = usePredictions()
  const entryLocked = useTournamentEntryLocked()
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<OutcomeState>({ status: 'idle' })

  const tournamentId =
    tournament.status === 'ready' ? tournament.data.tournament.id : null
  const locked = tournament.status === 'ready' ? entryLocked : false

  useEffect(() => {
    if (!userId || !tournamentId || !predictions.ready) {
      setState({ status: 'idle' })
      return
    }

    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    setState({ status: 'loading' })

    const load = async () => {
      try {
        const outcome = await fetchExistingEntrySubmissionStatus(
          userId,
          tournamentId,
        )
        if (!active) return
        setState({ status: 'ready', outcome })

        if (outcome?.state === 'automatic_submission_pending') {
          timer = setTimeout(load, PENDING_POLL_MS)
        }
      } catch (error: unknown) {
        if (!active) return
        setState({
          status: 'error',
          message: userFacingError(
            error,
            'Could not load the automatic submission outcome.',
          ),
        })
      }
    }

    void load()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [userId, tournamentId, predictions.ready, predictions.submittedAt, reloadToken])

  const outcome = state.status === 'ready' ? state.outcome : null
  const showPanel =
    locked &&
    (state.status === 'loading' ||
      state.status === 'error' ||
      outcome?.state === 'automatic_submission_pending' ||
      outcome?.state === 'automatically_submitted' ||
      outcome?.state === 'automatic_submission_failed')

  return (
    <>
      <ReviewPage />
      {showPanel ? (
        <div className={s.page} aria-live="polite">
          {state.status === 'loading' ? (
            <Alert variant="info" title="Checking automatic submission">
              Your saved entry is being checked against the same rules as manual
              submission.
            </Alert>
          ) : state.status === 'error' ? (
            <Alert variant="warning" title="Automatic submission status unavailable">
              <p>{state.message}</p>
              <Button
                variant="secondary"
                onClick={() => setReloadToken((token) => token + 1)}
              >
                Try again
              </Button>
            </Alert>
          ) : outcome?.state === 'automatically_submitted' ? (
            <Alert variant="success" title="Entry submitted automatically">
              Your complete saved entry was submitted when predictions locked
              {formatTimestamp(outcome.submittedAt)
                ? ` at ${formatTimestamp(outcome.submittedAt)}`
                : ''}
              . No prediction was changed.
            </Alert>
          ) : outcome?.state === 'automatic_submission_failed' ? (
            <Alert variant="warning" title="Entry was not submitted automatically">
              <p>
                The saved entry did not pass the authoritative submission check at
                lock and remains unsubmitted.
              </p>
              {outcome.failureMessage ? <p>{outcome.failureMessage}</p> : null}
            </Alert>
          ) : (
            <Alert variant="info" title="Automatic submission is pending">
              The tournament has just locked. The server checks complete saved
              entries every minute; this status will update automatically.
            </Alert>
          )}
        </div>
      ) : null}
    </>
  )
}
