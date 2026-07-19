import { useNavigate } from 'react-router-dom'
import { Alert, Button, ProgressBar, Skeleton } from '../../design-system'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { computeHubStatus } from '../predict/hubStatus'
import { daysUntil, formatLongDate } from '../../app/time'
import s from '../shared.module.css'

export function HomePage() {
  const navigate = useNavigate()
  const data = useTournamentData()
  const preds = usePredictions()

  if (data.status === 'idle' || data.status === 'loading') {
    return (
      <div className={s.page}>
        <div className={s.header}>
          <span className={s.eyebrow}>Euro 2028</span>
          <h1 className={s.title}>Home</h1>
        </div>
        <div className={s.card}>
          <Skeleton lines={3} />
        </div>
      </div>
    )
  }

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        <div className={s.header}>
          <h1 className={s.title}>Home</h1>
        </div>
        <Alert variant="error" title="Couldn't load the tournament">
          {data.message}
        </Alert>
      </div>
    )
  }

  const { tournament } = data.data
  const status = preds.ready
    ? computeHubStatus(data.data, preds.getPrediction, preds.jokerCount, preds.tieResolutions)
    : null
  const days = tournament.startsOn ? daysUntil(tournament.startsOn) : null

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>{tournament.name}</span>
        <h1 className={s.title}>Home</h1>
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Your entry</span>
        {status ? (
          <>
            <div className={s.rowBetween}>
              <span className={s.stat}>{status.overallPercent}%</span>
              <span className={s.statLabel}>
                {status.groups.predicted} of {status.groups.total}
                <br />
                group matches predicted
              </span>
            </div>
            <ProgressBar value={status.overallPercent} label="Group predictions complete" />
          </>
        ) : (
          <Skeleton lines={2} />
        )}
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Deadline</span>
        {days !== null && tournament.startsOn ? (
          <p className={s.sub}>
            Predictions lock when the tournament kicks off
            {days > 0 ? ` — in ${days} day${days === 1 ? '' : 's'}` : ''} (
            {formatLongDate(tournament.startsOn)}). The server enforces the lock; this countdown is a
            reminder.
          </p>
        ) : (
          <p className={s.sub}>Kickoff date to be confirmed.</p>
        )}
      </div>

      <Button variant="primary" fullWidth onClick={() => navigate('/predict')}>
        Continue your predictions
      </Button>
    </div>
  )
}
