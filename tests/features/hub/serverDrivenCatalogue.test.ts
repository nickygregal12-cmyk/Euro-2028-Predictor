import { describe, expect, it } from 'vitest'
import {
  catalogueFromPublishedSeasons,
  competitionPath,
} from '../../../src/features/hub/competitionCatalogue'
import { presentPlayerCompetitions } from '../../../src/features/hub/playerCompetitions'
import { presentExplore } from '../../../src/features/hub/exploreModel'
import {
  mapPublishedWeeklySeasons,
  type PublishedWeeklySeason,
} from '../../../src/services/supabase/weeklyCatalogueModel'

/**
 * `MIG-UI-12`, closed — which competitions exist AND where each one lives are
 * both the server's answer (contract 147).
 *
 * WHAT THIS PROTECTS. Publishing a new league must need the backend to publish
 * it and nothing else: no edit to global navigation, and no edit to a frontend
 * competition array either to make it EXIST or to make it OPENABLE. Until
 * contract 147 one frontend edit remained — the route slug, because
 * `public.competitions.slug` is revoked from every browser role — and the
 * previous version of this file pinned exactly where that boundary sat. The
 * boundary is gone, so these assertions now pin its absence: there is no static
 * competition array left to fall back to, and a season the server publishes is
 * routable the moment it does.
 *
 * WHY THE `kind` FILTER IS NOT RE-TESTED HERE. It is enforced inside the RPC and
 * proved by the migration's own guard, which is where an `EURO-001` safety
 * property belongs. A browser-side re-filter would be a second opinion about
 * what the weekly platform publishes, and adding one would make it possible for
 * the two to disagree.
 */

function season(
  competitionName: string,
  slug: string,
  status: PublishedWeeklySeason['status'] = 'active',
): PublishedWeeklySeason {
  return {
    competitionSlug: slug,
    seasonKey: '2026-27',
    competitionId: `competition-${slug}`,
    competitionName,
    seasonId: `season-${slug}`,
    seasonName: `${competitionName} 2026/27`,
    status,
    timeZone: 'Europe/London',
  }
}

describe('the catalogue is discovered, not declared', () => {
  it('routes a newly published competition with no frontend edit at all', () => {
    const catalogue = catalogueFromPublishedSeasons([season('Bundesliga', 'bundesliga')], [])
    const player = presentPlayerCompetitions(catalogue, [])

    // It exists, it is named, and it opens — immediately.
    expect(player.catalogue.map((entry) => entry.name)).toEqual(['Bundesliga'])
    expect(competitionPath(player.catalogue[0]!)).toBe('/competitions/bundesliga/2026-27')

    // And it is not counted as one of the player's, because they hold no
    // membership row in it.
    expect(player.mine).toHaveLength(0)

    // Explore lists it as an ordinary, openable competition. The
    // "Newly published, not openable" group this view used to need is gone,
    // because the state it described cannot occur any more.
    const explore = presentExplore(player, '')
    expect(explore.groups.flatMap((group) => group.entries).map((entry) => entry.competition.name))
      .toEqual(['Bundesliga'])
  })

  it('never invents a route for a competition, and never derives one from a name', () => {
    // The slug is a server-owned identifier. A season whose slug disagrees with
    // its display name proves nothing is derived: a name-derived slug would be
    // `bundesliga` and would 404.
    const catalogue = catalogueFromPublishedSeasons(
      [season('Bundesliga', 'de-bundesliga-1')],
      [],
    )
    expect(competitionPath(catalogue[0]!)).toBe('/competitions/de-bundesliga-1/2026-27')
  })

  it('drops a season the server sent without both halves of its address', () => {
    // A payload missing `competition_slug` or `season_key` cannot produce a
    // URL, and a listed competition that cannot be opened is the failure this
    // contract removed. Dropping it is safer than offering a broken link.
    const decoded = mapPublishedWeeklySeasons({
      seasons: [
        {
          competition_slug: 'premier-league',
          season_key: '2026-27',
          competition_id: 'competition-1',
          competition_name: 'Premier League',
          season_id: 'season-1',
          season_name: 'Premier League 2026/27',
          status: 'active',
          time_zone: 'Europe/London',
        },
        { competition_name: 'Half a season', season_id: 'season-2' },
      ],
    })
    expect(decoded.map((entry) => entry.competitionSlug)).toEqual(['premier-league'])
  })

  it('does not decide publication in the browser — a draft is the server’s to omit', () => {
    // The RPC excludes `draft` itself, so nothing here re-filters. A frontend
    // that also filtered would be a second publication rule, and Production —
    // where both league seasons are draft — correctly gets an empty catalogue
    // from the server rather than an empty one from the client.
    const catalogue = catalogueFromPublishedSeasons(
      [season('Serie A', 'serie-a', 'scheduled')],
      [],
    )
    expect(catalogue.map((entry) => entry.status)).toEqual(['upcoming'])
  })

  it('searches the whole published catalogue, so a growing one stays findable', () => {
    const catalogue = catalogueFromPublishedSeasons(
      [season('Bundesliga', 'bundesliga'), season('Serie A', 'serie-a')],
      [],
    )
    const player = presentPlayerCompetitions(catalogue, [])

    expect(
      presentExplore(player, 'bundes').groups.flatMap((group) => group.entries),
    ).toHaveLength(1)
    expect(presentExplore(player, 'bundes').noMatches).toBe(false)
    expect(presentExplore(player, 'zzzz').noMatches).toBe(true)
  })

  it('has nothing to fall back to, and says so rather than inventing a platform', () => {
    // A catalogue read that answered nothing produces an empty catalogue —
    // never a hand-written pair of competitions standing in for the server.
    const player = presentPlayerCompetitions(catalogueFromPublishedSeasons([], []), [])
    expect(player.catalogue).toEqual([])
    expect(player.empty).toBe(true)
  })
})
