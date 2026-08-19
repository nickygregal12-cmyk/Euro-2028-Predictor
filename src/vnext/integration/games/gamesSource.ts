import type { SeasonGames } from '../../../services/supabase/competitionGamesModel'

/**
 * WHAT THE REAL APPLICATION HANDS vNEXT GAMES.
 *
 *   contract C1b  `get_competition_games`  the catalogue and the caller's
 *                                          own membership in each game
 *
 * ONE READ, AND IT ANSWERS EVERYTHING THIS PAGE SHOWS. Unlike the Championship
 * and Account, nothing here needs a second read to name a row: the catalogue
 * carries each game's own `display_name`.
 *
 * ============================ THE CLOCK IS THE SERVER'S =================
 *
 * The read returns `server_now`, and its decoder says why in one line:
 * "Registration windows resolve against it, never a device clock." A browser an
 * hour fast would otherwise offer a registration that has closed or hide one
 * that has opened. `generatedAt` is supplied only as the fallback for a read
 * that did not answer.
 */

type GamesRead = { readonly kind: 'ok'; readonly games: SeasonGames } | { readonly kind: 'failed' }

export type GamesSource = {
  /** The host's instant. Used ONLY where the read supplied no `server_now`. */
  readonly generatedAt: string
  readonly context: {
    /** The season row id every season read is addressed by. */
    readonly tournamentId: string
    readonly competitionName: string
    readonly seasonLabel: string
  }
  readonly games: GamesRead
}
