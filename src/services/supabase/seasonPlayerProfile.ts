import { db } from './client'
import {
  mapSeasonPlayerProfile,
  type SeasonPlayerProfile,
} from './seasonPlayerProfileModel'

/**
 * Query wrappers for the two addresses a season player profile has.
 *
 * The co-membership disclosure boundary, the per-matchweek reveal and the
 * settled-only accuracy counts are all the RPC's; this file only calls it. The
 * decoder in `seasonPlayerProfileModel.ts` is pure so the entered and
 * not-entered answers are testable without a client.
 */
export type {
  SeasonPlayerProfile,
  SeasonProfileAccuracy,
  SeasonProfileJokers,
  SeasonProfileMatchweek,
  SeasonProfilePlayer,
  SeasonProfileSeason,
} from './seasonPlayerProfileModel'

/**
 * WHETHER AN ERROR FROM THIS READ IS THE PRIVACY BOUNDARY RATHER THAN A FAULT.
 *
 * Contract 151 raises `insufficient_privilege` when the caller shares no
 * private league with the player, and that refusal is a STATE: it must reach
 * the reader as "you do not share a private league with this player" and never
 * as "something went wrong". Two surfaces now need to tell the two apart —
 * the production season route and the vNext profile — and this lives beside the
 * read so there is one predicate rather than two that drift.
 *
 * It is a predicate rather than a thrown class on purpose: `fetchSeasonPlayerProfile`
 * already has callers that receive the raw error, and turning its rejection
 * into a new type would change what they see. The two contract-192 reads are
 * new and do throw typed refusals.
 */
export function seasonProfileRefused(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const row = error as { code?: unknown; message?: unknown }
  if (row.code === '42501' || row.code === 'insufficient_privilege') return true
  return typeof row.message === 'string' && row.message.includes('do not share a private league')
}

export async function fetchSeasonPlayerProfile(
  tournamentId: string,
  playerId: string,
): Promise<SeasonPlayerProfile> {
  const { data, error } = await db.rpc('get_season_player_profile', {
    p_tournament_id: tournamentId,
    p_player_id: playerId,
  })
  if (error) throw error
  return mapSeasonPlayerProfile(data)
}

/**
 * CONTRACT 206 / PROF-001 — the same profile, addressed by the season ref.
 *
 * ============================ WHY THERE ARE TWO ADDRESSES ================
 *
 * Contract 151 answers a caller who shares a PRIVATE LEAGUE with the player,
 * and it is addressed by the target's account id — which the leaderboard only
 * reveals at that same boundary. Contract 206 answers a caller who is merely in
 * the SAME SEASON, and it is addressed by the season-scoped entry ref, because
 * that boundary deliberately reveals no account id at all. The migration says so
 * in terms: *"player_ref is the only navigation identity exposed by this path."*
 *
 * So this is not a convenience overload. The two functions exist because the two
 * boundaries hand a caller two different identities, and a surface that had to
 * invent the missing one would be inventing a permission.
 *
 * IT DECIDES NOTHING. The reach test, the season-membership check and the
 * bounded payload are all the RPC's; a `compare` caller gets less than a
 * `profile` caller and neither gets the target's UUID. This file only calls it,
 * and `mapSeasonPlayerProfile` decodes both because both return the same
 * payload shape.
 */
export async function fetchSeasonPlayerProfileByRef(
  tournamentId: string,
  playerRef: string,
): Promise<SeasonPlayerProfile> {
  const { data, error } = await db.rpc('get_season_player_profile_by_ref', {
    p_tournament_id: tournamentId,
    p_player_ref: playerRef,
  })
  if (error) throw error
  return mapSeasonPlayerProfile(data)
}
