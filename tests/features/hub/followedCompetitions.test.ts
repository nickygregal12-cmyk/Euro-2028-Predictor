import { describe, expect, it } from 'vitest'
import { catalogueFromPublishedSeasons } from '../../../src/features/hub/competitionCatalogue'
import { presentPlayerCompetitions } from '../../../src/features/hub/playerCompetitions'
import type { HubSeasonMembership } from '../../../src/services/supabase/competitionGames'
import type { PublishedWeeklySeason } from '../../../src/services/supabase/weeklyCatalogueModel'
import { mapPlayerPreferences } from '../../../src/services/supabase/playerPreferencesModel'

/**
 * `MIG-UI-10`, consumed — Follow is read, and a followed competition is the
 * player's whether or not they have joined a game in it.
 *
 * WHAT THIS REPLACES. `followed` was the literal string `'unknown'` for every
 * competition in the product, because contract 157's persistence existed and
 * nothing called it. The consequence was not cosmetic: a player who followed
 * the Premier League and joined nothing was invisible to their own Hub, their
 * own rail and their own competition switcher.
 *
 * THE THREE PROPERTIES THESE ASSERTIONS PIN.
 *
 *   1. Follow and game membership are UNIONED. Either one alone makes a
 *      competition the player's, and neither may hide one the other includes.
 *   2. A failed or absent preference read produces `'unknown'`, never `false`.
 *      "We did not ask" and "they said no" send a player to different screens.
 *   3. A favourite club is per competition and never reorders anything.
 */

function season(name: string, slug: string): PublishedWeeklySeason {
  return {
    competitionSlug: slug,
    seasonKey: '2026-27',
    competitionId: `competition-${slug}`,
    competitionName: name,
    seasonId: `season-${slug}`,
    seasonName: `${name} 2026/27`,
    status: 'active',
    timeZone: 'Europe/London',
  }
}

function membership(name: string, slug: string, joined: boolean): HubSeasonMembership {
  return {
    seasonName: `${name} 2026/27`,
    tournamentId: `season-${slug}`,
    seasonStatus: 'active',
    seasonGames: {
      competitionMember: joined,
      serverNow: null,
      games: [
        {
          id: `${slug}-mp`,
          gameKey: 'main_predictor',
          active: true,
          displayName: 'Match Predictor',
          registrationOpensAt: null,
          registrationClosesAt: null,
          completedAt: null,
          allowRejoin: true,
          membership: joined
            ? { status: 'active', joinedAt: null, leftAt: null, disqualifiedAt: null }
            : null,
        },
      ],
    },
  }
}

const PUBLISHED = [season('Premier League', 'premier-league'), season('Bundesliga', 'bundesliga')]
const SEASONS = [
  membership('Premier League', 'premier-league', true),
  membership('Bundesliga', 'bundesliga', false),
]
const CATALOGUE = catalogueFromPublishedSeasons(PUBLISHED, SEASONS)

describe('a followed competition is the player’s without a game', () => {
  it('includes a competition the player follows and has joined nothing in', () => {
    const preferences = mapPlayerPreferences({
      follows: [{ tournament_id: 'season-bundesliga', favourite_team_id: null }],
    })

    const player = presentPlayerCompetitions(CATALOGUE, SEASONS, { preferences })

    expect(player.mine.map((entry) => entry.competition.name)).toEqual([
      'Premier League',
      'Bundesliga',
    ])
    const bundesliga = player.mine.find((entry) => entry.competition.name === 'Bundesliga')!
    expect(bundesliga.followed).toBe(true)
    // Followed, and NOT given an invented membership on the way in.
    expect(bundesliga.joinedGames).toEqual([])
  })

  it('keeps a joined competition the player never followed', () => {
    const preferences = mapPlayerPreferences({ follows: [] })

    const player = presentPlayerCompetitions(CATALOGUE, SEASONS, { preferences })

    const premier = player.mine.find((entry) => entry.competition.name === 'Premier League')!
    expect(premier.followed).toBe(false)
    expect(premier.joinedGames).toEqual(['main_predictor'])
    expect(player.mine).toHaveLength(1)
  })

  it('reports that Follow answered the question once the preference read landed', () => {
    const player = presentPlayerCompetitions(CATALOGUE, SEASONS, {
      preferences: mapPlayerPreferences({ follows: [] }),
    })

    expect(player.relevanceSource).toBe('follow')
  })
})

describe('an unread preference is unknown, never a no', () => {
  it('reports unknown and falls back to game membership when preferences are absent', () => {
    const player = presentPlayerCompetitions(CATALOGUE, SEASONS)

    expect(player.relevanceSource).toBe('game-membership')
    expect(player.mine).toHaveLength(1)
    expect(player.mine[0]?.followed).toBe('unknown')
    expect(player.mine[0]?.favourite).toBe('unknown')
  })

  it('treats an explicitly failed read the same way as an absent one', () => {
    const player = presentPlayerCompetitions(CATALOGUE, SEASONS, { preferences: null })

    expect(player.mine[0]?.followed).toBe('unknown')
  })
})

describe('a favourite club is prominence and nothing else', () => {
  it('resolves the favourite for the competition it was set in, and no other', () => {
    const preferences = mapPlayerPreferences({
      follows: [
        { tournament_id: 'season-premier-league', favourite_team_id: 'team-arsenal' },
        { tournament_id: 'season-bundesliga', favourite_team_id: null },
      ],
    })

    const player = presentPlayerCompetitions(CATALOGUE, SEASONS, { preferences })

    const premier = player.mine.find((entry) => entry.competition.name === 'Premier League')!
    const bundesliga = player.mine.find((entry) => entry.competition.name === 'Bundesliga')!
    expect(premier.favourite).toBe(true)
    expect(premier.favouriteTeamId).toBe('team-arsenal')
    expect(bundesliga.favourite).toBe(false)
    expect(bundesliga.favouriteTeamId).toBeNull()
  })

  it('does not let a favourite promote a competition above one with more games', () => {
    // Bundesliga is followed with a favourite club and has no game joined;
    // the Premier League has a game and no favourite. Games win.
    const preferences = mapPlayerPreferences({
      follows: [{ tournament_id: 'season-bundesliga', favourite_team_id: 'team-bayern' }],
    })

    const player = presentPlayerCompetitions(CATALOGUE, SEASONS, { preferences })

    expect(player.mine[0]?.competition.name).toBe('Premier League')
  })
})
