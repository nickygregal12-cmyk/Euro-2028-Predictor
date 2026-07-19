import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  EmptyState,
  JokerCounter,
  Skeleton,
  type MatchTeam,
} from '../../design-system'
import { CardsIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions, MAX_JOKERS } from '../../app/providers/PredictionsProvider'
import { isJokerCommitted } from '../../domain/tournament/jokerPolicy'
import { PlacedJokerCard } from './PlacedJokerCard'
import { formatShortDate } from '../../app/time'
import s from '../shared.module.css'

const INTRO =
  "Jokers double a match's points. Place them any time — each one commits when its match kicks off."

export function JokersPage() {
  const navigate = useNavigate()
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
        <div className={s.header}>
          <h1 className={s.title}>Jokers</h1>
        </div>
        <div className={s.card}>
          <Skeleton lines={3} />
        </div>
      </div>
    )
  }

  const teamsById = new Map(data.data.teams.map((t) => [t.id, t.name]))
  const letterByGroupId = new Map(data.data.groups.map((g) => [g.id, g.letter]))
  const teamOf = (id: string | null): MatchTeam => ({
    name: id ? (teamsById.get(id) ?? 'TBC') : 'TBC',
    countryCode: '',
  })

  const placed = data.data.matches
    .filter((m) => m.round === 'group' && preds.getPrediction(m.id).joker)
    .sort(
      (a, b) => a.matchDate.localeCompare(b.matchDate) || a.matchRef.localeCompare(b.matchRef),
    )
  const remaining = MAX_JOKERS - placed.length

  const header = (
    <>
      <div className={s.header}>
        <span className={s.eyebrow}>Predict</span>
        <h1 className={s.title}>Jokers</h1>
      </div>
      <div className={s.card}>
        <JokerCounter used={placed.length} total={MAX_JOKERS} />
        <p className={s.sub}>{INTRO}</p>
      </div>
    </>
  )

  if (placed.length === 0) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          icon={<CardsIcon size={22} />}
          title="No jokers placed yet"
          description="Jokers are placed on match cards in the group screens. Open a group and tap the gold joker on the match you're most confident about."
          action={
            <Button variant="primary" onClick={() => navigate('/predict/groups/A')}>
              Go to Groups
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className={s.page}>
      {header}

      <div className={s.stack}>
        {placed.map((m) => {
          const pred = preds.getPrediction(m.id)
          const committed = isJokerCommitted(m.kickoffAt)
          const letter = (m.groupId && letterByGroupId.get(m.groupId)) || 'A'
          return (
            <PlacedJokerCard
              key={m.id}
              group={letter}
              matchday={m.matchday ?? 1}
              date={formatShortDate(m.matchDate)}
              home={teamOf(m.homeTeamId)}
              away={teamOf(m.awayTeamId)}
              homeScore={pred.homeScore}
              awayScore={pred.awayScore}
              committed={committed}
              onRemove={() => preds.toggleJoker(m.id)}
              onMove={() => navigate(`/predict/groups/${letter}`)}
            />
          )
        })}
      </div>

      {remaining > 0 && (
        <div className={`${s.card} ${s.rowBetween}`}>
          <span className={s.sub}>
            {remaining} joker{remaining === 1 ? '' : 's'} still to place
          </span>
          <Button variant="secondary" onClick={() => navigate('/predict/groups/A')}>
            Place in Groups
          </Button>
        </div>
      )}
    </div>
  )
}
