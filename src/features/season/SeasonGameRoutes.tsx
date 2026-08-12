import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import {
  competitionChampionshipInstanceRoute,
  competitionChampionshipTableRoute,
  competitionPlayerRoute,
  competitionRoute,
  logicalWeeklyParent,
  weeklyRoutes,
  type DomesticGameRoute,
} from '../../app/weeklyRoutes'
import { useAuth } from '../auth/AuthProvider'
import type { HubCompetition } from '../hub/competitionCatalogue'
import { useHubCompetition } from '../hub/useHubCompetition'
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
import { rotateLeagueInviteCode } from '../../services/supabase/leagues'
import { useSeasonRoundId } from './useSeasonRoundId'
import { fetchSeasonLeagueMatchweekPredictions } from '../../services/supabase/seasonLeaguePredictions'
import { fetchSeasonLeagueMovement } from '../../services/supabase/seasonLeagueMovement'
import { SeasonPlayPage } from './SeasonPlayPage'
import { SeasonLmsFormGuide } from './SeasonLmsFormGuide'
import { presentLmsFormGuide, type LmsFormGuide } from './lmsFormGuideModel'
import { fetchSeasonClubForm } from '../../services/supabase/seasonClubForm'
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
  // The catalogue is the server's (contract 147) and arrives asynchronously, so
  // "not yet read" stays a loading state rather than becoming "no such season".
  const resolved = useHubCompetition(competitionSlug, seasonSlug)
  const competition = resolved.status === 'ready' ? resolved.competition : null
  const seasonRowName = competition?.seasonRowName ?? null

  useEffect(() => {
    if (resolved.status === 'loading') {
      setState({ status: 'loading' })
      return
    }
    if (!competition || !seasonRowName) {
      setState({
        status: 'failed',
        message:
          resolved.status === 'failed'
            ? 'The competition list could not be read right now.'
            : 'This competition season could not be found.',
      })
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
  }, [competition, seasonRowName, resolved.status])

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
              // Contract 131's names, asked for. These tables sit directly
              // beneath the season leaderboard, which already names every
              // entrant, so this discloses nothing new — and without it every
              // row of the monthly table and the form table reads "Entrant",
              // which is a rank against a word.
              fetchSeasonPeriodStandings(tournamentId, period, undefined, true),
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
    <RouteFrame
      title="Last Man Standing"
      section="games"
      state={state}
      game="lms"
      // The decision this page asks for is "which of these clubs wins", and
      // contract 141's form read answers it for the whole season in one
      // request. It duplicates nothing: the pick list is fixtures in kickoff
      // order, this is clubs in form order, and it recommends nothing.
      asideLabel="Form guide"
      aside={(resolved) =>
        resolved.gameIds.last_man_standing ? (
          <SeasonLmsFormPanel tournamentId={resolved.tournamentId} />
        ) : undefined
      }
    >
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
  // Contract 164's field. Memoised on the season id alone, so it does not
  // re-read on every render of the route around it.
  const readField = useMemo(
    () => () =>
      import('../../services/supabase/seasonLmsField').then(({ fetchSeasonLmsField }) =>
        fetchSeasonLmsField(tournamentId),
      ),
    [tournamentId],
  )

  return (
    <SeasonLmsPage
      gateway={gateway}
      now={now}
      registration={registration}
      readField={readField}
    />
  )
}

/**
 * The Last Man Standing contextual panel.
 *
 * IT READS THE ROUND AGAIN, and that is a deliberate cost rather than an
 * oversight. The alternative is lifting the round state out of `SeasonLmsPage`
 * so the panel can share it, which would make the page's own state machine —
 * pick, conflict, reload — the route's business. Two cheap reads is a better
 * trade than one shared mutable state across a component boundary, and the
 * panel is read-only.
 *
 * BOTH READS FAIL SILENTLY AND ALONE. A form guide is context beside the
 * answer; a panel that took the pick list down with it would be the opposite of
 * useful.
 */
