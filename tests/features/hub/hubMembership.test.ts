import { describe, expect, it } from 'vitest'
import { applyHubMembership } from '../../../src/features/hub/hubMembership'
import type { HubCompetition } from '../../../src/features/hub/competitionCatalogue'
import type { HubSeasonMembership } from '../../../src/services/supabase/competitionGames'

function entry(overrides: Partial<HubCompetition> = {}): HubCompetition {
  return {
    competitionSlug: 'premier-league',
    seasonSlug: '2026-27',
    seasonRowName: 'Premier League 2026/27',
    name: 'Premier League',
    seasonLabel: '2026/27',
    status: 'upcoming',
    summary: 'A summary.',
    games: [
      {
        kind: 'league-predictor',
        gameKey: 'main_predictor',
        name: 'Main Predictor',
        description: 'A description.',
        joined: false,
        status: 'coming-soon',
      },
    ],
    ...overrides,
  }
}

function season(overrides: Partial<HubSeasonMembership> = {}): HubSeasonMembership {
  return {
    seasonName: 'Premier League 2026/27',
    tournamentId: '60000000-0000-0000-0000-000000000001',
    seasonStatus: 'draft',
    seasonGames: {
      competitionMember: false,
      games: [{ gameKey: 'main_predictor', active: false, membership: null }],
    },
    ...overrides,
  }
}

function withGame(
  membershipStatus: string | null,
  active: boolean,
): HubSeasonMembership {
  return season({
    seasonGames: {
      competitionMember: membershipStatus === 'active',
      games: [
        {
          gameKey: 'main_predictor',
          active,
          membership: membershipStatus === null ? null : { status: membershipStatus, joinedAt: null },
        },
      ],
    },
  })
}

describe('applyHubMembership', () => {
  it('marks a game joined only for an active membership', () => {
    const joined = applyHubMembership([entry()], [withGame('active', true)])
    const left = applyHubMembership([entry()], [withGame('left', true)])

    expect(joined.competitions[0]?.games[0]).toMatchObject({ joined: true, status: 'joined' })
    expect(left.competitions[0]?.games[0]).toMatchObject({ joined: false, status: 'available' })
  })

  it('shows an unjoined game as available only while the server says it is active', () => {
    const active = applyHubMembership([entry()], [withGame(null, true)])
    const inactive = applyHubMembership([entry()], [withGame(null, false)])

    expect(active.competitions[0]?.games[0]?.status).toBe('available')
    expect(inactive.competitions[0]?.games[0]?.status).toBe('coming-soon')
  })

  it('keeps membership for a game the server did not list unclaimed', () => {
    const result = applyHubMembership(
      [entry()],
      [season({ seasonGames: { competitionMember: false, games: [] } })],
    )

    expect(result.competitions[0]?.games[0]).toMatchObject({
      joined: false,
      status: 'coming-soon',
    })
  })

  it('leaves an unresolved catalogue entry untouched and names it', () => {
    const untouched = entry({ seasonRowName: 'La Liga 2026/27' })
    const result = applyHubMembership([untouched], [season()])

    expect(result.competitions[0]).toBe(untouched)
    expect(result.unresolved).toEqual(['La Liga 2026/27'])
  })

  it('maps the season lifecycle onto the display status', () => {
    expect(
      applyHubMembership([entry()], [season({ seasonStatus: 'active' })]).competitions[0]?.status,
    ).toBe('live')
    expect(
      applyHubMembership([entry()], [season({ seasonStatus: 'complete' })]).competitions[0]
        ?.status,
    ).toBe('ended')
    expect(
      applyHubMembership([entry({ status: 'live' })], [season({ seasonStatus: 'draft' })])
        .competitions[0]?.status,
    ).toBe('upcoming')
  })

  it('keeps the parked product label regardless of the season lifecycle', () => {
    const parked = entry({ status: 'parked', seasonRowName: 'UEFA Euro 2028' })
    const result = applyHubMembership(
      [parked],
      [season({ seasonName: 'UEFA Euro 2028', seasonStatus: 'scheduled' })],
    )

    expect(result.competitions[0]?.status).toBe('parked')
  })

  it('keeps the presentation status when the season status is unknown', () => {
    const result = applyHubMembership([entry({ status: 'live' })], [season({ seasonStatus: null })])

    expect(result.competitions[0]?.status).toBe('live')
  })
})
