import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
import { isActiveMembership } from '../../services/supabase/competitionGamesModel'

/**
 * WHICH SIDE GAMES THIS PLAYER IS ACTUALLY IN, HERE — for the surfaces that
 * need to decide whether to ask a game's own read at all.
 *
 * WHY IT IS NOT ANOTHER REQUEST, and why it is not the hook next door.
 * `useSeasonGameCompetitionId` answers "what id addresses this game in this
 * season", which is a CATALOGUE question: it finds the row whether or not the
 * player has joined it, and that is correct for what it is used for. This
 * answers a MEMBERSHIP question — "may I spend a request on this game's round
 * read?" — and those are different enough that collapsing them would make one
 * caller silently wrong. Both read the same already-loaded provider, so neither
 * costs a request.
 *
 * IT ASKS `isActiveMembership` RATHER THAN CHECKING FOR AN ID. A competition
 * runs Last Man Standing whether or not this player entered it, so the row —
 * and its id — exists either way. Gating on the id would have Home ask for a
 * round the player is not in, on every load, in every competition that offers
 * the game.
 *
 * THE CHAMPIONSHIP IS AN ID AND LMS IS A BOOLEAN, deliberately. A season can
 * run SEVERAL Championships — contract 133's discovery read exists because of
 * it — so the caller needs the exact competition it must address. The Last Man
 * Standing round read is addressed by the tournament, so its membership is a
 * yes or no.
 *
 * NULL AND FALSE MEAN "NOT THIS PLAYER'S", NEVER AN ERROR. A shell read that
 * has not landed answers the same way as a player who joined nothing, and every
 * caller treats both as "there is nothing of yours here" — which is the honest
 * answer while it is still true.
 */
export type SeasonWeekMemberships = {
  /** True only where the player holds an ACTIVE Last Man Standing membership. */
  readonly playsLms: boolean
  /** The exact Championship this player is in here, or null. */
  readonly championshipCompetitionId: string | null
}

export function useSeasonWeekMemberships(
  competitionSlug: string | undefined,
  seasonSlug: string | undefined,
): SeasonWeekMemberships {
  const { player } = usePlayerCompetitions()

  if (!player || !competitionSlug || !seasonSlug) {
    return { playsLms: false, championshipCompetitionId: null }
  }

  const entry = player.mine.find(
    (candidate) =>
      candidate.competition.competitionSlug === competitionSlug &&
      candidate.competition.seasonSlug === seasonSlug,
  )

  if (entry === undefined) {
    return { playsLms: false, championshipCompetitionId: null }
  }

  return {
    playsLms: entry.games.some(
      (game) => game.gameKey === 'last_man_standing' && isActiveMembership(game),
    ),
    championshipCompetitionId:
      entry.games.find((game) => game.gameKey === 'predictor_cup' && isActiveMembership(game))
        ?.id ?? null,
  }
}
