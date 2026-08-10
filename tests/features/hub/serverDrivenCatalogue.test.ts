import { describe, expect, it } from 'vitest'
import { HUB_COMPETITIONS } from '../../../src/features/hub/competitionCatalogue'
import { presentPlayerCompetitions } from '../../../src/features/hub/playerCompetitions'
import { presentExplore } from '../../../src/features/hub/exploreModel'
import type { PublishedSeason } from '../../../src/services/supabase/publishedSeasons'

/**
 * `MIG-UI-12` — which competitions exist is the server's answer, not a frontend
 * array's.
 *
 * THE END STATE THIS PROTECTS. Publishing a new league should need the backend
 * to publish it and nothing else: no edit to global navigation, and no edit to
 * a hard-coded frontend competition array merely to make it exist. Until
 * `MIG-UI-12` exposes a route slug, one frontend edit remains — the slug — and
 * these assertions pin exactly where that boundary is, so it cannot quietly
 * widen back into "the array decides what exists".
 *
 * WHAT THE AUDIT ESTABLISHED, in one place:
 *
 * - `public.tournaments` is readable to `authenticated` and carries season id,
 *   name, `season_key`, `kind`, `status` and `display_timezone`.
 * - `kind = 'league_season'` is the canonical weekly-platform discriminator, so
 *   Euro (`kind = 'tournament'`) is excluded by its own stored kind rather than
 *   by an allowlist, and its separate publication boundary is untouched.
 * - `public.competitions` — which holds `slug` — is revoked from
 *   `authenticated`, so the route segment cannot be read in a browser.
 * - `get_competition_games(uuid)` describes a season and cannot enumerate one.
 */

function season(name: string, status: PublishedSeason['status'] = 'active'): PublishedSeason {
  return {
    id: `id-${name}`,
    name,
    seasonKey: '2026-27',
    status,
    timeZone: 'Europe/London',
  }
}

describe('the catalogue is discovered, not declared', () => {
  it('lists a newly published competition the static catalogue has never heard of', () => {
    const player = presentPlayerCompetitions(HUB_COMPETITIONS, [], undefined, [
      season('Bundesliga 2026/27'),
    ])

    // It exists, immediately, with no frontend edit.
    expect(player.unroutable.map((entry) => entry.name)).toEqual(['Bundesliga 2026/27'])
    const explore = presentExplore(player, '')
    expect(explore.unroutable.map((entry) => entry.name)).toEqual(['Bundesliga 2026/27'])
  })

  it('never invents a route for a competition whose slug it cannot read', () => {
    // `public.competitions.slug` is revoked from `authenticated`. A slug guessed
    // from the stored name would be a client-side invention of a server-owned
    // identifier, and would 404 the moment the two disagreed.
    const player = presentPlayerCompetitions(HUB_COMPETITIONS, [], undefined, [
      season('Bundesliga 2026/27'),
    ])
    expect(player.catalogue.map((entry) => entry.seasonRowName)).not.toContain(
      'Bundesliga 2026/27',
    )
    // And it is not counted as one of the player's, because they cannot be in
    // something with no membership row.
    expect(player.mine).toHaveLength(0)
  })

  it('does not advertise a draft season', () => {
    // `status` is a lifecycle rather than a publication decision, and this is
    // the one judgement the model makes with it: nobody has scheduled a draft.
    const player = presentPlayerCompetitions(HUB_COMPETITIONS, [], undefined, [
      season('Bundesliga 2026/27', 'draft'),
      season('Serie A 2026/27', 'scheduled'),
    ])
    expect(player.unroutable.map((entry) => entry.name)).toEqual(['Serie A 2026/27'])
  })

  it('does not duplicate a season the static catalogue already routes', () => {
    const known = HUB_COMPETITIONS[0]
    expect(known).toBeDefined()
    const player = presentPlayerCompetitions(HUB_COMPETITIONS, [], undefined, [
      season(known?.seasonRowName ?? ''),
    ])
    // It is routable, so it belongs to the catalogue and not to the
    // cannot-open-this list.
    expect(player.unroutable).toHaveLength(0)
  })

  it('searches the unroutable ones too, so a growing catalogue stays findable', () => {
    const player = presentPlayerCompetitions(HUB_COMPETITIONS, [], undefined, [
      season('Bundesliga 2026/27'),
      season('Serie A 2026/27'),
    ])
    expect(presentExplore(player, 'bundes').unroutable).toHaveLength(1)
    expect(presentExplore(player, 'bundes').noMatches).toBe(false)
    expect(presentExplore(player, 'zzzz').noMatches).toBe(true)
  })

  it('keeps the static catalogue as presentation metadata rather than as truth', () => {
    // With no server answer the frontend still renders what it knows, so a
    // discovery failure degrades to the previous behaviour rather than to an
    // empty platform. That is the fallback classification, stated as a test.
    const player = presentPlayerCompetitions(HUB_COMPETITIONS, [], undefined, [])
    expect(player.catalogue).toEqual(HUB_COMPETITIONS)
    expect(player.unroutable).toHaveLength(0)
  })
})
