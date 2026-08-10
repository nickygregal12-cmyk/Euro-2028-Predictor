import type { HubCompetition } from '../features/hub/competitionCatalogue'
import type {
  HubSeasonMembership,
} from '../services/supabase/competitionGames'
import type { CompetitionGame, CompetitionGameKey } from '../services/supabase/competitionGamesModel'
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
 * fixture: `HubCompetition` values and the membership rows the server read
 * would have produced, fed through the real `presentPlayerCompetitions`. What
 * it proves is a property of the MODEL and the components, which is where the
 * scalability rule can actually be broken.
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

const GAME_COPY: Record<CompetitionGameKey, { kind: HubCompetition['games'][number]['kind']; name: string }> = {
  main_predictor: { kind: 'league-predictor', name: 'Match Predictor' },
  last_man_standing: { kind: 'last-man-standing', name: 'Last Man Standing' },
  predictor_cup: { kind: 'predictor-championship', name: 'Predictor Championship' },
  ko_predictor: { kind: 'ko-predictor', name: 'Knockout Predictor' },
  original_predictor: { kind: 'original-predictor', name: 'Original Predictor' },
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

export const TWENTY_COMPETITION_CATALOGUE: readonly HubCompetition[] = NAMES.map((name) => ({
  competitionSlug: slugOf(name),
  seasonSlug: '2026-27',
  seasonRowName: `${name} 2026/27`,
  name,
  seasonLabel: '2026/27',
  status: 'live',
  summary: 'Weekly score predictions, Last Man Standing and the Predictor Championship.',
  games: GAMES.map((gameKey) => ({
    kind: GAME_COPY[gameKey].kind,
    gameKey,
    name: GAME_COPY[gameKey].name,
    description: 'A game in this competition.',
    joined: false,
    status: 'available' as const,
  })),
}))

function gameRow(name: string, gameKey: CompetitionGameKey, joined: boolean): CompetitionGame {
  return {
    id: `${slugOf(name)}-${gameKey}`,
    gameKey,
    active: true,
    displayName: GAME_COPY[gameKey].name,
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
  TWENTY_COMPETITION_CATALOGUE.map((competition) => {
    const plays = PLAYS_IN.includes(competition.name)
    const twoGames = competition.name === 'Premier League'
    return {
      seasonName: competition.seasonRowName,
      tournamentId: `season-${competition.competitionSlug}`,
      seasonStatus: 'active' as const,
      seasonGames: {
        competitionMember: plays,
        serverNow: '2026-08-10T09:00:00.000Z',
        games: [
          gameRow(competition.name, 'main_predictor', plays),
          gameRow(competition.name, 'last_man_standing', plays && twoGames),
          gameRow(competition.name, 'predictor_cup', false),
        ],
      },
    }
  })

/** The model as the shell would build it on that platform. */
export function twentyCompetitionPlayer(): PlayerCompetitions {
  return presentPlayerCompetitions(
    TWENTY_COMPETITION_CATALOGUE,
    TWENTY_COMPETITION_MEMBERSHIP,
  )
}
