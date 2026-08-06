import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import { createSeasonPlayContextGateway } from '../../services/supabase/seasonPlayContext'
import { fetchSeasonMatchweekFixtures } from '../../services/supabase/seasonFixtures'
import type { SeasonPlayContextGateway } from './seasonPlayContextModel'
import { SeasonCompetitionShell } from './SeasonCompetitionShell'
import { SeasonMatchesPage } from './SeasonMatchesPage'
import { seasonBasePath, seasonShellDestinations } from './seasonDestinations'
import { useSeasonPlayContext } from './useSeasonPlayContext'
import styles from './SeasonMatchPredictorRoute.module.css'

/**
 * `/competitions/:competitionSlug/:seasonSlug/matches` — §7.3's Matches
 * section on a real route, with real fixtures.
 *
 * IT RESOLVES THROUGH THE PLAY CONTEXT RATHER THAN THROUGH HUB MEMBERSHIP,
 * unlike the game routes beside it, and the difference is the point. The game
 * routes need to know which games a season runs and whether the caller has
 * joined them; Matches needs none of that. Contract 121's read turns the two
 * slugs into a season id, the competition's own timezone, how many matchweeks
 * it has and which one is next — everything a fixture list needs and nothing
 * about the caller. One read, and no membership question asked.
 *
 * A FINISHED SEASON IS NOT A DEAD END HERE. The Match Predictor route stops at
 * `season_over`, correctly — there is nothing left to enter. Matches has the
 * opposite answer: a season with every matchweek played is a season with every
 * result to read, so it opens at the last matchweek instead of refusing.
 *
 * THERE IS NO FLAG ON THIS ROUTE. The Match Predictor is behind one because it
 * writes predictions under lock rules and needed a rollback; this reads
 * fixtures and writes nothing, so the flag would gate a page that cannot cause
 * the harm a flag exists to roll back.
 */

export type SeasonMatchesRouteProps = {
  /** Injected by tests. Production builds the Supabase-backed gateway. */
  contextGateway?: SeasonPlayContextGateway
}

export function SeasonMatchesRoute({ contextGateway }: SeasonMatchesRouteProps = {}) {
  const navigate = useNavigate()
  const { competitionSlug, seasonSlug } = useParams<{
    competitionSlug: string
    seasonSlug: string
  }>()

  const gateway = useMemo(
    () => contextGateway ?? createSeasonPlayContextGateway(),
    [contextGateway],
  )
  const state = useSeasonPlayContext(gateway, competitionSlug, seasonSlug)

  const context = state.kind === 'ready' || state.kind === 'season_over' ? state.context : null
  const tournamentId = context?.tournamentId ?? null

  const fixtures = useMemo(
    () =>
      tournamentId === null
        ? null
        : { load: (matchweek: number) => fetchSeasonMatchweekFixtures(tournamentId, matchweek) },
    [tournamentId],
  )

  if (state.kind === 'loading') {
    return (
      <div className={styles.page} aria-busy="true" aria-live="polite">
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
        <Button variant="primary" fullWidth onClick={() => navigate('/')}>
          Back to hub
        </Button>
      </div>
    )
  }

  // Non-null whenever the state carries a context, but it is built by a hook
  // that cannot be called conditionally, so the narrowing happens here.
  if (context === null || fixtures === null) return null

  const base = seasonBasePath(competitionSlug ?? '', seasonSlug ?? '')

  return (
    <SeasonCompetitionShell
      competitionName={context.competitionName}
      seasonLabel={context.seasonLabel}
      statusStrip={[`${context.matchweekCount} matchweeks`]}
      active="matches"
      destinations={seasonShellDestinations(base)}
    >
      <SeasonMatchesPage
        gateway={fixtures}
        timeZone={context.timeZone}
        // The matchweek about to lock is the one a player is looking for. Once
        // a season has none left, the last one played is.
        openAt={context.matchweek ?? context.matchweekCount}
      />
    </SeasonCompetitionShell>
  )
}
