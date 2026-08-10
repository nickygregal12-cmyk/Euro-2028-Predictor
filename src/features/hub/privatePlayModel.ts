import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'
import type { GameLeague } from '../../services/supabase/gameLeagues'

/**
 * Every private league and private competition the player actually belongs to,
 * across every game and every football competition, in one list.
 *
 * WHAT IT REPLACES. `/leagues` used to be a competition chooser: pick a
 * competition, then see its private leagues. The 10 August 2026 authority
 * retires that — "do not force the player to remember which football
 * competition a private league belongs to before they can find it" — and the
 * old shape asked exactly that. Private play is where a player's friends are;
 * it is the last thing that should be filed behind a football taxonomy.
 *
 * THE CONTAINER NAMES ITS OWN CONTEXT INSTEAD. Each card carries competition,
 * season and game, because "The Saturday Crew" is meaningless on its own once a
 * player has two of them in different competitions — which is the same
 * scalability argument as the rail's, applied to content rather than
 * navigation.
 *
 * ONE GAME'S PRIVATE PLAY IS NOT ANOTHER'S. ADR 0011 keeps each game's
 * standings its own and `leagues.game_competition_id` says the same in storage,
 * so the game is a fact about each container rather than a filter this model
 * invents. A Match Predictor league and a Last Man Standing competition sharing
 * one list is a presentation decision; sharing one TABLE would not be, and
 * nothing here merges a standing.
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
  inviteCode: string
  competitionName: string
  seasonLabel: string
  gameKey: PrivatePlayGameKind
  gameName: string
  memberLine: string
  ownerLine: string
  /** Where this container's own surface is, when it has one. */
  href: string | null
}

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
  /** Competitions whose private play could not be read, by name. */
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

export function presentPrivatePlay(
  sources: readonly PrivatePlaySource[],
  unreadable: readonly string[],
  filter: PrivatePlayFilter = 'all',
): PrivatePlayView {
  const all: PrivatePlayEntry[] = []

  for (const source of sources) {
    for (const league of source.leagues) {
      all.push({
        // The league id is unique across games and competitions, so it keys
        // rows without help from the position in the list.
        key: league.id,
        name: league.name,
        inviteCode: league.inviteCode,
        competitionName: source.competitionName,
        seasonLabel: source.seasonLabel,
        gameKey: source.gameKey,
        gameName: PRIVATE_PLAY_GAME_NAME[source.gameKey],
        memberLine: memberLine(league.memberCount),
        ownerLine: league.isOwner ? 'You own this' : `Owned by ${league.ownerName}`,
        href: source.href,
      })
    }
  }

  // Largest first, then by name: a fifteen-person league is more likely the one
  // being looked for than a two-person one, and the name breaks ties stably so
  // the list does not reorder between visits.
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
