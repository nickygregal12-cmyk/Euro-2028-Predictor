import { describe, expect, it } from 'vitest'
import { at } from '../../support/indexed'
import {
  buildAccumulators,
  defaultRequest,
  legEdge,
  legFairOdds,
  requiredOddsForProfit,
  requiredOddsForTotalReturn,
  CORRELATION_NOTE,
  RESEARCH_CEILING_NOTE,
  DEFAULT_POOL_CAP,
  DEFAULT_RESULTS,
  OBJECTIVES,
  OBJECTIVE_MEANINGS,
  type Bookmaker,
  type Leg,
} from '../../../src/domain/ai/betBuilder'

/**
 * The Bet Builder's rules, exercised without Python.
 *
 * `tests/database-parity/betBuilderParity.test.ts` proves this module agrees
 * with `ai/accumulator.py` field for field, and that is the more valuable
 * test — but it SKIPS when Python or numpy is unavailable, and it lives
 * outside the domain coverage run. A 556-line domain module whose only
 * exercise is a suite that can silently skip is a module with no floor under
 * it, so the rules that decide whether something is presentable as a BET are
 * asserted here directly.
 *
 * The rules under test are the ones that would cause real harm if they broke:
 * an accumulator must never combine two markets on one fixture, never combine
 * two prices for one club, never mix venues, and never present an aggregate
 * as something a person could actually stake money on.
 */

const REGISTRY: readonly Bookmaker[] = [
  { code: 'B365', name: 'Bet365', kind: 'bookmaker', isRealPrice: true, exchangeCommission: null },
  { code: 'PS', name: 'Pinnacle', kind: 'bookmaker', isRealPrice: true, exchangeCommission: null },
  {
    code: 'BFE',
    name: 'Betfair Exchange',
    kind: 'exchange',
    isRealPrice: true,
    exchangeCommission: 0.02,
  },
  {
    code: 'SMK',
    name: 'Smarkets',
    kind: 'exchange',
    isRealPrice: true,
    exchangeCommission: null,
  },
  { code: 'MAX', name: 'Market maximum', kind: 'aggregate', isRealPrice: false, exchangeCommission: null },
  { code: 'AVG', name: 'Market average', kind: 'aggregate', isRealPrice: false, exchangeCommission: null },
]

function leg(overrides: Partial<Leg> = {}): Leg {
  return {
    fixtureId: 'f1',
    league: 'EPL',
    home: 'Leicester',
    away: 'Norwich',
    kickoffAt: '2026-08-15T14:00:00Z',
    selection: 'H',
    odds: 2,
    probability: 0.55,
    bookmaker: 'B365',
    dataConfidence: 0.8,
    dataConfidenceState: 'sufficient',
    agreement: 0.7,
    uncertaintyWidth: 0.05,
    capturedAt: '2026-08-13T10:00:00Z',
    priceAgeSeconds: 600,
    priceAgeLimitSeconds: 7200,
    usesMarket: false,
    ...overrides,
  }
}

/** Three independent fixtures at one real bookmaker, no shared club. */
function threeCleanLegs(book = 'B365'): Leg[] {
  return [
    leg({ fixtureId: 'f1', home: 'Leicester', away: 'Norwich', bookmaker: book }),
    leg({ fixtureId: 'f2', home: 'Hearts', away: 'Hibernian', league: 'SPL', bookmaker: book }),
    leg({ fixtureId: 'f3', home: 'Wrexham', away: 'Bromley', league: 'EL2', bookmaker: book }),
  ]
}

describe('the vocabulary the page shows is complete and self-describing', () => {
  it('gives every objective a stated meaning', () => {
    expect(OBJECTIVES).toEqual(['return', 'value', 'safety', 'confidence'])
    for (const objective of OBJECTIVES) {
      expect(OBJECTIVE_MEANINGS[objective]).toBeTruthy()
    }
  })

  it('applies its documented defaults, and lets one be overridden without moving the rest', () => {
    const request = defaultRequest()
    expect(request.legs).toBe(3)
    expect(request.objective).toBe('return')
    expect(request.results).toBe(DEFAULT_RESULTS)
    expect(request.poolCap).toBe(DEFAULT_POOL_CAP)
    expect(request.includeReferenceCeiling).toBe(false)

    const overridden = defaultRequest({ legs: 5 })
    expect(overridden.legs).toBe(5)
    expect(overridden.stake).toBe(request.stake)
  })
})

