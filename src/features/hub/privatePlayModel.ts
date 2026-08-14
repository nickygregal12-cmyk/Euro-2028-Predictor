import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'
import type { GameLeague } from '../../services/supabase/gameLeagues'
import type { PrivateCompetitionDiscovery } from '../../services/supabase/privateCompetitionDiscovery'

/**
 * Every private league and private competition the player actually belongs to,
 * across every game and every football competition, in one list.
 *
 * TWO STORAGE MODELS, ONE PRESENTATION. Match Predictor private play is an
 * ordinary `league`; Last Man Standing and Predictor Championship private play
 * are private `bonus_competitions`. They share a page because that is useful to
 * the player, never because the browser pretends they share an authority.
 *
 * PURE.
 */

export type PrivatePlayGameKind = Extract<
  CompetitionGameKey,
  'main_predictor' | 'last_man_standing' | 'predictor_cup'
>

export type PrivatePlayEntry = {
  key: string
  name: string
  /** Private bonus containers disclose the live code to the organiser only. */
  inviteCode: string | null
  inviteAvailable: boolean
  competitionName: string
  seasonLabel: string
  gameKey: PrivatePlayGameKind
  gameName: string
  memberLine: string
  ownerLine: string
  statusLine: string | null
  /** Where this container's own surface is, when one is actually routed. */
  href: string | null
}

/** Ordinary Match Predictor private leagues for one public game competition. */
export type PrivatePlaySource = {
  competitionName: string
  seasonLabel: string
  gameKey: PrivatePlayGameKind
  /** Where this game's leagues section lives, when it has one. */
  href: string | null
  leagues: readonly GameLeague[]
}

export type PrivatePlayFilter = 'all' | PrivatePlayGameKind

export type PrivatePlayView = {
  entries: readonly PrivatePlayEntry[]
  /** Counts per filter, so a filter with nothing behind it is not offered. */
  counts: Readonly<Record<PrivatePlayFilter, number>>
  empty: boolean
  /** Authorities whose private play could not be read, by a useful name. */
  unreadable: readonly string[]
}

export const PRIVATE_PLAY_GAME_NAME: Readonly<Record<PrivatePlayGameKind, string>> = {
  main_predictor: 'Match Predictor',
  last_man_standing: 'Last Man Standing',
  predictor_cup: 'Predictor Championship',
}

function memberLine(count: number): string {
  return count === 1 ? '1 member' : `${count} members`
}

function lifecycleLine(value: string | null): string | null {
  switch (value) {
    case 'setup':
      return 'Waiting to start'
    case 'registration_open':
      return 'Open for entries'
    case 'registration_closed':
      return 'Registration closed'
    case 'running':
      return 'In progress'
    case 'completed':
      return 'Finished'
    case 'unavailable':
      return 'Unavailable'
    default:
      return null
  }
}

/**
 * Where an ORDINARY private league opens, given its competition's Leagues
 * address. Bonus-game containers remain null until `MIG-UI-20` gives their
 * workspace a routed frontend destination.
 */
export function privatePlayHref(
  gameKey: PrivatePlayGameKind,
  competitionLeaguesHref: string | null,
): string | null {
  return gameKey === 'main_predictor' ? competitionLeaguesHref : null
}

export function presentPrivatePlay(
  sources: readonly PrivatePlaySource[],
  unreadable: readonly string[],
  filter: PrivatePlayFilter = 'all',
  privateCompetitions: readonly PrivateCompetitionDiscovery[] = [],
): PrivatePlayView {
  const all: PrivatePlayEntry[] = []

  // Ordinary Match Predictor leagues keep their existing authority and route.
  for (const source of sources) {
    for (const league of source.leagues) {
      all.push({
        key: league.id,
        name: league.name,
        inviteCode: league.inviteCode,
        inviteAvailable: true,
        competitionName: source.competitionName,
        seasonLabel: source.seasonLabel,
        gameKey: source.gameKey,
        gameName: PRIVATE_PLAY_GAME_NAME[source.gameKey],
        memberLine: memberLine(league.memberCount),
        ownerLine: league.isOwner ? 'You own this' : `Owned by ${league.ownerName}`,
        statusLine: null,
        href: source.href,
      })
    }
  }

  // Bonus-game containers are caller-addressed by Contract 179. Do not project
  // them into `GameLeague`: that would re-create the read mismatch PPLAY-001 is
  // fixing and would also leak an organiser-only invite code to ordinary members.
  for (const competition of privateCompetitions) {
    all.push({
      key: competition.competitionId,
      name: competition.name,
      inviteCode: competition.inviteCode,
      inviteAvailable: competition.inviteAvailable,
      competitionName: competition.seasonName,
      seasonLabel: competition.seasonKey ?? '',
      gameKey: competition.gameKey,
      gameName: competition.gameName,
      memberLine: memberLine(competition.members),
      ownerLine: competition.isOwner ? 'You own this' : 'You joined this',
      statusLine: lifecycleLine(competition.lifecycleState),
      href: null,
    })
  }

  // Largest first, then by name: a fifteen-person container is more likely the
  // one being looked for than a two-person one, and the name breaks ties stably.
  all.sort((left, right) => {
    const size = right.memberLine.localeCompare(left.memberLine, undefined, { numeric: true })
    return size !== 0 ? size : left.name.localeCompare(right.name)
  })

  const counts: Record<PrivatePlayFilter, number> = {
    all: all.length,
    main_predictor: all.filter((entry) => entry.gameKey === 'main_predictor').length,
    last_man_standing: all.filter((entry) => entry.gameKey === 'last_man_standing').length,
    predictor_cup: all.filter((entry) => entry.gameKey === 'predictor_cup').length,
  }

  return {
    entries: filter === 'all' ? all : all.filter((entry) => entry.gameKey === filter),
    counts,
    empty: all.length === 0,
    unreadable,
  }
}
