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
import { mapSeasonFixtureList, type SeasonFixtureList } from './seasonFixtureListModel'

export type {
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
