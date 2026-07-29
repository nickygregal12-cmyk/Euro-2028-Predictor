import { useNavigate } from 'react-router'
import { Button, TeamFlag } from '../../design-system'
import { CheckIcon, LockIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import { buildPredictHubModel } from './hubJourney'
import { PredictHubPage } from './PredictHubPage'
import s from '../shared.module.css'
import p from './postLockEntry.module.css'

export function PredictEntryPage() {
  const navigate = useNavigate()
  const tournament = useTournamentData()
  const predictions = usePredictions()

  if (
    tournament.status !== 'ready' ||
    !predictions.ready ||
    !isEntryLocked(tournament.data.tournament.lockAt) ||
    predictions.submittedAt === null
  ) {
    return <PredictHubPage />
  }

  const model = buildPredictHubModel(
    tournament.data,
    predictions.getPrediction,
    predictions.jokerCount,
    predictions.tieResolutions,
    predictions.bracketProgression,
  )
  const picksMade = model.status.groups.predicted + model.status.bracket.picked
  const picksTotal = model.status.groups.total + model.status.bracket.total

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>{tournament.data.tournament.name}</span>
        <h1 className={s.title}>My entry</h1>
        <p className={s.sub}>Your Original Predictor is frozen. Now you can see how your calls compare with the field.</p>
      </div>

      <section className={p.hero} aria-labelledby="locked-entry-heading">
        <div className={p.statusLine}>
          <span className={p.statusChip}><CheckIcon size={14} /> Submitted</span>
          <span className={p.lockText}><LockIcon size={14} /> Locked at the opening kickoff</span>
        </div>
        <div className={p.heroBody}>
          <div>
            <span className={s.eyebrow}>Your tournament call</span>
            <h2 id="locked-entry-heading" className={p.heroTitle}>
              {model.champion ? `${model.champion.name} to win Euro 2028` : 'Your entry is locked in'}
            </h2>
            <p className={p.heroCopy}>{picksMade} of {picksTotal} core picks are preserved with your submitted entry.</p>
          </div>
          {model.champion ? (
            <TeamFlag
              countryCode={model.champion.countryCode}
              label={`Your champion: ${model.champion.name}`}
              size="champion"
            />
          ) : null}
        </div>
        <div className={p.actions}>
          <Button onClick={() => navigate('/prediction-trends')}>See prediction trends</Button>
          <Button variant="secondary" onClick={() => navigate('/predict/review')}>Review full entry</Button>
        </div>
      </section>

      <section className={p.jokerCard} aria-labelledby="joker-window-heading">
        <div>
          <span className={s.eyebrow}>Still active</span>
          <h2 id="joker-window-heading" className={p.cardTitle}>Your uncommitted jokers can still move</h2>
          <p className={s.sub}>Each joker locks only when its chosen group match kicks off.</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/predict/jokers')}>Manage jokers</Button>
      </section>

      <div className={p.quickGrid}>
        <button type="button" className={p.quickCard} onClick={() => navigate('/profile')}>
          <strong>Points breakdown</strong>
          <span>See exactly where every point came from.</span>
        </button>
        <button type="button" className={p.quickCard} onClick={() => navigate('/league/overall')}>
          <strong>Overall standings</strong>
          <span>Track your position as results arrive.</span>
        </button>
      </div>
    </div>
  )
}
