import { createSeasonPlayContextGateway } from '../../services/supabase/seasonPlayContext'
import { createSeasonMatchPredictorRpcGateway } from '../../services/supabase/seasonMatchPredictor'
import { createSeasonLmsRpcGateway } from '../../services/supabase/seasonLms'
import { createSeasonCupPlayerViewRpcGateway } from '../../services/supabase/seasonCupPlayer'
import { isActiveMembership, type CompetitionGame } from '../../services/supabase/competitionGamesModel'
import { presentCompetitionWeek, type CompetitionWeek } from './competitionWeekModel'

/**
 * "What does this player owe this competition this week?", as one call.
 *
 * WHY IT IS ITS OWN FUNCTION. Two surfaces now need the answer — the
 * competition Overview panel and the cross-competition Play inbox — and the
 * loading is four coordinated reads with rules about which to skip. A second
 * copy in the inbox would be a fifth place that decides what is due, beside the
 * four game reads that actually know, and the two would disagree the first time
 * one of them learned something.
 *
 * IT ASKS ONLY ABOUT GAMES THE PLAYER HAS JOINED, and asks each game's own
 * read. Both season reads refuse a caller with no entry — `require_season_entry`
 * for the card, and the Last Man Standing round reports `entered: false` — so
 * calling them for a non-entrant spends a request to be told what the
 * membership read already said.
 *
 * ONE FAILURE FAILS THE WHOLE COMPETITION'S ANSWER, by throwing. A week that
 * quietly drops the game it could not read tells a player "nothing to do" while
 * a lock passes. The CALLER decides how loudly to say so: Overview refuses to
 * render the panel, the inbox names the competition it could not read and still
 * shows the others, because one unreadable competition must not hide the four
 * that answered.
 */

export type CompetitionWeekHrefs = {
  matchPredictor: string | null
  lms: string | null
  championship: string | null
}

export type LoadedCompetitionWeek = {
  week: CompetitionWeek
  /** The competition's own calendar zone, as the play context reports it. */
  timeZone: string
  tournamentId: string
}

export async function loadCompetitionWeek(
  competitionSlug: string,
  seasonSlug: string,
  games: readonly CompetitionGame[],
  hrefs: CompetitionWeekHrefs,
  now: () => Date = () => new Date(),
): Promise<LoadedCompetitionWeek> {
  const joined = (key: CompetitionGame['gameKey']) =>
    games.some((game) => game.gameKey === key && isActiveMembership(game))

  const joinedMainPredictor = joined('main_predictor')
  const joinedLms = joined('last_man_standing')
  // The Championship the player is IN, by exact competition id. A season can
  // run several — contract 133's discovery exists because of it — so "the
  // Championship" is not a thing to search for by game key alone.
  const championshipId =
    games.find((game) => game.gameKey === 'predictor_cup' && isActiveMembership(game))?.id ?? null

  const context = await createSeasonPlayContextGateway().load(competitionSlug, seasonSlug)

  const card =
    joinedMainPredictor && context.matchweek !== null
      ? await createSeasonMatchPredictorRpcGateway({
          tournamentId: context.tournamentId,
          competitionName: context.competitionName,
          seasonLabel: context.seasonLabel,
          timeZone: context.timeZone,
          now,
        }).load(context.matchweek)
      : null

  const round = joinedLms
    ? await createSeasonLmsRpcGateway({ tournamentId: context.tournamentId }).load()
    : null

  const championship = championshipId
    ? await createSeasonCupPlayerViewRpcGateway({ competitionId: championshipId }).load()
    : null

  return {
    week: presentCompetitionWeek({
      matchPredictor: card ? { page: card, href: hrefs.matchPredictor } : null,
      lms: round ? { page: round, href: hrefs.lms } : null,
      championship: championship ? { view: championship, href: hrefs.championship } : null,
      now: now(),
    }),
    timeZone: context.timeZone,
    tournamentId: context.tournamentId,
  }
}

/** Whether this competition has anything worth loading a week for. */
export function playsAnyGame(games: readonly CompetitionGame[]): boolean {
  return games.some((game) => isActiveMembership(game))
}
