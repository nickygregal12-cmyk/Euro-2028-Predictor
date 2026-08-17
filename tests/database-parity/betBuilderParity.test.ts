import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'
import {
  buildAccumulators,
  defaultRequest,
  requiredOddsForProfit,
  requiredOddsForTotalReturn,
  type Bookmaker,
  type Leg,
} from '../../src/domain/ai/betBuilder'

/**
 * The Bet Builder's browser adapter, against the Python engine it ports.
 *
 * `ai/accumulator.py` is the combination authority and stays so: it is what
 * `find_value.py` and `tools.py` call, and it is the version the lab's own
 * evidence is produced by. `src/domain/ai/betBuilder.ts` exists because the
 * page has to answer as a slider moves, and a round trip per keystroke is not
 * that.
 *
 * Two implementations of one rule is exactly the shape of defect this
 * repository keeps finding — the value gate's `AGGREGATE_BOOKS` set disagreed
 * with `ai.bookmakers` about Betfair, and the Edge Function's alias table
 * disagreed with `ai/aliases.py` about Leicester — so the two are executed over
 * the same fixtures here and required to agree field for field.
 *
 * Skipped when Python or its dependencies are unavailable, which is honest
 * rather than silent: `python3 -c "import numpy"` is the whole requirement.
 */

const aiDir = resolve(process.cwd(), 'ai')

