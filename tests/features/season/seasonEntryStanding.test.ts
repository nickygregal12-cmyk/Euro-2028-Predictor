import { describe, expect, it } from 'vitest'
import {
  entryStandingLine,
  seasonEntryStanding,
} from '../../../src/features/season/seasonEntryStanding'
import type { GameLeaveEligibility } from '../../../src/services/supabase/gameLeaveEligibilityModel'

const game = (
  gameKey: string,
  allowed: boolean,
  reason: string | null,
): GameLeaveEligibility => ({ id: `c-${gameKey}`, gameKey, allowed, reason })

describe('whether this competition runs a Match Predictor, and whether you are in it', () => {
  it('reports a season that runs no Match Predictor as not offered', () => {
    // The eligibility read lists every LIVE game, so an absent row means the
    // season does not run one — not that the caller is outside it.
    expect(seasonEntryStanding([game('last_man_standing', true, null)])).toBe('not_offered')
    expect(seasonEntryStanding([])).toBe('not_offered')
  })

  it('reports a game that is offered and unjoined as not entered', () => {
    expect(seasonEntryStanding([game('main_predictor', false, 'not_entered')])).toBe(
      'not_entered',
    )
  })

  it('treats every other refusal as entered, because they are about leaving', () => {
    // `allowed` says nothing about entry on its own: an entrant whose scoring
    // has started is refused a leave and is very much entered.
    expect(seasonEntryStanding([game('main_predictor', false, 'scoring_started')])).toBe(
      'entered',
    )
    expect(seasonEntryStanding([game('main_predictor', false, 'game_finished')])).toBe('entered')
    expect(seasonEntryStanding([game('main_predictor', true, null)])).toBe('entered')
  })

  it('says nothing at all until the read has answered', () => {
    expect(seasonEntryStanding(null)).toBe('unknown')
    expect(entryStandingLine('unknown')).toBeNull()
  })

  it('distinguishes a competition without the game from a player without an entry', () => {
    // Two different sentences, because they are two different facts and only
    // one of them is something the player can act on.
    expect(entryStandingLine('not_offered')).toMatch(/does not run a Match Predictor/)
    expect(entryStandingLine('not_entered')).toMatch(/have not joined/)
    expect(entryStandingLine('not_entered')).toMatch(/can join it/)
    expect(entryStandingLine('entered')).toBeNull()
  })
})
