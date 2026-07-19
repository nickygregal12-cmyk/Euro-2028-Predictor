import { Alert, Button, EmptyState, JokerCounter, Skeleton } from '../../design-system'
import { CardsIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions, MAX_JOKERS } from '../../app/providers/PredictionsProvider'
import s from '../shared.module.css'

export function JokersPage() {
  const data = useTournamentData()
  const preds = usePredictions()

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Jokers</h1>
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
          <Skeleton lines={3} />
        </div>
      </div>
    )
  }

  const teamsById = new Map(data.data.teams.map((t) => [t.id, t.name]))
  const placed = data.data.matches
    .filter((m) => m.round === 'group' && preds.getPrediction(m.id).joker)
    .sort((a, b) => a.matchRef.localeCompare(b.matchRef))

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>Predict</span>
        <h1 className={s.title}>Jokers</h1>
      </div>

      <div className={s.card}>
        <JokerCounter used={preds.jokerCount} total={MAX_JOKERS} />
        <p className={s.sub}>
          A joker doubles the points for one group match. Place up to {MAX_JOKERS} — tap the joker on
          any match card in the group screens. Each joker locks when its match kicks off.
        </p>
      </div>

      {placed.length === 0 ? (
        <EmptyState
          icon={<CardsIcon size={22} />}
          title="No jokers placed yet"
          description="Open a group and tap the joker on a match to double its points."
        />
      ) : (
        <div className={s.stack}>
          {placed.map((m) => (
            <div key={m.id} className={s.card}>
              <div className={s.rowBetween}>
                <span>
                  {teamsById.get(m.homeTeamId ?? '') ?? 'TBC'} v{' '}
                  {teamsById.get(m.awayTeamId ?? '') ?? 'TBC'}
                </span>
                <Button variant="secondary" onClick={() => preds.toggleJoker(m.id)}>
                  Remove
                </Button>
              </div>
              <span className={s.eyebrow}>
                {m.matchRef} · {m.venue}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
