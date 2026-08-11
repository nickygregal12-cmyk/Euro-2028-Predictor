import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/services/supabase/client', () => ({
  db: { rpc: mocks.rpc },
}))

import { fetchLeagueMatchPicks } from '../../src/services/supabase/matchCentre'

/**
 * Contract 171's two keys on `get_league_match_picks`, decoded.
 *
 * The cap itself is old and deliberate. What contract 171 added is the server
 * SAYING it applied, so a surface can tell a truncated list from members who did
 * not predict — a distinction the payload previously made impossible.
 */

const LEAGUE = '70000000-0000-0000-0000-000000000001'
const MATCH = '70000000-0000-0000-0000-000000000002'

function groupPayload(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'group',
    locked: true,
    total_members: 300,
    predicted_count: 260,
    picks_returned: 250,
    picks_truncated: true,
    picks: [
      { display_name: 'Alex', is_you: true, home_score: 2, away_score: 1, joker: false },
      { display_name: 'Sam', is_you: false, home_score: 1, away_score: 1, joker: true },
    ],
    ...overrides,
  }
}

describe('fetchLeagueMatchPicks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carries the truncation the server reported', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: groupPayload(), error: null })

    const picks = await fetchLeagueMatchPicks(LEAGUE, MATCH)

    expect(picks.picksReturned).toBe(250)
    expect(picks.picksTruncated).toBe(true)
    // The league's real size is unchanged by the cap, and stays the denominator.
    expect(picks.totalMembers).toBe(300)
  })

  it('does not invent truncation from the arithmetic', async () => {
    // Two rows out of three hundred members is the ordinary shape of a match
    // most of the league has not predicted. Only the server's flag says capped.
    mocks.rpc.mockResolvedValueOnce({
      data: groupPayload({ picks_returned: 2, picks_truncated: false }),
      error: null,
    })

    const picks = await fetchLeagueMatchPicks(LEAGUE, MATCH)

    expect(picks.picksTruncated).toBe(false)
  })

  it('reads a server that predates contract 171 as untruncated', async () => {
    const { picks_returned: _r, picks_truncated: _t, ...older } = groupPayload()
    mocks.rpc.mockResolvedValueOnce({ data: older, error: null })

    const picks = await fetchLeagueMatchPicks(LEAGUE, MATCH)

    expect(picks.picksReturned).toBe(2)
    expect(picks.picksTruncated).toBe(false)
    expect(picks.groupPicks).toHaveLength(2)
  })

  it('carries it on the knockout shape too', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        kind: 'knockout',
        locked: true,
        total_members: 412,
        predicted_count: 412,
        picks_returned: 250,
        picks_truncated: true,
        picks: [{ display_name: 'Alex', is_you: true, home_stage: 'sf', away_stage: null }],
      },
      error: null,
    })

    const picks = await fetchLeagueMatchPicks(LEAGUE, MATCH)

    expect(picks.kind).toBe('knockout')
    expect(picks.picksTruncated).toBe(true)
    expect(picks.koPicks[0]).toMatchObject({ homeStage: 'SF', awayStage: null })
  })
})
