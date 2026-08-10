import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'
import type { HubCompetition } from './competitionCatalogue'
import type { PlayerCompetitions, UnroutableSeason } from './playerCompetitions'

/**
 * The published catalogue, arranged for discovery rather than navigation.
 *
 * IT IS BUILT FOR A CATALOGUE THAT GROWS. The player's own competitions are
 * pinned above everything else and the rest are searchable, so twenty
 * competitions do not become one flat wall of equal cards. The grouping seam is
 * deliberately general — a group is a title and a list — so region, competition
 * type or popularity can be added when the catalogue carries the facts to group
 * by. It does not carry them today, and inventing a taxonomy from competition
 * names would be a guess rendered as a heading.
 *
 * A NEWLY PUBLISHED COMPETITION APPEARS HERE THE MOMENT THE SERVER HOLDS IT
 * (`MIG-UI-12`), whether or not the static catalogue knows its route slug. One
 * without a slug is listed under its own heading, named and unopenable, rather
 * than omitted — a competition that exists but is invisible because a frontend
 * array was not edited is the failure the server-driven catalogue replaced, and
 * silently dropping it here would reintroduce it one layer down.
 *
 * MEMBERSHIP IS REPORTED, FOLLOWING IS NOT CLAIMED. `playing` is the games the
 * server says the player has joined here. Nothing in this model says a player
 * follows a competition, because nothing can store that yet (`MIG-UI-10`) and
 * saying it from a game membership would collapse two choices the authority
 * keeps apart.
 *
 * PURE.
 */

export type ExploreEntry = {
  key: string
  competition: HubCompetition
  /** The games the player has joined here. Empty is the ordinary case. */
  playing: readonly CompetitionGameKey[]
}

export type ExploreGroup = {
  key: string
  title: string
  /** A sentence under the heading, where the group needs explaining. */
  note: string | null
  entries: readonly ExploreEntry[]
}

export type ExploreView = {
  groups: readonly ExploreGroup[]
  /**
   * Published seasons the frontend cannot open yet, matching the search.
   * Rendered as text, never as links.
   */
  unroutable: readonly UnroutableSeason[]
  /** True when a search matched nothing — distinct from an empty catalogue. */
  noMatches: boolean
}

function matches(competition: HubCompetition, query: string): boolean {
  if (query.trim() === '') return true
  const needle = query.trim().toLowerCase()
  return (
    competition.name.toLowerCase().includes(needle) ||
    competition.seasonLabel.toLowerCase().includes(needle)
  )
}

export function presentExplore(
  player: PlayerCompetitions | null,
  query: string,
): ExploreView {
  const catalogue = player?.catalogue ?? []
  const playingByName = new Map(
    (player?.mine ?? []).map((entry) => [entry.competition.seasonRowName, entry.joinedGames]),
  )

  const visible = catalogue.filter((competition) => matches(competition, query))
  const mine: ExploreEntry[] = []
  const rest: ExploreEntry[] = []

  for (const competition of visible) {
    const playing = playingByName.get(competition.seasonRowName) ?? []
    const entry: ExploreEntry = { key: competition.seasonRowName, competition, playing }
    if (playing.length > 0) mine.push(entry)
    else rest.push(entry)
  }

  const groups: ExploreGroup[] = []
  if (mine.length > 0) {
    groups.push({
      key: 'mine',
      title: 'Your competitions',
      note: null,
      entries: mine,
    })
  }
  if (rest.length > 0) {
    groups.push({
      key: 'all',
      title: mine.length > 0 ? 'More competitions' : 'Competitions',
      // Said once, where a player is deciding: opening a competition is free,
      // joining a game inside it is the commitment.
      note: 'Open a competition to see its fixtures and the games it runs.',
      entries: rest,
    })
  }

  const unroutable = (player?.unroutable ?? []).filter(
    (season) => query.trim() === '' || season.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return {
    groups,
    unroutable,
    noMatches: visible.length === 0 && unroutable.length === 0 && catalogue.length > 0,
  }
}
