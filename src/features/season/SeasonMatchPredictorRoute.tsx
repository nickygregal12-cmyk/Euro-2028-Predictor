import { useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import { isNextUi } from '../../app/routeFlags'
import { logicalWeeklyParent, weeklyRoutes } from '../../app/weeklyRoutes'
import { NotFoundPage } from '../notfound/NotFoundPage'
import { createSeasonPlayContextGateway } from '../../services/supabase/seasonPlayContext'
import { fetchSeasonConsensus } from '../../services/supabase/seasonConsensus'
import { createSeasonMatchPredictorRpcGateway } from '../../services/supabase/seasonMatchPredictor'
import { createSeasonGameRegistrationRpcGateway } from '../../services/supabase/seasonGameRegistration'
import { findHubCompetition } from '../hub/competitionCatalogue'
import { seasonBasePath, seasonShellDestinations } from './seasonDestinations'
import type { SeasonPlayContextGateway } from './seasonPlayContextModel'
import { SeasonCompetitionShell } from './SeasonCompetitionShell'
import { SeasonGameSubNav } from './SeasonGameSubNav'
import { SeasonMatchPredictorPage } from './SeasonMatchPredictorPage'
import { useSeasonPlayContext } from './useSeasonPlayContext'
import styles from './SeasonMatchPredictorRoute.module.css'

export type SeasonMatchPredictorRouteProps = {
  contextGateway?: SeasonPlayContextGateway
  now?: () => Date
}

function RouteExits() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const parent = logicalWeeklyParent(pathname)

  return (
    <>
      {parent && parent.href !== weeklyRoutes.hub ? (
        <Button variant="secondary" fullWidth onClick={() => navigate(parent.href)}>
          {parent.label}
        </Button>
      ) : null}
      <Button variant="secondary" fullWidth onClick={() => navigate(weeklyRoutes.hub)}>
        Back to Hub
      </Button>
    </>
  )
}

export function SeasonMatchPredictorRoute({
  contextGateway,
  now,
}: SeasonMatchPredictorRouteProps = {}) {
  const { competitionSlug, seasonSlug } = useParams<{
    competitionSlug: string
    seasonSlug: string
  }>()

  const enabled = isNextUi('seasonMatchPredictor')
  const destinations = seasonShellDestinations(
    seasonBasePath(competitionSlug ?? '', seasonSlug ?? ''),
  )

  const gateway = useMemo(
    () => contextGateway ?? createSeasonPlayContextGateway(),
    [contextGateway],
  )
  const state = useSeasonPlayContext(
    gateway,
    enabled ? competitionSlug : undefined,
    enabled ? seasonSlug : undefined,
  )

  const context = state.kind === 'ready' ? state.context : null
  const cardGateway = useMemo(() => {
    if (context === null) return null
    return createSeasonMatchPredictorRpcGateway({
      tournamentId: context.tournamentId,
      competitionName: context.competitionName,
      seasonLabel: context.seasonLabel,
      timeZone: context.timeZone,
      now: now ?? (() => new Date()),
    })
  }, [context, now])

  // The consensus read, bound to this season. Built here rather than inside the
  // panel so the panel imports no Supabase client — components render read-model
  // output and never call the database themselves.
  const consensusReader = useMemo(() => {
    if (context === null) return undefined
    const tournamentId = context.tournamentId
    return (matchweek: number) => fetchSeasonConsensus(tournamentId, matchweek)
  }, [context])

  const seasonRowName = findHubCompetition(competitionSlug, seasonSlug)?.seasonRowName ?? null
  const registration = useMemo(() => {
    if (seasonRowName === null) return undefined
    return createSeasonGameRegistrationRpcGateway({
      seasonRowName,
      gameKey: 'main_predictor',
    })
  }, [seasonRowName])

  if (!enabled) return <NotFoundPage />

  if (state.kind === 'loading') {
    return (
      <div className={styles.page} aria-busy="true" aria-live="polite">
        <RouteExits />
        <span className={styles.srOnly}>Loading this competition season</span>
        <Skeleton width="40%" height={16} />
        <Skeleton width="70%" height={28} />
        <Skeleton height={220} radius="card" />
      </div>
    )
  }

  if (state.kind === 'unavailable') {
    return (
      <div className={styles.page}>
        <Alert variant="warning" title={state.title}>
          {state.detail}
        </Alert>
        <RouteExits />
      </div>
    )
  }

  if (state.kind === 'season_over') {
    return (
      <SeasonCompetitionShell
        competitionName={state.context.competitionName}
        seasonLabel={state.context.seasonLabel}
        statusStrip={[`${state.context.matchweekCount} matchweeks played`]}
        active="games"
        destinations={destinations}
      >
        <SeasonGameSubNav game="match-predictor" />
        <Alert variant="info" title="This season has no matchweek left to play">
          Every matchweek has passed its lock. Results and standings stay available; there is
          nothing further to enter.
        </Alert>
      </SeasonCompetitionShell>
    )
  }

  if (cardGateway === null) return null

  return (
    <SeasonMatchPredictorPage
      gateway={cardGateway}
      matchweek={state.matchweek}
      competitionName={state.context.competitionName}
      seasonLabel={state.context.seasonLabel}
      destinations={destinations}
      registration={registration}
      consensus={consensusReader}
    />
  )
}
