import { competitionSectionRoute, type CompetitionSection } from '../../app/weeklyRoutes'
import type { HubCompetition } from './competitionCatalogue'
import type { HubSeasonMembership } from '../../services/supabase/competitionGames'

export type ChooserSection = Extract<CompetitionSection, 'play' | 'matches' | 'leagues'>

export type ChooserDestination = {
  key: string
  name: string
  seasonLabel: string
  href: string
}

export type CompetitionChooserView = {
  destinations: readonly ChooserDestination[]
  empty: boolean
  intro: string
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
      href: competitionSectionRoute(competition, section),
    }))

  return {
    destinations,
    empty: destinations.length === 0,
    intro: SECTION_INTRO[section],
  }
}
