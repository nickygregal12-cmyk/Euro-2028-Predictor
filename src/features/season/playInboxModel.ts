import { competitionGameRoute, competitionRefFromPath } from '../../app/weeklyRoutes'
import type {
  CompetitionGame,
  CompetitionGameKey,
} from '../../services/supabase/competitionGamesModel'

type PlayEntry = {
  gameKey: CompetitionGameKey
  name: string
  href: string | null
}

export type PlayInbox = {
  entries: readonly PlayEntry[]
  empty: boolean
}

const GAME_NAMES: Record<CompetitionGameKey, string> = {
  main_predictor: 'Match Predictor',
  last_man_standing: 'Last Man Standing',
  predictor_cup: 'Predictor Championship',
  original_predictor: 'Original Predictor',
  ko_predictor: 'KO Predictor',
}

function defaultHref(gameKey: CompetitionGameKey, base: string): string | null {
  const ref = competitionRefFromPath(base)
  if (!ref) throw new Error(`Invalid competition base route: ${base}`)

  switch (gameKey) {
    case 'last_man_standing':
      return competitionGameRoute(ref, 'lms')
    case 'predictor_cup':
      return competitionGameRoute(ref, 'championship')
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
  const ref = competitionRefFromPath(base)
  if (!ref) throw new Error(`Invalid competition base route: ${base}`)

  return {
    entries: joined.map((game) => ({
      gameKey: game.gameKey,
      name: GAME_NAMES[game.gameKey],
      // The Match Predictor's caller still uses the override as the feature-flag
      // enable signal; the route itself comes from the canonical authority.
      href:
        game.gameKey === 'main_predictor' && overrides.main_predictor
          ? competitionGameRoute(ref, 'match-predictor')
          : (overrides[game.gameKey] ?? defaultHref(game.gameKey, base)),
    })),
    empty: joined.length === 0,
  }
}
