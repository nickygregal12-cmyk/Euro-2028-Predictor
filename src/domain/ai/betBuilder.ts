/**
 * The Bet Builder's combination search, as the browser runs it.
 *
 * This is a PRESENTATION ADAPTER, not a second gate. Every leg it receives has
 * already passed the server-side value gate — `admin_ai_bet_builder_candidates`
 * returns rows of `ai.recommendations` where `decision = 'BET'`, joined through
 * `ai.valid_predictions` so a quarantined forecast is absent rather than
 * flagged — and nothing here can add a leg, relax a threshold or turn a PASS
 * into a BET. It filters what it was given and multiplies what survives.
 *
 * It is a deliberate, line-for-line port of `ai/accumulator.py`, and
 * `tests/database-parity/betBuilderParity.test.ts` runs both over the same
 * fixtures and requires identical output. Two implementations exist because the
 * page has to answer instantly as the user moves a slider, and a round trip per
 * keystroke is not that; the parity test is what stops them becoming two
 * different opinions about what a treble returns.
 *
 * The two rules worth restating here, because they are the ones a plausible
 * implementation gets wrong:
 *
 *   ONE BOOKMAKER. `MAX` is the best price on each selection across the sampled
 *   books, and those best prices sit at different books. Multiplying them gives
 *   a return available at no venue on earth. It stays computable as a research
 *   ceiling and is never labelled actionable.
 *
 *   TOTAL RETURN AND PROFIT ARE DIFFERENT NUMBERS. £10 at combined odds 5.0
 *   returns £50 and profits £40. Both are shown, separately named.
 */

export type Objective = 'return' | 'value' | 'safety' | 'confidence'

export const OBJECTIVES: readonly Objective[] = ['return', 'value', 'safety', 'confidence']

/** What each objective actually optimises, for the page to say out loud. */
export const OBJECTIVE_MEANINGS: Readonly<Record<Objective, string>> = {
  return:
    'Biggest payout among combinations that meet the target — the most money if it lands, which says nothing about how likely that is.',
  safety:
    'Highest estimated joint probability among combinations that meet the target — the most likely to land, not the best priced.',
  value:
    'Highest expected value among qualifying combinations — the best price for the risk, which is not the same as the most likely to win.',
  confidence:
    'Strongest evidence behind the legs — how well evidenced the forecasts are, which is not a statement about the chance of winning.',
}

export const DEFAULT_POOL_CAP = 40
export const DEFAULT_RESULTS = 5

export type Bookmaker = {
  readonly code: string
  readonly name: string
  readonly kind: 'bookmaker' | 'exchange' | 'aggregate' | 'unknown'
  readonly isRealPrice: boolean
  readonly exchangeCommission: number | null
}

export type Leg = {
  readonly fixtureId: string
  readonly league: string
  readonly home: string
  readonly away: string
  readonly kickoffAt: string | null
  readonly selection: 'H' | 'D' | 'A'
  readonly odds: number
  readonly probability: number
  readonly bookmaker: string
  readonly dataConfidence: number | null
  readonly dataConfidenceState: string | null
  readonly agreement: number | null
  readonly uncertaintyWidth: number | null
  readonly capturedAt: string | null
  readonly priceAgeSeconds: number | null
  readonly priceAgeLimitSeconds: number | null
  readonly usesMarket: boolean
}

export type BuildRequest = {
  readonly legs: number
  readonly objective: Objective
  readonly stake: number
  readonly minCombinedOdds: number | null
  readonly maxCombinedOdds: number | null
  readonly minLegOdds: number | null
  readonly maxLegOdds: number | null
  readonly minLegProbability: number | null
  readonly minDataConfidence: number | null
  readonly excludeLeagues: readonly string[]
  readonly excludeTeams: readonly string[]
  readonly bookmaker: string | null
  readonly includeReferenceCeiling: boolean
  readonly results: number
  readonly poolCap: number
}

export type BuiltAccumulator = {
  readonly legs: readonly Leg[]
  readonly legCount: number
  readonly bookmaker: string | null
  readonly actionable: boolean
  readonly actionableNote: string
  readonly exchangeCommission: number | null
  readonly combinedOdds: number
  readonly stake: number
  readonly estimatedTotalReturn: number
  readonly estimatedProfit: number
  readonly estimatedJointProbability: number
  readonly fairCombinedOdds: number
  readonly expectedValue: number
  readonly minDataConfidence: number | null
  readonly minAgreement: number | null
  readonly maxUncertaintyWidth: number | null
  readonly correlationTreatment: string
  readonly warnings: readonly string[]
  readonly oldestPriceCapturedAt: string | null
}