describe('a target is arithmetic, and the two meanings are never conflated', () => {
  it('separates total return from profit', () => {
    expect(requiredOddsForTotalReturn(10, 50)).toBeCloseTo(5)
    expect(requiredOddsForProfit(10, 50)).toBeCloseTo(6)
  })

  it('refuses a stake of zero rather than returning infinity', () => {
    expect(() => requiredOddsForTotalReturn(0, 50)).toThrow(/stake of zero/)
    expect(() => requiredOddsForProfit(0, 50)).toThrow(/stake of zero/)
    expect(() => requiredOddsForProfit(-1, 50)).toThrow(/stake of zero/)
  })
})

describe('one leg reports its own edge against its own fair price', () => {
  it('computes edge and fair odds from the probability', () => {
    expect(legEdge(leg({ odds: 2, probability: 0.55 }))).toBeCloseTo(0.1)
    expect(legFairOdds(leg({ probability: 0.5 }))).toBeCloseTo(2)
  })

  it('reports an impossible outcome as infinitely priced rather than dividing by zero', () => {
    expect(legFairOdds(leg({ probability: 0 }))).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('the request refuses what it cannot answer', () => {
  it('rejects an unknown objective', () => {
    const request = { ...defaultRequest(), objective: 'lucky' as never }
    expect(() => buildAccumulators(threeCleanLegs(), request, REGISTRY)).toThrow(/unknown objective/)
  })

  it('rejects an accumulator of fewer than one leg', () => {
    expect(() =>
      buildAccumulators(threeCleanLegs(), defaultRequest({ legs: 0 }), REGISTRY),
    ).toThrow(/at least one leg/)
  })
})

describe('a leg that fails the request never reaches a combination', () => {
  const cases: [string, Partial<Leg>, Parameters<typeof defaultRequest>[0], RegExp][] = [
    ['leg odds below the minimum', { odds: 1.1 }, { minLegOdds: 1.5 }, /below the requested minimum/],
    ['leg odds above the maximum', { odds: 9 }, { maxLegOdds: 5 }, /above the requested maximum/],
    [
      'probability below the minimum',
      { probability: 0.1 },
      { minLegProbability: 0.4 },
      /probability below the requested minimum/,
    ],
    [
      'data confidence below the minimum',
      { dataConfidence: 0.2 },
      { minDataConfidence: 0.6 },
      /data confidence below the requested minimum/,
    ],
    [
      'data confidence entirely absent',
      { dataConfidence: null },
      { minDataConfidence: 0.6 },
      /data confidence below the requested minimum/,
    ],
  ]

  for (const [name, legOverride, requestOverride, reason] of cases) {
    it(`drops a leg whose ${name}`, () => {
      const legs = [leg({ ...legOverride, fixtureId: 'bad' }), ...threeCleanLegs()]
      const result = buildAccumulators(legs, defaultRequest(requestOverride), REGISTRY)
      expect(result.candidatesSupplied).toBe(4)
      expect(result.candidatesEligible).toBe(3)
      expect(Object.keys(result.rejectionReasons).some((key) => reason.test(key))).toBe(true)
    })
  }

  it('drops a leg in an excluded league, and one naming an excluded club', () => {
    const byLeague = buildAccumulators(
      threeCleanLegs(),
      defaultRequest({ excludeLeagues: ['SPL'] }),
      REGISTRY,
    )
    expect(byLeague.candidatesEligible).toBe(2)
    expect(byLeague.rejectionReasons['league excluded by the request']).toBe(1)

    const byTeam = buildAccumulators(
      threeCleanLegs(),
      defaultRequest({ excludeTeams: ['Hibernian'] }),
      REGISTRY,
    )
    expect(byTeam.candidatesEligible).toBe(2)
    expect(byTeam.rejectionReasons['team excluded by the request']).toBe(1)
  })

  it('drops a price older than the freshness limit that travelled with it', () => {
    const stale = leg({ fixtureId: 'stale', priceAgeSeconds: 9000, priceAgeLimitSeconds: 7200 })
    const result = buildAccumulators([stale, ...threeCleanLegs()], defaultRequest(), REGISTRY)
    expect(result.candidatesEligible).toBe(3)
    expect(
      result.rejectionReasons['price older than the freshness limit for its time to kickoff'],
    ).toBe(1)
  })

  it('keeps a leg whose freshness limit is unknown rather than guessing one', () => {
    const unknown = leg({
      fixtureId: 'f9',
      home: 'Ayr',
      away: 'Raith Rvs',
      priceAgeSeconds: 99_999,
      priceAgeLimitSeconds: null,
    })
    const result = buildAccumulators([unknown, ...threeCleanLegs()], defaultRequest(), REGISTRY)
    expect(result.candidatesEligible).toBe(4)
  })
})

describe('an accumulator is never two bets on one thing', () => {
  it('never combines two markets on the same fixture', () => {
    const legs = [
      leg({ fixtureId: 'f1', selection: 'H', odds: 2.5 }),
      leg({ fixtureId: 'f1', selection: 'A', odds: 3.1 }),
      leg({ fixtureId: 'f2', home: 'Hearts', away: 'Hibernian', league: 'SPL' }),
    ]
    const result = buildAccumulators(legs, defaultRequest({ legs: 2 }), REGISTRY)
    for (const acc of result.accumulators) {
      expect(new Set(acc.legs.map((l) => l.fixtureId)).size).toBe(acc.legs.length)
    }
    expect(result.accumulators.length).toBeGreaterThan(0)
  })

  it('never prices the same club twice across two fixtures', () => {
    const legs = [
      leg({ fixtureId: 'f1', home: 'Leicester', away: 'Norwich' }),
      leg({ fixtureId: 'f2', home: 'Leicester', away: 'Hull' }),
      leg({ fixtureId: 'f3', home: 'Hearts', away: 'Hibernian', league: 'SPL' }),
    ]
    const result = buildAccumulators(legs, defaultRequest({ legs: 2 }), REGISTRY)
    for (const acc of result.accumulators) {
      const clubs = acc.legs.flatMap((l) => [l.home, l.away])
      expect(new Set(clubs).size).toBe(clubs.length)
    }
  })
})

describe('an actionable accumulator is one real bookmaker, or it is not actionable', () => {
  it('excludes aggregate prices from the search unless the ceiling is asked for', () => {
    const legs = threeCleanLegs('MAX')
    const result = buildAccumulators(legs, defaultRequest(), REGISTRY)
    expect(result.accumulators).toHaveLength(0)
    expect(result.rejectionReasons['priced only at an aggregate, which is not a bet']).toBe(3)
    expect(result.answerWhenEmpty).toBe('No combination meets those constraints.')
  })

  it('marks an aggregate combination unactionable when the ceiling is asked for', () => {
    const result = buildAccumulators(
      threeCleanLegs('MAX'),
      defaultRequest({ includeReferenceCeiling: true }),
      REGISTRY,
    )
    expect(result.accumulators.length).toBeGreaterThan(0)
    for (const acc of result.accumulators) {
      expect(acc.actionable).toBe(false)
      expect(acc.actionableNote).toBe(RESEARCH_CEILING_NOTE)
      expect(acc.warnings.some((w) => /not a real price/.test(w))).toBe(true)
    }
    expect(result.answerWhenEmpty).toBe('No combination meets those constraints.')
  })

  it('never combines legs priced at two different bookmakers', () => {
    const legs = [
      leg({ fixtureId: 'f1', bookmaker: 'B365' }),
      leg({ fixtureId: 'f2', home: 'Hearts', away: 'Hibernian', league: 'SPL', bookmaker: 'PS' }),
      leg({ fixtureId: 'f3', home: 'Wrexham', away: 'Bromley', league: 'EL2', bookmaker: 'B365' }),
    ]
    const result = buildAccumulators(legs, defaultRequest({ legs: 2 }), REGISTRY)
    for (const acc of result.accumulators) {
      expect(new Set(acc.legs.map((l) => l.bookmaker.toUpperCase())).size).toBe(1)
      expect(acc.bookmaker).toBe(acc.legs[0]?.bookmaker.toUpperCase())
    }
    expect(result.bookmakersWithCandidates).toEqual(['B365', 'PS'])
  })

  it('reports a bookmaker that cannot field enough legs rather than silently omitting it', () => {
    const legs = [
      leg({ fixtureId: 'f1', bookmaker: 'B365' }),
      leg({ fixtureId: 'f2', home: 'Hearts', away: 'Hibernian', league: 'SPL', bookmaker: 'B365' }),
      leg({ fixtureId: 'f3', home: 'Wrexham', away: 'Bromley', league: 'EL2', bookmaker: 'PS' }),
    ]
    const result = buildAccumulators(legs, defaultRequest({ legs: 2 }), REGISTRY)
    expect(result.bookmakersWithoutEnoughLegs).toEqual([
      { bookmaker: 'PS', eligibleLegs: 1, legsRequested: 2 },
    ])
  })

  it('drops a leg priced somewhere other than the bookmaker that was asked for', () => {
    const legs = [
      leg({ fixtureId: 'f1', bookmaker: 'B365' }),
      leg({ fixtureId: 'f2', home: 'Hearts', away: 'Hibernian', league: 'SPL', bookmaker: 'PS' }),
    ]
    const result = buildAccumulators(legs, defaultRequest({ legs: 1, bookmaker: 'B365' }), REGISTRY)
    expect(result.candidatesEligible).toBe(1)
    expect(result.rejectionReasons['priced at a different bookmaker than the one requested']).toBe(1)
  })

  it('treats an unregistered bookmaker code as not a real price', () => {
    const result = buildAccumulators(threeCleanLegs('WHO'), defaultRequest(), REGISTRY)
    expect(result.accumulators).toHaveLength(0)
    expect(result.rejectionReasons['priced only at an aggregate, which is not a bet']).toBe(3)
  })
})

describe('the money arithmetic says what it means', () => {
  it('multiplies the leg odds and charges exchange commission on winnings only', () => {
    const result = buildAccumulators(
      threeCleanLegs('BFE'),
      defaultRequest({ legs: 3, stake: 10 }),
      REGISTRY,
    )
    const acc = at(result.accumulators, 0)
    expect(acc.combinedOdds).toBeCloseTo(8, 6)
    expect(acc.exchangeCommission).toBe(0.02)
    // gross 80; commission is 2% of the 70 of winnings, never of the stake.
    expect(acc.estimatedTotalReturn).toBeCloseTo(78.6, 2)
    expect(acc.estimatedProfit).toBeCloseTo(68.6, 2)
  })

  it('keeps total return and profit as separate numbers', () => {
    const result = buildAccumulators(threeCleanLegs(), defaultRequest({ stake: 10 }), REGISTRY)
    const acc = at(result.accumulators, 0)
    expect(acc.estimatedTotalReturn - acc.estimatedProfit).toBeCloseTo(acc.stake, 6)
  })

  it('derives joint probability, fair odds and expected value from the legs', () => {
    const result = buildAccumulators(threeCleanLegs(), defaultRequest({ legs: 3 }), REGISTRY)
    const acc = at(result.accumulators, 0)
    expect(acc.estimatedJointProbability).toBeCloseTo(0.55 ** 3, 6)
    expect(acc.fairCombinedOdds).toBeCloseTo(1 / 0.55 ** 3, 3)
    expect(acc.expectedValue).toBeCloseTo(0.55 ** 3 * 8 - 1, 5)
  })

  it('warns that an exchange stating no commission is reported gross', () => {
    const result = buildAccumulators(threeCleanLegs('SMK'), defaultRequest(), REGISTRY)
    const acc = at(result.accumulators, 0)
    expect(acc.exchangeCommission).toBeNull()
    expect(acc.actionableNote).toMatch(/GROSS of commission/)
  })

  it('rounds on the number’s true decimal expansion, not on a scaled multiplication', () => {
    // The parity suite's own case. `0.0734845` is really 0.07348449999…, so it
    // sits BELOW the tie and must round down. `Math.round(v * 1e6) / 1e6`
    // scales first and returns 0.073485 — the divergence Python would not
    // reproduce.
    const acc = buildAccumulators(
      [leg({ probability: 0.0734845 })],
      defaultRequest({ legs: 1 }),
      REGISTRY,
    ).accumulators[0]
    expect(acc?.estimatedJointProbability).toBe(0.073484)
    expect(Math.round(0.0734845 * 1e6) / 1e6).toBe(0.073485)
  })

  it('sends a genuine tie to the even digit', () => {
    // 1.0625 is 17/16 and so is exact in binary — a real half-way case rather
    // than a near-miss. Half-to-even keeps 1.062; rounding half away from zero
    // would give 1.063.
    const acc = buildAccumulators(
      [leg({ odds: 1.0625 })],
      defaultRequest({ legs: 1 }),
      REGISTRY,
    ).accumulators[0]
    expect(acc?.combinedOdds).toBe(1.062)
    expect(Math.round(1.0625 * 1e3) / 1e3).toBe(1.063)
  })
})

describe('a combined-odds window is applied to the combination, not to the legs', () => {
  it('refuses combinations outside the requested window', () => {
    const low = buildAccumulators(
      threeCleanLegs(),
      defaultRequest({ legs: 3, minCombinedOdds: 100 }),
      REGISTRY,
    )
    expect(low.accumulators).toHaveLength(0)
    expect(low.answerWhenEmpty).toBe('No combination meets those constraints.')

    const high = buildAccumulators(
      threeCleanLegs(),
      defaultRequest({ legs: 3, maxCombinedOdds: 2 }),
      REGISTRY,
    )
    expect(high.accumulators).toHaveLength(0)
  })

  it('admits a combination inside the window', () => {
    const result = buildAccumulators(
      threeCleanLegs(),
      defaultRequest({ legs: 3, minCombinedOdds: 4, maxCombinedOdds: 16 }),
      REGISTRY,
    )
    expect(result.accumulators.length).toBeGreaterThan(0)
    expect(result.answerWhenEmpty).toBeNull()
  })
})

describe('the correlation the estimate cannot see is stated rather than hidden', () => {
  it('attaches the correlation treatment to every accumulator', () => {
    const result = buildAccumulators(threeCleanLegs(), defaultRequest(), REGISTRY)
    expect(result.accumulators[0]?.correlationTreatment).toBe(CORRELATION_NOTE)
  })

  it('warns when every leg sits in one league', () => {
    const legs = [
      leg({ fixtureId: 'f1', home: 'Leicester', away: 'Norwich' }),
      leg({ fixtureId: 'f2', home: 'Hull', away: 'Swansea' }),
      leg({ fixtureId: 'f3', home: 'Stoke', away: 'Cardiff' }),
    ]
    const result = buildAccumulators(legs, defaultRequest({ legs: 3 }), REGISTRY)
    expect(result.accumulators[0]?.warnings.some((w) => /every leg is in EPL/.test(w))).toBe(true)
  })

  it('carries the weakest evidence and the oldest price of its legs', () => {
    const legs = [
      leg({ fixtureId: 'f1', dataConfidence: 0.9, agreement: 0.9, uncertaintyWidth: 0.02, capturedAt: '2026-08-13T09:00:00Z' }),
      leg({ fixtureId: 'f2', home: 'Hearts', away: 'Hibernian', league: 'SPL', dataConfidence: 0.4, agreement: 0.3, uncertaintyWidth: 0.11, capturedAt: '2026-08-13T08:00:00Z' }),
    ]
    const acc = at(buildAccumulators(legs, defaultRequest({ legs: 2 }), REGISTRY).accumulators, 0)
    expect(acc.minDataConfidence).toBeCloseTo(0.4)
    expect(acc.minAgreement).toBeCloseTo(0.3)
    expect(acc.maxUncertaintyWidth).toBeCloseTo(0.11)
    expect(acc.oldestPriceCapturedAt).toBe('2026-08-13T08:00:00Z')
  })

  it('reports absent evidence as absent rather than as zero', () => {
    const legs = [
      leg({ fixtureId: 'f1', dataConfidence: null, agreement: null, uncertaintyWidth: null, capturedAt: null }),
      leg({ fixtureId: 'f2', home: 'Hearts', away: 'Hibernian', league: 'SPL', dataConfidence: null, agreement: null, uncertaintyWidth: null, capturedAt: null }),
    ]
    const acc = at(buildAccumulators(legs, defaultRequest({ legs: 2 }), REGISTRY).accumulators, 0)
    expect(acc.minDataConfidence).toBeNull()
    expect(acc.minAgreement).toBeNull()
    expect(acc.maxUncertaintyWidth).toBeNull()
    expect(acc.oldestPriceCapturedAt).toBeNull()
  })
})

describe('the objective changes which combination is offered first', () => {
  /** One safe short price, one long shot, one middling — three separate books. */
  function mixed(): Leg[] {
    return [
      leg({ fixtureId: 'a1', home: 'A', away: 'B', odds: 1.2, probability: 0.9, dataConfidence: 0.5 }),
      leg({ fixtureId: 'a2', home: 'C', away: 'D', odds: 1.25, probability: 0.85, dataConfidence: 0.4 }),
      leg({ fixtureId: 'b1', home: 'E', away: 'F', odds: 8, probability: 0.2, dataConfidence: 0.95 }),
      leg({ fixtureId: 'b2', home: 'G', away: 'H', odds: 9, probability: 0.19, dataConfidence: 0.99 }),
    ]
  }

  it('puts the most likely combination first when safety is asked for', () => {
    const result = buildAccumulators(mixed(), defaultRequest({ legs: 2, objective: 'safety' }), REGISTRY)
    const first = at(result.accumulators, 0)
    expect(first.legs.map((l) => l.fixtureId).sort()).toEqual(['a1', 'a2'])
  })

  it('puts the biggest payout first when return is asked for, and it is a different answer', () => {
    // The default objective, and the one the page opens on. It ranks on price
    // alone, so it must pick the long shots that `safety` deliberately avoids —
    // if these two ever agreed, one of them would be mislabelled.
    const byReturn = buildAccumulators(
      mixed(),
      defaultRequest({ legs: 2, objective: 'return' }),
      REGISTRY,
    )
    const bySafety = buildAccumulators(
      mixed(),
      defaultRequest({ legs: 2, objective: 'safety' }),
      REGISTRY,
    )

    const top = at(byReturn.accumulators, 0)
    expect(top.legs.map((l) => l.fixtureId).sort()).toEqual(['b1', 'b2'])
    expect(top.combinedOdds).toBeCloseTo(72, 5)
    expect(top.legs.map((l) => l.fixtureId).sort()).not.toEqual(
      at(bySafety.accumulators, 0).legs.map((l) => l.fixtureId).sort(),
    )
  })

  it('still honours the target when ranking by return', () => {
    // A target is a floor on combined odds, not a hint. Asking for the biggest
    // payout must not become a licence to ignore a constraint the user set.
    const result = buildAccumulators(
      mixed(),
      defaultRequest({ legs: 2, objective: 'return', minCombinedOdds: 100 }),
      REGISTRY,
    )
    expect(result.accumulators.every((acc) => acc.combinedOdds >= 100)).toBe(true)
  })

  it('puts the best-evidenced combination first when confidence is asked for', () => {
    const result = buildAccumulators(
      mixed(),
      defaultRequest({ legs: 2, objective: 'confidence' }),
      REGISTRY,
    )
    const first = at(result.accumulators, 0)
    expect(first.legs.map((l) => l.fixtureId).sort()).toEqual(['b1', 'b2'])
    expect(first.minDataConfidence).toBeGreaterThan(0.9)
  })

  it('orders by expected value when value is asked for', () => {
    const result = buildAccumulators(mixed(), defaultRequest({ legs: 2, objective: 'value' }), REGISTRY)
    const values = result.accumulators.map((acc) => acc.expectedValue)
    expect(values).toEqual([...values].sort((a, b) => b - a))
  })
})

describe('the search is bounded and reproducible', () => {
  it('returns at most the requested number of results', () => {
    const legs = Array.from({ length: 6 }, (_, i) =>
      leg({ fixtureId: `f${i}`, home: `H${i}`, away: `A${i}`, odds: 2 + i / 10 }),
    )
    const result = buildAccumulators(legs, defaultRequest({ legs: 2, results: 3 }), REGISTRY)
    expect(result.accumulators).toHaveLength(3)
    expect(result.combinationsEvaluated).toBeGreaterThan(3)
  })

  it('caps the candidate pool and says how many it dropped', () => {
    const legs = Array.from({ length: 8 }, (_, i) =>
      leg({ fixtureId: `f${i}`, home: `H${i}`, away: `A${i}`, odds: 2 + i / 10 }),
    )
    const result = buildAccumulators(legs, defaultRequest({ legs: 2, poolCap: 5 }), REGISTRY)
    expect(result.candidatesEligible).toBe(8)
    expect(result.candidatesConsidered).toBe(5)
    expect(result.candidatesDroppedByPoolCap).toBe(3)
  })

  it('returns the identical answer for the identical input', () => {
    const legs = Array.from({ length: 6 }, (_, i) =>
      leg({ fixtureId: `f${i}`, home: `H${i}`, away: `A${i}`, odds: 2 + i / 10 }),
    )
    const once = buildAccumulators(legs, defaultRequest({ legs: 3 }), REGISTRY)
    const twice = buildAccumulators(legs, defaultRequest({ legs: 3 }), REGISTRY)
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice))
  })

  it('is unmoved by the order the candidates arrive in', () => {
    const legs = Array.from({ length: 5 }, (_, i) =>
      leg({ fixtureId: `f${i}`, home: `H${i}`, away: `A${i}`, odds: 2 + i / 10 }),
    )
    const forwards = buildAccumulators(legs, defaultRequest({ legs: 3 }), REGISTRY)
    const backwards = buildAccumulators([...legs].reverse(), defaultRequest({ legs: 3 }), REGISTRY)
    expect(backwards.accumulators.map((a) => a.legs.map((l) => l.fixtureId).sort())).toEqual(
      forwards.accumulators.map((a) => a.legs.map((l) => l.fixtureId).sort()),
    )
  })
})

describe('"no qualifying bet" is an answer rather than a failure', () => {
  it('says so plainly when nothing survives, without relaxing a threshold', () => {
    const result = buildAccumulators(
      threeCleanLegs(),
      defaultRequest({ legs: 3, minDataConfidence: 0.99 }),
      REGISTRY,
    )
    expect(result.accumulators).toHaveLength(0)
    expect(result.answerWhenEmpty).toBe('No combination meets those constraints.')
    expect(result.candidatesEligible).toBe(0)
  })

  it('says so when there are simply not enough legs to fill the accumulator', () => {
    const result = buildAccumulators(threeCleanLegs().slice(0, 2), defaultRequest({ legs: 3 }), REGISTRY)
    expect(result.accumulators).toHaveLength(0)
    expect(result.answerWhenEmpty).toBe('No combination meets those constraints.')
  })

  it('falls silent about the empty answer once an actionable combination exists', () => {
    const result = buildAccumulators(threeCleanLegs(), defaultRequest({ legs: 3 }), REGISTRY)
    expect(result.accumulators[0]?.actionable).toBe(true)
    expect(result.accumulators[0]?.actionableNote).toMatch(/Every leg is priced at B365/)
    expect(result.answerWhenEmpty).toBeNull()
  })

  it('answers an empty candidate list without throwing', () => {
    const result = buildAccumulators([], defaultRequest(), REGISTRY)
    expect(result.candidatesSupplied).toBe(0)
    expect(result.accumulators).toHaveLength(0)
    expect(result.bookmakersWithCandidates).toEqual([])
    expect(result.answerWhenEmpty).toBe('No combination meets those constraints.')
  })
})
