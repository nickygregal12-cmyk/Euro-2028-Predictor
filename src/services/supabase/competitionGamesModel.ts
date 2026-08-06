// Decode layer for the C1b `get_competition_games` read. Pure: no Supabase
// import, so the shape rules are unit-testable without a client.

/** Database game keys as the C1b catalogue stores them. */
export type CompetitionGameKey =
  | 'main_predictor'
  | 'last_man_standing'
  | 'predictor_cup'
  | 'original_predictor'
  | 'ko_predictor'

export type CompetitionGameMembership = {
  status: string
  joinedAt: string | null
  /** Set when the caller left; with `allowRejoin` it decides whether they may return. */
  leftAt: string | null
  /** A disqualified entry can never be rejoined, whatever `allowRejoin` says. */
  disqualifiedAt: string | null
}

export type CompetitionGame = {
  /** The `game_competition_id` every join and leave is addressed by. */
  id: string
  gameKey: CompetitionGameKey
  active: boolean
  /** The catalogue's own name for the game, as the database holds it. */
  displayName: string | null
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  completedAt: string | null
  allowRejoin: boolean
  membership: CompetitionGameMembership | null
}

export type SeasonGames = {
  competitionMember: boolean
  /** The server's instant. Registration windows resolve against it, never a device clock. */
  serverNow: string | null
  games: CompetitionGame[]
}

const GAME_KEYS: readonly string[] = [
  'main_predictor',
  'last_man_standing',
  'predictor_cup',
  'original_predictor',
  'ko_predictor',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * Malformed data fails loudly rather than reading as "no games": the Hub's
 * whole defect history is plausible emptiness standing in for a broken read,
 * so anything that is not the documented shape is an error, not an absence.
 * An unknown game_key is the one tolerated surprise — a future game the
 * catalogue does not describe yet is skipped, never guessed at.
 *
 * WHAT THIS DECODES IS WIDER THAN IT WAS, AND NONE OF IT IS NEW SERVER DATA.
 * `get_competition_games` has always returned each game's `id`, its
 * registration window, `completed_at`, `allow_rejoin` and the fuller
 * membership row, plus a top-level `server_now`; this layer simply dropped
 * them. The id in particular is what every join and leave is addressed by, so
 * discarding it was the whole reason a membership control could be rendered
 * and not wired. `id` is therefore required — a game without one cannot be
 * acted on and is a broken payload, not a read-only game.
 */
export function decodeSeasonGames(payload: unknown): SeasonGames {
  if (!isRecord(payload) || typeof payload.competition_member !== 'boolean') {
    throw new Error('The competition games response was not in the expected shape.')
  }
  const rawGames = payload.games
  if (!Array.isArray(rawGames)) {
    throw new Error('The competition games response was not in the expected shape.')
  }

  const games: CompetitionGame[] = []
  for (const raw of rawGames) {
    if (
      !isRecord(raw) ||
      typeof raw.game_key !== 'string' ||
      typeof raw.active !== 'boolean' ||
      typeof raw.id !== 'string'
    ) {
      throw new Error('The competition games response was not in the expected shape.')
    }
    if (!GAME_KEYS.includes(raw.game_key)) continue

    let membership: CompetitionGameMembership | null = null
    if (raw.membership !== null && raw.membership !== undefined) {
      if (!isRecord(raw.membership) || typeof raw.membership.status !== 'string') {
        throw new Error('The competition games response was not in the expected shape.')
      }
      membership = {
        status: raw.membership.status,
        joinedAt: textOrNull(raw.membership.joined_at),
        leftAt: textOrNull(raw.membership.left_at),
        disqualifiedAt: textOrNull(raw.membership.disqualified_at),
      }
    }

    games.push({
      id: raw.id,
      gameKey: raw.game_key as CompetitionGameKey,
      active: raw.active,
      displayName: textOrNull(raw.display_name),
      registrationOpensAt: textOrNull(raw.registration_opens_at),
      registrationClosesAt: textOrNull(raw.registration_closes_at),
      completedAt: textOrNull(raw.completed_at),
      // Absent reads as "no rejoin": the permissive default would invite a
      // player back into a game the catalogue never said they could re-enter.
      allowRejoin: raw.allow_rejoin === true,
      membership,
    })
  }

  return {
    competitionMember: payload.competition_member,
    serverNow: textOrNull(payload.server_now),
    games,
  }
}

/** An active membership is the only state that counts as being in the game. */
export function isActiveMembership(game: CompetitionGame): boolean {
  return game.membership?.status === 'active'
}
