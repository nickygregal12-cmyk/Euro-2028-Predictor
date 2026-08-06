import { describe, expect, it } from 'vitest'
import { HUB_COMPETITIONS } from '../../../src/features/hub/competitionCatalogue'
import { presentCompetitionChooser } from '../../../src/features/hub/competitionChooserModel'
import type { HubSeasonMembership } from '../../../src/services/supabase/competitionGames'

function season(name: string, member: boolean): HubSeasonMembership {
  return {
    seasonName: name,
    tournamentId: `id-${name}`,
    seasonStatus: 'active',
    seasonGames: { competitionMember: member, serverNow: '2026-08-06T12:00:00Z', games: [] },
  }
}

const PREMIER = 'Premier League 2026/27'
const SCOTTISH = 'Scottish Premiership 2026/27'

describe('presentCompetitionChooser', () => {
  it('sends each competition to the section the tab is for', () => {
    const play = presentCompetitionChooser(HUB_COMPETITIONS, [season(PREMIER, true)], 'play')
    const matches = presentCompetitionChooser(HUB_COMPETITIONS, [season(PREMIER, true)], 'matches')
    const leagues = presentCompetitionChooser(HUB_COMPETITIONS, [season(PREMIER, true)], 'leagues')

    expect(play.destinations[0].href).toBe('/competitions/premier-league/2026-27/play')
    expect(matches.destinations[0].href).toBe('/competitions/premier-league/2026-27/matches')
    expect(leagues.destinations[0].href).toBe('/competitions/premier-league/2026-27/leagues')
  })

  it('lists only what the server says the caller has joined', () => {
    // Following a competition is not game entry (ADR 0011), and a chooser
    // offering somewhere the player cannot play is a dead end wearing a link.
    const view = presentCompetitionChooser(
      HUB_COMPETITIONS,
      [season(PREMIER, true), season(SCOTTISH, false)],
      'play',
    )

    expect(view.destinations.map((d) => d.name)).toEqual(['Premier League'])
  })

  it('never takes membership from the static catalogue', () => {
    // `HUB_COMPETITIONS` carries placeholder `joined` flags; a chooser built
    // from the constant would confidently offer competitions never entered.
    const view = presentCompetitionChooser(HUB_COMPETITIONS, [], 'play')

    expect(view.destinations).toEqual([])
    expect(view.empty).toBe(true)
  })

  it('lists several joined competitions, because a player may follow more than one', () => {
    const view = presentCompetitionChooser(
      HUB_COMPETITIONS,
      [season(PREMIER, true), season(SCOTTISH, true)],
      'matches',
    )

    expect(view.destinations).toHaveLength(2)
    expect(view.destinations.map((d) => d.href)).toEqual([
      '/competitions/premier-league/2026-27/matches',
      '/competitions/scottish-premiership/2026-27/matches',
    ])
  })

  it('keeps the same shape at one competition as at several', () => {
    // Deliberately not collapsed to a redirect: it would hide which
    // competition answered, and a screen the player had never seen would
    // appear the first time they joined a second one.
    const view = presentCompetitionChooser(HUB_COMPETITIONS, [season(PREMIER, true)], 'play')

    expect(view.empty).toBe(false)
    expect(view.destinations).toHaveLength(1)
  })

  it('says what each list is for', () => {
    expect(presentCompetitionChooser(HUB_COMPETITIONS, [], 'matches').intro).toMatch(
      /fixtures and results/,
    )
  })

  it('ignores a season the catalogue does not describe', () => {
    // The catalogue is the presentation authority for what a competition is
    // called; a season the server lists and it does not cannot be named.
    const view = presentCompetitionChooser(
      HUB_COMPETITIONS,
      [season('Some Other League 2030/31', true)],
      'play',
    )

    expect(view.destinations).toEqual([])
  })
})
