import type { SeasonLeaderboardPage } from '../../../services/supabase/seasonLeaderboardModel'
import type { SeasonLeagueStandingsPage } from '../../../services/supabase/seasonLeagueStandingsModel'
import type { SeasonLeagueMovement } from '../../../services/supabase/seasonLeagueMovementModel'
import type { GameLeague } from '../../../services/supabase/gameLeagues'

/**
 * WHAT THE REAL APPLICATION HANDS vNEXT LEAGUES.
 *
 * ============================ FOUR READS, EACH ALREADY AUTHORITATIVE ======
 *
 *   contract 191  `get_season_leaderboard`        the competition season's table
 *   —             `get_my_game_leagues`           the caller's private leagues
 *   contract 128  `get_season_league_standings`   ONE league's own table
 *   contract 150  `get_season_league_movement`    what one SETTLED matchweek did
 *
 * ============================ THE TWO TABLES ARRIVE SEPARATELY ============
 *
 * And they must. `seasonLeagueStandingsModel.ts` records why: a private league's
 * totals come from `season_standings` so it cannot disagree with the season, but
 * its RANK is recomputed inside the league — so the same two players carry
 * different ranks in the two payloads. This source therefore carries two
 * different page types rather than one, and the mapper builds two different
 * models from them. A single "standings" field here would be the first step
 * toward a single presenter, which is how a competition-wide ranking gets
 * asserted by accident.
 *
 * ============================ ONE TABLE AT A TIME ========================
 *
 * `global` and `league` are both nullable and exactly one is populated per
 * render, because the page shows one table. Reading both on every visit would
 * double the cost of a surface whose whole job is to show the one the player
 * chose.
 *
 * ============================ NO PER-ROW READ, EVER ======================
 *
 * There is no field here that a per-player request would fill, and that is the
 * N+1 prevention: contract 191 already carries the reach and the id a row needs
 * to decide whether it is openable, and contract 128 already carries `isYou`,
 * `isOwner` and `hasEntry`. A standings list of fifty costs the same as a list
 * of five. `LeaguePlayer` has no field a profile read would supply, so a row
 * cannot start asking even by accident — the same discipline Stage 8 used to
 * keep head-to-head out of a fixture list.
 *
 * ============================ NOTHING HERE IS A CLOCK ====================
 *
 * `generatedAt` is supplied by the caller, so the mapper is pure and a test can
 * pin an instant.
 */

/** The competition season and the game these standings rank. */
export type LeaguesSourceContext = {
  readonly tournamentId: string
  readonly competitionName: string
  readonly seasonLabel: string
  /**
   * The game whose standings these are. A private league belongs to exactly one
   * game in exactly one competition, and a table that names neither is a table
   * of nothing in particular.
   */
  readonly gameName: string
  /**
   * The game competition id private leagues hang off. `null` where the player
   * has not joined the game, which is an ordinary state and not a failure.
   */
  readonly gameCompetitionId: string | null
}

export type LeaguesSource = {
  readonly generatedAt: string
  readonly context: LeaguesSourceContext
  /** Which table was asked for. The source answers the one that was. */
  readonly selectedLeagueId: string | null
  /** Contract 191's season table. Null when a private league was asked for. */
  readonly global: SeasonLeaderboardPage | null
  /** The caller's private leagues. Empty is ordinary; null is unread. */
  readonly leagues: readonly GameLeague[] | null
  /** Contract 128's table for `selectedLeagueId`. Null when global was asked for. */
  readonly league: SeasonLeagueStandingsPage | null
  /**
   * Contract 150's movement for the selected league.
   *
   * NULL IS THE COMMON CASE AND IS NOT A FAILURE. Movement exists only over a
   * SETTLED matchweek; an unsettled one answers `settled: false` with no rows,
   * which is an answer. The mapper renders no movement in either case and does
   * not tell the reader they differ, because to a reader they do not.
   */
  readonly movement: SeasonLeagueMovement | null
}
