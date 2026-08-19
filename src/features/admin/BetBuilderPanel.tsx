import { useEffect, useMemo, useState } from 'react'
import {
  OBJECTIVE_MEANINGS,
  buildAccumulators,
  defaultRequest,
  requiredOddsForTotalReturn,
  type BuiltAccumulator,
  type Objective,
} from '../../domain/ai/betBuilder'
import { Alert, Button, Skeleton } from '../../design-system'
import { AI_LAB_LEAGUES } from '../../services/supabase/aiLabModel'
import {
  fetchBetBuilderBookmakers,
  fetchBetBuilderCandidates,
  type BetBuilderCandidates,
  type BookmakerSummary,
} from '../../services/supabase/betBuilder'
import { userFacingError } from '../../shared/errors/userFacingError'
import styles from './BetBuilderPanel.module.css'

/**
 * The private Bet Builder.
 *
 * Administrator-only, inside the Hub-only AI Lab, absent from the Euro
 * deployment's route tree, paper research only, and with no bet-placement
 * integration of any kind.
 *
 * The page filters and presents; it never judges. Every leg it can see has
 * already passed the server-side value gate — the bounded read returns
 * `ai.recommendations` rows where `decision = 'BET'`, joined through
 * `ai.valid_predictions` — so there is no path by which the browser can turn a
 * PASS into a bet, admit a quarantined forecast, or relax a threshold.
 *
 * Three things this page is careful about, each of which is easy to get wrong
 * in a way that looks fine:
 *
 *   ONE BOOKMAKER. An actionable accumulator is priced at a single real venue.
 *   `MAX` is the best price on each selection ACROSS books and is available
 *   nowhere as a combination; it is offered only as an explicitly-labelled
 *   research ceiling.
 *
 *   RETURN IS NOT PROFIT. £10 at 5.0 returns £50 and profits £40. Both are
 *   shown and neither is labelled as the other.
 *
 *   FOUR RANKINGS, FOUR MEANINGS. "Biggest return" is the highest combined
 *   odds and says nothing about the chance of winning; "safest" is the highest
 *   joint probability; "best value" is the highest expected value; "best
 *   evidenced" is the strongest evidence behind the legs and is also NOT a
 *   statement about the chance of winning. None is called "confidence" alone.
 *
 * The control surface was cut from roughly thirty-five visible controls to
 * twelve, measured in a browser. What went behind "More filters" is the long
 * tail — bookmaker, ten league chips, odds and probability floors, excluded
 * teams — and the panel's summary counts how many of them are active, so a
 * collapsed filter cannot silently shrink the result list.
 *
 * ONE TARGET FIELD REPLACED A THREE-WAY CHOICE. "No target", "minimum total
 * return" and "minimum profit" were the same constraint written three ways,
 * since return = profit + stake. The page now asks once and states both
 * numbers, which is the part that mattered.
 */

const LEG_CHOICES = [
  { legs: 1, label: 'Single' },
  { legs: 2, label: 'Double' },
  { legs: 3, label: 'Treble' },
  { legs: 4, label: '4 fold' },
  { legs: 5, label: '5 fold' },
  { legs: 6, label: '6 fold' },
  { legs: 8, label: '8 fold' },
] as const

const OBJECTIVE_CHOICES: readonly { key: Objective; label: string }[] = [
  { key: 'return', label: 'Biggest return' },
  { key: 'safety', label: 'Safest' },
  { key: 'value', label: 'Best value' },
  { key: 'confidence', label: 'Best evidenced' },
]

export type DateWindow = 'today' | 'tomorrow' | 'saturday3pm' | 'weekend' | 'week'

const DATE_CHOICES: readonly { key: DateWindow; label: string }[] = [
  { key: 'week', label: 'Next 7 days' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'saturday3pm', label: 'Saturday 3pm' },
  { key: 'weekend', label: 'All weekend' },
]

