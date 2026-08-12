import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import { isNextUi } from '../../app/routeFlags'
import {
  competitionMatchPredictorRoute,
  logicalWeeklyParent,
  weeklyRoutes,
} from '../../app/weeklyRoutes'
import { NotFoundPage } from '../notfound/NotFoundPage'
import { createSeasonPlayContextGateway } from '../../services/supabase/seasonPlayContext'
import { fetchSeasonConsensus } from '../../services/supabase/seasonConsensus'
import { fetchSeasonClubForm } from '../../services/supabase/seasonClubForm'
import type { SeasonClubForm } from '../../services/supabase/seasonClubFormModel'
import { createSeasonMatchPredictorRpcGateway } from '../../services/supabase/seasonMatchPredictor'
import { createSeasonGameRegistrationRpcGateway } from '../../services/supabase/seasonGameRegistration'
import { useHubCompetition } from '../hub/useHubCompetition'
import { seasonBasePath, seasonShellDestinations } from './seasonDestinations'
import type { SeasonPlayContextGateway } from './seasonPlayContextModel'
import { SeasonCompetitionShell } from './SeasonCompetitionShell'
import { SeasonGameSubNav } from './SeasonGameSubNav'
import { SeasonMatchPredictorPage } from './SeasonMatchPredictorPage'
import { useSeasonPlayContext } from './useSeasonPlayContext'
import { competitionTableLookup, useCompetitionTable } from './useCompetitionTable'
import { useOptionalAuth } from '../auth/AuthProvider'
import type { OfflineDraftingOptions } from './useSeasonMatchPredictor'
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

  const [search] = useSearchParams()
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

  /**
   * Contract 141's club form for the whole season, for the panel's football
   * half (`UI-F06`).
   *
   * ONE READ PER SEASON VISIT, not one per fixture: the read takes no fixture
   * and returns every club in the competition, so a card of ten costs one
   * request. The Matches section does exactly this for the same reason.
   *
   * IT FAILS SILENTLY AND ALONE. Form is context beside the prediction card;
   * a matchweek that refused to open because a form read failed would be far
   * worse than one that simply says less. Null then means "not read", which
   * the model keeps distinct from "no club has played".
   */
  const [clubForm, setClubForm] = useState<
    { clubs: readonly SeasonClubForm[]; matches: number } | null
  >(null)
  const formSeasonId = context?.tournamentId ?? null
  useEffect(() => {
    if (formSeasonId === null) return
    let active = true
    setClubForm(null)
    fetchSeasonClubForm(formSeasonId)
      .then((table) => {
        if (active) setClubForm({ clubs: table.clubs, matches: table.matches })
      })
      .catch(() => {
        if (active) setClubForm(null)
      })
    return () => {
      active = false
    }
  }, [formSeasonId])

  /**
   * Contract 160's table, for the insight panel's standing line.
   *
   * ONE READ PER SEASON VISIT, like the form beside it, and through the same
   * hook the Matches route uses — so the position a player reads beside the
   * prediction card is the one they read on the fixture they open afterwards.
   * A competition that is not a league season has no table and the RPC refuses
   * it; that resolves to `unavailable` and the standing line is simply absent.
   */
  const readTable = useMemo(
    () =>
      formSeasonId === null
        ? undefined
        : () =>
            import('../../services/supabase/competitionTable').then(
              ({ fetchCompetitionTable }) => fetchCompetitionTable(formSeasonId),
            ),
    [formSeasonId],
  )
  const table = useCompetitionTable(readTable)

  // The season's stored row name, from the server's own catalogue (contract
  // 147). Null while the catalogue is still being read, which withholds the
  // registration gateway rather than building one against a guessed name.
  const catalogueEntry = useHubCompetition(competitionSlug, seasonSlug)
  const seasonRowName =
    catalogueEntry.status === 'ready' ? catalogueEntry.competition.seasonRowName : null
  const registration = useMemo(() => {
    if (seasonRowName === null) return undefined
    return createSeasonGameRegistrationRpcGateway({
      seasonRowName,
      gameKey: 'main_predictor',
    })
  }, [seasonRowName])

  /**
   * Which matchweek to open at.
   *
   * The play context answers "the one you can play now", which is the right
   * default and was until now the only answer — so a player looking at a
   * September fixture could not reach the card that predicts it. `?matchweek=`
   * names one instead.
   *
   * IT FALLS BACK RATHER THAN REFUSING. An absent, unparseable or out-of-range
   * value opens the current matchweek, because a stale or shared link should
   * land somewhere useful rather than on an error. The season's own matchweek
   * count is the bound; nothing here trusts the number into a read.
   *
   * IT IS RESOLVED ABOVE THE GUARDS BELOW because the offline-drafting hook
   * needs it, and a hook after an early return is a hook that is sometimes not
   * called. The context is nullable here for the same reason.
   */
  const playable = state.kind === 'ready' ? state : null
  const requested = Number(search.get('matchweek'))
  const withinSeason =
    playable !== null &&
    Number.isInteger(requested) &&
    requested >= 1 &&
    requested <= playable.context.matchweekCount
  const matchweek = withinSeason ? requested : (playable?.matchweek ?? 1)

  // INNOV-020. Null unless there is an account, a season and usable storage.
  const offline = useOfflineDrafting(playable?.context.tournamentId ?? null, matchweek)

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

  if (cardGateway === null || playable === null) return null

  return (
    <SeasonMatchPredictorPage
      gateway={cardGateway}
      matchweek={matchweek}
      // INNOV-020. Supplied only where all three things a draft needs exist —
      // an account to scope it to, a season, and a browser with storage. Any
      // of them missing leaves offline drafting off rather than half on.
      offline={offline ?? undefined}
      competitionName={playable.context.competitionName}
      seasonLabel={playable.context.seasonLabel}
      destinations={destinations}
      registration={registration}
      consensus={consensusReader}
      // UI-F06's football half. Contract 141's form and contract 160's
      // position, each read once for the season above.
      clubForm={clubForm}
      tableFor={competitionTableLookup(table)}
      // Built here rather than in the page: URL construction belongs to the
      // route authority, and this is the same builder the Match Centre's link
      // into this card already uses.
      matchweekHref={(target) =>
        competitionMatchPredictorRoute(
          { competitionSlug: competitionSlug ?? '', seasonSlug: seasonSlug ?? '' },
          target,
        )
      }
    />
  )
}