export type BuildResult = {
  readonly accumulators: readonly BuiltAccumulator[]
  readonly candidatesSupplied: number
  readonly candidatesEligible: number
  readonly candidatesConsidered: number
  readonly candidatesDroppedByPoolCap: number
  readonly rejectionReasons: Readonly<Record<string, number>>
  readonly bookmakersWithCandidates: readonly string[]
  readonly bookmakersWithoutEnoughLegs: readonly {
    bookmaker: string
    eligibleLegs: number
    legsRequested: number
  }[]
  readonly combinationsEvaluated: number
  readonly answerWhenEmpty: string | null
}

export const CORRELATION_NOTE =
  'One leg per fixture and one leg per club. The joint probability is the ' +
  'product of the leg probabilities, which assumes different fixtures are ' +
  'independent — they are not perfectly independent (weather, refereeing ' +
  'directives, and any systematic model error move several at once), so ' +
  'treat it as an estimate rather than a measurement. Two markets on the ' +
  'SAME fixture are never combined here: their joint probability is only ' +
  'available from the scoreline distribution, and multiplying them would ' +
  'overstate the return of what is largely one bet.'

export const RESEARCH_CEILING_NOTE =
  'Not placeable. These legs are priced across more than one venue (or at an ' +
  'aggregate), so the combined return shown is a line-shopping ceiling ' +
  'rather than a bet. Ask for a single bookmaker to get an actionable one.'

function singleBookNote(book: string): string {
  return (
    `Every leg is priced at ${book}, so the combined odds are the odds that ` +
    'bookmaker is offering on this combination of selections.'
  )
}

export function defaultRequest(overrides: Partial<BuildRequest> = {}): BuildRequest {
  return {
    legs: 3,
    objective: 'return',
    stake: 10,
    minCombinedOdds: null,
    maxCombinedOdds: null,
    minLegOdds: null,
    maxLegOdds: null,
    minLegProbability: null,
    minDataConfidence: null,
    excludeLeagues: [],
    excludeTeams: [],
    bookmaker: null,
    includeReferenceCeiling: false,
    results: DEFAULT_RESULTS,
    poolCap: DEFAULT_POOL_CAP,
    ...overrides,
  }
}

/**
 * Target arithmetic. Kept as two named functions because labelling one as the
 * other is the single most misleading thing this page could do.
 */
export function requiredOddsForTotalReturn(stake: number, targetTotalReturn: number): number {
  if (stake <= 0) throw new Error('a stake of zero cannot reach any return')
  return targetTotalReturn / stake
}

export function requiredOddsForProfit(stake: number, targetProfit: number): number {
  if (stake <= 0) throw new Error('a stake of zero cannot reach any profit')
  return (stake + targetProfit) / stake
}

function fairOdds(leg: Leg): number {
  return leg.probability > 0 ? 1 / leg.probability : Number.POSITIVE_INFINITY
}

export function legEdge(leg: Leg): number {
  return leg.probability * leg.odds - 1
}

export function legFairOdds(leg: Leg): number {
  return fairOdds(leg)
}

function teams(leg: Leg): readonly string[] {
  return [leg.home, leg.away]
}

function ineligible(leg: Leg, request: BuildRequest): string | null {
  if (request.minLegOdds !== null && leg.odds < request.minLegOdds) {
    return 'leg odds below the requested minimum'
  }
  if (request.maxLegOdds !== null && leg.odds > request.maxLegOdds) {
    return 'leg odds above the requested maximum'
  }
  if (request.minLegProbability !== null && leg.probability < request.minLegProbability) {
    return 'leg probability below the requested minimum'
  }
  if (
    request.minDataConfidence !== null &&
    (leg.dataConfidence === null || leg.dataConfidence < request.minDataConfidence)
  ) {
    return 'leg data confidence below the requested minimum'
  }
  if (request.excludeLeagues.includes(leg.league)) return 'league excluded by the request'
  if (teams(leg).some((team) => request.excludeTeams.includes(team))) {
    return 'team excluded by the request'
  }
  // A price older than the freshness policy allows is not a price. The limit
  // travels with the leg from `ai.price_age_limit_seconds`, so this reapplies
  // the server's own number rather than inventing a browser-side one.
  if (
    leg.priceAgeSeconds !== null &&
    leg.priceAgeLimitSeconds !== null &&
    leg.priceAgeSeconds > leg.priceAgeLimitSeconds
  ) {
    return 'price older than the freshness limit for its time to kickoff'
  }
  return null
}

