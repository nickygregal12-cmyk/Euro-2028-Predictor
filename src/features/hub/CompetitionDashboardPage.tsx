import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, Button, EmptyIllustration } from '../../design-system'
import {
  competitionGameRoute,
  competitionSectionRoute,
  type DomesticGameRoute,
} from '../../app/weeklyRoutes'
import {
  fetchHubMembership,
  type HubSeasonMembership,
} from '../../services/supabase/competitionGames'
import type { CompetitionGame } from '../../services/supabase/competitionGamesModel'
import {
  registerBonusCompetition,
  withdrawBonusCompetition,
} from '../../services/supabase/bonusGames'
import s from '../shared.module.css'
import h from './hub.module.css'
import { isNextUi } from '../../app/routeFlags'
import {
  findHubCompetition,
  type HubCompetition,
  type HubGame,
} from './competitionCatalogue'
import { applyHubMembership } from './hubMembership'
import { decideGameMembership, gameMembershipRefusal } from './gameMembershipAction'
import { CompetitionWeekPanel } from './CompetitionWeekPanel'
import { useCompetitionWeek } from './useCompetitionWeek'
import { SeasonCompetitionShell } from '../season/SeasonCompetitionShell'
import { seasonShellDestinations } from '../season/seasonDestinations'

function domesticGameRoute(game: HubGame): DomesticGameRoute | null {
  switch (game.kind) {
    case 'league-predictor':
      return isNextUi('seasonMatchPredictor') ? 'match-predictor' : null
    case 'last-man-standing':
      return 'lms'
    case 'predictor-championship':
      return 'championship'
    default:
      return null
  }
}

function gamePath(competition: HubCompetition, game: HubGame): string | null {
  const route = domesticGameRoute(game)
  return route ? competitionGameRoute(competition, route) : null
}

type DashboardState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; competition: HubCompetition; season: HubSeasonMembership | null }

function useCompetitionDashboard(competition: HubCompetition | null) {
  const [state, setState] = useState<DashboardState>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)
  const seasonRowName = competition?.seasonRowName ?? null

  useEffect(() => {
    if (!competition || !seasonRowName) return
    let active = true
    setState({ status: 'loading' })
    fetchHubMembership([seasonRowName])
      .then((seasons) => {
        if (!active) return
        const { competitions } = applyHubMembership([competition], seasons)
        setState({
          status: 'ready',
          competition: competitions[0] ?? competition,
          season: seasons.find((entry) => entry.seasonName === seasonRowName) ?? null,
        })
      })
      .catch(() => {
        if (active) setState({ status: 'failed' })
      })
    return () => {
      active = false
    }
  }, [seasonRowName, nonce, competition])

  return { state, nonce, reload: useCallback(() => setNonce((value) => value + 1), []) }
}

type CompetitionPageMode = 'overview' | 'games'

