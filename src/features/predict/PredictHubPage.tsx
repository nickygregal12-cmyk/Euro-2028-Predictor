import { type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, ProgressBar, Skeleton } from '../../design-system'
import {
  AlertIcon,
  BallIcon,
  CardsIcon,
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
  TrophyIcon,
  type IconProps,
} from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { computeHubStatus } from './hubStatus'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import { daysUntil, formatLongDate } from '../../app/time'
import s from '../shared.module.css'
import hub from './hub.module.css'

type RowState = 'done' | 'attention' | 'todo' | 'locked'

function StageIcon({ state, Base }: { state: RowState; Base: ComponentType<IconProps> }) {
  if (state === 'done') return <CheckIcon size={18} className={hub.iconDone} />
  if (state === 'attention') return <AlertIcon size={18} className={hub.iconAttention} />
  if (state === 'locked') return <LockIcon size={18} className={hub.iconMuted} />
  return <Base size={18} className={hub.iconMuted} />
}

function HubRow(props: {
  title: string
  subtitle: string
  state: RowState
  Base: ComponentType<IconProps>
  onOpen: () => void
}) {
  const locked = props.state === 'locked'
  return (
    <button
      type="button"
      className={hub.row}
      disabled={locked}
      onClick={locked ? undefined : props.onOpen}
    >
      <span className={hub.chip}>
        <StageIcon state={props.state} Base={props.Base} />
      </span>
      <span className={hub.body}>
        <span className={hub.rowTitle}>{props.title}</span>
        <span className={`${hub.rowSub} ${props.state === 'attention' ? hub.rowSubAttention : ''}`}>
          {props.subtitle}
        </span>
      </span>
      {!locked && <ChevronRightIcon size={18} className={hub.chevron} />}
    </button>
  )
}

export function PredictHubPage() {
  const navigate = useNavigate()
  const data = useTournamentData()
  const preds = usePredictions()

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Predict</h1>
        <Alert variant="error" title="Couldn't load the tournament">
          {data.message}
        </Alert>
      </div>
    )
  }

  if (data.status !== 'ready' || !preds.ready) {
    return (
      <div className={s.page}>
        <div className={s.header}>
          <h1 className={s.title}>Predict</h1>
        </div>
        <div className={s.card}>
          <Skeleton lines={2} />
        </div>
        <div className={hub.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={s.card}>
              <Skeleton height={20} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const status = computeHubStatus(
    data.data,
    preds.getPrediction,
    preds.jokerCount,
    preds.tieResolutions,
    preds.bracketProgression,
  )
  const startsOn = data.data.tournament.startsOn
  const days = startsOn ? daysUntil(startsOn) : null
  const locked = isEntryLocked(data.data.tournament.lockAt)

  const thirdSub =
    status.thirdPlace.state === 'blocked'
      ? 'Predict all group matches first'
      : status.thirdPlace.state === 'ties'
        ? `${status.thirdPlace.tieCount} tie${status.thirdPlace.tieCount === 1 ? '' : 's'} need your call`
        : 'Settled — nothing to resolve'
  const thirdState: RowState =
    status.thirdPlace.state === 'blocked'
      ? 'todo'
      : status.thirdPlace.state === 'ties'
        ? 'attention'
        : 'done'

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>{data.data.tournament.name}</span>
        <h1 className={s.title}>Predict</h1>
      </div>

      <div className={s.card}>
        <ProgressBar
          value={status.overallPercent}
          label="Overall progress"
          showValue={false}
        />
        <div className={hub.lockLine}>
          <LockIcon size={13} />
          {locked
            ? 'Predictions are locked — the tournament has started'
            : days !== null && startsOn
              ? `Locks at kickoff${days > 0 ? ` — in ${days} day${days === 1 ? '' : 's'}` : ''} (${formatLongDate(startsOn)})`
              : 'Locks at tournament kickoff'}
        </div>
      </div>

      <div className={hub.list}>
        <HubRow
          title="Groups A–F"
          subtitle={`${status.groups.predicted} of ${status.groups.total} matches predicted`}
          state={status.groups.complete ? 'done' : 'todo'}
          Base={BallIcon}
          onOpen={() => navigate('/predict/groups/A')}
        />
        <HubRow
          title="Best third-placed teams"
          subtitle={thirdSub}
          state={thirdState}
          Base={TrophyIcon}
          onOpen={() => navigate('/predict/third-place')}
        />
        <HubRow
          title="Knockout bracket"
          subtitle={`${status.bracket.picked} of ${status.bracket.total} winners picked`}
          state={status.bracket.picked === status.bracket.total ? 'done' : 'todo'}
          Base={TrophyIcon}
          onOpen={() => navigate('/predict/bracket')}
        />
        <HubRow
          title="Jokers"
          subtitle={`${status.jokers.placed} of ${status.jokers.total} placed`}
          state={status.jokers.placed === status.jokers.total ? 'done' : 'todo'}
          Base={CardsIcon}
          onOpen={() => navigate('/predict/jokers')}
        />
        <HubRow
          title="Review and submit"
          subtitle={
            preds.submittedAt !== null
              ? 'Entry submitted · still editable until kickoff'
              : status.reviewUnlocked
                ? 'Ready to review'
                : 'Complete the steps above first'
          }
          state={
            preds.submittedAt !== null ? 'done' : status.reviewUnlocked ? 'todo' : 'locked'
          }
          Base={CheckIcon}
          onOpen={() => navigate('/predict/review')}
        />
      </div>
    </div>
  )
}
