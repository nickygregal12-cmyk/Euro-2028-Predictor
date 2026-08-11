import { competitionRoute } from '../../app/weeklyRoutes'
import type { HubSeasonMembership } from '../../services/supabase/competitionGames'
import type {
  CompetitionGame,
  CompetitionGameKey,
} from '../../services/supabase/competitionGamesModel'
import type { PublishedWeeklySeason } from '../../services/supabase/weeklyCatalogue'

export type HubGameKind =
  | 'league-predictor'
  | 'original-predictor'
  | 'last-man-standing'
  | 'predictor-championship'
  | 'ko-predictor'

export type HubGame = {
  kind: HubGameKind
  gameKey: CompetitionGameKey
  name: string
  description: string
  joined: boolean
  status: 'available' | 'joined' | 'coming-soon'
}

export type HubCompetition = {
  competitionSlug: string
  seasonSlug: string
  seasonRowName: string
  name: string
  seasonLabel: string
  status: 'live' | 'upcoming' | 'parked' | 'ended'
  summary: string
  games: HubGame[]
}

/**
 * The catalogue is the server's, in full (contract 147, `MIG-UI-12`).
 *
 * WHAT THIS FILE USED TO BE. A hand-written array of two competitions —
 * `HUB_COMPETITIONS` — which was the only place a competition's route slug
 * could come from, because `public.competitions.slug` is revoked from every
 * browser role. Publishing a third league therefore needed a frontend edit
 * before it could be opened, which is the opposite of the scalability contract.
 * Contract 147 returns the slug and its season key together, so the array is
 * gone and `catalogueFromPublishedSeasons` builds the same shape from what the
 * server publishes.
 *
 * WHAT REMAINS PRESENTATION COPY, AND WHY IT SCALES. `GAME_PRESENTATION` below
 * is keyed on the GAME, not on the competition — one sentence explaining each
 * game FORMAT, which is a property of the format and identical in every
 * competition that runs it. Twenty new leagues add twenty catalogue entries and
 * nothing here. There is deliberately no per-competition copy left: a
 * hand-written sentence about the Premier League is exactly the row that made
 * publishing a league a frontend change.
 *
 * NO SLUG IS EVER DERIVED FROM A NAME. It comes from `competition_slug` or the
 * season is not routable, and a season the server does not publish does not
 * appear at all.
 */

/**
 * One sentence per game format. Presentation copy that genuinely cannot come
 * from the server: `get_competition_games` returns a display name and a
 * lifecycle, not an explanation of how the game is played.
 */
export const GAME_PRESENTATION: Record<
  CompetitionGameKey,
  { kind: HubGameKind; name: string; description: string }
> = {
  main_predictor: {
    kind: 'league-predictor',
    name: 'Match Predictor',
    description: 'Predict every score before the matchweek locks at its first kickoff.',
  },
  last_man_standing: {
    kind: 'last-man-standing',
    name: 'Last Man Standing',
    description: 'Choose one team each round and survive for as long as possible.',
  },
  predictor_cup: {
    kind: 'predictor-championship',
    name: 'Predictor Championship',
    description: 'Play a head-to-head fixture every matchweek for three, one or zero points.',
  },
  ko_predictor: {
    kind: 'ko-predictor',
    name: 'Knockout Predictor',
    description: 'Predict the knockout bracket from the round of sixteen onwards.',
  },
  original_predictor: {
    kind: 'original-predictor',
    name: 'Original Predictor',
    description: 'The original tournament prediction game.',
  },
}

/**
 * "2026-27" as the season key stores it becomes "2026/27" as football writes
 * it. A formatting rule over a canonical value, not a second identity — the key
 * itself is what every route and read is addressed by.
 */
export function seasonLabelFromKey(seasonKey: string): string {
  return seasonKey.replace('-', '/')
}

function statusOf(status: PublishedWeeklySeason['status']): HubCompetition['status'] {
  switch (status) {
    case 'active':
      return 'live'
    case 'complete':
    case 'archived':
      return 'ended'
    case 'draft':
    case 'scheduled':
    case null:
      return 'upcoming'
    default:
      return 'upcoming'
  }
}

/**
 * The weekly platform's three domestic game FORMATS, in the order ADR 0012–0014
 * define them.
 *
 * IT IS A PLATFORM FACT, NOT PER-COMPETITION METADATA, and that is why it can
 * stay in the frontend after contract 147 removed everything else: the weekly
 * product runs Match Predictor, Last Man Standing and the Predictor
 * Championship, and a twenty-first competition adds no entry to this list.
 *
 * WHY THE LIST IS SHOWN EVEN WHERE A SEASON SERVES NOTHING. "This competition
 * has not opened Last Man Standing yet" is a true and useful sentence; dropping
 * the game entirely would leave a player unable to tell an unopened game from
 * one the platform does not have. The SERVED state is always the server's —
 * nothing here claims a game exists in a season.
 */
const WEEKLY_GAME_FORMATS: readonly CompetitionGameKey[] = [
  'main_predictor',
  'last_man_standing',
  'predictor_cup',
]

/**
 * The season's own sentence, built from the games the server actually serves.
 *
 * IT IS NOT WRITTEN PER COMPETITION any more. A season that runs all three
 * weekly games reads the same as any other that does, which is true; a season
 * serving none says so instead of promising three.
 */
