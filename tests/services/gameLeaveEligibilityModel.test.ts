import { describe, expect, it } from 'vitest'
import {
  isKnownLeaveRefusal,
  leaveRefusalSentence,
  mapSeasonLeaveEligibility,
} from '../../src/services/supabase/gameLeaveEligibilityModel'

function payload(games: unknown[], serverNow = '2026-08-09T12:00:00Z') {
  return { server_now: serverNow, games }
}

describe('decoding contract 140', () => {
  it('keeps the server’s allowed flag rather than re-deriving it from the reason', () => {
    // The two agree by construction upstream — the read builds `allowed` from
    // the same call that builds `reason`. Re-deriving here would be a second
    // opinion that could disagree with the write.
    const decoded = mapSeasonLeaveEligibility(
      payload([{ id: 'g1', game_key: 'main_predictor', allowed: false, reason: null }]),
    )
    expect(decoded.games[0]?.allowed).toBe(false)
    expect(decoded.games[0]?.reason).toBeNull()
  })

  it('treats a missing allowed field as not allowed', () => {
    // Absence is not permission. A payload this cannot read must never open a
    // control the server would refuse.
    const decoded = mapSeasonLeaveEligibility(payload([{ id: 'g1', game_key: 'lms' }]))
    expect(decoded.games[0]?.allowed).toBe(false)
  })

  it('drops a row with no id, because it could only be applied to the wrong game', () => {
    const decoded = mapSeasonLeaveEligibility(
      payload([{ game_key: 'lms', allowed: true, reason: null }]),
    )
    expect(decoded.games).toHaveLength(0)
  })

  it('reads an empty season without inventing a game', () => {
    const decoded = mapSeasonLeaveEligibility(payload([]))
    expect(decoded.games).toEqual([])
    expect(decoded.serverNow).toBe('2026-08-09T12:00:00Z')
  })

  it('survives a payload with no games array at all', () => {
    expect(mapSeasonLeaveEligibility({}).games).toEqual([])
    expect(mapSeasonLeaveEligibility(null).serverNow).toBeNull()
  })
})

describe('what a refusal says to the player', () => {
  it('names each refusal the server can raise', () => {
    expect(leaveRefusalSentence('game_finished')).toMatch(/final standings/)
    expect(leaveRefusalSentence('scoring_started')).toMatch(/already scored/)
    expect(leaveRefusalSentence('draw_completed')).toMatch(/somebody else/)
    expect(leaveRefusalSentence('not_found')).toMatch(/no longer available/)
  })

  it('says nothing for a player who is not in the game', () => {
    // Not a refusal anyone needs explaining: somebody who has not joined is not
    // being offered a Leave control to be refused.
    expect(leaveRefusalSentence('not_entered')).toBeNull()
    expect(leaveRefusalSentence(null)).toBeNull()
  })

  it('degrades an unknown refusal to a refusal rather than to permission', () => {
    // A reason added server-side that this build has not met is still the
    // server refusing something real.
    expect(leaveRefusalSentence('some_future_rule')).toBe(
      'You cannot leave this game right now.',
    )
    expect(isKnownLeaveRefusal('some_future_rule')).toBe(false)
    expect(isKnownLeaveRefusal('scoring_started')).toBe(true)
  })
})
