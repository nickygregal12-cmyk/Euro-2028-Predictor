import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import {
  competitionChampionshipInstanceRoute,
  competitionRoute,
  logicalWeeklyParent,
  weeklyRoutes,
  type DomesticGameRoute,
} from '../../app/weeklyRoutes'
import { useAuth } from '../auth/AuthProvider'
import { findHubCompetition, type HubCompetition } from '../hub/competitionCatalogue'
import { fetchHubMembership } from '../../services/supabase/competitionGames'
import type {
  CompetitionGame,
  CompetitionGameKey,
} from '../../services/supabase/competitionGamesModel'
import { fetchSeasonLeaderboardPage } from '../../services/supabase/seasonLeaderboard'
import {
  fetchMyEntryId,
  fetchSeasonPeriodStandings,
} from '../../services/supabase/seasonPeriodStandings'
import { createSeasonLmsRpcGateway } from '../../services/supabase/seasonLms'
import { createSeasonLmsRegistrationRpcGateway } from '../../services/supabase/seasonLmsRegistration'
import {
  createSeasonCupDiscoveryRpcGateway,
  createSeasonCupPlayerViewRpcGateway,
} from '../../services/supabase/seasonCupPlayer'
import { createGameLeague, fetchMyGameLeagues } from '../../services/supabase/gameLeagues'
import { joinLeague } from '../../services/supabase/leagues'
import { isNextUi } from '../../app/routeFlags'
import { presentPlayInbox } from './playInboxModel'
import { SeasonCompetitionShell, type SeasonShellSection } from './SeasonCompetitionShell'
import { SeasonGameSubNav } from './SeasonGameSubNav'
import { seasonShellDestinations } from './seasonDestinations'
import { SeasonLeaguesPage } from './SeasonLeaguesPage'
import { SeasonPlayPage } from './SeasonPlayPage'
import { SeasonStandingsPage } from './SeasonStandingsPage'
import { SeasonLmsPage } from './SeasonLmsPage'
import {
  SeasonChampionshipIndexPage,
  SeasonChampionshipPlayerPage,
  type ChampionshipPageMode,
} from './SeasonChampionshipPages'
import s from '../shared.module.css'

type Resolved = {
  competition: HubCompetition
  tournamentId: string
  gameIds: Partial<Record<CompetitionGameKey, string>>
  games: readonly CompetitionGame[]
}

type RouteState =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; resolved: Resolved }

function useSeasonRoute(): RouteState {
  const { competitionSlug, seasonSlug } = useParams<{
    competitionSlug: string
    seasonSlug: string
  }>()
  const [state, setState] = useState<RouteState>({ status: 'loading' })
  const competition = findHubCompetition(competitionSlug, seasonSlug)
  const seasonRowName = competition?.seasonRowName ?? null

  useEffect(() => {
    if (!competition || !seasonRowName) {
      setState({ status: 'failed', message: 'This competition season could not be found.' })
      return
    }
    let active = true
    setState({ status: 'loading' })
    fetchHubMembership([seasonRowName])
      .then((seasons) => {
        if (!active) return
        const season = seasons.find((entry) => entry.seasonName === seasonRowName)
        if (!season) {
          setState({
            status: 'failed',
            message: 'This competition season is not available yet.',
          })
          return
        }
        const gameIds: Partial<Record<CompetitionGameKey, string>> = {}
        for (const game of season.seasonGames.games) gameIds[game.gameKey] = game.id
        setState({
          status: 'ready',
          resolved: {
            competition,
            tournamentId: season.tournamentId,
            gameIds,
            games: season.seasonGames.games,
          },
        })
      })
      .catch(() => {
        if (active) {
          setState({ status: 'failed', message: 'This season could not be loaded right now.' })
        }
      })
    return () => {
      active = false
    }
  }, [competition, seasonRowName])

  return state
}

