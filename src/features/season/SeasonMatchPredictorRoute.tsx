import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import { isNextUi } from '../../app/routeFlags'
import { NotFoundPage } from '../notfound/NotFoundPage'
import { createSeasonPlayContextGateway } from '../../services/supabase/seasonPlayContext'
import { createSeasonMatchPredictorRpcGateway } from '../../services/supabase/seasonMatchPredictor'
import type { SeasonPlayContextGateway } from './seasonPlayContextModel'
import { SeasonCompetitionShell } from './SeasonCompetitionShell'
import { SeasonMatchPredictorPage } from './SeasonMatchPredictorPage'
import { useSeasonPlayContext } from './useSeasonPlayContext'
import styles from './SeasonMatchPredictorRoute.module.css'

/**
 * `/competitions/:competitionSlug/:seasonSlug/main-predictor` — the season
 * Match Predictor on a real route, with real data.
 *
 * The page below this has been production code since UI-04 and reachable only
 * from `/dev/season-predictor`. What kept it off the route table was never the
 * page: it was that no browser role could turn the two slugs in a URL into a
 * season, or say which matchweek that season's card should open at. Contract
 * 120 answers both, so this composes the two gateways the page needs and does
 * nothing else — it computes no lock, no matchweek and no allowance of its own.
 *
 * WHY THE FLAG RENDERS A 404 RATHER THAN A DEGRADED PAGE. §13.4 makes rollback
 * a release gate: turning the flag off must restore the previous journey with
 * no data rollback. The previous journey at this address is that the address
 * did not exist, so that is exactly what the off branch restores. There is no
 * spare implementation kept alive for the purpose, because there was never a
 * legacy season card to keep.
 *
 * WHY THE GATEWAYS ARE MEMOISED ON THEIR INPUTS. The card gateway holds the
 * per-fixture version map that makes a concurrent edit refuse instead of
 * overwriting. Rebuilding it on every render would empty that map continuously,
 * and the first save after each render would be sent with version 0 — which the
 * database would either refuse or, worse, accept as a first write. It is
 * rebuilt exactly when the season it belongs to changes.
 */

export type SeasonMatchPredictorRouteProps = {
  /** Injected by tests. Production builds the Supabase-backed gateway. */
  contextGateway?: SeasonPlayContextGateway
  /** Injected by tests so a fixed clock can drive the lock presentation. */
  now?: () => Date
}

export function SeasonMatchPredictorRoute({
  contextGateway,
  now,
}: SeasonMatchPredictorRouteProps = {}) {
  const navigate = useNavigate()
  const { competitionSlug, seasonSlug } = useParams<{
    competitionSlug: string
    seasonSlug: string
  }>()

  const enabled = isNextUi('seasonMatchPredictor')

  const gateway = useMemo(
    () => contextGateway ?? createSeasonPlayContextGateway(),
    [contextGateway],
  )
  const state = useSeasonPlayContext(
    gateway,
    enabled ? competitionSlug : undefined,
    enabled ? seasonSlug : undefined,
  )

  // Only a season with an open matchweek gets a card gateway. A finished season
  // has a page of its own and no card, and building the gateway anyway would
  // create the per-fixture version map for a card that never renders.
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

  if (!enabled) return <NotFoundPage />

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

  if (state.kind === 'season_over') {
    return (
      <SeasonCompetitionShell
        competitionName={state.context.competitionName}
        seasonLabel={state.context.seasonLabel}
        statusStrip={[`${state.context.matchweekCount} matchweeks played`]}
        active="play"
      >
        <Alert variant="info" title="This season has no matchweek left to play">
          Every matchweek has passed its lock. Results and standings stay available; there is
          nothing further to enter.
        </Alert>
      </SeasonCompetitionShell>
    )
  }

  // `cardGateway` is non-null whenever the state carries a context, but it is
  // built by a hook that cannot be called conditionally, so the narrowing has
  // to happen here rather than in the type.
  if (cardGateway === null) return null

  return <SeasonMatchPredictorPage gateway={cardGateway} matchweek={state.matchweek} />
}
