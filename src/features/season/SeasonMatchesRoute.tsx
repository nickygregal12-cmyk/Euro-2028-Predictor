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

  const football = useMemo<SeasonFootballContext | undefined>(() => {
    if (tournamentId === null || clubForm === null) return undefined
    // Joined by name because contract 139's fixture read carries no team id.
    // Both names come from `public.teams.name`, so this is an equality on one
    // source of truth rather than a fuzzy match.
    const byName = new Map(clubForm.map((club) => [club.name, club]))
    return {
      formFor: (name: string) => byName.get(name) ?? null,
      headToHead: (teamId: string, opponentId: string) =>
        fetchSeasonClubHeadToHead(tournamentId, teamId, opponentId),
    }
  }, [tournamentId, clubForm])

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
      <SeasonMatchesPage
        gateway={fixtures}
        timeZone={context.timeZone}
        readMatchweekCard={readCard}
        football={football}
      />
    </SeasonCompetitionShell>
  )
}