// The traditional Saturday afternoon slate rather than literally 15:00. A 14:30
// or 16:30 kick-off belongs to the same block, and a filter that returned an
// empty list because the only game that day started at half past would be worse
// than useless.
const SATURDAY_BLOCK_FROM_HOUR = 14.5
const SATURDAY_BLOCK_TO_HOUR = 17

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function windowFor(choice: DateWindow, now: Date): { from: Date; to: Date } {
  const today = startOfDay(now)
  if (choice === 'today') {
    const end = new Date(today)
    end.setDate(end.getDate() + 1)
    return { from: now, to: end }
  }
  if (choice === 'tomorrow') {
    const from = new Date(today)
    from.setDate(from.getDate() + 1)
    const to = new Date(from)
    to.setDate(to.getDate() + 1)
    return { from, to }
  }
  if (choice === 'saturday3pm') {
    const from = new Date(today)
    from.setDate(from.getDate() + ((6 - from.getDay() + 7) % 7))
    const to = new Date(from)
    from.setHours(Math.floor(SATURDAY_BLOCK_FROM_HOUR), (SATURDAY_BLOCK_FROM_HOUR % 1) * 60, 0, 0)
    to.setHours(SATURDAY_BLOCK_TO_HOUR, 0, 0, 0)
    // Asked on a Saturday evening, the block is already over. Rolling to next
    // Saturday is the only reading that returns fixtures; the alternative is a
    // window entirely in the past and an empty list that looks like "no value
    // found" rather than "you have missed it".
    if (to <= now) {
      from.setDate(from.getDate() + 7)
      to.setDate(to.getDate() + 7)
    }
    return { from, to }
  }
  if (choice === 'weekend') {
    // Saturday 00:00 to Monday 00:00, this coming weekend.
    const from = new Date(today)
    const daysToSaturday = (6 - from.getDay() + 7) % 7
    from.setDate(from.getDate() + daysToSaturday)
    const to = new Date(from)
    to.setDate(to.getDate() + 2)
    return { from: from < now ? now : from, to }
  }
  const to = new Date(today)
  to.setDate(to.getDate() + 7)
  return { from: now, to }
}

function money(value: number): string {
  return `£${value.toFixed(2)}`
}

function percent(value: number | null, digits = 1): string {
  return value === null ? '—' : `${(value * 100).toFixed(digits)}%`
}

function when(value: string | null): string {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return date.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

function age(seconds: number | null): string {
  if (seconds === null) return 'unknown age'
  if (seconds < 90) return `${Math.round(seconds)}s old`
  if (seconds < 5400) return `${Math.round(seconds / 60)} min old`
  return `${(seconds / 3600).toFixed(1)}h old`
}

function selectionLabel(selection: string, home: string, away: string): string {
  if (selection === 'H') return `${home} to win`
  if (selection === 'A') return `${away} to win`
  return 'Draw'
}

type Loaded =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; candidates: BetBuilderCandidates }

export function chooseBetBuilderBookmaker(
  rows: readonly BookmakerSummary[],
  requestedLegs: number,
  current: string | null,
): string | null {
  const actionable = rows.filter((row) => row.isRealPrice)
  const currentRow = actionable.find((row) => row.code === current)
  if (currentRow && currentRow.legs >= requestedLegs) return currentRow.code

  const enough = actionable.filter((row) => row.legs >= requestedLegs)
  const pool = enough.length ? enough : actionable
  return [...pool].sort((a, b) => b.legs - a.legs || a.code.localeCompare(b.code))[0]?.code ?? null
}

