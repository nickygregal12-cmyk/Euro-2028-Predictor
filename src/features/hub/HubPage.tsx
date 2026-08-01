import { useNavigate } from 'react-router'
import { Button } from '../../design-system'
import s from '../shared.module.css'
import h from './hub.module.css'
import {
  HUB_COMPETITIONS,
  competitionPath,
  partitionHubCompetitions,
  type HubCompetition,
} from './competitionCatalogue'

type CompetitionCardProps = {
  competition: HubCompetition
  onOpen: (competition: HubCompetition) => void
  action: string
}

function CompetitionCard({ competition, onOpen, action }: CompetitionCardProps) {
  const headingId = `competition-${competition.competitionSlug}-${competition.seasonSlug}`

  return (
    <section className={h.competitionCard} aria-labelledby={headingId}>
      <div className={h.cardHeader}>
        <div className={h.cardTitle}>
          <h3 className={h.name} id={headingId}>
            {competition.name}
          </h3>
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

      <Button variant="primary" fullWidth onClick={() => onOpen(competition)}>
        {action} {competition.name}
      </Button>
    </section>
  )
}

export function HubPage() {
  const navigate = useNavigate()
  const { mine, discover } = partitionHubCompetitions(HUB_COMPETITIONS)
  const open = (competition: HubCompetition) => navigate(competitionPath(competition))

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

      <section className={h.section} aria-labelledby="hub-my-competitions">
        <h2 className={h.sectionTitle} id="hub-my-competitions">
          My competitions
        </h2>
        {mine.length === 0 ? (
          <p className={h.empty}>
            You have not joined a competition yet. Pick one from Discover to get started.
          </p>
        ) : (
          <div className={h.grid}>
            {mine.map((competition) => (
              <CompetitionCard
                action="Open"
                competition={competition}
                key={competitionPath(competition)}
                onOpen={open}
              />
            ))}
          </div>
        )}
      </section>

      <section className={h.section} aria-labelledby="hub-discover">
        <h2 className={h.sectionTitle} id="hub-discover">
          Discover
        </h2>
        {discover.length === 0 ? (
          <p className={h.empty}>
            You have joined every competition currently running. New seasons appear here as
            they open.
          </p>
        ) : (
          <div className={h.grid}>
            {discover.map((competition) => (
              <CompetitionCard
                action="View"
                competition={competition}
                key={competitionPath(competition)}
                onOpen={open}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
