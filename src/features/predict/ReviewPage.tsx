import { Alert, EmptyState, Skeleton } from '../../design-system'
import { CheckIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { computeHubStatus } from './hubStatus'
import s from '../shared.module.css'

// The submission gate (design-system §6): review stays locked until the earlier
// stages are complete. Full validity gating + submit lands with the bracket in a
// later Phase 1 step; here it honestly reports what's still outstanding.
export function ReviewPage() {
  const data = useTournamentData()
  const preds = usePredictions()

  if (data.status !== 'ready' || !preds.ready) {
    return (
      <div className={s.page}>
        <div className={s.card}>
          <Skeleton lines={3} />
        </div>
      </div>
    )
  }

  const status = computeHubStatus(
    data.data,
    preds.getPrediction,
    preds.jokerCount,
    preds.tieResolutions,
  )
  const outstanding: string[] = []
  if (!status.groups.complete) {
    outstanding.push(
      `${status.groups.total - status.groups.predicted} group match(es) still to predict`,
    )
  }
  if (status.thirdPlace.state === 'ties') {
    outstanding.push(`${status.thirdPlace.tieCount} third-place tie(s) to resolve`)
  }
  if (status.bracket.picked < status.bracket.total) {
    outstanding.push(`${status.bracket.total - status.bracket.picked} bracket winner(s) to pick`)
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>Predict</span>
        <h1 className={s.title}>Review and submit</h1>
      </div>
      {status.reviewUnlocked ? (
        <EmptyState
          icon={<CheckIcon size={22} />}
          title="Everything's predicted"
          description="Final review and submit arrives with the bracket step."
        />
      ) : (
        <Alert variant="info" title="Complete the steps above first">
          <ul>
            {outstanding.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  )
}
