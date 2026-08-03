/**
 * Predictor Cup tie settlement for a season round.
 *
 * Authority: ADR 0014 as amended by ADR 0020. The rules encoded here:
 *
 * - head-to-head scoring is 3 for a win, 1 for a draw, 0 for a loss on
 *   prediction-point totals — unchanged from the tournament rules;
 * - the points source is a NEUTRAL CONTRACT: per-fixture Cup points arrive
 *   as inputs and are raw 5/3/0 values. Jokers never apply to Cup scoring,
 *   so this module rejects any fixture points outside the raw scale rather
 *   than trusting the caller not to have doubled them;
 * - the settlement cutoff: a tie settles on the fixtures played and
 *   confirmed by the cutoff, on the SAME fixture set for both entrants. A
 *   round never hangs on a fixture moved to March;
 * - a tie settled on a reduced fixture set must say so — the settled-on
 *   "9 of 10" fact is part of the settlement, and display wording owns the
 *   label, not the omission;
 * - a tie with NOTHING settled by the cutoff has no recorded outcome in
 *   ADR 0014 and refuses rather than inventing a goalless draw — the
 *   round-anomaly rule blocks on genuine anomalies, and a whole card
 *   missing is one.
 *
 * A drawn group tie is an ordinary 1/1. Knockout deciders (Extra-Time
 * Accuracy, the Penalty Number) remain with the existing tournament
 * machinery per ADR 0014. Pure domain: no storage, network or ambient
 * clock — the cutoff has already been applied to the facts supplied here.
 */

/** The raw per-fixture Cup scale: exact 5, result 3, miss 0. Never Jokered. */
const RAW_FIXTURE_POINTS = new Set([0, 3, 5])

export const CUP_TIE_MATCH_POINTS = { win: 3, draw: 1, loss: 0 } as const

export type CupTieFixture = {
  fixtureId: string
  /** True when the fixture was played and confirmed by the cutoff. */
  confirmedByCutoff: boolean
}

export type CupTieEntrantPoints = {
  entryId: string
  /** Raw Cup points per confirmed fixture, keyed by fixture id. */
  fixturePoints: Readonly<Record<string, number>>
}

export type CupTieSettlement = {
  result: 'home_win' | 'away_win' | 'draw'
  home: { entryId: string; points: number; matchPoints: 0 | 1 | 3 }
  away: { entryId: string; points: number; matchPoints: 0 | 1 | 3 }
  /** The required label facts: "settled on 9 of 10 fixtures". */
  settledOnFixtures: number
  fixtureCardSize: number
  reducedSet: boolean
}

export type CupTieSettlementResult =
  | { ok: true; settlement: CupTieSettlement }
  | {
      ok: false
      reason:
        | 'invalid_input'
        | 'duplicate_fixture'
        | 'same_entrant_twice'
        | 'points_missing_for_confirmed_fixture'
        | 'points_for_unconfirmed_fixture'
        | 'points_off_raw_scale'
        | 'no_settled_fixtures'
    }

function entrantTotal(
  entrant: CupTieEntrantPoints,
  confirmed: readonly string[],
  cardFixtureIds: ReadonlySet<string>,
): number | CupTieSettlementResult {
  for (const fixtureId of Object.keys(entrant.fixturePoints)) {
    if (!cardFixtureIds.has(fixtureId)) return { ok: false, reason: 'invalid_input' }
    if (!confirmed.includes(fixtureId)) {
      return { ok: false, reason: 'points_for_unconfirmed_fixture' }
    }
  }
  let total = 0
  for (const fixtureId of confirmed) {
    const points = entrant.fixturePoints[fixtureId]
    if (points === undefined) return { ok: false, reason: 'points_missing_for_confirmed_fixture' }
    if (!RAW_FIXTURE_POINTS.has(points)) return { ok: false, reason: 'points_off_raw_scale' }
    total += points
  }
  return total
}

/**
 * Settle one head-to-head tie, or refuse. Contradictory data — points for a
 * fixture the cutoff excluded, a missing confirmed-fixture score, a value a
 * Joker could have produced — refuses the tie rather than settling a guess.
 */
export function settleCupTie(
  fixtures: readonly CupTieFixture[],
  home: CupTieEntrantPoints,
  away: CupTieEntrantPoints,
): CupTieSettlementResult {
  if (
    home.entryId.trim().length === 0 ||
    away.entryId.trim().length === 0 ||
    fixtures.length === 0
  ) {
    return { ok: false, reason: 'invalid_input' }
  }
  if (home.entryId === away.entryId) return { ok: false, reason: 'same_entrant_twice' }

  const cardFixtureIds = new Set<string>()
  for (const fixture of fixtures) {
    if (fixture.fixtureId.trim().length === 0) return { ok: false, reason: 'invalid_input' }
    if (cardFixtureIds.has(fixture.fixtureId)) return { ok: false, reason: 'duplicate_fixture' }
    cardFixtureIds.add(fixture.fixtureId)
  }

  const confirmed = fixtures
    .filter((fixture) => fixture.confirmedByCutoff)
    .map((fixture) => fixture.fixtureId)
  if (confirmed.length === 0) return { ok: false, reason: 'no_settled_fixtures' }

  const homeTotal = entrantTotal(home, confirmed, cardFixtureIds)
  if (typeof homeTotal !== 'number') return homeTotal
  const awayTotal = entrantTotal(away, confirmed, cardFixtureIds)
  if (typeof awayTotal !== 'number') return awayTotal

  const result =
    homeTotal > awayTotal ? 'home_win' : homeTotal < awayTotal ? 'away_win' : 'draw'
  const [homeMatch, awayMatch]: [0 | 1 | 3, 0 | 1 | 3] =
    result === 'home_win'
      ? [CUP_TIE_MATCH_POINTS.win, CUP_TIE_MATCH_POINTS.loss]
      : result === 'away_win'
        ? [CUP_TIE_MATCH_POINTS.loss, CUP_TIE_MATCH_POINTS.win]
        : [CUP_TIE_MATCH_POINTS.draw, CUP_TIE_MATCH_POINTS.draw]

  return {
    ok: true,
    settlement: {
      result,
      home: { entryId: home.entryId, points: homeTotal, matchPoints: homeMatch },
      away: { entryId: away.entryId, points: awayTotal, matchPoints: awayMatch },
      settledOnFixtures: confirmed.length,
      fixtureCardSize: fixtures.length,
      reducedSet: confirmed.length < fixtures.length,
    },
  }
}
