import { useNavigate } from 'react-router-dom'
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

const FINALISE_PATH = '/predict/third-place'

function groupReviewPath(letter: string): string {
  return `/predict/groups/${letter}?return=${encodeURIComponent(FINALISE_PATH)}`
}

export function ThirdPlacePage() {
  const navigate = useNavigate()
  const data = useTournamentData()
  const preds = usePredictions()

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Finalise Group Standings</h1>
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

  const pipeline = buildThirdPlacePipeline(
    data.data,
    preds.getPrediction,
    preds.tieResolutions,
  )

  const header = (
    <div className={s.header}>
      <span className={s.eyebrow}>Predict</span>
      <h1 className={s.title}>Finalise Group Standings</h1>
      <p className={s.sub}>
        Resolve any remaining group ties, review the best third-placed teams and
        confirm who reaches the knockout stage.
      </p>
    </div>
  )

  if (!pipeline.groupsComplete) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          icon={<InfoIcon size={22} />}
          title="Predict all group matches first"
          description="Final standings and the best-third ranking appear once every group is complete."
        />
      </div>
    )
  }

  // Pending decisions come first. Resolved decisions remain visible afterwards
  // so the user can review or amend them before moving to the bracket.
  const orderedTies = [...pipeline.ties].sort(
    (a, b) => Number(a.resolved) - Number(b.resolved),
  )

  const tieNote =
    pipeline.pendingCount > 0 ? (
      <span>
        {pipeline.pendingCount} decision{pipeline.pendingCount === 1 ? '' : 's'} still
        required before the qualifying four are final.
      </span>
    ) : undefined

  return (
    <div className={s.page}>
      {header}

      {orderedTies.length > 0 && (
        <div className={s.stack}>
          <span className={s.eyebrow}>Standings decisions</span>
          {orderedTies.map((tie) => (
            <TieResolver
              key={tie.key}
              title={tie.title}
              reason={tie.reason}
              teams={tie.teams}
              resolved={tie.resolved}
              saveStatus={preds.getTieSaveStatus(tie.teams.map((team) => team.id))}
              reviewActions={tie.reviewGroups.map((letter) => ({
                label:
                  tie.scope === 'group'
                    ? `Change Group ${letter} scores`
                    : `Review Group ${letter} scores`,
                onClick: () => navigate(groupReviewPath(letter)),
              }))}
              onResolve={(order) => preds.setTieResolution(tie.scope, order)}
            />
          ))}
        </div>
      )}

      <div className={s.stack}>
        <span className={s.eyebrow}>Best third-placed teams</span>
        {pipeline.rows ? (
          <ThirdPlaceTable rows={pipeline.rows} tieResolutionSlot={tieNote} />
        ) : (
          <Alert variant="warning" title="Resolve the group decisions above">
            At least one group&apos;s third-place team is still undecided. Confirm an
            order or change that group&apos;s scores before the best-third table can be
            completed.
          </Alert>
        )}
      </div>
    </div>
  )
}
