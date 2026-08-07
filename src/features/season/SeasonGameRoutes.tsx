import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { Alert, Skeleton } from '../../design-system'
import { competitionRoute } from '../../app/weeklyRoutes'
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
import { createSeasonCupRpcGateway } from '../../services/supabase/seasonCup'
import { createGameLeague, fetchMyGameLeagues } from '../../services/supabase/gameLeagues'
import { joinLeague } from '../../services/supabase/leagues'
import { isNextUi } from '../../app/routeFlags'
import { presentPlayInbox } from './playInboxModel'
import { SeasonCompetitionShell, type SeasonShellSection } from './SeasonCompetitionShell'
import { seasonShellDestinations } from './seasonDestinations'
import { SeasonLeaguesPage } from './SeasonLeaguesPage'
import { SeasonPlayPage } from './SeasonPlayPage'
import { SeasonStandingsPage } from './SeasonStandingsPage'
import { SeasonLmsPage } from './SeasonLmsPage'
import { SeasonCupPhasePage } from './SeasonCupPhasePage'
import s from '../shared.module.css'

/**
 * The production routes for the season game surfaces.
 *
 * WHAT THESE ADD is the layer the pages were built without: URL resolution.
 * Each page has been production code for some time and reachable only from a
 * DEV harness, because nothing turned `/competitions/premier-league/2026-27`
 * into the season and competition identifiers its gateway needs. That is all
 * these containers do — resolve identity, then mount the page that already
 * exists.
 *
 * IDENTITY IS RESOLVED FROM SERVER DATA, NOT FROM THE SLUG. The catalogue maps
 * the URL to the exact `tournaments.name` the C1 migrations created, and
 * `fetchHubMembership` turns that into the season's id and its games' ids. The
 * slug never becomes an identifier: `competitions.slug` is not browser-readable
 * and deriving one client-side would silently disagree with the server's rule.
 *
 * A GAME THE SEASON DOES NOT HOLD IS AN ERROR, NOT AN EMPTY PAGE. If the
 * catalogue names a game and the database does not list it, that is a
 * disagreement worth showing rather than a surface to render blank — the
 * empty-versus-failed line every read in this repository is held to.
 */

type Resolved = {
  competition: HubCompetition
  tournamentId: string
  /** Game competition ids by key, as the season's catalogue lists them. */
  gameIds: Partial<Record<CompetitionGameKey, string>>
  /** The season's games as the server listed them, membership included. */
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

/**
 * Every season game page renders inside the competition shell, exactly as the
 * Match Predictor route does. The shell supplies competition identity and the
 * competition sub-navigation; this only decides which section is current and
 * what the status strip says.
 *
 * Before the season resolves there is no competition to name, so the shell is
 * not rendered with a placeholder identity — a masthead reading "Competition"
 * would be furniture asserting something untrue. The skeleton stands alone
 * until the name is a fact.
 */
function RouteFrame({
  title,
  section,
  state,
  statusStrip = [],
  children,
}: {
  title: string
  section: SeasonShellSection
  state: RouteState
  statusStrip?: readonly string[]
  children: (resolved: Resolved) => React.ReactNode
}) {
  if (state.status === 'loading') {
    return (
      <div className={s.page}>
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
      {children(state.resolved)}
    </SeasonCompetitionShell>
  )
}

function competitionBase(resolved: Resolved): string {
  return competitionRoute(resolved.competition)
}

/** A game the catalogue names and the season does not list. Shown, not hidden. */
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
    <RouteFrame title="Match Predictor standings" section="games" state={state}>
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

  return (
    <SeasonStandingsPage gameName="Match Predictor" gateway={gateway} periods={periods} />
  )
}

export function SeasonLmsRoute() {
  const state = useSeasonRoute()
  const { userId } = useAuth()

  return (
    <RouteFrame title="Last Man Standing" section="games" state={state}>
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

export function SeasonChampionshipRoute() {
  const state = useSeasonRoute()
  const { userId } = useAuth()

  return (
    <RouteFrame title="Predictor Championship" section="games" state={state}>
      {(resolved) => {
        const competitionId = resolved.gameIds.predictor_cup
        if (!competitionId) return <MissingGame name="The Predictor Championship" />
        return (
          <SeasonChampionshipRouteBody
            tournamentId={resolved.tournamentId}
            competitionId={competitionId}
            userId={userId}
          />
        )
      }}
    </RouteFrame>
  )
}

function SeasonChampionshipRouteBody({
  tournamentId,
  competitionId,
  userId,
}: {
  tournamentId: string
  competitionId: string
  userId: string | null
}) {
  const gateway = useMemo(
    () => createSeasonCupRpcGateway({ competitionId }),
    [competitionId],
  )
  const registration = useMemo(
    () =>
      userId
        ? createSeasonLmsRegistrationRpcGateway({ tournamentId, competitionId, userId })
        : undefined,
    [tournamentId, competitionId, userId],
  )

  return <SeasonCupPhasePage gateway={gateway} registration={registration} />
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
              // The flag decides whether the Match Predictor surface is
              // available; the route authority constructs its address.
              isNextUi('seasonMatchPredictor') ? { main_predictor: 'enabled' } : {},
            )}
          />
        )
      }}
    </RouteFrame>
  )
}
