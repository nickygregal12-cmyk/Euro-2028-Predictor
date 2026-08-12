// Contract 175's `get_season_matchweek_projection` — the What-If projection,
// from the authority rather than from the browser.
//
// ONE CALL ANSWERS THE WHOLE MATCHWEEK. The read is keyed on the season and the
// matchweek, not on a fixture, because the number a player actually cares about
// — "what would the next goal make my matchweek worth" — is a matchweek total.
// A per-fixture read would have to be folded back into one anyway, in the
// browser, which is the derivation this contract exists to remove.
//
// THE LEAGUE ARGUMENT IS OPTIONAL AND THE SERVER OWNS ITS REVEAL. Passing a
// league the caller is not in, or that is not on this season, RAISES. Passing
// one before the matchweek's own lock returns the block with `revealed: false`
// and no member rows at all — a payload rather than a refusal, because "not
// yet" and "not yours" must not look the same on screen.
//
// A REFUSAL IS SEPARATED FROM A FAULT. `42501` covers "not authenticated" and
// "you have not entered this season"; both mean there is nothing to project and
// nothing to retry, so they surface as one typed error the caller can render as
// an absence rather than as a broken page.

import { db } from './client'
import {
  mapSeasonMatchweekProjection,
  type SeasonMatchweekProjection,
} from './seasonMatchweekProjectionModel'

export type {
  SeasonMatchweekProjection,
  ProjectionFixture,
  ProjectionBranch,
  ProjectionBasis,
  ProjectionLeague,
  ProjectionLeagueRow,
  ProjectionScore,
} from './seasonMatchweekProjectionModel'

/**
 * The caller may not project this matchweek — unauthenticated, or holding no
 * entry in the season. It lives here rather than in the pure model because it
 * is a fact about the call, and the model must stay importable without the
 * configured client.
 */
export class ProjectionUnavailableError extends Error {
  constructor() {
    super('This matchweek cannot be projected for you')
    this.name = 'ProjectionUnavailableError'
  }
}

function isRefusal(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === '42501' || code === 'insufficient_privilege'
}

export async function fetchSeasonMatchweekProjection(
  tournamentId: string,
  matchweek: number,
  leagueId?: string | null,
): Promise<SeasonMatchweekProjection> {
  const { data, error } = await db.rpc('get_season_matchweek_projection', {
    p_tournament_id: tournamentId,
    p_matchweek: matchweek,
    // Omitted rather than sent as null, so the server's own default applies and
    // the call shape matches "no league was asked about".
    ...(leagueId ? { p_league_id: leagueId } : {}),
  })
  if (error) {
    if (isRefusal(error)) throw new ProjectionUnavailableError()
    throw error
  }
  return mapSeasonMatchweekProjection(data)
}