function CompetitionPage({ mode }: { mode: CompetitionPageMode }) {
  const navigate = useNavigate()
  const { competitionSlug, seasonSlug } = useParams<{
    competitionSlug: string
    seasonSlug: string
  }>()
  const catalogue = findHubCompetition(competitionSlug, seasonSlug)
  const { state, nonce, reload } = useCompetitionDashboard(catalogue)
  const [acting, setActing] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const changeMembership = async (served: CompetitionGame, leaving: boolean) => {
    if (acting) return
    setActing(served.id)
    setActionError(null)
    try {
      if (leaving) await withdrawBonusCompetition(served.id)
      else await registerBonusCompetition(served.id)
      reload()
    } catch (error) {
      setActionError(gameMembershipRefusal(error))
      reload()
    } finally {
      setActing(null)
    }
  }

  if (!catalogue) {
    return (
      <div className={s.page}>
        <div className={h.empty}>
          <EmptyIllustration variant="list" />
        </div>
        <Alert variant="warning" title="This competition could not be found">
          Return to the Hub and choose an available competition season.
        </Alert>
        <Button variant="primary" fullWidth onClick={() => navigate('/')}>
          Back to Hub
        </Button>
      </div>
    )
  }

  const competition = state.status === 'ready' ? state.competition : catalogue
  const membershipKnown = state.status === 'ready'
  const servedGames = state.status === 'ready' ? (state.season?.seasonGames.games ?? []) : []
  const serverNow = state.status === 'ready' ? (state.season?.seasonGames.serverNow ?? null) : null
  const base = competitionSectionRoute(competition, 'overview')
  const destinations = seasonShellDestinations(base)

  // Where each game lives, resolved once here rather than inside the week hook:
  // the Match Predictor destination is flag-gated and that decision belongs in
  // the one place that already makes it.
  const weekHrefs = {
    matchPredictor: isNextUi('seasonMatchPredictor')
      ? competitionGameRoute(competition, 'match-predictor')
      : null,
    lms: competitionGameRoute(competition, 'lms'),
    championship: competitionGameRoute(competition, 'championship'),
  }
  const week = useCompetitionWeek(competitionSlug, seasonSlug, servedGames, weekHrefs, nonce)

  return (
    <SeasonCompetitionShell
      competitionName={competition.name}
      seasonLabel={competition.seasonLabel}
      statusStrip={[competition.status]}
      active={mode}
      destinations={destinations}
    >
      {state.status === 'failed' ? (
        <Alert variant="warning" title="Couldn’t check your entries">
          Which games you have joined couldn’t be loaded right now, so no entry is claimed either
          way. Your entries are unaffected.
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={reload}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      {mode === 'overview' ? (
        <section className={h.section} aria-labelledby="competition-overview">
          <div className={h.sectionHead}>
            <h2 className={h.sectionTitle} id="competition-overview">
              Overview
            </h2>
          </div>
          <p className={s.sub}>{competition.summary}</p>
          {/* §7.3's Overview job: what is due, before what exists. It renders
              nothing at all for a player who has joined no game here — an
              action panel with no actions is furniture. */}
          <CompetitionWeekPanel
            week={week.week}
            loading={week.loading}
            failed={week.failed}
            timeZone={week.timeZone}
          />
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate(competitionSectionRoute(competition, 'games'))}
          >
            View games
          </Button>
        </section>
      ) : (
        <>
          {actionError ? (
            <Alert variant="error" title="That change was not saved">
              {actionError}
            </Alert>
          ) : null}

          <section className={h.section} aria-labelledby="competition-games">
            <div className={h.sectionHead}>
              <h2 className={h.sectionTitle} id="competition-games">
                Games
              </h2>
              <span className={h.sectionCount}>{competition.games.length}</span>
            </div>

            <div className={h.gameStack}>
              {competition.games.map((game) => {
                const path = gamePath(competition, game)
                const headingId = `game-${game.kind}`
                const served = servedGames.find((entry) => entry.gameKey === game.gameKey)
                const decision = served ? decideGameMembership(served, serverNow) : null
                const busy = served !== undefined && acting === served.id

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
                      {!membershipKnown ? null : game.joined ? (
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

                      {decision?.action ? (
                        <Button
                          variant="secondary"
                          fullWidth
                          disabled={busy || acting !== null}
                          onClick={() =>
                            served && changeMembership(served, decision.action === 'leave')
                          }
                        >
                          {busy ? 'Saving…' : decision.label}
                        </Button>
                      ) : decision?.refusal ? (
                        <p className={h.gameMeta}>{decision.refusal}</p>
                      ) : (
                        <Button variant="secondary" fullWidth disabled>
                          {state.status === 'loading' ? 'Checking…' : 'Entry unavailable'}
                        </Button>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </section>
        </>
      )}
    </SeasonCompetitionShell>
  )
}

export function CompetitionDashboardPage() {
  return <CompetitionPage mode="overview" />
}

export function CompetitionGamesPage() {
  return <CompetitionPage mode="games" />
}