function RouteFrame({
  title,
  section,
  state,
  game,
  statusStrip = [],
  children,
}: {
  title: string
  section: SeasonShellSection
  state: RouteState
  game?: DomesticGameRoute
  statusStrip?: readonly string[]
  children: (resolved: Resolved) => React.ReactNode
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const parent = logicalWeeklyParent(pathname)

  const exits = (
    <div className={s.actions}>
      {parent && parent.href !== weeklyRoutes.hub ? (
        <Button variant="secondary" fullWidth onClick={() => navigate(parent.href)}>
          {parent.label}
        </Button>
      ) : null}
      <Button variant="secondary" fullWidth onClick={() => navigate(weeklyRoutes.hub)}>
        Back to Hub
      </Button>
    </div>
  )

  if (state.status === 'loading') {
    return (
      <div className={s.page}>
        {exits}
        <Skeleton width="60%" height={28} />
        <Skeleton width="100%" height={220} />
      </div>
    )
  }

  if (state.status === 'failed') {
    return (
      <div className={s.page}>
        <div className={s.header}>
          <h1 className={s.title}>{title}</h1>
        </div>
        <Alert variant="error" title="We could not open this game">
          {state.message}
        </Alert>
        {exits}
      </div>
    )
  }

  return (
    <SeasonCompetitionShell
      competitionName={state.resolved.competition.name}
      seasonLabel={state.resolved.competition.seasonLabel}
      statusStrip={statusStrip}
      active={section}
      destinations={seasonShellDestinations(competitionBase(state.resolved))}
    >
      {game ? <SeasonGameSubNav game={game} /> : null}
      {children(state.resolved)}
    </SeasonCompetitionShell>
  )
}

function competitionBase(resolved: Resolved): string {
  return competitionRoute(resolved.competition)
}

function MissingGame({ name }: { name: string }) {
  return (
    <Alert variant="warning" title={`${name} is not part of this season`}>
      This season does not list this game, so there is nothing to open.
    </Alert>
  )
}

export function SeasonStandingsRoute() {
  const state = useSeasonRoute()
  const { userId } = useAuth()

  return (
    <RouteFrame
      title="Match Predictor standings"
      section="games"
      state={state}
      game="match-predictor"
    >
      {(resolved) => (
        <SeasonStandingsRouteBody tournamentId={resolved.tournamentId} userId={userId} />
      )}
    </RouteFrame>
  )
}

function SeasonStandingsRouteBody({
  tournamentId,
  userId,
}: {
  tournamentId: string
  userId: string | null
}) {
  const gateway = useMemo(
    () => ({
      load: (cursor: string | null) =>
        fetchSeasonLeaderboardPage(tournamentId, { after: cursor }),
    }),
    [tournamentId],
  )
  const periods = useMemo(
    () =>
      userId
        ? {
            load: (period: 'month' | 'form') =>
              fetchSeasonPeriodStandings(tournamentId, period),
            myEntryId: () => fetchMyEntryId(userId, tournamentId),
          }
        : undefined,
    [tournamentId, userId],
  )

  return <SeasonStandingsPage gameName="Match Predictor" gateway={gateway} periods={periods} />
}

export function SeasonLmsRoute() {
  const state = useSeasonRoute()
  const { userId } = useAuth()

  return (
    <RouteFrame title="Last Man Standing" section="games" state={state} game="lms">
      {(resolved) => {
        const competitionId = resolved.gameIds.last_man_standing
        if (!competitionId) return <MissingGame name="Last Man Standing" />
        return (
          <SeasonLmsRouteBody
            tournamentId={resolved.tournamentId}
            competitionId={competitionId}
            userId={userId}
          />
        )
      }}
    </RouteFrame>
  )
}

function SeasonLmsRouteBody({
  tournamentId,
  competitionId,
  userId,
}: {
  tournamentId: string
  competitionId: string
  userId: string | null
}) {
  const gateway = useMemo(
    () => createSeasonLmsRpcGateway({ tournamentId }),
    [tournamentId],
  )
  const registration = useMemo(
    () =>
      userId
        ? createSeasonLmsRegistrationRpcGateway({ tournamentId, competitionId, userId })
        : undefined,
    [tournamentId, competitionId, userId],
  )
  const now = useMemo(() => () => new Date(), [])

  return <SeasonLmsPage gateway={gateway} now={now} registration={registration} />
}

/**
 * Championship is now an instance index rather than an alias for the current
 * public competition. A season can run one public Championship alongside
 * organiser-created private competitions, and the browser must not silently
 * collapse those distinct games into the public id.
 */
export function SeasonChampionshipRoute() {
  const state = useSeasonRoute()

  return (
    <RouteFrame
      title="Predictor Championship"
      section="games"
      state={state}
      game="championship"
    >
      {(resolved) => {
        if (!resolved.gameIds.predictor_cup) {
          return <MissingGame name="The Predictor Championship" />
        }
        return <SeasonChampionshipIndexRouteBody resolved={resolved} />
      }}
    </RouteFrame>
  )
}

function SeasonChampionshipIndexRouteBody({ resolved }: { resolved: Resolved }) {
  const gateway = useMemo(
    () => createSeasonCupDiscoveryRpcGateway({ tournamentId: resolved.tournamentId }),
    [resolved.tournamentId],
  )
  const hrefFor = (competitionId: string) =>
    competitionChampionshipInstanceRoute(resolved.competition, competitionId)

  return <SeasonChampionshipIndexPage gateway={gateway} hrefFor={hrefFor} />
}

export function SeasonChampionshipFixtureRoute() {
  return <SeasonChampionshipPlayerRoute mode="fixture" />
}

export function SeasonChampionshipTableRoute() {
  return <SeasonChampionshipPlayerRoute mode="table" />
}

export function SeasonChampionshipFixturesRoute() {
  return <SeasonChampionshipPlayerRoute mode="fixtures" />
}

function SeasonChampionshipPlayerRoute({ mode }: { mode: ChampionshipPageMode }) {
  const state = useSeasonRoute()
  const { userId } = useAuth()
  const { competitionId } = useParams<{ competitionId: string }>()

  return (
    <RouteFrame
      title="Predictor Championship"
      section="games"
      state={state}
      game="championship"
    >
      {(resolved) => {
        const publicCompetitionId = resolved.gameIds.predictor_cup
        if (!publicCompetitionId) return <MissingGame name="The Predictor Championship" />
        if (!competitionId) {
          return (
            <Alert variant="error" title="Championship not found">
              This Championship address is incomplete.
            </Alert>
          )
        }
        return (
          <SeasonChampionshipPlayerRouteBody
            tournamentId={resolved.tournamentId}
            competitionId={competitionId}
            publicCompetitionId={publicCompetitionId}
            userId={userId}
            mode={mode}
          />
        )
      }}
    </RouteFrame>
  )
}

function SeasonChampionshipPlayerRouteBody({
  tournamentId,
  competitionId,
  publicCompetitionId,
  userId,
  mode,
}: {
  tournamentId: string
  competitionId: string
  publicCompetitionId: string
  userId: string | null
  mode: ChampionshipPageMode
}) {
  const gateway = useMemo(
    () => createSeasonCupPlayerViewRpcGateway({ competitionId }),
    [competitionId],
  )
  const registration = useMemo(
    () =>
      userId && competitionId === publicCompetitionId
        ? createSeasonLmsRegistrationRpcGateway({ tournamentId, competitionId, userId })
        : undefined,
    [tournamentId, competitionId, publicCompetitionId, userId],
  )

  return <SeasonChampionshipPlayerPage gateway={gateway} mode={mode} registration={registration} />
}

export function SeasonLeaguesRoute() {
  const state = useSeasonRoute()

  return (
    <RouteFrame title="Leagues" section="leagues" state={state}>
      {(resolved) => {
        const game = resolved.games.find((entry) => entry.gameKey === 'main_predictor')
        if (!game) return <MissingGame name="The Match Predictor" />
        return (
          <SeasonLeaguesRouteBody
            gameCompetitionId={game.id}
            joinedGame={game.membership?.status === 'active'}
          />
        )
      }}
    </RouteFrame>
  )
}

function SeasonLeaguesRouteBody({
  gameCompetitionId,
  joinedGame,
}: {
  gameCompetitionId: string
  joinedGame: boolean
}) {
  const gateway = useMemo(
    () => ({
      load: () => fetchMyGameLeagues(gameCompetitionId),
      create: (name: string) => createGameLeague(gameCompetitionId, name),
      join: (code: string) => joinLeague(code),
    }),
    [gameCompetitionId],
  )

  return (
    <SeasonLeaguesPage
      gateway={gateway}
      gameName="Match Predictor"
      joinedGame={joinedGame}
    />
  )
}

export function SeasonPlayRoute() {
  const state = useSeasonRoute()

  return (
    <RouteFrame title="Play" section="play" state={state}>
      {(resolved) => {
        const base = competitionBase(resolved)
        return (
          <SeasonPlayPage
            overviewHref={base}
            inbox={presentPlayInbox(
              resolved.games,
              base,
              isNextUi('seasonMatchPredictor') ? { main_predictor: 'enabled' } : {},
            )}
          />
        )
      }}
    </RouteFrame>
  )
}
