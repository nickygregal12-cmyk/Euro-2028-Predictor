import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import { createSeasonPlayContextGateway } from '../../services/supabase/seasonPlayContext'
import { fetchSeasonFixtureList } from '../../services/supabase/seasonFixtureList'
import { createSeasonMatchPredictorRpcGateway } from '../../services/supabase/seasonMatchPredictor'
import {
  fetchSeasonClubForm,
  fetchSeasonClubHeadToHead,
} from '../../services/supabase/seasonClubForm'
import type { SeasonClubForm } from '../../services/supabase/seasonClubFormModel'
import type { SeasonFootballContext } from './SeasonMatchCentre'
import { createSeasonLmsRpcGateway } from '../../services/supabase/seasonLms'
import { fetchSeasonLeaveEligibility } from '../../services/supabase/gameLeaveEligibility'
import type { GameLeaveEligibility } from '../../services/supabase/gameLeaveEligibilityModel'
import { seasonEntryStanding } from './seasonEntryStanding'
import type { LmsRoundPage } from './lmsRoundModel'
import type { SeasonPlayContextGateway } from './seasonPlayContextModel'
import { SeasonCompetitionShell } from './SeasonCompetitionShell'
import { SeasonMatchesPage } from './SeasonMatchesPage'
import { seasonBasePath, seasonShellDestinations } from './seasonDestinations'
import { competitionMatchPredictorRoute } from '../../app/weeklyRoutes'
import { isNextUi } from '../../app/routeFlags'
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
        : {
            load: (window: { from?: string; to?: string }) =>
              fetchSeasonFixtureList(tournamentId, window),
          },
    [tournamentId],
  )

  /**
   * The Match Centre's read of the caller's own card, built here because this
   * is where the season id is. It is the SAME gateway the Match Predictor
   * mounts, deliberately: a second decoder over `get_season_matchweek_card`
   * would be a second opinion about the player's own entry, and the two would
   * drift on the first schema change. Only `load` is used — the Match Centre
   * shows what happened and never writes.
   */
  const readCard = useMemo(() => {
    if (!context || tournamentId === null) return undefined
    const gateway = createSeasonMatchPredictorRpcGateway({
      tournamentId,
      competitionName: context.competitionName,
      seasonLabel: context.seasonLabel,
      timeZone: context.timeZone,
      now: () => new Date(),
    })
    return (matchweek: number) => gateway.load(matchweek)
  }, [context, tournamentId])

  /**
   * Contract 141's club form, once per season rather than once per fixture:
   * the read returns every club in one call, so a list showing a fortnight of
   * fixtures costs one request however many clubs appear in it.
   *
   * It fails silently and alone. Form is context beside the answer — a Matches
   * section without it is the section that shipped last week, and one that
   * refused to render because form could not be read would be worse.
   */
  const [clubForm, setClubForm] = useState<readonly SeasonClubForm[] | null>(null)
  useEffect(() => {
    if (tournamentId === null) return
    let active = true
    setClubForm(null)
    fetchSeasonClubForm(tournamentId)
      .then((table) => {
        if (active) setClubForm(table.clubs)
      })
      .catch(() => {
        if (active) setClubForm(null)
      })
    return () => {
      active = false
    }
  }, [tournamentId])

  /**
   * The caller's current Last Man Standing round, so an opened fixture can say
   * whether their survival is riding on it.
   *
   * ONE READ PER SEASON VISIT, not per fixture: the round read takes no round
   * argument and answers the one that is open now, so there is exactly one
   * answer to fetch. A non-entrant gets `entered: false` and the panel says
   * nothing — the read is cheap enough not to be worth gating on membership
   * this surface has not asked about.
   *
   * It fails silently and alone, like club form: a Matches section that refused
   * to render because it could not read an entry in a different game would be
   * worse than one that simply says less.
   */
  const [lmsRound, setLmsRound] = useState<LmsRoundPage | null>(null)
  useEffect(() => {
    if (tournamentId === null) return
    let active = true
    setLmsRound(null)
    createSeasonLmsRpcGateway({ tournamentId })
      .load()
      .then((round) => {
        if (active) setLmsRound(round)
      })
      .catch(() => {
        if (active) setLmsRound(null)
      })
    return () => {
      active = false
    }
  }, [tournamentId])

  /**
   * Contract 140's read, reused for a question it happens to answer: whether
   * this competition runs a Match Predictor and whether the caller is in it.
   * The card read returns an empty card for a non-entrant rather than refusing,
   * so this is the only thing that can tell the panel which it is looking at.
   *
   * Silent on failure, like the other two: the standing then reads `unknown`
   * and the panel says nothing about entry rather than guessing wrong.
   */
  const [eligibility, setEligibility] = useState<readonly GameLeaveEligibility[] | null>(null)
  useEffect(() => {
    if (tournamentId === null) return
    let active = true
    setEligibility(null)
    fetchSeasonLeaveEligibility(tournamentId)
      .then((answer) => {
        if (active) setEligibility(answer.games)
      })
      .catch(() => {
        if (active) setEligibility(null)
      })
    return () => {
      active = false
    }
  }, [tournamentId])

  const football = useMemo<SeasonFootballContext | undefined>(() => {
    // Built once either read has answered, rather than waiting for both: they
    // are independent facts and the panel renders whichever it has.
    if (
      tournamentId === null ||
      (clubForm === null && lmsRound === null && eligibility === null)
    ) {
      return undefined
    }
    // Joined by name because contract 139's fixture read carries no team id.
    // Both names come from `public.teams.name`, so this is an equality on one
    // source of truth rather than a fuzzy match.
    const byName = new Map((clubForm ?? []).map((club) => [club.name, club]))
    return {
      // Only once the form read has answered. Supplying a lookup that returns
      // null for everything would render both clubs as having played nothing.
      formFor: clubForm === null ? undefined : (name: string) => byName.get(name) ?? null,
      headToHead: (teamId: string, opponentId: string) =>
        fetchSeasonClubHeadToHead(tournamentId, teamId, opponentId),
      lmsRound,
      entryStanding: seasonEntryStanding(eligibility),
    }
  }, [tournamentId, clubForm, lmsRound, eligibility])

  /**
   * Where a fixture's matchweek is predicted.
   *
   * Behind the same flag as the route it points at — a link to a page that
   * renders Not Found is the dead control this batch is removing — and absent
   * for a caller with no entry, since there is no card of theirs to open.
   */
  const predictHref = useMemo(() => {
    if (!isNextUi('seasonMatchPredictor')) return undefined
    if (seasonEntryStanding(eligibility) !== 'entered') return undefined
    const ref = { competitionSlug: competitionSlug ?? '', seasonSlug: seasonSlug ?? '' }
    return (matchweek: number) => competitionMatchPredictorRoute(ref, matchweek)
  }, [eligibility, competitionSlug, seasonSlug])

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
      {/* No `openAt`. The window is the server's default — the last week and
          the next fortnight — because "what is on around now" is the question
          this section answers, and anchoring it to a matchweek is what filed a
          postponed November fixture under a September heading. */}
      {/* No `timeZone`. Kickoffs resolve in the VIEWER's own zone under the
          10 August direction; the competition's persisted zone stays with the
          calendar it belongs to. */}
      <SeasonMatchesPage
        gateway={fixtures}
        readMatchweekCard={readCard}
        football={football}
        predictHref={predictHref}
      />
    </SeasonCompetitionShell>
  )
}
