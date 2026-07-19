import { Alert, EmptyState, Skeleton, ThirdPlaceTable } from '../../design-system'
import { InfoIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { buildThirdPlace } from './thirdPlace'
import s from '../shared.module.css'

export function ThirdPlacePage() {
  const data = useTournamentData()
  const preds = usePredictions()

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Best thirds</h1>
        <Alert variant="error" title="Couldn't load the tournament">
          {data.message}
        </Alert>
      </div>
    )
  }

  if (data.status !== 'ready' || !preds.ready) {
    return (
      <div className={s.page}>
        <div className={s.card}>
          <Skeleton lines={4} />
        </div>
      </div>
    )
  }

  const result = buildThirdPlace(data.data, preds.getPrediction)

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>Predict</span>
        <h1 className={s.title}>Best third-placed teams</h1>
      </div>
      {result ? (
        <ThirdPlaceTable
          rows={result.rows}
          tieResolutionSlot={
            result.tieCount > 0 ? (
              <span>
                {result.tieCount} tie{result.tieCount === 1 ? '' : 's'} can&apos;t be separated
                automatically — you&apos;ll be asked to resolve the order before submitting.
              </span>
            ) : undefined
          }
        />
      ) : (
        <EmptyState
          icon={<InfoIcon size={22} />}
          title="Predict all group matches first"
          description="The best-third ranking appears once every group is complete."
        />
      )}
    </div>
  )
}
