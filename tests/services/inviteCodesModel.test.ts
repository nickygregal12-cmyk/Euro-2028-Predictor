import { describe, expect, it } from 'vitest'
import {
  mapResolvedInvite,
  normaliseInviteCode,
} from '../../src/services/supabase/inviteCodesModel'

const LEAGUE = {
  found: true,
  kind: 'league',
  id: 'league-1',
  name: 'The Office',
  season: 'Premier League 2026/27',
  game: 'Match Predictor',
  members: 8,
  already_in: false,
  requires_game_entry: true,
  join_with: 'join_league',
}

const COMPETITION = {
  found: true,
  kind: 'competition',
  id: 'comp-1',
  name: 'Sunday Survivors',
  season: 'Premier League 2026/27',
  game: 'Last Man Standing',
  game_key: 'last_man_standing',
  members: 12,
  already_in: false,
  is_owner: true,
  closed: false,
  join_with: 'join_private_competition',
}

describe('mapResolvedInvite', () => {
  it('resolves a league invite and carries the game-entry requirement verbatim', () => {
    const resolved = mapResolvedInvite(LEAGUE)

    expect(resolved).toEqual({
      found: true,
      kind: 'league',
      id: 'league-1',
      name: 'The Office',
      season: 'Premier League 2026/27',
      game: 'Match Predictor',
      members: 8,
      alreadyIn: false,
      requiresGameEntry: true,
      joinWith: 'join_league',
    })
  })

  it('resolves a private competition invite with its game key and closed state', () => {
    const resolved = mapResolvedInvite({ ...COMPETITION, closed: true, already_in: true })

    expect(resolved).toMatchObject({
      found: true,
      kind: 'competition',
      gameKey: 'last_man_standing',
      isOwner: true,
      closed: true,
      alreadyIn: true,
      joinWith: 'join_private_competition',
    })
  })

  it('leaves an unrecognised game key null rather than guessing at one', () => {
    const resolved = mapResolvedInvite({ ...COMPETITION, game_key: 'quiz_night' })

    expect(resolved).toMatchObject({ found: true, kind: 'competition', gameKey: null })
  })

  it('answers a not-found code with nothing else at all', () => {
    expect(mapResolvedInvite({ found: false })).toEqual({ found: false })
  })

  it('gives a malformed, unknown and empty payload the same indistinguishable answer', () => {
    for (const payload of [null, undefined, {}, 'nope', [], { found: 'yes' }]) {
      expect(mapResolvedInvite(payload)).toEqual({ found: false })
    }
  })

  it('degrades a resolved container with no name to not-found rather than showing a blank invite', () => {
    expect(mapResolvedInvite({ ...LEAGUE, name: '' })).toEqual({ found: false })
    expect(mapResolvedInvite({ ...COMPETITION, id: null })).toEqual({ found: false })
  })

  it('refuses a container kind this build does not understand', () => {
    expect(mapResolvedInvite({ ...COMPETITION, kind: 'tournament_pool' })).toEqual({
      found: false,
    })
  })

  it('reads a missing member count as zero rather than as NaN', () => {
    expect(mapResolvedInvite({ ...LEAGUE, members: null })).toMatchObject({ members: 0 })
    expect(mapResolvedInvite({ ...LEAGUE, members: -4 })).toMatchObject({ members: 0 })
  })
})

describe('normaliseInviteCode', () => {
  it('upper-cases, trims and strips the separators people paste from a chat', () => {
    expect(normaliseInviteCode('  abc-123  ')).toBe('ABC123')
    expect(normaliseInviteCode('abc 123 def 456')).toBe('ABC123DEF456')
  })

  it('does not police length or alphabet, because contract 158 widened both', () => {
    expect(normaliseInviteCode('abcdef123456')).toBe('ABCDEF123456')
    expect(normaliseInviteCode('ab')).toBe('AB')
  })
})
