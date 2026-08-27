import { describe, expect, it } from 'vitest'
import {
  destinationRouteFromPath,
  shellDestinationFromPath,
} from '../../src/app/vnext/surfaceDestination'
import {
  competitionGameRoute,
  competitionMatchCentreRoute,
  competitionPlayerRoute,
  competitionRoute,
  competitionSeasonWrappedRoute,
  competitionSectionRoute,
  weeklyRoutes,
} from '../../src/app/weeklyRoutes'

/**
 * WHICH DESTINATION A CRASHED ADDRESS BELONGED TO.
 *
 * `VNextSurfaceBoundary` is a layout route, so the router cannot tell it which
 * of the four it is standing in front of and it reads the address instead. This
 * is the part of that boundary that can be proved without a browser, a render or
 * a thrown error, so it is proved here.
 *
 * EVERY EXPECTED ADDRESS IS BUILT BY THE APPLICATION'S ROUTE AUTHORITY rather
 * than written as a literal, exactly as the module under test builds them.
 * Hand-typing `'/competitions/x/y/matches'` on both sides would make this test
 * agree with itself while both disagreed with the router.
 */

const REF = { competitionSlug: 'scottish-premiership', seasonSlug: '2026-27' }

describe('the destination an address belongs to', () => {
  it('places each competition section on its own destination', () => {
    expect(shellDestinationFromPath(competitionRoute(REF))).toBe('home')
    expect(shellDestinationFromPath(competitionSectionRoute(REF, 'matches'))).toBe('matches')
    expect(shellDestinationFromPath(competitionSectionRoute(REF, 'games'))).toBe('games')
    expect(shellDestinationFromPath(competitionSectionRoute(REF, 'leagues'))).toBe('leagues')
  })

  it('places a page BENEATH a section on that section, not on the competition root', () => {
    // The competition root is a prefix of every one of these, so a naive
    // longest-match-last would answer Home for all four.
    expect(shellDestinationFromPath(competitionMatchCentreRoute(REF, 'fixture-1'))).toBe(
      'matches',
    )
    expect(shellDestinationFromPath(competitionGameRoute(REF, 'lms'))).toBe('games')
    expect(shellDestinationFromPath(competitionGameRoute(REF, 'championship'))).toBe('games')
    expect(shellDestinationFromPath(competitionGameRoute(REF, 'match-predictor'))).toBe('games')
  })

  it('agrees with what each surface says about itself', () => {
    // A CRASHED PAGE MUST NOT LIGHT A DIFFERENT TAB FROM THE WORKING ONE.
    // `VNextSeasonWrapped` renders `destination="none"`, and the prefix
    // fall-through would otherwise answer Home — so the two would disagree about
    // where the player is, which is the exact defect `destination` was made
    // required to prevent.
    expect(shellDestinationFromPath(competitionSeasonWrappedRoute(REF))).toBe('none')
  })

  it("places a player's season on Leagues, the doorway it is reached through", () => {
    // Addressed under the competition root — `…/:c/:s/players/:playerId` — so
    // the address alone would say Home. The capability matrix names Leagues as
    // where a profile is opened from, and that is where a player who arrived at
    // a broken one expects the navigation to say they are.
    expect(shellDestinationFromPath(competitionPlayerRoute(REF, 'player-1'))).toBe('leagues')
  })

  it('places the cross-competition scopes on the destinations that absorbed them', () => {
    expect(shellDestinationFromPath(weeklyRoutes.hub)).toBe('home')
    expect(shellDestinationFromPath(weeklyRoutes.matches)).toBe('matches')
    expect(shellDestinationFromPath(weeklyRoutes.leagues)).toBe('leagues')
    // `/play` is the absorbed attention layer rather than a fifth destination.
    expect(shellDestinationFromPath(weeklyRoutes.play)).toBe('home')
  })

  it("answers 'none' for an address outside the four rather than guessing one", () => {
    for (const path of [
      '/account',
      '/welcome',
      '/join/ABC123',
      '/about',
      '/competitions',
      '/nothing/here',
      '/',
      // A sibling that merely shares a prefix must not be swallowed by it.
      '/matchesomething',
      '/leaguesomething',
    ]) {
      const answer = shellDestinationFromPath(path)
      if (path === '/') {
        expect(answer).toBe('home')
        continue
      }
      if (path === '/matchesomething' || path === '/leaguesomething') {
        expect(answer, `${path} is not under the destination it shares a prefix with`).toBe(
          'none',
        )
        continue
      }
      expect(answer, `${path} must not be placed on a destination`).toBe('none')
    }
  })
})

describe('where a destination press goes from a crashed address', () => {
  it('keeps the player in the competition they were in', () => {
    const from = competitionGameRoute(REF, 'championship')
    expect(destinationRouteFromPath(from, 'home')).toBe(competitionRoute(REF))
    expect(destinationRouteFromPath(from, 'matches')).toBe(
      competitionSectionRoute(REF, 'matches'),
    )
    expect(destinationRouteFromPath(from, 'leagues')).toBe(
      competitionSectionRoute(REF, 'leagues'),
    )
  })

  it('uses the real global addresses when the address holds no competition', () => {
    // THE DEFECT THIS PINS. The first version sent all four to the hub root, so
    // a player at a broken `/account` who pressed "Matches" landed on Home — a
    // control going somewhere other than its label, which is the same lesson as
    // an inert one. `/matches` and `/leagues` are registered addresses and this
    // module already recognises them on the way in.
    expect(destinationRouteFromPath('/account', 'matches')).toBe(weeklyRoutes.matches)
    expect(destinationRouteFromPath('/account', 'leagues')).toBe(weeklyRoutes.leagues)
    expect(destinationRouteFromPath('/account', 'home')).toBe(weeklyRoutes.hub)
  })

  it('sends Games to the hub root, because there is no global Games address', () => {
    // Not an oversight and not the same as the three above: the route matrix
    // absorbed `/play` into Home and never made a cross-competition games
    // catalogue, because which games exist is a fact about a competition. The
    // hub root is where a player picks one.
    expect(destinationRouteFromPath('/account', 'games')).toBe(weeklyRoutes.hub)
    // And it must not be reachable as a competition section from nowhere.
    expect(destinationRouteFromPath('/account', 'games')).not.toContain('/competitions/')
  })
})
