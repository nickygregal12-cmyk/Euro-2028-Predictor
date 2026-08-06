import type { GameLeague } from '../../services/supabase/gameLeagues'
import { userFacingError } from '../../shared/errors/userFacingError'

/**
 * Presentation model for a competition's private leagues (§7.3's Leagues
 * section).
 *
 * A LEAGUE BELONGS TO A GAME, NOT TO A COMPETITION, and that is the decision
 * this file exists to make visible. ADR 0011 keeps each game's entry, scoring
 * and standings its own; `leagues.game_competition_id` says the same in
 * storage. A season running a Match Predictor, a Last Man Standing and a
 * Championship has three separate things a private league could rank, and one
 * list headed "Leagues" would be asserting a combined authority none of them
 * has. So the surface names the game its leagues belong to, every time.
 *
 * THERE IS NO STANDINGS TABLE HERE, AND THAT IS DELIBERATE RATHER THAN
 * UNFINISHED. `get_league_members` ranks by `predictor_internal.standing_metrics`,
 * which reads `score_events`, `matches` and `match_predictions` — the tournament
 * scoring tables. A season's points live in `season_matchweek_scores` and never
 * reach any of them, so that read would return every member of a season league
 * on zero points with no error: a plausible table that is entirely wrong. This
 * is the same shape as the defect contracts 86, 98, 116, 118 and 120 each
 * fixed — a read written for one competition shape and never widened — so the
 * surface renders what the game-scoped read genuinely answers (which leagues
 * exist, who owns them, how many are in them, how to invite) and states that
 * the table needs a read of its own rather than showing a wrong one.
 *
 * THE INVITE CODE IS THE PRODUCT. A private league with no way to share it is
 * an empty room, so the code is on the card rather than behind a tap.
 */

export type GameLeagueView = {
  id: string
  name: string
  inviteCode: string
  /** "12 members" — plural resolved once, here. */
  memberLine: string
  /** "You own this league" or "Owned by <name>". */
  ownerLine: string
  isOwner: boolean
}

export type GameLeaguesView = {
  leagues: readonly GameLeagueView[]
  empty: boolean
  /**
   * Null when the caller may create a league here; a sentence when they may
   * not. The server enforces this too — it is stated up front so the interface
   * never offers a control that is certain to be refused.
   */
  createRefusal: string | null
  /** What a league in this section ranks, said once above the list. */
  scopeLine: string
  /** Why no table is shown inside a league. Stated, never implied by absence. */
  standingsNote: string
}

export type GameLeaguesFacts = {
  /** The game these leagues belong to, as the interface names it. */
  gameName: string
  /** Whether the caller holds an active membership in that game. */
  joinedGame: boolean
  leagues: readonly GameLeague[]
}

function memberLine(count: number): string {
  return count === 1 ? '1 member' : `${count} members`
}

export function presentGameLeagues(facts: GameLeaguesFacts): GameLeaguesView {
  return {
    leagues: facts.leagues.map((league) => ({
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      memberLine: memberLine(league.memberCount),
      ownerLine: league.isOwner ? 'You own this league' : `Owned by ${league.ownerName}`,
      isOwner: league.isOwner,
    })),
    empty: facts.leagues.length === 0,
    createRefusal: facts.joinedGame
      ? null
      : `Join the ${facts.gameName} before creating a league here. A private league ranks that game, so it cannot exist without an entry in it.`,
    scopeLine: `These leagues rank the ${facts.gameName}. Each game in this competition keeps its own.`,
    standingsNote:
      'League tables are not open yet. The ranking a private league needs is the one this competition already keeps, and reading it per league is still to be built — so no table is shown rather than one that would read zero for everybody.',
  }
}

/**
 * Turn a league write refusal into the sentence that explains it.
 *
 * Keyed on the error code, never on the message: the copy is this repository's
 * and the server's own string is not passed through, the same discipline
 * `lmsRefusal` uses. A code this does not know falls back to
 * `userFacingError`, so a new refusal degrades to safe generic copy.
 */
const CREATE_REFUSALS: Record<string, string> = {
  // create_game_league: no active membership in a game that takes predictions.
  '42501': 'Join this game before creating a league in it.',
  insufficient_privilege: 'Join this game before creating a league in it.',
  // The name failed the server's 1–40 character rule.
  '23514': 'A league name must be 1 to 40 characters.',
  check_violation: 'A league name must be 1 to 40 characters.',
}

const JOIN_REFUSALS: Record<string, string> = {
  // join_league: the code matched nothing.
  '02000': 'That invite code does not match a league.',
  no_data_found: 'That invite code does not match a league.',
  // The code matched a league in a game the caller has not joined.
  '42501': 'That league belongs to a game you have not joined yet.',
  insufficient_privilege: 'That league belongs to a game you have not joined yet.',
}

function classify(table: Record<string, string>, error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string' && table[code]) return table[code]
  return userFacingError(error)
}

export function leagueCreateRefusal(error: unknown): string {
  return classify(CREATE_REFUSALS, error)
}

export function leagueJoinRefusal(error: unknown): string {
  return classify(JOIN_REFUSALS, error)
}

/** Everything the page may ask of the world. Injected, so the page stays pure. */
export type SeasonLeaguesGateway = {
  load(): Promise<readonly GameLeague[]>
  create(name: string): Promise<unknown>
  join(code: string): Promise<unknown>
}