/**
 * `INNOV-020` — the device half of offline drafting, assembled where the route
 * knows the account and the matchweek.
 *
 * IT IS NULL UNLESS EVERY PART EXISTS. No signed-in user, no season, or no
 * `localStorage` (private mode, a disabled setting, a non-browser render) each
 * leave offline drafting off. A partly-wired draft store is worse than none: it
 * would hold work it cannot scope to an account, and a shared device would show
 * one player another's predictions.
 *
 * THE CLOCK IT CARRIES IS FOR DISPLAY ONLY. It stamps "saved on this device"
 * and reaches no server: contract 177 accepts no instant at all.
 */
function useOfflineDrafting(
  tournamentId: string | null,
  matchweek: number,
): OfflineDraftingOptions | null {
  // Optional on purpose: offline drafting is absent without an account, and a
  // shell rendered outside the provider must lose the drafting rather than the
  // page. Nothing here gates access.
  const userId = useOptionalAuth()?.userId ?? null

  return useMemo(() => {
    if (!userId || !tournamentId) return null

    let storage: Storage
    try {
      // Touched rather than assumed: Safari's private mode has thrown on
      // access rather than on write, and a throw here would take the page down.
      storage = window.localStorage
      const probe = 'fph.storageProbe'
      storage.setItem(probe, '1')
      storage.removeItem(probe)
    } catch {
      return null
    }

    return {
      storage,
      scope: { userId, tournamentId, matchweek },
      now: () => new Date(),
      isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
      subscribeOnline: (listener) => {
        window.addEventListener('online', listener)
        return () => window.removeEventListener('online', listener)
      },
    }
  }, [userId, tournamentId, matchweek])
}