function classify(code: string, registry: readonly Bookmaker[]): Bookmaker {
  const found = registry.find((entry) => entry.code.toUpperCase() === code.toUpperCase())
  if (found) return found
  if (code.toUpperCase() === 'AVG' || code.toUpperCase() === 'MAX') {
    return {
      code: code.toUpperCase(),
      name: code.toUpperCase(),
      kind: 'aggregate',
      isRealPrice: false,
      exchangeCommission: null,
    }
  }
  return {
    code: code.toUpperCase(),
    name: code.toUpperCase(),
    kind: 'unknown',
    isRealPrice: false,
    exchangeCommission: null,
  }
}

// `indices` holds exactly `k` entries throughout, and every read below is at an
// offset already proven `< k` by the loop that produced it — genuinely never
// out of range, but not something the index signature can see. A guard that
// throws documents the invariant instead of silently asserting past it.
function at<T>(arr: readonly T[], i: number): T {
  const value = arr[i]
  if (value === undefined) throw new Error(`combinations: index ${i} out of range`)
  return value
}

/** Every k-subset, in the same order Python's `itertools.combinations` yields. */
function* combinations<T>(items: readonly T[], k: number): Generator<T[]> {
  if (k > items.length || k < 1) return
  const indices = Array.from({ length: k }, (_, i) => i)
  for (;;) {
    yield indices.map((i) => at(items, i))
    let i = k - 1
    while (i >= 0 && indices[i] === i + items.length - k) i -= 1
    if (i < 0) return
    indices[i] = at(indices, i) + 1
    for (let j = i + 1; j < k; j += 1) indices[j] = at(indices, j - 1) + 1
  }
}

function compareIds(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const av = at(a, i)
    const bv = at(b, i)
    if (av !== bv) return av < bv ? -1 : 1
  }
  return a.length - b.length
}

function score(acc: BuiltAccumulator, objective: Objective): (number | string[])[] {
  const ids = acc.legs.map((leg) => leg.fixtureId).slice().sort()
  const placeable = acc.actionable ? 0 : 1
  if (objective === 'safety') {
    return [placeable, -acc.estimatedJointProbability, -acc.expectedValue, ids]
  }
  if (objective === 'confidence') {
    return [placeable, -(acc.minDataConfidence ?? 0), -acc.expectedValue, ids]
  }
  if (objective === 'return') {
    // Deliberately ranks on price alone. It is the only objective that does,
    // which is why its stated meaning says out loud that it is silent on the
    // chance of winning; joint probability breaks ties so that two equally
    // priced combinations are not ordered arbitrarily.
    return [placeable, -acc.combinedOdds, -acc.estimatedJointProbability, ids]
  }
  return [placeable, -acc.expectedValue, -acc.estimatedJointProbability, ids]
}

function compareScores(a: (number | string[])[], b: (number | string[])[]): number {
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]
    const right = b[i]
    if (Array.isArray(left) && Array.isArray(right)) {
      const cmp = compareIds(left, right)
      if (cmp !== 0) return cmp
      continue
    }
    if (left !== right) return (left as number) - (right as number)
  }
  return 0
}

function totalReturn(stake: number, combinedOdds: number, commission: number | null): number {
  const gross = stake * combinedOdds
  if (!commission) return gross
  // Commission is charged on winnings, never on the stake.
  return stake + (gross - stake) * (1 - commission)
}

/**
 * Python's `round()`, exactly: round half to EVEN, on the number's own decimal
 * expansion rather than on a scaled multiplication.
 *
 * This is not pedantry. `Math.round(value * 1e6) / 1e6` rounds half AWAY from
 * zero and introduces its own scaling error, and the parity suite found the
 * difference on the first run: a four-fold joint probability of 0.0734845 came
 * out as 0.073484 in Python and 0.073485 here. One digit in the sixth decimal
 * place of a probability changes nothing anybody would act on — and a parity
 * test that tolerates "nearly the same" is a parity test that will later
 * tolerate a real divergence, so the two round identically instead.
 */
