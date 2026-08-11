// A season's fixtures over a date window (contract 139's `get_season_fixtures`).
//
// IT REPLACES A DEFECT RATHER THAN ADDING A FEATURE. The Matches surface has
// been built on `get_season_matchweek_card`, which answers one matchweek at a
// time — so it grouped strictly by round, which is the misreading the owner's
// 5 August amendment names by hand. A fixture postponed out of matchweek 5 into
// November keeps its round on purpose, so a by-round list files a November
// match under a September heading and puts it in the wrong place in the season.
//
// This read is windowed by DATE and carries the round as a label, which is what
// makes "ordered by kickoff, labelled by matchweek" expressible at all.
//
// NO MEMBERSHIP CHECK BEYOND BEING SIGNED IN, by the read's own design: a
// fixture list is the same for everybody and discloses nothing about any
// player. It carries no prediction, no Joker and no points — the card read
// still owns all three, and this module must never grow them.

import { db } from './client'
import {
  mapSeasonFixture,
  mapSeasonFixtureList,
  type SeasonFixtureAnswer,
  type SeasonFixtureList,
} from './seasonFixtureListModel'

export type {
  SeasonFixtureAnswer,
  SeasonFixtureCompetition,
  SeasonFixtureList,
  SeasonListFixture,
  SeasonFixtureClub,
  SeasonFixtureRound,
} from './seasonFixtureListModel'

export type SeasonFixtureWindow = {
  /** ISO instants. Omitted lets the server choose its own default window. */
  from?: string
  to?: string
}

/**
 * Fetch one window of a season's fixtures.
 *
 * The window is the server's to bound and to refuse: it defaults to the last
 * week and the next fortnight, caps at 120 days and at 500 fixtures. Nothing
 * here re-checks any of that — a browser holding its own copy of the limit is
 * one that will disagree with the server the first time either changes.
 */
export async function fetchSeasonFixtureList(
  tournamentId: string,
  window: SeasonFixtureWindow = {},
): Promise<SeasonFixtureList> {
  const { data, error } = await db.rpc('get_season_fixtures', {
    p_tournament_id: tournamentId,
    p_from: window.from ?? undefined,
    p_to: window.to ?? undefined,
  })
  if (error) throw error
  return mapSeasonFixtureList(data)
}

/**
 * One fixture, by its own id (contract 148).
 *
 * WHY THIS IS HERE AND NOT IN A MODULE OF ITS OWN. It is the same fixture
 * vocabulary as the list — the RPC returns contract 139's entry field for field
 * — and the whole point of contract 148 is that a fixture looks identical
 * whichever way it was reached. Two modules would be two chances to decode it
 * differently.
 *
 * IT REPLACES A DATE-WINDOW SEARCH. The addressable Match Centre used to carry
 * the fixture's day in its URL, load a three-week window around it and look for
 * the fixture in the result — which could honestly report "not in this window"
 * for a link that was perfectly valid. Nothing does that any more.
 *
 * THE SERVER REFUSES RATHER THAN RETURNS NOTHING for a fixture that does not
 * exist or belongs to the tournament shape, so an error here is a real answer
 * and is not swallowed.
 */
export async function fetchSeasonFixture(fixtureId: string): Promise<SeasonFixtureAnswer> {
  const { data, error } = await db.rpc('get_season_fixture', {
    p_season_fixture_id: fixtureId,
  })
  if (error) throw error
  return mapSeasonFixture(data)
}
