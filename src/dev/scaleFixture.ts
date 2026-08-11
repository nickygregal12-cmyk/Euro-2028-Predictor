import {
  catalogueFromPublishedSeasons,
  type HubCompetition,
} from '../features/hub/competitionCatalogue'
import type {
  HubSeasonMembership,
} from '../services/supabase/competitionGames'
import type { CompetitionGame, CompetitionGameKey } from '../services/supabase/competitionGamesModel'
import type { PublishedWeeklySeason } from '../services/supabase/weeklyCatalogue'
import {
  presentPlayerCompetitions,
  type PlayerCompetitions,
} from '../features/hub/playerCompetitions'

/**
 * A synthetic platform of twenty published competitions, of which the player
 * plays in three.
 *
 * WHY IT EXISTS. The 10 August navigation authority makes twenty-plus
 * competitions a BINDING acceptance requirement, not an aspiration: adding
 * seventeen competitions must not make ordinary signed-in navigation visibly
 * noisy. With two competitions in the real catalogue, every bounded list, every
 * "your competitions" default and every overflow rule is untested by
 * construction — they all look identical to an unbounded version.
 *
 * IT IS NOT SEED DATA AND NEVER REACHES A DATABASE. It is a presentation
 * fixture: the rows contract 147's `get_published_weekly_seasons` and the
 * membership read would have produced, fed through the REAL
 * `catalogueFromPublishedSeasons` and `presentPlayerCompetitions`. Since
 * contract 147 the route slug is a server field, so this fixture supplies one
 * per season exactly as the server would and the twenty competitions are
 * routable for the same reason the two real ones are — not because a frontend
 * array was extended to twenty. What it proves is a property of the MODEL and
 * the components, which is where the scalability rule can actually be broken.
 *
 * THE THREE JOINED ONES ARE DELIBERATELY NOT THE FIRST THREE. A fixture whose
 * relevant competitions sit at the top of the catalogue would pass a bounded
 * list that simply sliced the first six.
 */

const GAMES: readonly CompetitionGameKey[] = [
  'main_predictor',
  'last_man_standing',
  'predictor_cup',
]

const GAME_NAMES: Record<CompetitionGameKey, string> = {
  main_predictor: 'Match Predictor',
  last_man_standing: 'Last Man Standing',
  predictor_cup: 'Predictor Championship',
  ko_predictor: 'Knockout Predictor',
  original_predictor: 'Original Predictor',
}

/** Twenty plausible competition names, so the fixture reads like a catalogue. */
const NAMES: readonly string[] = [
  'Premier League',
  'Championship',
  'League One',
  'League Two',
  'Scottish Premiership',
  'Scottish Championship',
  'FA Cup',
  'Scottish Cup',
  'EFL Cup',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
  'Eredivisie',
  'Primeira Liga',
  'Champions League',
  'Europa League',
  'Conference League',
  'Womens Super League',
  'MLS',
]

/** Not the first three: a slice-the-top bounded list would pass wrongly. */
const PLAYS_IN: readonly string[] = ['Premier League', 'Scottish Premiership', 'Champions League']

function slugOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * What contract 147 would return for this platform: twenty published league
 * seasons, each carrying BOTH halves of its address. The slug is the server's
 * here exactly as it is in production; nothing derives one from a name.
 */
export const TWENTY_COMPETITION_SEASONS: readonly PublishedWeeklySeason[] = NAMES.map(
  (name) => ({
    competitionSlug: slugOf(name),
    seasonKey: '2026-27',
    competitionId: `competition-${slugOf(name)}`,
    competitionName: name,
    seasonId: `season-${slugOf(name)}`,
    seasonName: `${name} 2026/27`,
    status: 'active' as const,
    timeZone: 'Europe/London',
  }),
)

function gameRow(name: string, gameKey: CompetitionGameKey, joined: boolean): CompetitionGame {
  return {
    id: `${slugOf(name)}-${gameKey}`,
    gameKey,
    active: true,
    displayName: GAME_NAMES[gameKey],
    registrationOpensAt: null,
    registrationClosesAt: null,
    completedAt: null,
    allowRejoin: true,
    membership: joined
      ? {
          status: 'active',
          joinedAt: '2026-08-01T00:00:00.000Z',
          leftAt: null,
          disqualifiedAt: null,
        }
      : null,
  }
}

/**
 * The membership rows the server read would return: three competitions with
 * entries, seventeen with none. The player plays two games in one of them, so
 * the "most joined games first" ordering has something to order.
 */
export const TWENTY_COMPETITION_MEMBERSHIP: readonly HubSeasonMembership[] =
  TWENTY_COMPETITION_SEASONS.map((season) => {
    const plays = PLAYS_IN.includes(season.competitionName)
    const twoGames = season.competitionName === 'Premier League'
    const name = season.competitionName
    return {
      seasonName: season.seasonName,
      tournamentId: season.seasonId,
      seasonStatus: 'active' as const,
      seasonGames: {
        competitionMember: plays,
        serverNow: '2026-08-10T09:00:00.000Z',
        games: GAMES.map((gameKey) =>
          gameRow(
            name,
            gameKey,
            gameKey === 'main_predictor'
              ? plays
              : gameKey === 'last_man_standing'
                ? plays && twoGames
                : false,
          ),
        ),
      },
    }
  })

/**
 * The catalogue the shell would build on that platform — through the real
 * `catalogueFromPublishedSeasons`, so the fixture exercises the server-driven
 * route model rather than a hand-written stand-in for it.
 */
export const TWENTY_COMPETITION_CATALOGUE: readonly HubCompetition[] =
  catalogueFromPublishedSeasons(TWENTY_COMPETITION_SEASONS, TWENTY_COMPETITION_MEMBERSHIP)

/** The model as the shell would build it on that platform. */
export function twentyCompetitionPlayer(): PlayerCompetitions {
  return presentPlayerCompetitions(
    TWENTY_COMPETITION_CATALOGUE,
    TWENTY_COMPETITION_MEMBERSHIP,
  )
}