function round(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value
  // Enough decimals to see the number's true position relative to the tie.
  // `6.1325` is really 6.1325000000000002842…, which rounds UP at three
  // decimals; fifteen digits would have shown a flat tie and rounded it down.
  const exact = value.toFixed(Math.min(100, digits + 25))
  const negative = exact.startsWith('-')
  const [whole, fraction = ''] = (negative ? exact.slice(1) : exact).split('.')
  if (fraction.length <= digits) return value

  const kept = fraction.slice(0, digits)
  const rest = fraction.slice(digits)
  const digitsOnly = `${whole}${kept}`
  const lastKept = Number(digitsOnly[digitsOnly.length - 1])

  let roundUp: boolean
  const first = Number(rest[0])
  if (first > 5) roundUp = true
  else if (first < 5) roundUp = false
  else if (/[1-9]/.test(rest.slice(1))) roundUp = true
  else roundUp = lastKept % 2 === 1 // an exact tie goes to the even digit

  // Incremented as an integer string, so the carry cannot pick up a floating
  // point error of its own on the way back out.
  const carried = roundUp
    ? (BigInt(digitsOnly) + 1n).toString().padStart(digitsOnly.length, '0')
    : digitsOnly
  const cut = carried.length - digits
  const magnitude = Number(
    digits === 0 ? carried : `${carried.slice(0, cut) || '0'}.${carried.slice(cut)}`,
  )
  return negative ? -magnitude : magnitude
}

function combineWithin(
  considered: readonly Leg[],
  request: BuildRequest,
  book: string | null,
  registry: readonly Bookmaker[],
): BuiltAccumulator[] {
  const classification = book ? classify(book, registry) : null
  const actionable = Boolean(classification?.isRealPrice)
  const commission = classification?.exchangeCommission ?? null
  let note: string
  if (classification && classification.kind === 'exchange' && commission === null) {
    note =
      `${singleBookNote(book as string)} It is an exchange and ai.bookmakers ` +
      'states no commission, so the return shown is GROSS of commission and an ' +
      'exchange may not offer a traditional accumulator at all.'
  } else if (actionable) {
    note = singleBookNote(book as string)
  } else {
    note = RESEARCH_CEILING_NOTE
  }

  const out: BuiltAccumulator[] = []
  for (const combo of combinations(considered, request.legs)) {
    const fixtures = new Set(combo.map((leg) => leg.fixtureId))
    if (fixtures.size !== combo.length) continue // two legs on one match: never

    const clubs = new Set<string>()
    let duplicated = false
    for (const leg of combo) {
      if (teams(leg).some((team) => clubs.has(team))) {
        duplicated = true
        break
      }
      teams(leg).forEach((team) => clubs.add(team))
    }
    if (duplicated) continue // the same club priced twice

    const odds = combo.reduce((product, leg) => product * leg.odds, 1)
    const joint = combo.reduce((product, leg) => product * leg.probability, 1)
    if (request.minCombinedOdds !== null && odds < request.minCombinedOdds) continue
    if (request.maxCombinedOdds !== null && odds > request.maxCombinedOdds) continue

    const warnings: string[] = []
    const leagues = new Set(combo.map((leg) => leg.league))
    if (leagues.size === 1 && combo.length > 1) {
      warnings.push(
        `every leg is in ${[...leagues][0]}; a systematic model error in one ` +
          'league would move all of them together',
      )
    }
    if (!actionable && book !== null) {
      warnings.push(
        `${book} is not a real price (ai.bookmakers.is_real_price is false); ` +
          'this combination is a reference ceiling, not a bet',
      )
    }
    if (book === null) {
      warnings.push(
        'legs are priced across more than one venue; the combined return is a ' +
          'line-shopping ceiling and is available nowhere',
      )
    }

    const confidences = combo
      .map((leg) => leg.dataConfidence)
      .filter((value): value is number => value !== null)
    const agreements = combo
      .map((leg) => leg.agreement)
      .filter((value): value is number => value !== null)
    const widths = combo
      .map((leg) => leg.uncertaintyWidth)
      .filter((value): value is number => value !== null)
    const captures = combo
      .map((leg) => leg.capturedAt)
      .filter((value): value is string => value !== null)
      .sort()

    const gross = totalReturn(request.stake, odds, commission)
    out.push({
      legs: combo,
      legCount: combo.length,
      bookmaker: book,
      actionable,
      actionableNote: note,
      exchangeCommission: commission,
      combinedOdds: round(odds, 3),
      stake: round(request.stake, 2),
      estimatedTotalReturn: round(gross, 2),
      estimatedProfit: round(gross - request.stake, 2),
      estimatedJointProbability: round(joint, 6),
      fairCombinedOdds: joint > 0 ? round(1 / joint, 3) : Number.POSITIVE_INFINITY,
      expectedValue: round(joint * odds - 1, 5),
      minDataConfidence: confidences.length ? Math.min(...confidences) : null,
      minAgreement: agreements.length ? Math.min(...agreements) : null,
      maxUncertaintyWidth: widths.length ? Math.max(...widths) : null,
      correlationTreatment: CORRELATION_NOTE,
      warnings,
      oldestPriceCapturedAt: captures[0] ?? null,
    })
  }
  return out
}