function summaryOf(served: readonly CompetitionGame[]): string {
  const open = served.filter((game) => game.active)
  if (open.length === 0) return 'No games are open in this competition season yet.'
  const names = open.map((game) => game.displayName ?? GAME_PRESENTATION[game.gameKey].name)
  const last = names[names.length - 1] as string
  const listed = names.length === 1 ? last : `${names.slice(0, -1).join(', ')} and ${last}`
  return `${listed}.`
}

/**
 * The published catalogue as the Hub presents it.
 *
 * GAMES COME FROM THE MEMBERSHIP READ, which is `get_competition_games` — the
 * server's own list of what a season runs. A season whose games could not be
 * read keeps an empty game list and says so in its summary rather than being
 * given three it might not have.
 *
 * PURE. Server answers in, presentation model out; no clock, no network.
 */
export function hubGamesFromServed(served: readonly CompetitionGame[]): HubGame[] {
  const byKey = new Map(served.map((game) => [game.gameKey, game]))
  // The three weekly formats first and always, then anything else the season
  // serves — so a game the platform gains later is listed by the server rather
  // than waiting for this array to be edited.
  const keys = [
    ...WEEKLY_GAME_FORMATS,
    ...served.map((game) => game.gameKey).filter((key) => !WEEKLY_GAME_FORMATS.includes(key)),
  ]

  return keys.map((gameKey) => {
    const copy = GAME_PRESENTATION[gameKey]
    const game = byKey.get(gameKey)
    return {
      kind: copy.kind,
      gameKey,
      // The server's display name wins where it has one: it is the name the
      // competition administrator chose for this season's game.
      name: game?.displayName ?? copy.name,
      description: copy.description,
      // Membership is overlaid by `applyHubMembership`, which is the one place
      // that reads it. Claiming it here would be a second answer.
      joined: false,
      // A game the season does not serve at all is `coming-soon`: the
      // competition has not opened it, which is a state and not an absence.
      status: game?.active ? 'available' : 'coming-soon',
    }
  })
}

export function catalogueFromPublishedSeasons(
  published: readonly PublishedWeeklySeason[],
  memberships: readonly HubSeasonMembership[],
): HubCompetition[] {
  const bySeasonName = new Map(memberships.map((season) => [season.seasonName, season]))

  return published.map((season) => {
    const membership = bySeasonName.get(season.seasonName)
    const served = membership?.seasonGames.games ?? []
    const games = hubGamesFromServed(served)

    return {
      competitionSlug: season.competitionSlug,
      seasonSlug: season.seasonKey,
      seasonRowName: season.seasonName,
      name: season.competitionName,
      seasonLabel: seasonLabelFromKey(season.seasonKey),
      status: statusOf(season.status),
      summary: summaryOf(served),
      games,
    }
  })
}

export function competitionPath(competition: HubCompetition): string {
  return competitionRoute(competition)
}

export function isJoinedCompetition(competition: HubCompetition): boolean {
  return competition.games.some((game) => game.joined)
}

/**
 * The games of a competition, joined first.
 *
 * WHY ORDER MATTERS HERE. `UI-F08` asks for joined games before available ones,
 * and the reason is the five-second test: a player opens Games to do something
 * in a game they are IN, and the catalogue's declaration order put an
 * unjoined game above a joined one whenever the catalogue happened to list it
 * first. Ordering by membership costs nothing and makes the section answer the
 * question it is opened with.
 *
 * MEMBERSHIP IS THE SERVER'S, carried on the overlaid catalogue entry by
 * `applyHubMembership`. A game whose membership could not be read keeps
 * `joined: false` and therefore sorts second, which is the safe direction: it
 * is listed and reachable either way, just not promoted on a guess.
 *
 * THE CATALOGUE'S OWN ORDER IS THE TIE-BREAK, so the section does not reshuffle
 * between renders and two joined games keep a stable relationship.
 */
export function gamesJoinedFirst(games: readonly HubGame[]): HubGame[] {
  return games
    .map((game, index) => ({ game, index }))
    .sort((left, right) => {
      if (left.game.joined !== right.game.joined) return left.game.joined ? -1 : 1
      return left.index - right.index
    })
    .map((entry) => entry.game)
}

export function partitionHubCompetitions(competitions: readonly HubCompetition[]): {
  mine: HubCompetition[]
  discover: HubCompetition[]
} {
  return {
    mine: competitions.filter(isJoinedCompetition),
    discover: competitions.filter((competition) => !isJoinedCompetition(competition)),
  }
}

/**
 * The catalogue entry a route addresses.
 *
 * IT TAKES THE CATALOGUE rather than closing over a module-level array, which
 * is the whole of the contract 147 change: the set of competitions is a value
 * the shell read from the server, so every lookup has to be given it. A caller
 * with no catalogue yet has a LOADING state, not a missing competition — those
 * are different screens and conflating them is how a published competition
 * reads as "not found" for the first second of every visit.
 */
export function findHubCompetition(
  catalogue: readonly HubCompetition[],
  competitionSlug: string | undefined,
  seasonSlug: string | undefined,
): HubCompetition | null {
  if (!competitionSlug || !seasonSlug) return null
  return (
    catalogue.find(
      (competition) =>
        competition.competitionSlug === competitionSlug &&
        competition.seasonSlug === seasonSlug,
    ) ?? null
  )
}
