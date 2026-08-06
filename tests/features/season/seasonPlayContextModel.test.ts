import { describe, expect, it } from 'vitest'
import {
  presentSeasonPlay,
  seasonLabelFor,
  type SeasonPlayContext,
} from '../../../src/features/season/seasonPlayContextModel'

/**
 * The season route's state machine.
 *
 * There is exactly one interesting decision in this module and every assertion
 * below is about it: a season with no open matchweek and a URL that names no
 * season must not produce the same page. They are both "there is no card here",
 * and collapsing them would tell a player whose season has finished that their
 * competition does not exist — and tell a player who mistyped an address that
 * their season is over. The database already refuses to conflate them, raising
 * for one and returning a null matchweek for the other, so the only place the
 * distinction can now be lost is here.
 */

function context(over: Partial<SeasonPlayContext> = {}): SeasonPlayContext {
  return {
    tournamentId: 'season-1',
    competitionName: 'Premier League',
    seasonLabel: '2026/27',
    timeZone: 'Europe/London',
    status: 'draft',
    matchweek: 3,
    matchweekCount: 38,
    locksAt: '2026-08-13T11:30:00Z',
    ...over,
  }
}

describe('the season label', () => {
  it('reads a season key the way the hub writes it', () => {
    expect(seasonLabelFor('2026-27')).toBe('2026/27')
  })

  it('replaces only the first separator', () => {
    // A blanket replace would mangle any other shape rather than leaving it
    // alone, which is the wrong instinct for a value that comes from the
    // database and may one day not be `<year>-<year>`.
    expect(seasonLabelFor('2026-27-playoff')).toBe('2026/27-playoff')
    expect(seasonLabelFor('2028')).toBe('2028')
  })
})

describe('presentSeasonPlay', () => {
  it('shows the card once a matchweek is open', () => {
    const state = presentSeasonPlay({ status: 'ready', context: context(), error: null })

    expect(state.kind).toBe('ready')
    expect(state.kind === 'ready' && state.matchweek).toBe(3)
  })

  it('waits rather than guessing while the season is still loading', () => {
    expect(
      presentSeasonPlay({ status: 'loading', context: null, error: null }).kind,
    ).toBe('loading')
  })

  it('reports a finished season as finished, not as missing', () => {
    const state = presentSeasonPlay({
      status: 'ready',
      context: context({ matchweek: null }),
      error: null,
    })

    expect(state.kind).toBe('season_over')
    expect(state.kind === 'season_over' && state.context.matchweekCount).toBe(38)
  })

  it('reports a URL that names no season as an address problem', () => {
    const state = presentSeasonPlay({
      status: 'failed',
      context: null,
      error: new Error('That competition season does not exist'),
    })

    expect(state.kind).toBe('unavailable')
    expect(state.kind === 'unavailable' && state.title).toMatch(/could not be found/)
    // The recovery is different from a failed read's, so the words must be too:
    // this one is fixed by going back to the hub, and retrying never helps.
    expect(state.kind === 'unavailable' && state.detail).toMatch(/hub/)
  })

  it('treats a tournament-shaped competition as the same kind of mistake', () => {
    // `/competitions/euro/2028/main-predictor` is a hand-typed URL for a game
    // that competition does not have. The database raises its own message for
    // it, and it deserves the address answer rather than the outage answer.
    const state = presentSeasonPlay({
      status: 'failed',
      context: null,
      error: new Error('That competition is not a league season'),
    })

    expect(state.kind === 'unavailable' && state.title).toMatch(/could not be found/)
  })

  it('does not blame the address for a failure that is not the address', () => {
    // A dropped connection, a revoked grant or a malformed payload all land
    // here. Telling the player their season does not exist would be a lie, and
    // one that sends them to look for a competition they are already in.
    const state = presentSeasonPlay({
      status: 'failed',
      context: null,
      error: new Error('FetchError: network request failed'),
    })

    expect(state.kind).toBe('unavailable')
    expect(state.kind === 'unavailable' && state.title).toMatch(/could not be loaded/)
    expect(state.kind === 'unavailable' && state.detail).toMatch(/try again/i)
  })

  it('does not render a card from a context it never received', () => {
    // `status: 'ready'` with a null context should be unreachable, but the type
    // permits it and a card built from nothing would be a card built from
    // defaults — which is how a player ends up entering predictions against
    // the wrong season.
    expect(
      presentSeasonPlay({ status: 'ready', context: null, error: null }).kind,
    ).toBe('unavailable')
  })
})
