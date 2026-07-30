import { describe, expect, it } from 'vitest'
import { resolveMatchState } from '../../src/domain/competition/matchState'
import type { ResolvedLockState } from '../../src/domain/competition/lockState'
import { matchTemporalState } from '../../src/domain/tournament/matchCentre'

const UNLOCKED: ResolvedLockState = {
  status: 'open',
  locked: false,
  lockAt: '2028-06-10T18:00:00.000Z',
  reason: 'before_scope_lock',
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