function pythonAvailable(): boolean {
  try {
    execFileSync('python3', ['-c', 'import numpy'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const REGISTRY: readonly Bookmaker[] = [
  { code: 'B365', name: 'Bet365', kind: 'bookmaker', isRealPrice: true, exchangeCommission: null },
  { code: 'PS', name: 'Pinnacle', kind: 'bookmaker', isRealPrice: true, exchangeCommission: null },
  { code: 'BFE', name: 'Betfair Exchange', kind: 'exchange', isRealPrice: true, exchangeCommission: 0.02 },
  { code: 'MAX', name: 'Market maximum', kind: 'aggregate', isRealPrice: false, exchangeCommission: null },
  { code: 'AVG', name: 'Market average', kind: 'aggregate', isRealPrice: false, exchangeCommission: null },
]

/**
 * A deterministic candidate pool spanning four venues, three leagues, a shared
 * club and a duplicated fixture — every branch the search has.
 */
function pool(): Leg[] {
  const books = ['B365', 'PS', 'BFE', 'MAX']
  const leagues = ['EPL', 'ECH', 'SPL']
  const legs: Leg[] = []
  for (let i = 0; i < 9; i += 1) {
    for (const book of books) {
      legs.push({
        fixtureId: `f${i}`,
        league: at(leagues, i % leagues.length),
        home: `Home ${i}`,
        away: `Away ${i}`,
        kickoffAt: `2026-08-1${(i % 5) + 1}T15:00:00Z`,
        selection: 'H',
        odds: Number((1.7 + i * 0.13 + books.indexOf(book) * 0.07).toFixed(3)),
        probability: Number((0.62 - i * 0.03).toFixed(4)),
        bookmaker: book,
        dataConfidence: Number((0.58 + (i % 4) * 0.07).toFixed(4)),
        dataConfidenceState: 'medium',
        agreement: Number((0.6 + (i % 3) * 0.1).toFixed(4)),
        uncertaintyWidth: Number((0.05 + (i % 3) * 0.02).toFixed(4)),
        capturedAt: '2026-08-13T10:00:00Z',
        priceAgeSeconds: 600,
        priceAgeLimitSeconds: 43200,
        usesMarket: false,
      })
    }
  }
  // The same club on a second fixture, and a second selection on one fixture:
  // both must be refused by the combination rules on both sides.
  legs.push({ ...at(legs, 0), fixtureId: 'f0', selection: 'D', odds: 3.4, probability: 0.26 })
  legs.push({ ...at(legs, 4), fixtureId: 'fx', home: 'Home 0', away: 'Other', odds: 2.5, probability: 0.5 })
  return legs
}

type Scenario = {
  name: string
  request: ReturnType<typeof defaultRequest>
}

const SCENARIOS: readonly Scenario[] = [
  { name: 'treble, value', request: defaultRequest({ legs: 3, objective: 'value', stake: 10 }) },
  { name: 'treble, safety', request: defaultRequest({ legs: 3, objective: 'safety', stake: 10 }) },
  {
    name: 'treble, confidence',
    request: defaultRequest({ legs: 3, objective: 'confidence', stake: 25 }),
  },
  {
    name: 'four fold with a return target',
    request: defaultRequest({ legs: 4, stake: 10, minCombinedOdds: 5 }),
  },
  {
    name: 'double with a data-confidence floor',
    request: defaultRequest({ legs: 2, stake: 10, minDataConfidence: 0.7 }),
  },
  {
    name: 'single at one named bookmaker',
    request: defaultRequest({ legs: 1, stake: 10, bookmaker: 'BFE' }),
  },
  {
    name: 'research ceiling included',
    request: defaultRequest({ legs: 3, stake: 10, includeReferenceCeiling: true }),
  },
  {
    name: 'impossible constraints',
    request: defaultRequest({ legs: 3, stake: 10, minCombinedOdds: 500 }),
  },
]

function pythonResults(): Record<string, unknown> {
  const dir = mkdtempSync(join(tmpdir(), 'betbuilder-'))
  const script = join(dir, 'run.py')
  writeFileSync(
    script,
    `
import json, sys
sys.path.insert(0, ${JSON.stringify(aiDir)})
import accumulator as A

payload = json.load(open(${JSON.stringify(join(dir, 'input.json'))}))
registry = {b["code"]: {"code": b["code"], "kind": b["kind"],
                        "is_real_price": b["isRealPrice"],
                        "exchange_commission": b["exchangeCommission"]}
            for b in payload["registry"]}
legs = [A.Leg(fixture_id=l["fixtureId"], league=l["league"], home=l["home"],
              away=l["away"], kickoff_at=l["kickoffAt"], selection=l["selection"],
              odds=l["odds"], probability=l["probability"],
              bookmaker=l["bookmaker"], data_confidence=l["dataConfidence"],
              data_confidence_state=l["dataConfidenceState"],
              agreement=l["agreement"], uncertainty_width=l["uncertaintyWidth"],
              captured_at=l["capturedAt"], price_age_seconds=l["priceAgeSeconds"])
        for l in payload["legs"]]

out = {}
for scenario in payload["scenarios"]:
    r = scenario["request"]
    request = A.AccumulatorRequest(
        legs=r["legs"], objective=r["objective"], stake=r["stake"],
        min_combined_odds=r["minCombinedOdds"], max_combined_odds=r["maxCombinedOdds"],
        min_leg_odds=r["minLegOdds"], max_leg_odds=r["maxLegOdds"],
        min_leg_probability=r["minLegProbability"],
        min_data_confidence=r["minDataConfidence"],
        exclude_leagues=tuple(r["excludeLeagues"]), exclude_teams=tuple(r["excludeTeams"]),
        results=r["results"], pool_cap=r["poolCap"], bookmaker=r["bookmaker"],
        include_reference_ceiling=r["includeReferenceCeiling"],
        bookmaker_registry=registry)
    built = A.build_accumulators(legs, request)
    out[scenario["name"]] = {
        "candidatesEligible": built["candidates_eligible"],
        "candidatesConsidered": built["candidates_considered"],
        "combinationsEvaluated": built["combinations_evaluated"],
        "rejectionReasons": built["rejection_reasons"],
        "bookmakersWithCandidates": built["bookmakers_with_candidates"],
        "bookmakersWithoutEnoughLegs": [
            {"bookmaker": b["bookmaker"], "eligibleLegs": b["eligible_legs"],
             "legsRequested": b["legs_requested"]}
            for b in built["bookmakers_without_enough_legs"]],
        "accumulators": [{
            "bookmaker": a["bookmaker"],
            "actionable": a["actionable"],
            "combinedOdds": a["combined_odds"],
            "estimatedTotalReturn": a["estimated_total_return"],
            "estimatedProfit": a["estimated_profit"],
            "estimatedJointProbability": a["estimated_joint_probability"],
            "fairCombinedOdds": a["fair_combined_odds"],
            "expectedValue": a["expected_value"],
            "minDataConfidence": a["min_data_confidence"],
            "legs": [f'{l["fixture_id"]}:{l["selection"]}@{l["bookmaker"]}'
                     for l in a["legs"]],
        } for a in built["accumulators"]],
    }
print(json.dumps(out))
`,
    'utf8',
  )
  writeFileSync(
    join(dir, 'input.json'),
    JSON.stringify({ legs: pool(), registry: REGISTRY, scenarios: SCENARIOS }),
    'utf8',
  )
  const stdout = execFileSync('python3', [script], { encoding: 'utf8', cwd: aiDir })
  return JSON.parse(stdout) as Record<string, unknown>
}

function browserResult(scenario: Scenario) {
  const built = buildAccumulators(pool(), scenario.request, REGISTRY)
  return {
    candidatesEligible: built.candidatesEligible,
    candidatesConsidered: built.candidatesConsidered,
    combinationsEvaluated: built.combinationsEvaluated,
    rejectionReasons: built.rejectionReasons,
    bookmakersWithCandidates: built.bookmakersWithCandidates,
    bookmakersWithoutEnoughLegs: built.bookmakersWithoutEnoughLegs,
    accumulators: built.accumulators.map((acc) => ({
      bookmaker: acc.bookmaker,
      actionable: acc.actionable,
      combinedOdds: acc.combinedOdds,
      estimatedTotalReturn: acc.estimatedTotalReturn,
      estimatedProfit: acc.estimatedProfit,
      estimatedJointProbability: acc.estimatedJointProbability,
      fairCombinedOdds: acc.fairCombinedOdds,
      expectedValue: acc.expectedValue,
      minDataConfidence: acc.minDataConfidence,
      legs: acc.legs.map((leg) => `${leg.fixtureId}:${leg.selection}@${leg.bookmaker}`),
    })),
  }
}

describe('the browser Bet Builder agrees with the Python combination engine', () => {
  const available = pythonAvailable()
  const results = available ? pythonResults() : {}

  it.skipIf(!available).each(SCENARIOS.map((s) => s.name))(
    '%s produces identical accumulators in both implementations',
    (name) => {
      const scenario = SCENARIOS.find((s) => s.name === name) as Scenario
      expect(browserResult(scenario)).toEqual(results[name])
    },
  )

  it.skipIf(available)('is skipped without python3 and numpy', () => {
    expect(available).toBe(false)
  })
})

describe('the Bet Builder cannot present a cross-book ceiling as a bet', () => {
  it('excludes aggregates from the search unless the ceiling is asked for', () => {
    const legs = pool().filter((leg) => leg.bookmaker === 'MAX')
    const built = buildAccumulators(legs, defaultRequest({ legs: 3 }), REGISTRY)
    expect(built.accumulators).toEqual([])
    expect(built.rejectionReasons['priced only at an aggregate, which is not a bet']).toBe(
      legs.length,
    )
  })

  it('marks the ceiling view unactionable when it is asked for', () => {
    const legs = pool().filter((leg) => leg.bookmaker === 'MAX')
    const built = buildAccumulators(
      legs,
      defaultRequest({ legs: 3, includeReferenceCeiling: true }),
      REGISTRY,
    )
    expect(built.accumulators.length).toBeGreaterThan(0)
    expect(built.accumulators.every((acc) => acc.actionable === false)).toBe(true)
    expect(built.answerWhenEmpty).toBe('No combination meets those constraints.')
  })

  it('uses one real bookmaker for every leg of an actionable accumulator', () => {
    const built = buildAccumulators(pool(), defaultRequest({ legs: 3 }), REGISTRY)
    const actionable = built.accumulators.filter((acc) => acc.actionable)
    expect(actionable.length).toBeGreaterThan(0)
    for (const acc of actionable) {
      const books = new Set(acc.legs.map((leg) => leg.bookmaker))
      expect(books.size).toBe(1)
      expect(REGISTRY.find((b) => b.code === acc.bookmaker)?.isRealPrice).toBe(true)
    }
  })
})

describe('a target is turned into a constraint without confusing the two meanings', () => {
  it('distinguishes total return from profit', () => {
    expect(requiredOddsForTotalReturn(10, 50)).toBeCloseTo(5)
    expect(requiredOddsForProfit(10, 50)).toBeCloseTo(6)
  })

  it('refuses rather than relaxing when the target cannot be met', () => {
    const built = buildAccumulators(
      pool(),
      defaultRequest({ legs: 3, stake: 10, minCombinedOdds: requiredOddsForTotalReturn(10, 5000) }),
      REGISTRY,
    )
    expect(built.accumulators).toEqual([])
    expect(built.answerWhenEmpty).toBe('No combination meets those constraints.')
  })
})

describe('a stale price cannot become a leg', () => {
  it('drops a leg older than the freshness limit that travelled with it', () => {
    const legs = pool()
      .filter((leg) => leg.bookmaker === 'B365')
      .map((leg, index) => (index === 0 ? { ...leg, priceAgeSeconds: 99999 } : leg))
    const built = buildAccumulators(legs, defaultRequest({ legs: 3 }), REGISTRY)
    expect(
      built.rejectionReasons['price older than the freshness limit for its time to kickoff'],
    ).toBe(1)
    for (const acc of built.accumulators) {
      expect(acc.legs.some((leg) => leg.priceAgeSeconds === 99999)).toBe(false)
    }
  })
})
