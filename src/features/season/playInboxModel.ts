import type {
  CompetitionGame,
  CompetitionGameKey,
} from '../../services/supabase/competitionGamesModel'

/**
 * §7.3's Play section: "actions for all games joined in this competition".
 *
 * WHAT IT IS AND IS NOT. This lists the games the caller has actually joined
 * and where to go to play each. It does NOT compute a next action, a deadline
 * or a rank — those live in each game's own read, and gathering four of them
 * here would put a fifth copy of "what is due" in the browser beside the four
 * that already know. A player arriving here wants the short list of things
 * that are theirs; the game page tells them what to do about it.
 *
 * A GAME THE CALLER HAS NOT JOINED IS NOT LISTED. That is what makes this
 * different from Overview, which shows the whole catalogue with join controls.
 * §7.3 pairs them deliberately: Overview is "the competition", Play is "yours".
 * When nothing is joined, this says so and points at Overview rather than
 * rendering an empty list that looks broken.
 *
 * ONLY GAMES WITH A SURFACE GET A DESTINATION. A joined game whose page does
 * not exist yet is still listed — the membership is real and hiding it would
 * misreport what the player has joined — but it carries no link, because a
 * dead link is worse than an honest absence.
 */

/** Reachable through `PlayInbox`; not exported separately, so it does not
 *  become a needless public name. */
type PlayEntry = {
  gameKey: CompetitionGameKey
  name: string
  /** Where to play it, or null when the game has no surface yet. */
  href: string | null
}

export type PlayInbox = {
  entries: readonly PlayEntry[]
  /** True when the caller holds no active membership in this competition. */
  empty: boolean
}

/** The interface's name for each game (ADR 0020), not the database's. */
const GAME_NAMES: Record<CompetitionGameKey, string> = {
  main_predictor: 'Main Predictor',
  last_man_standing: 'Last Man Standing',
  predictor_cup: 'Predictor Championship',
  original_predictor: 'Original Predictor',
  ko_predictor: 'KO Predictor',
}

/**
 * The path each game is played at, given a competition base.
 *
 * `main_predictor` is absent deliberately: its route is flag-gated, and this
 * model cannot read a flag without becoming impure. The caller supplies it
 * when the flag is on, which keeps the decision where the flag already lives.
 */
function defaultHref(gameKey: CompetitionGameKey, base: string): string | null {
  switch (gameKey) {
    case 'last_man_standing':
      return `${base}/last-man-standing`
    case 'predictor_cup':
      return `${base}/championship`
    default:
      return null
  }
}

export function presentPlayInbox(
  games: readonly CompetitionGame[],
  base: string,
  overrides: Partial<Record<CompetitionGameKey, string>> = {},
): PlayInbox {
  const joined = games.filter((game) => game.membership?.status === 'active')

  return {
    entries: joined.map((game) => ({
      gameKey: game.gameKey,
      name: GAME_NAMES[game.gameKey],
      href: overrides[game.gameKey] ?? defaultHref(game.gameKey, base),
    })),
    empty: joined.length === 0,
  }
}
