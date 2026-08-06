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
}

export type CompetitionGame = {
  gameKey: CompetitionGameKey
  active: boolean
  membership: CompetitionGameMembership | null
}

export type SeasonGames = {
  competitionMember: boolean
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

/**
 * Malformed data fails loudly rather than reading as "no games": the Hub's
 * whole defect history is plausible emptiness standing in for a broken read,
 * so anything that is not the documented shape is an error, not an absence.
 * An unknown game_key is the one tolerated surprise — a future game the
 * catalogue does not describe yet is skipped, never guessed at.
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
    if (!isRecord(raw) || typeof raw.game_key !== 'string' || typeof raw.active !== 'boolean') {
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
        joinedAt:
          typeof raw.membership.joined_at === 'string' ? raw.membership.joined_at : null,
      }
    }

    games.push({
      gameKey: raw.game_key as CompetitionGameKey,
      active: raw.active,
      membership,
    })
  }

  return { competitionMember: payload.competition_member, games }
}

/** An active membership is the only state that counts as being in the game. */
export function isActiveMembership(game: CompetitionGame): boolean {
  return game.membership?.status === 'active'
}
