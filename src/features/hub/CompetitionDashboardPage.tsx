import { useNavigate, useParams } from 'react-router'
import { Alert, Button } from '../../design-system'
import s from '../shared.module.css'
import h from './hub.module.css'
import { findHubCompetition, type HubGame } from './competitionCatalogue'

function gamePath(
  competitionSlug: string,
  seasonSlug: string,
  game: HubGame,
): string | null {
  if (competitionSlug === 'euro' && seasonSlug === '2028' && game.kind === 'original-predictor') {
    return '/competitions/euro/2028/original'
  }

  return null
}

export function CompetitionDashboardPage() {
  const navigate = useNavigate()
  const { competitionSlug, seasonSlug } = useParams<{
    competitionSlug: string
    seasonSlug: string
  }>()
  const competition = findHubCompetition(competitionSlug, seasonSlug)

  if (!competition) {
    return (
      <div className={s.page}>
        <div className={s.header}>
          <span className={s.eyebrow}>Football Prediction Hub</span>
          <h1 className={s.title}>Competition unavailable</h1>
        </div>
        <Alert variant="warning" title="This competition could not be found">
          Return to the hub and choose an available competition season.
        </Alert>
        <Button variant="primary" fullWidth onClick={() => navigate('/')}>
          Back to hub
        </Button>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>Football Prediction Hub</span>
        <h1 className={s.title}>{competition.name}</h1>
        <p className={s.sub}>{competition.seasonLabel}</p>
      </div>

      <section className={h.competitionCard}>
        <div className={h.cardHeader}>
          <div className={h.cardTitle}>
            <span className={h.name}>Competition dashboard</span>
            <span className={h.season}>Your games and next actions</span>
          </div>
          <span className={h.status}>{competition.status}</span>
        </div>
        <p className={h.description}>
          This dashboard will prioritise incomplete predictions, the next lock, live results,
          current ranks and active game decisions for this competition.
        </p>
      </section>

      <div className={h.gameList}>
        {competition.games.map((game) => {
          const path = gamePath(competition.competitionSlug, competition.seasonSlug, game)
          return (
            <section className={h.gameCard} key={game.kind}>
              <div className={h.gameHeader}>
                <span className={h.gameName}>{game.name}</span>
                <span className={game.joined ? h.joined : h.status}>
                  {game.joined ? 'Joined' : game.status === 'coming-soon' ? 'Coming soon' : 'Available'}
                </span>
              </div>
              <span className={h.gameDescription}>{game.description}</span>
              <div className={h.actions}>
                <Button
                  variant={path ? 'primary' : 'secondary'}
                  fullWidth
                  disabled={!path}
                  onClick={() => path && navigate(path)}
                >
                  {path ? 'Open game' : 'Build pending'}
                </Button>
                <Button variant="secondary" fullWidth disabled={game.status === 'coming-soon'}>
                  {game.joined ? 'Leave game' : 'Join game'}
                </Button>
              </div>
            </section>
          )
        })}
      </div>

      <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
        Back to all competitions
      </Button>
    </div>
  )
}
