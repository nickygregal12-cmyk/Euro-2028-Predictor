import { describe, expect, it } from 'vitest'
import { resolveMatchState, type MatchState } from '../../src/domain/competition/matchState'
import type { ResolvedLockState } from '../../src/domain/competition/lockState'
import { matchTemporalState } from '../../src/domain/tournament/matchCentre'
import { lifecycleFromResolvedMatchState } from '../../src/domain/tournament/matchCentreRepositoryAdapter'
import type { Match } from '../../src/services/supabase/tournamentData'

const UNLOCKED: ResolvedLockState = {
  status: 'open',
  locked: false,
  lockAt: '2028-06-10T18:00:00.000Z',
  reason: 'before_scope_lock',
}

const MATCH: Match = {
  id: 'match-1',
  matchRef: 'M01',
  round: 'group',
  groupId: 'group-a',
  matchday: 1,
  homeSource: 'Scotland',
  awaySource: 'England',
  homeTeamId: 'scotland',
  awayTeamId: 'england',
  matchDate: '2028-06-10',
  kickoffAt: '2028-06-10T18:00:00Z',
  venue: 'Hampden Park',
  homeScore: null,
  awayScore: null,
}

function shared(input: {
  kickoffAt: string | null
  homeScore: number | null
  awayScore: number | null
  now: string
}) {
  return resolveMatchState(
    {
      kickoffAt: input.kickoffAt,
      administrationState: 'scheduled',
      officialState:
        input.homeScore !== null && input.awayScore !== null ? 'confirmed' : 'unconfirmed',
      lockState: UNLOCKED,
      liveData: null,
    },
    new Date(input.now),
  )
}

function lifecycle(state: MatchState, now = '2028-06-10T17:30:00Z') {
  return lifecycleFromResolvedMatchState(MATCH, state, now)
}

describe('Match Centre temporal differential evidence', () => {
  it('captures the legacy pre-kickoff state', () => {
    const match = {
      kickoffAt: '2028-06-10T18:00:00Z',
      homeScore: null,
      awayScore: null,
    }
    expect(matchTemporalState(match)).toBe('before')
    expect(shared({ ...match, now: '2028-06-10T16:00:00Z' })).toBe('scheduled_editable')
  })

  it('captures the legacy passed-kickoff no-feed collapse', () => {
    const match = {
      kickoffAt: '2028-06-10T18:00:00Z',
      homeScore: null,
      awayScore: null,
    }
    expect(matchTemporalState(match)).toBe('before')
    expect(shared({ ...match, now: '2028-06-10T18:30:00Z' })).toBe('in_play_no_feed')
  })

  it('captures the legacy post-result state', () => {
    const match = {
      kickoffAt: '2028-06-10T18:00:00Z',
      homeScore: 2,
      awayScore: 1,
    }
    expect(matchTemporalState(match)).toBe('after')
    expect(shared({ ...match, now: '2028-06-10T20:00:00Z' })).toBe('confirmed')
  })

  it('captures the legacy missing-kickoff fail-closed state', () => {
    const match = { kickoffAt: null, homeScore: null, awayScore: null }
    expect(matchTemporalState(match)).toBe('before')
    expect(shared({ ...match, now: '2028-06-10T18:30:00Z' })).toBe('scheduled_locked')
  })
})

describe('Match Centre shared-state legacy mapping', () => {
  it('retains the pre-match presentation window for scheduled states', () => {
    expect(lifecycle('scheduled_editable')).toBe('PRE_MATCH')
    expect(lifecycle('scheduled_locked')).toBe('PRE_MATCH')
  })

  it('fails closed for no-feed in-play and unconfirmed full-time states', () => {
    expect(lifecycle('in_play_no_feed', '2028-06-10T18:30:00Z')).toBe('SCHEDULED')
    expect(lifecycle('full_time_unconfirmed', '2028-06-10T21:00:00Z')).toBe('SCHEDULED')
  })

  it('maps a feed-backed live state into the existing during contract', () => {
    expect(lifecycle('in_play_feed', '2028-06-10T18:30:00Z')).toBe('LIVE_FIRST_HALF')
  })

  it('maps confirmed and scored states to full time', () => {
    expect(lifecycle('confirmed')).toBe('FULL_TIME')
    expect(lifecycle('scored')).toBe('FULL_TIME')
  })

  it('preserves exceptional administration states', () => {
    expect(lifecycle('suspended')).toBe('SUSPENDED')
    expect(lifecycle('postponed')).toBe('POSTPONED')
    expect(lifecycle('abandoned')).toBe('CANCELLED')
    expect(lifecycle('cancelled')).toBe('CANCELLED')
  })
})
