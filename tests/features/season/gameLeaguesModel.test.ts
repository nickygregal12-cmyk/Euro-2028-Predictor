import { describe, expect, it } from 'vitest'
import {
  leagueCreateRefusal,
  leagueJoinRefusal,
  presentGameLeagues,
} from '../../../src/features/season/gameLeaguesModel'
import type { GameLeague } from '../../../src/services/supabase/gameLeagues'

function league(overrides: Partial<GameLeague> = {}): GameLeague {
  return {
    id: 'league-1',
    name: 'The Office',
    inviteCode: 'ABC123',
    memberCount: 4,
    isOwner: false,
    ownerName: 'Sam',
    lastActivityAt: null,
    ...overrides,
  }
}

describe('presentGameLeagues', () => {
  it('names the game its leagues rank', () => {
    // ADR 0011 keeps each game's standings its own; a competition running
    // three games has three things a private league could mean, and a bare
    // "Leagues" heading would assert a combined ranking that does not exist.
    const view = presentGameLeagues({
      gameName: 'Main Predictor',
      joinedGame: true,
      leagues: [],
    })

    expect(view.scopeLine).toContain('Main Predictor')
  })

  it('no longer explains away a table it can now show', () => {
    // This view once carried a `standingsNote` saying no league opened into a
    // table, because `get_league_members` ranks by the tournament scoring
    // tables a season's points never reach. Contract 128 supplied
    // `get_season_league_standings`, so the sentence became false rather than
    // merely stale. Asserted as an absence because a note explaining why there
    // is no table, printed above a table, is worse than either alone.
    const view = presentGameLeagues({
      gameName: 'Main Predictor',
      joinedGame: true,
      leagues: [league()],
    })

    expect('standingsNote' in view).toBe(false)
  })

  it('refuses creation in words when the caller has not joined the game', () => {
    const view = presentGameLeagues({
      gameName: 'Main Predictor',
      joinedGame: false,
      leagues: [],
    })

    expect(view.createRefusal).toContain('Main Predictor')
  })

  it('allows creation once the caller has joined', () => {
    const view = presentGameLeagues({
      gameName: 'Main Predictor',
      joinedGame: true,
      leagues: [],
    })

    expect(view.createRefusal).toBeNull()
  })

  it('distinguishes a league the caller owns from one they belong to', () => {
    const view = presentGameLeagues({
      gameName: 'Main Predictor',
      joinedGame: true,
      leagues: [league({ isOwner: true }), league({ id: 'l2', isOwner: false })],
    })

    expect(view.leagues[0]?.ownerLine).toBe('You own this league')
    expect(view.leagues[1]?.ownerLine).toBe('Owned by Sam')
  })

  it('resolves the member plural once, in the model', () => {
    const view = presentGameLeagues({
      gameName: 'Main Predictor',
      joinedGame: true,
      leagues: [league({ memberCount: 1 }), league({ id: 'l2', memberCount: 12 })],
    })

    expect(view.leagues.map((l) => l.memberLine)).toEqual(['1 member', '12 members'])
  })

  it('reports an empty list as empty', () => {
    expect(presentGameLeagues({ gameName: 'Main Predictor', joinedGame: true, leagues: [] }).empty)
      .toBe(true)
  })
})

describe('the league refusals', () => {
  it('tells a caller with no entry to join the game first', () => {
    expect(leagueCreateRefusal({ code: '42501' })).toMatch(/Join this game/)
    expect(leagueCreateRefusal({ code: 'insufficient_privilege' })).toMatch(/Join this game/)
  })

  it('states the name rule the server enforces', () => {
    expect(leagueCreateRefusal({ code: 'check_violation' })).toMatch(/1 to 40 characters/)
  })

  it('separates an unknown code from a league in another game', () => {
    // Two different things to do about it: check the code you were given, or
    // join the game it belongs to.
    expect(leagueJoinRefusal({ code: 'no_data_found' })).toMatch(/does not match a league/)
    expect(leagueJoinRefusal({ code: '42501' })).toMatch(/a game you have not joined/)
  })

  it('falls back to safe generic copy for a code it does not know', () => {
    // A new refusal degrades to something safe rather than to nothing, and no
    // raw server detail reaches a player.
    const sentence = leagueCreateRefusal({ code: 'XX999', message: 'relation does not exist' })

    expect(sentence).not.toContain('relation')
    expect(sentence.length).toBeGreaterThan(0)
  })
})
