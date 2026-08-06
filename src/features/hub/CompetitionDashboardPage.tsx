import { useNavigate, useParams } from 'react-router'
import { Alert, Button, EmptyIllustration, Masthead } from '../../design-system'
import s from '../shared.module.css'
import h from './hub.module.css'
import { findHubCompetition, type HubGame } from './competitionCatalogue'
import { isNextUi } from '../../app/routeFlags'

function gamePath(
  competitionSlug: string,
  seasonSlug: string,
  game: HubGame,
): string | null {
  if (competitionSlug === 'euro' && seasonSlug === '2028' && game.kind === 'original-predictor') {
    return '/competitions/euro/2028/original'
  }

  // The season Match Predictor. Reached from here rather than named in the
  // catalogue because the catalogue describes the games a competition offers,
  // and where a game lives is a routing fact — the Euro entry above is the same
  // decision, made once already.
  if (game.kind === 'league-predictor' && isNextUi('seasonMatchPredictor')) {
    return `/competitions/${competitionSlug}/${seasonSlug}/main-predictor`
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
        <Masthead>
          <div className={s.header}>
            <span className={s.eyebrow}>Football Prediction Hub</span>
            <h1 className={s.title}>Competition unavailable</h1>
          </div>
        </Masthead>
        <div className={h.empty}>
          <EmptyIllustration variant="list" />
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
      <Masthead>
        <div className={s.header}>
          <span className={s.eyebrow}>Football Prediction Hub</span>
          <h1 className={s.title}>{competition.name}</h1>
          <div className={h.seasonRow}>
            <span className={h.season}>{competition.seasonLabel}</span>
            <span className={h.status}>{competition.status}</span>
          </div>
        </div>
      </Masthead>

      <p className={h.dashboardIntro}>
        This dashboard will prioritise incomplete predictions, the next lock, live results,
        current ranks and active game decisions for this competition.
      </p>

      <section className={h.section} aria-labelledby="dashboard-games">
        <div className={h.sectionHead}>
          <h2 className={h.sectionTitle} id="dashboard-games">
            Games
          </h2>
          <span className={h.sectionCount}>{competition.games.length}</span>
        </div>

        <div className={h.gameStack}>
          {competition.games.map((game) => {
            const path = gamePath(competition.competitionSlug, competition.seasonSlug, game)
            const headingId = `game-${game.kind}`
            return (
              <section
                className={`${h.gameCard} ${game.joined ? '' : h.gameCardAvailable}`}
                key={game.kind}
                aria-labelledby={headingId}
              >
                <div className={h.gameHeader}>
                  <h3 className={h.gameCardHeading} id={headingId}>
                    {game.name}
                  </h3>
                  {game.joined ? (
                    <span className={h.joined}>Joined</span>
                  ) : (
                    <span className={h.gameMeta}>
                      {game.status === 'coming-soon' ? 'Coming soon' : 'Available'}
                    </span>
                  )}
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
      </section>

      <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
        Back to all competitions
      </Button>
    </div>
  )
}
