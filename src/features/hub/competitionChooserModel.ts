import type { HubCompetition } from './competitionCatalogue'
import { competitionPath } from './competitionCatalogue'
import type { HubSeasonMembership } from '../../services/supabase/competitionGames'

/**
 * The global navigation's answer to "which competition?".
 *
 * WHY THIS EXISTS. The bottom bar is the one part of the interface that never
 * got converted when this became a multi-competition platform. Its tabs are
 * right — §7.2's rail contract names Hub, Predict, Leagues, Games and More —
 * but Predict went to `/predict`, Matches to `/matches` and League to
 * `/league`, and all three are the EURO TOURNAMENT'S journeys: they read
 * `useTournamentData()`. A player who joined the Scottish Premiership tapped
 * Predict in the bottom bar and landed in Euro 2028. Every season surface
 * lives under `/competitions/…` and could only be reached by going Home first.
 *
 * A GLOBAL TAB CANNOT NAME ONE COMPETITION, because a player may follow
 * several and the platform holds no notion of a current one. §7.5's onboarding
 * marks a favourite as optional and nothing persists it, so inventing "your
 * competition" here would be a preference this repository has never stored.
 * The honest answer is to ask, and to make asking cheap: one joined
 * competition is one tap, and the tap is still shown rather than redirected
 * past, because a redirect hides which competition answered.
 *
 * IT LISTS JOINED COMPETITIONS ONLY. Following a competition is not game
 * entry (ADR 0011), and a chooser offering somewhere the player cannot play is
 * a dead end wearing a link. A player with none is sent to the Hub, which is
 * where joining happens.
 *
 * MEMBERSHIP IS THE SERVER'S, NEVER THE CATALOGUE'S. `HUB_COMPETITIONS` is a
 * static presentation list and its `joined` flags are placeholders; the games
 * hub read is what knows. A chooser built from the constant would confidently
 * offer competitions the player never entered.
 */

export type ChooserSection = 'play' | 'matches' | 'leagues'

export type ChooserDestination = {
  key: string
  name: string
  seasonLabel: string
  /** The section of that competition this tab leads to. */
  href: string
}

export type CompetitionChooserView = {
  destinations: readonly ChooserDestination[]
  /** True when the player has joined nothing; the Hub is the way out. */
  empty: boolean
  /** One sentence naming what this list is for. */
  intro: string
}

const SECTION_PATH: Record<ChooserSection, string> = {
  play: '/play',
  matches: '/matches',
  leagues: '/leagues',
}

const SECTION_INTRO: Record<ChooserSection, string> = {
  play: 'Choose a competition to see the games you have joined in it.',
  matches: 'Choose a competition to see its fixtures and results.',
  leagues: 'Choose a competition to see its private leagues.',
}

export function presentCompetitionChooser(
  catalogue: readonly HubCompetition[],
  seasons: readonly HubSeasonMembership[],
  section: ChooserSection,
): CompetitionChooserView {
  // Matched by the catalogue's exact season row name, which is the same join
  // every season route makes. A slug is never turned into an identifier.
  const joined = new Set(
    seasons
      .filter((season) => season.seasonGames.competitionMember)
      .map((season) => season.seasonName),
  )

  const destinations = catalogue
    .filter((competition) => joined.has(competition.seasonRowName))
    .map((competition) => ({
      key: competition.seasonRowName,
      name: competition.name,
      seasonLabel: competition.seasonLabel,
      href: `${competitionPath(competition)}${SECTION_PATH[section]}`,
    }))

  return {
    destinations,
    empty: destinations.length === 0,
    intro: SECTION_INTRO[section],
  }
}
