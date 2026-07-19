import {
  Alert,
  EmptyState,
  Skeleton,
  ThirdPlaceTable,
  TieResolver,
} from '../../design-system'
import { InfoIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { buildThirdPlacePipeline } from './thirdPlacePipeline'
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

  const pipeline = buildThirdPlacePipeline(data.data, preds.getPrediction, preds.tieResolutions)

  const header = (
    <div className={s.header}>
      <span className={s.eyebrow}>Predict</span>
      <h1 className={s.title}>Best third-placed teams</h1>
    </div>
  )

  if (!pipeline.groupsComplete) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          icon={<InfoIcon size={22} />}
          title="Predict all group matches first"
          description="The best-third ranking appears once every group is complete."
        />
      </div>
    )
  }

  // Ties still needing a decision come first, so the call-to-action is on top.
  const orderedTies = [...pipeline.ties].sort(
    (a, b) => Number(a.resolved) - Number(b.resolved),
  )

  const tieNote =
    pipeline.pendingCount > 0 ? (
      <span>
        {pipeline.pendingCount} tie{pipeline.pendingCount === 1 ? '' : 's'} below still need
        {pipeline.pendingCount === 1 ? 's' : ''} your order — the qualifying four aren&apos;t final
        until every tie is set.
      </span>
    ) : undefined

  return (
    <div className={s.page}>
      {header}

      {pipeline.rows ? (
        <ThirdPlaceTable rows={pipeline.rows} tieResolutionSlot={tieNote} />
      ) : (
        <Alert variant="warning" title="Resolve the ties below first">
          Some of your groups finish level on every criterion we can predict, so who comes third
          isn&apos;t decided yet. Set the order below and the ranking will appear.
        </Alert>
      )}

      {orderedTies.length > 0 && (
        <div className={s.stack}>
          <span className={s.eyebrow}>Ties to resolve</span>
          {orderedTies.map((tie) => (
            <TieResolver
              key={tie.key}
              title={tie.title}
              reason={tie.reason}
              teams={tie.teams}
              resolved={tie.resolved}
              saveStatus={preds.getTieSaveStatus(tie.teams.map((t) => t.id))}
              onResolve={(order) => preds.setTieResolution(tie.scope, order)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
