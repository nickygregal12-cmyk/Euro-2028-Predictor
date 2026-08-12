import type { SeasonClubForm } from '../../services/supabase/seasonClubFormModel'
import { summariseClubForm, type ClubFormSummary } from './clubFormModel'
import type { MatchPredictorFixture } from './matchPredictorModel'

/**
 * The form of the clubs in the matchweek being predicted, fixture by fixture.
 *
 * WHY THE FLAGSHIP SURFACE HAD NO FOOTBALL ON IT. `UI-F06` splits the product
 * into two questions: Football Insights answers *what should I predict*, and
 * Player & League Insights answers *how am I doing*. The Match Predictor's
 * contextual panel is labelled "Match insights" and held only the anonymous
 * consensus — which is the second question, and which is withheld until the
 * matchweek locks. So the panel beside the prediction card was empty at
 * exactly the moment a player is deciding what to enter, and full afterwards.
 * This is the first half of that pair, arranged for the decision in front of
 * the player.
 *
 * IT IS THE SAME AUTHORITY THE MATCH CENTRE AND THE LMS PANEL ALREADY USE.
 * Contract 141's read returns every club in the competition in one request, so
 * a card of ten fixtures costs one request rather than twenty, and the numbers
 * on this panel cannot disagree with the ones on the fixture the player opens
 * afterwards. No new read, no new schema, nothing derived twice.
 *
 * IT ORDERS BY THE CARD, NOT BY FORM. The LMS guide ranks clubs, because that
 * game asks the player to choose ONE club and ordering by form is the shape of
 * that decision. This one is read alongside a list of fixtures the player is
 * filling in top to bottom, and reordering it would mean the panel and the
 * card disagree about where a match is — so it keeps the card's order.
 *
 * IT NEVER RECOMMENDS AND NEVER PREDICTS. No suggested scoreline, no favourite,
 * no confidence, no arrow. The direction rules out API-generated winner
 * predictions before lock, and one derived locally from six results would be
 * the same claim with less behind it.
 *
 * A CLUB WITH NOTHING SETTLED SAYS SO. `summariseClubForm` returns a null
 * record for a club that has not played, because rendering "0 form" or an empty
 * row of pills reads as a bad run — and at Matchweek 1 that is every club in
 * the competition.
 *
 * JOINED BY CLUB NAME, for the reason the Match Centre records: both names come
 * from `public.teams.name`, so this is an equality on one source of truth
 * rather than a fuzzy match. The card's fixtures carry no team id, which is why
 * the name is all there is to join on here.
 *
 * PURE. Both inputs are arguments; no clock, no storage, no network.
 */

export type MatchweekFormFixture = {
  fixtureId: string
  home: { name: string; summary: ClubFormSummary }
  away: { name: string; summary: ClubFormSummary }
}

export type MatchweekFormGuide = {
  fixtures: readonly MatchweekFormFixture[]
  /** How many matches back the server was asked for. Stated, never assumed. */
  window: number
  /**
   * True when no club in this matchweek has a settled match behind it — the
   * ordinary state at the start of a season, and a different thing from the
   * form read having failed, which produces no guide at all.
   */
  empty: boolean
}

export function presentMatchweekForm(
  fixtures: readonly MatchPredictorFixture[],
  clubs: readonly SeasonClubForm[] | null,
  window: number | null,
): MatchweekFormGuide | null {
  // No guide at all when the read has not answered. An empty panel beside a
  // prediction card is worse than no panel: it reads as "these clubs have
  // played nothing", which is a claim about the football rather than about
  // this build's ability to read it.
  if (clubs === null || window === null) return null

  const byName = new Map(clubs.map((club) => [club.name, club]))
  const rows = fixtures.map((fixture) => ({
    fixtureId: fixture.fixtureId,
    home: {
      name: fixture.home.name,
      summary: summariseClubForm(byName.get(fixture.home.name) ?? null),
    },
    away: {
      name: fixture.away.name,
      summary: summariseClubForm(byName.get(fixture.away.name) ?? null),
    },
  }))

  return {
    fixtures: rows,
    window,
    empty: rows.every((row) => row.home.summary.played === 0 && row.away.summary.played === 0),
  }
}