export function BetBuilderPanel() {
  const [books, setBooks] = useState<readonly BookmakerSummary[] | null>(null)
  const [booksError, setBooksError] = useState<string | null>(null)
  const [bookmaker, setBookmaker] = useState<string | null>(null)
  const [leagues, setLeagues] = useState<readonly string[]>([])
  const [dateWindow, setDateWindow] = useState<DateWindow>('week')
  const [stake, setStake] = useState(10)
  const [legs, setLegs] = useState(3)
  const [objective, setObjective] = useState<Objective>('return')
  const [targetAmount, setTargetAmount] = useState<number | null>(null)
  const [minLegProbability, setMinLegProbability] = useState<number | null>(null)
  const [minDataConfidence, setMinDataConfidence] = useState<number | null>(null)
  const [minLegOdds, setMinLegOdds] = useState<number | null>(null)
  const [maxLegOdds, setMaxLegOdds] = useState<number | null>(null)
  const [excludeTeams, setExcludeTeams] = useState('')
  const [state, setState] = useState<Loaded>({ kind: 'idle' })
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setBooksError(null)
    fetchBetBuilderBookmakers()
      .then((rows) => {
        if (!active) return
        setBooks(rows)
        setBookmaker((current) => chooseBetBuilderBookmaker(rows, legs, current))
      })
      .catch((error: unknown) => {
        if (active) setBooksError(userFacingError(error, 'Bookmakers could not be read.'))
      })
    return () => {
      active = false
    }
  }, [reload, legs])

  useEffect(() => {
    if (!bookmaker) return
    let active = true
    setState({ kind: 'loading' })
    const { from, to } = windowFor(dateWindow, new Date())
    fetchBetBuilderCandidates({ bookmaker, leagues: leagues.length ? leagues : null, from, to })
      .then((candidates) => {
        if (active) setState({ kind: 'ready', candidates })
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            kind: 'failed',
            message: userFacingError(error, 'Selections could not be read.'),
          })
        }
      })
    return () => {
      active = false
    }
  }, [bookmaker, leagues, dateWindow, reload])

  const registry = useMemo(
    () =>
      (books ?? []).map((row) => ({
        code: row.code,
        name: row.name,
        kind: row.kind,
        isRealPrice: row.isRealPrice,
        exchangeCommission: row.exchangeCommission,
      })),
    [books],
  )

  // One field replaced a three-way "no target / total return / profit" choice
  // plus its own amount box. Nothing was dropped: a target return and a target
  // profit are the same constraint written two ways, since return = profit +
  // stake. The page therefore asks once and SAYS BOTH NUMBERS, which is the
  // part that actually mattered -- `£10 returning £50` and `£10 profiting £40`
  // are the same bet, and only one of them can be called the return.
  const requiredOdds = useMemo(() => {
    if (targetAmount === null || targetAmount <= 0 || stake <= 0) return null
    return requiredOddsForTotalReturn(stake, targetAmount)
  }, [stake, targetAmount])

  const targetSentence = useMemo(() => {
    if (stake <= 0) return 'Enter a stake to see what a combination would return.'
    if (requiredOdds === null) {
      return `No target set — showing the ${OBJECTIVE_CHOICES.find((c) => c.key === objective)?.label.toLowerCase() ?? ''} combinations for a ${money(stake)} stake.`
    }
    return `${money(stake)} returning ${money(targetAmount ?? 0)} needs combined odds of ${requiredOdds.toFixed(2)} — a profit of ${money(Math.max(0, (targetAmount ?? 0) - stake))} on top of your stake.`
  }, [stake, targetAmount, requiredOdds, objective])

  // Counted so the collapsed panel cannot hide a filter that is silently
  // shrinking the result list.
  const activeFilterCount = useMemo(
    () =>
      [
        leagues.length > 0,
        minLegProbability !== null,
        minDataConfidence !== null,
        minLegOdds !== null,
        maxLegOdds !== null,
        excludeTeams.trim() !== '',
      ].filter(Boolean).length,
    [leagues, minLegProbability, minDataConfidence, minLegOdds, maxLegOdds, excludeTeams],
  )

  const built = useMemo(() => {
    if (state.kind !== 'ready') return null
    return buildAccumulators(
      state.candidates.legs,
      defaultRequest({
        legs,
        objective,
        stake,
        minCombinedOdds: requiredOdds,
        minLegProbability,
        minDataConfidence,
        minLegOdds,
        maxLegOdds,
        excludeTeams: excludeTeams
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
        bookmaker,
        results: 5,
      }),
      registry,
    )
  }, [
    state, legs, objective, stake, requiredOdds, minLegProbability, minDataConfidence,
    minLegOdds, maxLegOdds, excludeTeams, bookmaker, registry,
  ])

  const actionable = built?.accumulators.filter((acc) => acc.actionable) ?? []
  const selectedBook = books?.find((row) => row.code === bookmaker) ?? null

  return (
    <div className={styles.builder}>
      <section className={styles.intro}>
        <h2>Bet Builder</h2>
        <p>
          Combinations assembled only from selections that already passed the value gate on the
          server, priced at one real bookmaker. Paper research: nothing here places a bet, and
          nothing here can admit a selection the gate refused.
        </p>
      </section>

      {booksError ? <Alert variant="warning">{booksError}</Alert> : null}

      <section className={styles.controls} aria-label="Bet Builder controls">
        <div className={styles.primary}>
          <label className={styles.amount}>
            Stake
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={stake}
              onChange={(event) => setStake(Number(event.target.value) || 0)}
            />
          </label>

          <label className={styles.amount}>
            Target return
            <input
              type="number"
              min={0}
              step={5}
              placeholder="Best available"
              value={targetAmount ?? ''}
              onChange={(event) =>
                setTargetAmount(event.target.value === '' ? null : Number(event.target.value) || 0)
              }
            />
          </label>

          <label className={styles.amount}>
            Legs
            <select value={legs} onChange={(event) => setLegs(Number(event.target.value))}>
              {LEG_CHOICES.map((choice) => (
                <option key={choice.legs} value={choice.legs}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className={styles.readout}>{targetSentence}</p>

        <fieldset className={styles.field}>
          <legend>Rank by</legend>
          <div className={styles.chips}>
            {OBJECTIVE_CHOICES.map((choice) => (
              <button
                type="button"
                key={choice.key}
                aria-pressed={objective === choice.key}
                onClick={() => setObjective(choice.key)}
              >
                {choice.label}
              </button>
            ))}
          </div>
          <small>{OBJECTIVE_MEANINGS[objective]}</small>
        </fieldset>

        <fieldset className={styles.field}>
          <legend>When</legend>
          <div className={styles.chips}>
            {DATE_CHOICES.map((choice) => (
              <button
                type="button"
                key={choice.key}
                aria-pressed={dateWindow === choice.key}
                onClick={() => setDateWindow(choice.key)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </fieldset>

        <details className={styles.optional}>
          <summary>
            More filters{activeFilterCount ? ` (${activeFilterCount} active)` : ''}
          </summary>
          <div className={styles.optionalGrid}>
            <label className={styles.wide}>
              Bookmaker
              <select value={bookmaker ?? ''} onChange={(event) => setBookmaker(event.target.value)}>
                {(books ?? [])
                  .filter((row) => row.isRealPrice)
                  .map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.name} · {row.legs} selection{row.legs === 1 ? '' : 's'}
                    </option>
                  ))}
              </select>
              <small>
                Aggregates (AVG, MAX) are excluded: their best prices sit at different books, so a
                combination of them is available nowhere.
              </small>
            </label>

            <fieldset className={`${styles.field} ${styles.wide}`}>
              <legend>Leagues</legend>
              <div className={styles.chips}>
                <button
                  type="button"
                  aria-pressed={leagues.length === 0}
                  onClick={() => setLeagues([])}
                >
                  All available
                </button>
                {AI_LAB_LEAGUES.map((league) => (
                  <button
                    type="button"
                    key={league.key}
                    aria-pressed={leagues.includes(league.key)}
                    onClick={() =>
                      setLeagues((current) =>
                        current.includes(league.key)
                          ? current.filter((key) => key !== league.key)
                          : [...current, league.key],
                      )
                    }
                  >
                    {league.name}
                  </button>
                ))}
              </div>
            </fieldset>

            <label>
              Minimum individual win probability
              <input
                type="number" min={0} max={1} step={0.05}
                value={minLegProbability ?? ''}
                onChange={(event) =>
                  setMinLegProbability(event.target.value === '' ? null : Number(event.target.value))
                }
              />
            </label>
            <label>
              Minimum data confidence
              <input
                type="number" min={0} max={1} step={0.05}
                value={minDataConfidence ?? ''}
                onChange={(event) =>
                  setMinDataConfidence(event.target.value === '' ? null : Number(event.target.value))
                }
              />
              <small>
                Leaving this blank keeps the gate&rsquo;s own floor. It cannot be lowered here.
              </small>
            </label>
            <label>
              Minimum leg odds
              <input
                type="number" min={1} step={0.1}
                value={minLegOdds ?? ''}
                onChange={(event) =>
                  setMinLegOdds(event.target.value === '' ? null : Number(event.target.value))
                }
              />
            </label>
            <label>
              Maximum leg odds
              <input
                type="number" min={1} step={0.5}
                value={maxLegOdds ?? ''}
                onChange={(event) =>
                  setMaxLegOdds(event.target.value === '' ? null : Number(event.target.value))
                }
              />
            </label>
            <label className={styles.wide}>
              Exclude teams (comma separated)
              <input
                type="text"
                value={excludeTeams}
                onChange={(event) => setExcludeTeams(event.target.value)}
              />
            </label>

            <div className={styles.wide}>
              <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
                Refresh selections
              </Button>
            </div>
          </div>
        </details>
      </section>

      {state.kind === 'loading' ? <Skeleton height="12rem" /> : null}
      {state.kind === 'failed' ? (
        <Alert variant="warning" title="Selections unavailable">{state.message}</Alert>
      ) : null}

      {state.kind === 'ready' && built ? (
        <>
          <p className={styles.summary}>
            {state.candidates.legCount} gate-passed selection
            {state.candidates.legCount === 1 ? '' : 's'} at {selectedBook?.name ?? bookmaker}
            {' · '}
            {built.candidatesEligible} eligible after your filters
            {built.candidatesDroppedByPoolCap > 0
              ? ` · ${built.candidatesDroppedByPoolCap} dropped by the pool cap`
              : ''}
            {' · '}
            {built.combinationsEvaluated} combination
            {built.combinationsEvaluated === 1 ? '' : 's'} evaluated
          </p>

          {actionable.length === 0 ? (
            <Alert variant="info" title="No combination meets those constraints.">
              <p className={styles.emptyCopy}>
                This is an answer, not a failure. Nothing is relaxed to produce a bet: if reaching
                the target would need a selection the gate refused, or a leg below the data-confidence
                floor, there is no qualifying combination.
              </p>
              {Object.keys(built.rejectionReasons).length ? (
                <ul className={styles.reasons}>
                  {Object.entries(built.rejectionReasons).map(([reason, count]) => (
                    <li key={reason}>
                      {count} selection{count === 1 ? '' : 's'}: {reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              {built.bookmakersWithoutEnoughLegs.length ? (
                <p className={styles.emptyCopy}>
                  {built.bookmakersWithoutEnoughLegs
                    .map(
                      (row) =>
                        `${row.bookmaker} prices ${row.eligibleLegs} qualifying selection${row.eligibleLegs === 1 ? '' : 's'}, fewer than the ${row.legsRequested} requested`,
                    )
                    .join('; ')}
                  . No leg is ever taken from a second bookmaker to make up the number.
                </p>
              ) : null}
            </Alert>
          ) : (
            <ol className={styles.results}>
              {actionable.map((acc, index) => (
                <AccumulatorCard key={index} accumulator={acc} />
              ))}
            </ol>
          )}
        </>
      ) : null}
    </div>
  )
}

function AccumulatorCard({ accumulator }: { accumulator: BuiltAccumulator }) {
  return (
    <li className={styles.card}>
      <header className={styles.cardHead}>
        <div>
          <span className={styles.bookPill}>{accumulator.bookmaker}</span>
          <strong>
            {accumulator.legCount} leg{accumulator.legCount === 1 ? '' : 's'} at{' '}
            {accumulator.combinedOdds.toFixed(2)}
          </strong>
        </div>
        <div className={styles.money}>
          <span>
            Stake <strong>{money(accumulator.stake)}</strong>
          </span>
          <span>
            Total return <strong>{money(accumulator.estimatedTotalReturn)}</strong>
          </span>
          <span>
            Profit <strong>{money(accumulator.estimatedProfit)}</strong>
          </span>
        </div>
      </header>

      <p className={styles.actionable}>{accumulator.actionableNote}</p>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Match</th>
              <th scope="col">Selection</th>
              <th scope="col">Odds</th>
              <th scope="col">Model</th>
              <th scope="col">Fair odds</th>
              <th scope="col">Edge</th>
              <th scope="col">Data confidence</th>
              <th scope="col">Agreement</th>
              <th scope="col">Uncertainty</th>
              <th scope="col">Price captured</th>
            </tr>
          </thead>
          <tbody>
            {accumulator.legs.map((leg) => (
              <tr key={`${leg.fixtureId}-${leg.selection}`}>
                <td>
                  <strong>
                    {leg.home} v {leg.away}
                  </strong>
                  <span>
                    {leg.league} · {when(leg.kickoffAt)}
                  </span>
                </td>
                <td>{selectionLabel(leg.selection, leg.home, leg.away)}</td>
                <td>{leg.odds.toFixed(2)}</td>
                <td>{percent(leg.probability)}</td>
                <td>{leg.probability > 0 ? (1 / leg.probability).toFixed(2) : '—'}</td>
                <td>{percent(leg.probability * leg.odds - 1)}</td>
                <td>
                  {percent(leg.dataConfidence)}
                  {leg.dataConfidenceState ? ` · ${leg.dataConfidenceState}` : ''}
                </td>
                <td>{leg.agreement === null ? 'single model' : percent(leg.agreement)}</td>
                <td>{leg.uncertaintyWidth === null ? '—' : percent(leg.uncertaintyWidth)}</td>
                <td>
                  {when(leg.capturedAt)}
                  <span>{age(leg.priceAgeSeconds)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className={styles.combined}>
        <div>
          <dt>Estimated joint probability</dt>
          <dd>{percent(accumulator.estimatedJointProbability, 2)}</dd>
        </div>
        <div>
          <dt>Fair combined odds</dt>
          <dd>{accumulator.fairCombinedOdds.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Expected value</dt>
          <dd>{percent(accumulator.expectedValue, 2)}</dd>
        </div>
        <div>
          <dt>Lowest leg data confidence</dt>
          <dd>{percent(accumulator.minDataConfidence)}</dd>
        </div>
        <div>
          <dt>Oldest price</dt>
          <dd>{when(accumulator.oldestPriceCapturedAt)}</dd>
        </div>
        {accumulator.exchangeCommission === null ? null : (
          <div>
            <dt>Exchange commission</dt>
            <dd>{percent(accumulator.exchangeCommission, 1)} of winnings</dd>
          </div>
        )}
      </dl>

      {accumulator.warnings.length ? (
        <ul className={styles.warnings}>
          {accumulator.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <p className={styles.correlation}>{accumulator.correlationTreatment}</p>
    </li>
  )
}