function SeasonLmsFormPanel({ tournamentId }: { tournamentId: string }) {
  const [guide, setGuide] = useState<LmsFormGuide | null>(null)

  useEffect(() => {
    let active = true
    setGuide(null)
    void (async () => {
      const [round, form] = await Promise.all([
        // `Promise.resolve().then(...)` rather than calling the gateway
        // directly: BUILDING it can throw synchronously, and a synchronous
        // throw escapes the rejection handler two lines below — the panel
        // would take the page's error boundary with it instead of failing
        // silently, which is the one thing this component promises not to do.
        Promise.resolve()
          .then(() => createSeasonLmsRpcGateway({ tournamentId }).load())
          .then(
            (page) => page,
            () => null,
          ),
        fetchSeasonClubForm(tournamentId).then(
          (table) => table.clubs,
          () => null,
        ),
      ])
      if (!active) return
      setGuide(presentLmsFormGuide(round, form, round?.pick?.teamId ?? null))
    })()
    return () => {
      active = false
    }
  }, [tournamentId])

  if (!guide) return null
  return <SeasonLmsFormGuide guide={guide} />
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
      // My Fixture composes its own two-column layout, because the panel is
      // built from the view that page already loaded; the shell therefore
      // stops capping the content at a reading column and lets it.
      width={mode === 'fixture' ? 'full' : 'reading'}
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
            tableHref={competitionChampionshipTableRoute(
              resolved.competition,
              competitionId,
            )}
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
  tableHref,
}: {
  tournamentId: string
  competitionId: string
  publicCompetitionId: string
  userId: string | null
  mode: ChampionshipPageMode
  tableHref: string
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

  // Contract 167's group stage, bound to this Championship instance.
  const readGroupStage = useMemo(
    () => () =>
      import('../../services/supabase/seasonCupGroupStage').then(
        ({ fetchSeasonCupGroupStage }) => fetchSeasonCupGroupStage(competitionId),
      ),
    [competitionId],
  )

  return (
    <SeasonChampionshipPlayerPage
      gateway={gateway}
      mode={mode}
      registration={registration}
      tableHref={tableHref}
      readGroupStage={readGroupStage}
    />
  )
}

export function SeasonLeaguesRoute() {
  const state = useSeasonRoute()

  return (
    <RouteFrame
      title="Leagues"
      section="leagues"
      state={state}
      // An open league's Matchweek tab is a comparison matrix across every
      // fixture in the matchweek, and a 820px reading column made it scroll
      // inside its own container on a 1440px screen while 600px sat empty
      // beside it. The matrix is the widest thing this section holds, so the
      // section takes the width. The phone layout is untouched: below the
      // shell's own cap this is one column either way.
      width="full"
    >
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

  // Contracts 149 and 150 are addressed by the ROUND, and contract 121 answers
  // in matchweek numbers. `useSeasonRoundId` resolves one to the other from the
  // fixtures, which is the only browser read carrying both.
  const competitionRoundId = useSeasonRoundId(tournamentId, matchweek)

  const playerHref = useMemo(() => {
    const ref = { competitionSlug: competitionSlug ?? '', seasonSlug: seasonSlug ?? '' }
    return (playerId: string) => competitionPlayerRoute(ref, playerId)
  }, [competitionSlug, seasonSlug])

  const loadMovement = useMemo(
    // No round named: contract 150 answers for the most recent SETTLED
    // matchweek, which is the question the league card is really asking.
    () => (leagueId: string) => fetchSeasonLeagueMovement(leagueId),
    [],
  )

  return (
    <SeasonLeaguesPage
      gateway={gateway}
      standings={standings}
      gameName="Match Predictor"
      joinedGame={joinedGame}
      rotateInviteCode={rotateLeagueInviteCode}
      headToHead={headToHead}
      competitionRoundId={competitionRoundId}
      loadMatchweek={fetchSeasonLeagueMatchweekPredictions}
      loadMovement={loadMovement}
      playerHref={playerHref}
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
