import { type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import {
  Alert,
  Button,
  EmptyState,
  ProgressBar,
  Skeleton,
  TeamFlag,
} from '../../design-system'
import {
  AlertIcon,
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
} from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { buildPredictHubModel, type StageState } from './hubJourney'
import { useTournamentEntryLocked } from '../shared/useTournamentEntryLocked'
import { daysUntil, formatLongDate } from '../../app/time'
import s from '../shared.module.css'
import hub from './hub.module.css'

function StepChip({ state, step }: { state: StageState; step: number }) {
  const cls =
    state === 'done'
      ? hub.stepChipDone
      : state === 'current'
        ? hub.stepChipCurrent
        : state === 'attention'
          ? hub.stepChipAttention
          : hub.stepChipMuted
  return (
    <span className={`${hub.stepChip} ${cls}`} aria-hidden="true">
      {state === 'done' ? (
        <CheckIcon size={16} />
      ) : state === 'attention' ? (
        <AlertIcon size={16} />
      ) : state === 'locked' ? (
        <LockIcon size={16} />
      ) : (
        step
      )}
    </span>
  )
}

function StageStep(props: {
  step: number
  title: string
  subtitle: string
  state: StageState
  onOpen: () => void
  children?: ReactNode
}) {
  const locked = props.state === 'locked'
  return (
    <li className={hub.step}>
      <button
        type="button"
        className={hub.stepRow}
        disabled={locked}
        onClick={locked ? undefined : props.onOpen}
      >
        <StepChip state={props.state} step={props.step} />
        <span className={hub.body}>
          <span className={hub.rowTitle}>{props.title}</span>
          <span
            className={`${hub.rowSub} ${props.state === 'attention' ? hub.rowSubAttention : ''}`}
          >
            {props.subtitle}
          </span>
        </span>
        {!locked && <ChevronRightIcon size={18} className={hub.chevron} />}
      </button>
      {props.children}
    </li>
  )
}

export function PredictHubPage() {
  const navigate = useNavigate()
  const data = useTournamentData()
  const preds = usePredictions()
  const entryLocked = useTournamentEntryLocked()

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
          <Skeleton lines={4} />
        </div>
        <div className={s.card}>
          <Skeleton lines={5} />
        </div>
      </div>
    )
  }

  const model = buildPredictHubModel(
    data.data,
    preds.getPrediction,
    preds.jokerCount,
    preds.tieResolutions,
    preds.bracketProgression,
  )
  const { status } = model
  const startsOn = data.data.tournament.startsOn
  const days = startsOn ? daysUntil(startsOn) : null
  const locked = entryLocked
  const submitted = preds.submittedAt !== null

  // Spectator: locked out with nothing entered — pitch the games that are
  // still open instead of a dead checklist (design-system §6).
  if (locked && !model.hasAnyEntry && !submitted) {
    return (
      <div className={s.page}>
        <div className={s.header}>
          <span className={s.eyebrow}>{data.data.tournament.name}</span>
          <h1 className={s.title}>Predict</h1>
        </div>
        <EmptyState
          icon={<LockIcon size={28} />}
          title="Entries are locked"
          description="Predictions closed at the opening kickoff. You can still follow every match, and the bonus games open as the tournament unfolds."
          action={
            <div className={hub.spectatorActions}>
              <Button onClick={() => navigate('/games')}>Explore the Games hub</Button>
              <Button variant="secondary" onClick={() => navigate('/matches')}>
                Browse the tournament
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const groupTieCount = model.groupChips.reduce((n, c) => n + c.pendingTies, 0)
  const groupsSubtitle =
    `${status.groups.predicted} of ${status.groups.total} matches predicted` +
    (groupTieCount > 0
      ? ` · ${groupTieCount} tie${groupTieCount === 1 ? '' : 's'} need your call`
      : '')

  const standingsSubtitle =
    status.thirdPlace.state === 'blocked'
      ? 'Predict all group matches first'
      : status.thirdPlace.state === 'ties'
        ? `${status.thirdPlace.tieCount} decision${status.thirdPlace.tieCount === 1 ? '' : 's'} need your call`
        : 'Group standings confirmed'

  const reviewSubtitle = submitted
    ? locked
      ? 'Entry submitted and locked in'
      : 'Entry submitted · still editable until kickoff'
    : status.reviewUnlocked
      ? 'Ready to review'
      : 'Complete the steps above first'

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>{data.data.tournament.name}</span>
        <h1 className={s.title}>{locked ? 'My entry' : 'Predict'}</h1>
      </div>

      <div className={`${s.card} ${hub.hero}`}>
        <div className={s.rowBetween}>
          <span className={hub.heroPercent}>{model.entryPercent}%</span>
          <span className={hub.heroLabel}>
            {status.groups.predicted + status.bracket.picked} of{' '}
            {status.groups.total + status.bracket.total} picks made
          </span>
        </div>
        <ProgressBar
          value={model.entryPercent}
          label="Entry completion"
          showValue={false}
        />
        {model.champion ? (
          <div className={hub.championLine}>
            <TeamFlag
              countryCode={model.champion.countryCode}
              label={model.champion.name}
              size="table"
            />
            <span>
              Your champion: <strong>{model.champion.name}</strong>
            </span>
          </div>
        ) : null}
        <div className={hub.lockHero}>
          <LockIcon size={14} />
          {locked
            ? submitted
              ? 'Locked in — the tournament has started'
              : 'Predictions are locked — the tournament has started'
            : days !== null && startsOn
              ? `Locks at kickoff${days > 0 ? ` — in ${days} day${days === 1 ? '' : 's'}` : ''} (${formatLongDate(startsOn)})`
              : 'Locks at tournament kickoff'}
        </div>
        {!locked ? (
          <div className={hub.continueWrap}>
            <Button onClick={() => navigate(model.continueTarget.route)}>
              {model.continueTarget.label}
            </Button>
          </div>
        ) : null}
      </div>

      <div className={`${s.card} ${hub.journeyCard}`}>
        <ol className={hub.stepper}>
          <StageStep
            step={1}
            title="Groups A–F"
            subtitle={groupsSubtitle}
            state={
              locked
                ? status.groups.complete
                  ? 'done'
                  : 'todo'
                : model.stageStates.groups
            }
            onOpen={() => navigate('/predict/groups/A')}
          >
            <div className={hub.letterChips}>
              {model.groupChips.map((chip) => (
                <button
                  key={chip.letter}
                  type="button"
                  className={`${hub.letterChip} ${
                    chip.pendingTies > 0
                      ? hub.letterChipAttention
                      : chip.complete
                        ? hub.letterChipDone
                        : ''
                  }`}
                  aria-label={`Group ${chip.letter}: ${
                    chip.pendingTies > 0
                      ? `${chip.pendingTies} tie${chip.pendingTies === 1 ? '' : 's'} need your call`
                      : `${chip.predicted} of ${chip.total} predicted`
                  }`}
                  onClick={() => navigate(`/predict/groups/${chip.letter}`)}
                >
                  {chip.complete && chip.pendingTies === 0 ? (
                    <CheckIcon size={13} aria-hidden="true" />
                  ) : null}
                  {chip.letter}
                </button>
              ))}
            </div>
          </StageStep>
          <StageStep
            step={2}
            title="Finalise Group Standings"
            subtitle={standingsSubtitle}
            state={
              locked
                ? status.thirdPlace.state === 'settled'
                  ? 'done'
                  : 'todo'
                : model.stageStates.standings
            }
            onOpen={() => navigate('/predict/third-place')}
          />
          <StageStep
            step={3}
            title="Knockout bracket"
            subtitle={`${status.bracket.picked} of ${status.bracket.total} winners picked`}
            state={
              locked
                ? status.bracket.picked === status.bracket.total
                  ? 'done'
                  : 'todo'
                : model.stageStates.bracket
            }
            onOpen={() => navigate('/predict/bracket')}
          />
          <StageStep
            step={4}
            title="Jokers"
            subtitle={`${status.jokers.placed} of ${status.jokers.total} placed · optional, movable until each kickoff`}
            state={model.stageStates.jokers}
            onOpen={() => navigate('/predict/jokers')}
          />
          <StageStep
            step={5}
            title="Review and submit"
            subtitle={reviewSubtitle}
            state={submitted ? 'done' : locked ? 'todo' : model.stageStates.review}
            onOpen={() => navigate('/predict/review')}
          />
        </ol>
      </div>
    </div>
  )
}
