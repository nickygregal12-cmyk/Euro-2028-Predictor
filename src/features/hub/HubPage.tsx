import { useNavigate } from 'react-router'
import { Button } from '../../design-system'
import s from '../shared.module.css'
import h from './hub.module.css'
import { HUB_COMPETITIONS, competitionPath } from './competitionCatalogue'

export function HubPage() {
  const navigate = useNavigate()

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>Football Prediction Hub</span>
        <h1 className={s.title}>Choose your competition</h1>
      </div>

      <div className={h.intro}>
        <p className={s.sub}>
          Join only the competitions and games you want to play. Your account, profile and
          career record carry across every season.
        </p>
      </div>

      <div className={h.grid}>
        {HUB_COMPETITIONS.map((competition) => (
          <section className={h.competitionCard} key={competitionPath(competition)}>
            <div className={h.cardHeader}>
              <div className={h.cardTitle}>
                <span className={h.name}>{competition.name}</span>
                <span className={h.season}>{competition.seasonLabel}</span>
              </div>
              <span className={h.status}>{competition.status}</span>
            </div>

            <p className={h.description}>{competition.summary}</p>

            <div className={h.gameList}>
              {competition.games.map((game) => (
                <div className={h.gameCard} key={game.kind}>
                  <div className={h.gameHeader}>
                    <span className={h.gameName}>{game.name}</span>
                    {game.joined ? <span className={h.joined}>Joined</span> : null}
                  </div>
                  <span className={h.gameDescription}>{game.description}</span>
                </div>
              ))}
            </div>

            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate(competitionPath(competition))}
            >
              Open competition
            </Button>
          </section>
        ))}
      </div>
    </div>
  )
}