export function buildAccumulators(
  legs: readonly Leg[],
  request: BuildRequest,
  registry: readonly Bookmaker[],
): BuildResult {
  if (!OBJECTIVES.includes(request.objective)) {
    throw new Error(`unknown objective ${request.objective}`)
  }
  if (request.legs < 1) throw new Error('an accumulator needs at least one leg')

  const rejections: Record<string, number> = {}
  const pool: Leg[] = []
  for (const leg of legs) {
    let why = ineligible(leg, request)
    if (
      why === null &&
      request.bookmaker !== null &&
      leg.bookmaker.toUpperCase() !== request.bookmaker.toUpperCase()
    ) {
      why = 'priced at a different bookmaker than the one requested'
    }
    if (why !== null) {
      rejections[why] = (rejections[why] ?? 0) + 1
    } else {
      pool.push(leg)
    }
  }

  // Deterministic pool order: best edge first, ties by fixture id then
  // selection, so two runs over the same data return the same list.
  pool.sort((a, b) => {
    const edge = legEdge(b) - legEdge(a)
    if (edge !== 0) return edge
    if (a.fixtureId !== b.fixtureId) return a.fixtureId < b.fixtureId ? -1 : 1
    return a.selection < b.selection ? -1 : a.selection > b.selection ? 1 : 0
  })

  const groups = new Map<string, Leg[]>()
  for (const leg of pool) {
    const code = leg.bookmaker.toUpperCase()
    if (!request.includeReferenceCeiling && !classify(code, registry).isRealPrice) {
      const key = 'priced only at an aggregate, which is not a bet'
      rejections[key] = (rejections[key] ?? 0) + 1
      continue
    }
    const bucket = groups.get(code)
    if (bucket) bucket.push(leg)
    else groups.set(code, [leg])
  }

  let dropped = 0
  let consideredTotal = 0
  const results: BuiltAccumulator[] = []
  for (const book of [...groups.keys()].sort()) {
    const bookPool = groups.get(book) as Leg[]
    const considered = bookPool.slice(0, request.poolCap)
    dropped += bookPool.length - considered.length
    consideredTotal += considered.length
    results.push(...combineWithin(considered, request, book, registry))
  }

  results.sort((a, b) => compareScores(score(a, request.objective), score(b, request.objective)))
  const top = results.slice(0, request.results)

  const counts = new Map<string, number>()
  pool.forEach((leg) => {
    const code = leg.bookmaker.toUpperCase()
    counts.set(code, (counts.get(code) ?? 0) + 1)
  })

  return {
    accumulators: top,
    candidatesSupplied: legs.length,
    candidatesEligible: pool.length,
    candidatesConsidered: consideredTotal,
    candidatesDroppedByPoolCap: dropped,
    rejectionReasons: rejections,
    bookmakersWithCandidates: [...counts.keys()].sort(),
    bookmakersWithoutEnoughLegs: [...counts.entries()]
      .filter(([, n]) => n < request.legs)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([bookmaker, eligibleLegs]) => ({
        bookmaker,
        eligibleLegs,
        legsRequested: request.legs,
      })),
    combinationsEvaluated: results.length,
    // A first-class successful answer. Not an error, and never a prompt to
    // relax a threshold: if £10 to £100 needs a low-quality leg, the right
    // answer is that there is no qualifying bet.
    answerWhenEmpty: top.some((acc) => acc.actionable)
      ? null
      : 'No combination meets those constraints.',
  }
}
