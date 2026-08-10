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
import { fetchSeasonLeagueStandingsPage } from '../../services/supabase/seasonLeagueStandings'
import { fetchSeasonHeadToHead } from '../../services/supabase/seasonHeadToHead'
import { createSeasonPlayContextGateway } from '../../services/supabase/seasonPlayContext'
import { useSeasonPlayContext } from './useSeasonPlayContext'
import { isNextUi } from '../../app/routeFlags'
import { presentPlayInbox } from './playInboxModel'
import { SeasonCompetitionShell, type SeasonShellSection } from './SeasonCompetitionShell'
import { SeasonGameSubNav } from './SeasonGameSubNav'
import { seasonShellDestinations } from './seasonDestinations'
import { SeasonLeaguesPage } from './SeasonLeaguesPage'
import { SeasonPlayPage } from './SeasonPlayPage'
import { SeasonPeriodStandings } from './SeasonPeriodStandings'
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
  aside,
  asideLabel,
  width,
  children,
}: {
  title: string
  section: SeasonShellSection
  state: RouteState
  game?: DomesticGameRoute
  statusStrip?: readonly string[]
  /**
   * The desktop contextual panel, built from the resolved season like the
   * children are. A function rather than a node because the panel's own
   * gateway needs the season identifiers, which only exist once resolved.
   */
  aside?: (resolved: Resolved) => React.ReactNode
  asideLabel?: string
  width?: 'reading' | 'full'
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
      aside={aside ? aside(state.resolved) : undefined}
      asideLabel={asideLabel}
      width={width}
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
      // The season table is the widest thing in the product: rank, name,
      // matchweeks and points, for a field that can run to hundreds. It earns
      // the full width, and ADR 0012's two retention tables move beside it
      // rather than below it — where, on a desktop, they were previously a
      // scroll away from the table they qualify.
      width="full"
      asideLabel="Monthly and rolling form"
      aside={(resolved) => (
        <SeasonPeriodStandingsPanel tournamentId={resolved.tournamentId} userId={userId} />
      )}
    >
      {(resolved) => (
        <SeasonStandingsRouteBody tournamentId={resolved.tournamentId} userId={userId} />
      )}
    </RouteFrame>
  )
}

function SeasonStandingsRouteBody({
  tournamentId,
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

  // No `periods`: the retention tables are the route's contextual panel now, so
  // passing them here as well would render both twice on a wide screen.
  return <SeasonStandingsPage gameName="Match Predictor" gateway={gateway} />
}

/**
 * ADR 0012's monthly and rolling-form tables, as the standings section's
 * contextual panel.
 *
 * THE SENTENCE THAT SUBORDINATES THEM TRAVELS WITH THEM. `SeasonPeriodStandings`
 * carries its own statement that the cumulative total is the only ranking that
 * decides a season — which matters more beside the table than beneath it, since
 * a panel of equal visual weight is exactly the rival claim ADR 0012 forbids.
 *
 * ABSENT FOR A SIGNED-OUT OR UNRESOLVED CALLER, because the read is addressed by
 * the caller's own entry. An empty panel would be furniture.
 */
function SeasonPeriodStandingsPanel({
  tournamentId,
  userId,
}: {
  tournamentId: string
  userId: string | null
}) {
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
  if (!periods) return null
  return <SeasonPeriodStandings gateway={periods} />
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
            tournamentId={resolved.tournamentId}
            joinedGame={game.membership?.status === 'active'}
          />
        )
      }}
    </RouteFrame>
  )
}

function SeasonLeaguesRouteBody({
  gameCompetitionId,
  tournamentId,
  joinedGame,
}: {
  gameCompetitionId: string
  tournamentId: string
  joinedGame: boolean
}) {
  const { competitionSlug, seasonSlug } = useParams<{
    competitionSlug: string
    seasonSlug: string
  }>()
  // Which matchweek a head-to-head compares. `useSeasonRoute` resolves the
  // season and its games but not its calendar, and contract 121's play context
  // is the read that answers "which matchweek" — the same one the Matches and
  // Match Predictor routes use, so all three agree about where the season is.
  const playContext = useSeasonPlayContext(
    useMemo(() => createSeasonPlayContextGateway(), []),
    competitionSlug,
    seasonSlug,
  )
  const matchweek =
    playContext.kind === 'ready' || playContext.kind === 'season_over'
      ? (playContext.context.matchweek ?? playContext.context.matchweekCount)
      : null

  const headToHead = useMemo(
    () =>
      matchweek === null
        ? undefined
        : {
            matchweek,
            load: (opponentId: string) =>
              fetchSeasonHeadToHead(tournamentId, opponentId, matchweek),
          },
    [tournamentId, matchweek],
  )
  const gateway = useMemo(
    () => ({
      load: () => fetchMyGameLeagues(gameCompetitionId),
      create: (name: string) => createGameLeague(gameCompetitionId, name),
      join: (code: string) => joinLeague(code),
    }),
    [gameCompetitionId],
  )

  // Keyed on nothing: the league id is an argument rather than a closure, so
  // one gateway serves every card and opening a second table does not remake
  // the first one's hook.
  const standings = useMemo(
    () => ({
      load: (leagueId: string, cursor: string | null) =>
        fetchSeasonLeagueStandingsPage(leagueId, { after: cursor }),
    }),
    [],
  )

  return (
    <SeasonLeaguesPage
      gateway={gateway}
      standings={standings}
      gameName="Match Predictor"
      joinedGame={joinedGame}
      headToHead={headToHead}
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
