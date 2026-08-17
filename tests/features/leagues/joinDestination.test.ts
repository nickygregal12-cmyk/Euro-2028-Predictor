import { describe, expect, it } from 'vitest'
import { joinedInviteHref } from '../../../src/features/leagues/joinDestination'
import { weeklyRoutes } from '../../../src/app/weeklyRoutes'

/**
 * Where accepting an invite lands the player, per build.
 *
 * THE DEFECT THIS PINS, AND IT IS A `EURO-001` PREREQUISITE. `/league/:id` is
 * the TOURNAMENT's league table: `LeagueDetailPage` consumes `useTournamentData`
 * and `useTournamentEntryLocked`, its member rows navigate to
 * `/tournament/profile/:playerId` and `/h2h/:rivalId`, and its server read
 * `get_league_members` refuses a season league by name (contract 128). Until
 * this rule existed, `/join/:code` sent EVERY joined league there — including on
 * a build that does not serve the tournament, where `TournamentJourney` refuses
 * the route outright and the read behind it would refuse the league anyway.
 *
 * That mattered because the weekly join journey is the ONE live weekly entry
 * point into `/league/:id`. Everything else that links there — `HomePage`,
 * `LeaguePage`, `PredictEntryPage` — is parked Euro source. So this is what has
 * to be true before `servesEuroTournament` can be turned off on the Hub without
 * breaking a journey the weekly product actually has.
 *
 * A joined private COMPETITION is unchanged and lands on the private play list
 * on both builds, because it has no page of its own on either (`MIG-UI-20`).
 */

const LEAGUE = { kind: 'league', leagueId: 'league-77' } as const
const COMPETITION = { kind: 'competition', competitionId: 'comp-3' } as const

describe('where an accepted invite opens', () => {
  it('opens a joined league on its tournament page where the tournament is served', () => {
    expect(joinedInviteHref(LEAGUE, true)).toBe('/league/league-77')
  })

  it('lands a joined league on private play where the tournament is not served', () => {
    // Not `/league/:id`: on the Hub that route is refused by the deployment
    // gate, and `get_league_members` would refuse the league even if it were
    // not. The list is where the league appears, with its own card.
    expect(joinedInviteHref(LEAGUE, false)).toBe(weeklyRoutes.leagues)
  })

  it('lands a joined private competition on private play on both builds', () => {
    expect(joinedInviteHref(COMPETITION, true)).toBe(weeklyRoutes.leagues)
    expect(joinedInviteHref(COMPETITION, false)).toBe(weeklyRoutes.leagues)
  })

  it('never returns a competition id as a path', () => {
    // A private competition has no route of its own. Building one from the id
    // the join returned is the exact "faked with a link that 404s" the landing
    // page's own note refuses, and it would look reasonable in a diff.
    expect(joinedInviteHref(COMPETITION, true)).not.toContain(COMPETITION.competitionId)
    expect(joinedInviteHref(COMPETITION, false)).not.toContain(COMPETITION.competitionId)
  })

  it('accepts a competition the join named no id for', () => {
    expect(joinedInviteHref({ kind: 'competition', competitionId: null }, false)).toBe(
      weeklyRoutes.leagues,
    )
  })
})
