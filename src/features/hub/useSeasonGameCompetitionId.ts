import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'

/**
 * The `game_competition_id` for one game of one season, taken from the
 * membership the shell has already read.
 *
 * WHY IT IS NOT ANOTHER REQUEST. `PlayerCompetitionsProvider` already holds the
 * server's game rows for every competition the player is relevant to, and the
 * id it carries is the same one `get_my_game_leagues` and every join/leave
 * command are addressed by. A surface issuing its own `get_competition_games`
 * to find it would be a second read of an answer already in memory — and on a
 * platform of twenty competitions, a second read per surface is the cost the
 * provider exists to remove.
 *
 * NULL IS "NOT AVAILABLE TO THIS PLAYER", NOT AN ERROR. A player relevant to no
 * competition, a competition the player has joined no game in, or a shell whose
 * read has not landed all answer null, and every caller treats that as "there
 * is nothing of yours here" rather than as a failure. It is deliberately
 * narrower than the truth: a game a player could join but has not is absent,
 * which is correct for every use so far — all of them are asking about the
 * player's OWN play.
 */
export function useSeasonGameCompetitionId(
  competitionSlug: string | undefined,
  seasonSlug: string | undefined,
  gameKey: CompetitionGameKey,
): string | null {
  const { player } = usePlayerCompetitions()
  if (!player || !competitionSlug || !seasonSlug) return null

  const entry = player.mine.find(
    (candidate) =>
      candidate.competition.competitionSlug === competitionSlug &&
      candidate.competition.seasonSlug === seasonSlug,
  )
  return entry?.games.find((game) => game.gameKey === gameKey)?.id ?? null
}
