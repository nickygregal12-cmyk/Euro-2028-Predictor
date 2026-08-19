import { useMemo, useState } from 'react'
import { Alert } from '../../design-system'
import type {
  AiCoverage,
  AiHealth,
  AiResultsReview,
  CoverageFixture,
} from '../../services/supabase/aiLabCoverageModel'
import styles from './AiLabPage.module.css'

/**
 * The three surfaces that answer #854's central question: is there no value
 * right now, or is the pipeline broken?
 *
 * Coverage lists EVERY relevant fixture rather than only the actionable ones,
 * because a fixture that is absent looks identical to a fixture that does not
 * exist. A PASS is shown with the gate that stopped it, the number that gate
 * measured and the limit it was measured against, so "why is this not a bet"
 * has an answer on the same row.
 */

function percent(value: number | null, digits = 1): string {
  return value === null ? '—' : `${(value * 100).toFixed(digits)}%`
}

function decimal(value: number | null, digits = 2): string {
  return value === null ? '—' : value.toFixed(digits)
}

function signedPercent(value: number | null): string {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function when(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return date.toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

/** A duration a person can read, from seconds. */
export function humanAge(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return 'unknown'
  if (seconds < 90) return `${Math.round(seconds)}s`
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)} h`
  return `${(seconds / 86400).toFixed(1)} days`
}

/**
 * Whether a price is inside the limit its own distance from kickoff allows.
 * Returned as a tri-state rather than a boolean: "no price at all" and "a price
 * that is too old" are different problems with different fixes.
 */
export function priceFreshness(
  ageSeconds: number | null,
  limitSeconds: number | null,
): 'fresh' | 'stale' | 'unknown' {
  if (ageSeconds === null || limitSeconds === null) return 'unknown'
  return ageSeconds <= limitSeconds ? 'fresh' : 'stale'
}

function outcomeLabel(selection: string | null): string {
  if (selection === 'H') return 'Home'
  if (selection === 'D') return 'Draw'
  if (selection === 'A') return 'Away'
  return selection ?? '—'
}

export function OperationalHealth({ health }: { health: AiHealth }) {
  const forecastGap = health.predictions.withoutForecast
  const priceAge = health.prices.lastRealCaptureAt
    ? (Date.now() - Date.parse(health.prices.lastRealCaptureAt)) / 1000
    : null
  const budgetLeft =
    health.oddsApi.softCap !== null && health.oddsApi.creditsUsedThisMonth !== null
      ? health.oddsApi.softCap - health.oddsApi.creditsUsedThisMonth
      : null

  const rows: readonly {
    label: string
    value: string
    detail: string
    tone: 'positive' | 'negative' | 'neutral'
  }[] = [
    {
      label: 'Fixtures',
      value: `${health.fixtures.upcoming7d} in 7 days`,
      detail: `${health.fixtures.leaguesWithUpcoming} leagues · synced ${when(health.fixtures.lastSyncAt)}`,
      tone: health.fixtures.upcoming7d > 0 ? 'positive' : 'neutral',
    },
    {
      label: 'Forecasts',
      value: `${health.predictions.withCurrentForecast} / ${health.predictions.upcomingFixtures}`,
      detail: forecastGap === 0
        ? `every upcoming fixture · last run ${when(health.predictions.lastPredictAt)}`
        : `${forecastGap} without a forecast · last run ${when(health.predictions.lastPredictAt)}`,
      tone: forecastGap === 0 ? 'positive' : 'negative',
    },
    {
      label: 'Real prices',
      value: priceAge === null ? 'none' : `${humanAge(priceAge)} old`,
      detail: health.prices.realBooksSeen7d.length
        ? `${health.prices.realBooksSeen7d.join(', ')} seen this week`
        : 'no real bookmaker price captured this week',
      // 12 hours is the loosest limit the value gate ever applies, so a capture
      // older than that cannot be current for ANY fixture.
      tone: priceAge !== null && priceAge <= 43200 ? 'positive' : 'negative',
    },
    {
      label: 'Value loop',
      value: `${health.valueLoop.currentBets} BET · ${health.valueLoop.currentPasses} PASS`,
      detail: `last run ${when(health.valueLoop.lastRunAt)}`,
      tone: 'neutral',
    },
    {
      label: 'Settlement',
      value: health.settlement.playedAndUnsettled === 0
        ? 'caught up'
        : `${health.settlement.playedAndUnsettled} waiting`,
      detail: `${health.settlement.settled} settled · ${health.settlement.awaitingClosingBenchmark} without a closing benchmark · last run ${when(health.settlement.lastRunAt)}`,
      tone: health.settlement.playedAndUnsettled === 0 ? 'positive' : 'negative',
    },
    {
      label: 'Odds provider',
      value: health.oddsApi.collectionEnabled ? 'collecting' : 'disabled',
      detail: `${health.oddsApi.creditsUsedThisMonth ?? '—'} of ${health.oddsApi.softCap ?? '—'} credits used${budgetLeft === null ? '' : `, ${budgetLeft} left`} · last dispatch ${when(health.oddsApi.lastDispatchAt)}`,
      tone: health.oddsApi.collectionEnabled ? 'positive' : 'negative',
    },
    {
      label: 'Models',
      value: `${health.models.current} / ${health.models.expected}`,
      detail: health.models.oldestTrainedThrough
        ? `data through ${health.models.oldestTrainedThrough} to ${health.models.newestTrainedThrough} · trained ${when(health.models.lastTrainAt)}`
        : `trained ${when(health.models.lastTrainAt)}`,
      tone: health.models.current === health.models.expected ? 'positive' : 'negative',
    },
  ]

  return (
    <section className={styles.panel} aria-labelledby="ai-health-heading">
      <div className={styles.panelHeading}>
        <h2 id="ai-health-heading">Pipeline health</h2>
        <span>Read {when(health.generatedAt)}</span>
      </div>
      <div className={styles.metricGrid}>
        {rows.map((row) => (
          <div className={styles.metric} key={row.label} data-tone={row.tone}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            <small>{row.detail}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Plain names for the refusal vocabulary.
 *
 * The codes are the contract and stay visible — `ai.pass_reason_explanation`
 * answers for all eleven and a reader tracing one back to SQL needs the exact
 * string. But `PASS_HIGH_MODEL_DISAGREEMENT` as the PRIMARY label makes a
 * human read a machine's identifier and translate it themselves, on a page
 * whose whole purpose is explaining why a fixture was refused.
 *
 * An unknown code falls through to itself rather than being prettified by
 * rule, so a new refusal added in SQL shows up honestly as unlabelled here
 * instead of being silently reworded into something it does not mean.
 */
const REFUSAL_LABELS: Readonly<Record<string, string>> = {
  PASS_LOW_EDGE: 'Edge too small',
  PASS_STALE_PRICE: 'Price too old',
  PASS_WIDE_UNCERTAINTY: 'Forecast too uncertain',
  PASS_HIGH_MODEL_DISAGREEMENT: 'Models disagree',
  PASS_ODDS_OUT_OF_RANGE: 'Price out of range',
  PASS_LOW_DATA: 'Too little history',
  PASS_MARKET_DISCREPANCY: 'Too far from the market',
  PASS_NO_REAL_PRICE: 'No real bookmaker price',
  PASS_LOW_CONFIDENCE: 'Data confidence too low',
  PASS_NO_FORECAST: 'No forecast',
  PASS_QUARANTINED: 'Forecast withdrawn',
}

export function refusalLabel(code: string): string {
  return REFUSAL_LABELS[code] ?? code
}

export function CoverageSummary({ coverage }: { coverage: AiCoverage }) {
  const { totals } = coverage
  return (
    <section className={styles.panel} aria-labelledby="ai-coverage-summary-heading">
      <div className={styles.panelHeading}>
        <h2 id="ai-coverage-summary-heading">This window</h2>
        <span>
          {when(coverage.window.from)} to {when(coverage.window.to)}
        </span>
      </div>
      <p className={styles.panelCopy}>
        <strong>{totals.fixtures} fixtures analysed</strong>
        {' · '}
        <strong>{totals.actionableBets} actionable</strong>
        {' · '}
        <strong>{totals.passed} passed</strong>
        {totals.withoutCurrentDecision > 0
          ? ` · ${totals.withoutCurrentDecision} with no current decision at all`
          : ''}
      </p>
      {totals.actionableBets === 0 ? (
        <Alert variant="info" title="No qualifying value right now">
          Every fixture below was assessed and refused for a stated reason. That is an
          answer rather than a failure — but read the refusal distribution before
          treating it as one: if the collector has stopped, every fixture passes on a
          stale price and the model has not been consulted at all.
        </Alert>
      ) : null}
      {coverage.passReasonCounts.length ? (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Why fixtures did not qualify</caption>
            <thead>
              <tr><th scope="col">Refusal</th><th scope="col">Fixtures</th></tr>
            </thead>
            <tbody>
              {coverage.passReasonCounts.map((row) => (
                <tr key={row.code}>
                  <td>
                    <strong>{refusalLabel(row.code)}</strong>
                    <span>{row.code}</span>
                  </td>
                  <td>{row.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>Coverage by league</caption>
          <thead>
            <tr>
              <th scope="col">League</th>
              <th scope="col">Fixtures</th>
              <th scope="col">Forecast</th>
              <th scope="col">Real book</th>
              <th scope="col">Decided</th>
              <th scope="col">BET</th>
              <th scope="col">PASS</th>
            </tr>
          </thead>
          <tbody>
            {coverage.byLeague.map((row) => (
              <tr key={row.league}>
                <th scope="row">{row.league}</th>
                <td>{row.fixtures}</td>
                <td>{row.withForecast}</td>
                <td>{row.withRealBookmakerPrice}</td>
                <td>{row.withCurrentDecision}</td>
                <td>{row.actionableBets}</td>
                <td>{row.passed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type CoverageFilter = 'all' | 'bet' | 'pass' | 'undecided'

export function CoverageFixtures({ coverage }: { coverage: AiCoverage }) {
  const [filter, setFilter] = useState<CoverageFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const shown = useMemo(() => coverage.fixtures.filter((fixture) => {
    if (filter === 'all') return true
    if (filter === 'undecided') return fixture.decision === null
    if (filter === 'bet') return fixture.decision?.decision === 'BET'
    return fixture.decision?.decision === 'PASS'
  }), [coverage.fixtures, filter])

  return (
    <section className={styles.panel} aria-labelledby="ai-coverage-fixtures-heading">
      <div className={styles.panelHeading}>
        <h2 id="ai-coverage-fixtures-heading">Every fixture</h2>
        <span>{shown.length} shown of {coverage.fixtures.length}</span>
      </div>
      <nav className={styles.filterTabs} aria-label="Filter fixtures by decision">
        {([
          ['all', `All ${coverage.fixtures.length}`],
          ['bet', `Actionable ${coverage.totals.actionableBets}`],
          ['pass', `Passed ${coverage.totals.passed}`],
          ['undecided', `Undecided ${coverage.totals.withoutCurrentDecision}`],
        ] as const).map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {shown.length === 0 ? (
        <p className={styles.panelCopy}>No fixture in this window matches that filter.</p>
      ) : (
        <ul className={styles.matchList}>
          {shown.map((fixture) => (
            <CoverageRow
              key={fixture.fixtureId}
              fixture={fixture}
              open={expanded === fixture.fixtureId}
              onToggle={() =>
                setExpanded(expanded === fixture.fixtureId ? null : fixture.fixtureId)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function CoverageRow({
  fixture, open, onToggle,
}: { fixture: CoverageFixture; open: boolean; onToggle: () => void }) {
  const decision = fixture.decision
  const freshness = priceFreshness(
    decision?.priceAgeSeconds ?? null,
    decision?.priceAgeLimitSeconds ?? null,
  )
  const detailId = `coverage-detail-${fixture.fixtureId}`
  const pick = fixture.prediction?.predictedResult ?? null
  const headlineProbability: number | null =
    (pick === 'H' ? fixture.prediction?.pHome
      : pick === 'D' ? fixture.prediction?.pDraw
        : pick === 'A' ? fixture.prediction?.pAway
          : null) ?? null

  // ONE LINE PER FIXTURE. This was a stacked card roughly 230px tall — league
  // chip, kick-off, teams, a three-column probability row, a dense metadata
  // line, the refusal code and its sentence — which made a seven-day window of
  // fifty-three fixtures around eighteen thousand pixels of scrolling. Nothing
  // was removed: everything below the summary line now lives in the detail
  // this row could already open.
  return (
    <li className={styles.matchRow}>
      {/* The summary line IS the control. A separate "Show detail" link under
          every fixture cost another line each, which over a seven-day window of
          fifty-three fixtures is most of a screen of pure affordance. Children
          are phrasing content so the button stays valid. */}
      <button
        type="button"
        className={styles.rowToggle}
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
      >
      <span className={styles.rowMain}>
        <span className={styles.rowWho}>
          <span className={styles.leagueCode}>{fixture.league}</span>
          <span className={styles.fixture}>
            {fixture.home} <span>v</span> {fixture.away}
          </span>
          <span className={styles.rowWhen}>{when(fixture.kickoffAt)}</span>
        </span>

        <span className={styles.rowVerdict}>
          {decision ? (
            <>
              <span
                className={styles.statePill}
                data-tone={decision.decision === 'BET' ? 'positive' : 'neutral'}
              >
                {decision.decision}
              </span>
              {decision.decision === 'BET' ? (
                <span className={styles.rowPrice}>
                  <strong>{outcomeLabel(decision.selection)}</strong>
                  {' '}{decimal(decision.oddsOffered)}
                  {decision.bookmaker ? ` ${decision.bookmaker}` : ''}
                  {' · '}
                  <strong data-edge="true">{signedPercent(decision.modelEdge)}</strong>
                </span>
              ) : (
                <span className={styles.rowReason}>
                  {decision.reasons.length
                    ? decision.reasons.map((r) => refusalLabel(r.code)).join(' · ')
                    : 'Passed'}
                </span>
              )}
            </>
          ) : (
            <>
              <span className={styles.statePill} data-tone="neutral">NOT DECIDED</span>
              <span className={styles.rowReason}>
                {fixture.prediction ? 'Awaiting a decision' : 'Not forecast'}
              </span>
            </>
          )}
        </span>
      </span>

      {decision && decision.reasons.length > 0 ? (
        <span className={styles.rowWhy}>
          {decision.reasons.map((reason) => reason.explanation).join(' ')}
        </span>
      ) : null}

      <span className={styles.rowGlance}>
        {fixture.prediction && headlineProbability !== null
          ? `Model ${percent(headlineProbability)} ${outcomeLabel(pick).toLowerCase()}`
          : 'No current forecast — and that is not the same thing as a refusal'}
        {decision?.priceAgeSeconds !== undefined && decision?.priceAgeSeconds !== null
          ? ` · price ${humanAge(decision.priceAgeSeconds)} old${
              decision.priceAgeLimitSeconds !== null
                ? ` of ${humanAge(decision.priceAgeLimitSeconds)} allowed`
                : ''
            }${freshness === 'stale' ? ' — too old to act on' : ''}`
          : ''}
        {fixture.quality?.dataConfidenceState
          ? ` · ${fixture.quality.dataConfidenceState} data`
          : ''}
        <span className={styles.rowChevron} aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className={styles.srOnly}>
          {open ? 'Hide detail' : 'Show model, data and market detail'}
        </span>
      </span>
      </button>

      {open ? (
        <dl className={styles.fixtureDetail} id={detailId}>
          {fixture.prediction ? (
            <>
              <dt>Forecast</dt>
              <dd>
                {fixture.prediction.predictedScore ?? '—'} ·
                {' '}xG {decimal(fixture.prediction.expHomeGoals)}–{decimal(fixture.prediction.expAwayGoals)} ·
                {' '}{fixture.prediction.modelFamily ?? '—'} {fixture.prediction.modelVersion ?? ''} ·
                {' '}horizon {fixture.prediction.horizon ?? '—'} ·
                {' '}made {when(fixture.prediction.forecastMadeAt)}
                {fixture.prediction.modelTrainedThrough
                  ? ` · model data through ${fixture.prediction.modelTrainedThrough}`
                  : ''}
                {(fixture.prediction.forecastsCollapsed ?? 1) > 1
                  ? ` · newest of ${fixture.prediction.forecastsCollapsed} forecasts of this fixture`
                  : ''}
              </dd>
            </>
          ) : null}
          {fixture.quality ? (
            <>
              <dt>Data quality</dt>
              <dd>
                confidence {percent(fixture.quality.dataConfidence)} ({fixture.quality.dataConfidenceState ?? '—'}) ·
                {' '}agreement {percent(fixture.quality.agreement)} ·
                {' '}uncertainty {percent(fixture.quality.uncertaintyWidth)}
                {fixture.quality.missingInputs.length
                  ? ` · missing: ${fixture.quality.missingInputs.join(', ')}`
                  : ''}
              </dd>
            </>
          ) : null}
          <dt>Market</dt>
          <dd>
            {fixture.market.realBookCount} real
            {fixture.market.realBookCount === 1 ? ' venue' : ' venues'}
            {fixture.market.realBooks.length ? ` (${fixture.market.realBooks.join(', ')})` : ''} ·
            {' '}latest capture {when(fixture.market.latestRealCaptureAt)}
            {fixture.market.bestRealPrice
              ? ` · ${fixture.market.bestRealPrice.bookmaker} ${decimal(fixture.market.bestRealPrice.oddsHome)}/${decimal(fixture.market.bestRealPrice.oddsDraw)}/${decimal(fixture.market.bestRealPrice.oddsAway)}`
              : ''}
            {fixture.market.aggregateReferenceAvailable
              ? ' · an aggregate reference exists, and is never actionable'
              : ' · no aggregate reference'}
          </dd>
          {decision ? (
            <>
              <dt>Decision</dt>
              <dd>
                {decision.decision} {outcomeLabel(decision.selection)} ·
                {' '}decided {when(decision.decidedAt)}
                {decision.marketFairProbability !== null
                  ? ` · de-vigged market ${percent(decision.marketFairProbability)}`
                  : ' · no market reference to de-vig'}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </li>
  )
}

const SUFFICIENCY_COPY: Record<string, string> = {
  NO_SAMPLE: 'Nothing has been graded in this window.',
  EARLY_SAMPLE:
    'Fewer than 30 graded fixtures. Result accuracy here is variance, not skill.',
  INDICATIVE_ONLY:
    'Fewer than 100 graded fixtures. Indicative at best; not enough to move a model.',
  USABLE: 'Large enough to be worth reading, and still not enough to move a model alone.',
}

export function ResultsReview({ review }: { review: AiResultsReview }) {
  const { totals } = review
  return (
    <div className={styles.stack}>
      <section className={styles.metricGrid} aria-label="Graded performance">
        <div className={styles.metric}>
          <span>Graded fixtures</span>
          <strong>{totals.gradedFixtures}</strong>
          <small>
            {review.duplicateGradedRowsExcluded > 0
              ? `${review.duplicateGradedRowsExcluded} repeated forecasts collapsed`
              : 'one forecast per fixture'}
          </small>
        </div>
        <div className={styles.metric}>
          <span>Result correct</span>
          <strong>{percent(totals.resultAccuracy)}</strong>
          <small>{totals.resultCorrect} of {totals.gradedFixtures}</small>
        </div>
        <div className={styles.metric}>
          <span>Exact scores</span>
          <strong>{totals.exactScores}</strong>
          <small>modal scoreline exactly right</small>
        </div>
        <div className={styles.metric}>
          <span>Log loss</span>
          <strong>{decimal(totals.meanLogLoss, 4)}</strong>
          <small>lower is better</small>
        </div>
        <div className={styles.metric}>
          <span>RPS</span>
          <strong>{decimal(totals.meanRps, 4)}</strong>
          <small>Brier {decimal(totals.meanBrier, 4)}</small>
        </div>
        <div
          className={styles.metric}
          data-tone={
            totals.meanMarketLogLoss !== null && totals.meanLogLoss !== null
              ? (totals.meanLogLoss < totals.meanMarketLogLoss ? 'positive' : 'negative')
              : 'neutral'
          }
        >
          <span>Versus the close</span>
          <strong>{decimal(totals.meanMarketLogLoss, 4)}</strong>
          <small>
            {totals.marketComparisons === 0
              ? 'no closing benchmark published yet'
              : `market log loss over ${totals.marketComparisons} fixtures`}
          </small>
        </div>
      </section>

      <Alert
        variant={review.sampleSufficiency === 'USABLE' ? 'info' : 'warning'}
        title={`Sample: ${review.sampleSufficiency.replace(/_/g, ' ').toLowerCase()}`}
      >
        {SUFFICIENCY_COPY[review.sampleSufficiency] ?? ''} {review.sampleNote}
      </Alert>

      <section className={styles.panel} aria-labelledby="ai-review-league-heading">
        <div className={styles.panelHeading}>
          <h2 id="ai-review-league-heading">By league</h2>
          <span>one row per fixture</span>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">League</th>
                <th scope="col">Graded</th>
                <th scope="col">Correct</th>
                <th scope="col">Exact</th>
                <th scope="col">Log loss</th>
                <th scope="col">RPS</th>
                <th scope="col">Brier</th>
              </tr>
            </thead>
            <tbody>
              {review.byLeague.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.gradedFixtures}</td>
                  <td>
                    {row.resultCorrect}
                    {row.gradedFixtures > 0
                      ? ` (${((row.resultCorrect / row.gradedFixtures) * 100).toFixed(0)}%)`
                      : ''}
                  </td>
                  <td>{row.exactScores ?? '—'}</td>
                  <td>{decimal(row.meanLogLoss, 4)}</td>
                  <td>{decimal(row.meanRps, 4)}</td>
                  <td>{decimal(row.meanBrier, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {review.byLeague.some((row) => row.gradedFixtures < 10) ? (
          <p className={styles.panelCopy}>
            A league with a handful of fixtures can read as 100% or 0% and mean
            neither. Compare log loss across leagues before comparing accuracy.
          </p>
        ) : null}
      </section>

      <section className={styles.panel} aria-labelledby="ai-review-fixtures-heading">
        <div className={styles.panelHeading}>
          <h2 id="ai-review-fixtures-heading">Every graded fixture</h2>
          <span>{review.fixtures.length}</span>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Fixture</th>
                <th scope="col">Score</th>
                <th scope="col">Called</th>
                <th scope="col">Result</th>
                <th scope="col">Exact</th>
                <th scope="col">Log loss</th>
                <th scope="col">vs close</th>
              </tr>
            </thead>
            <tbody>
              {review.fixtures.map((fixture) => (
                <tr key={fixture.fixtureId}>
                  <td>
                    <strong>{fixture.home} v {fixture.away}</strong>
                    <span>{fixture.league} · {when(fixture.kickoffAt)}</span>
                  </td>
                  <td>
                    {fixture.homeGoals ?? '—'}–{fixture.awayGoals ?? '—'}
                    <span>predicted {fixture.predictedScore ?? '—'}</span>
                  </td>
                  <td>{outcomeLabel(fixture.predictedResult)}</td>
                  <td>
                    <span
                      className={styles.statePill}
                      data-tone={fixture.resultCorrect ? 'positive' : 'negative'}
                    >
                      {fixture.resultCorrect ? 'correct' : 'wrong'}
                    </span>
                  </td>
                  <td>
                    {fixture.exactScoreCorrect ? 'yes' : 'no'}
                    {fixture.modalScorelineBeatModalOutcome ? (
                      <span>
                        scoreline right, outcome wrong — the likeliest single score and
                        the likeliest outcome are different statistics, and both grades
                        are correct
                      </span>
                    ) : null}
                  </td>
                  <td>{decimal(fixture.logLoss, 3)}</td>
                  <td>
                    {fixture.logLossVsMarket === null
                      ? '—'
                      : `${fixture.logLossVsMarket > 0 ? '+' : ''}${fixture.logLossVsMarket.toFixed(3)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.panelCopy}>
          Versus the close is the model&rsquo;s log loss minus the de-vigged closing
          line&rsquo;s, so <strong>negative is the model winning</strong>. It is the only
          comparison at this sample size that says anything about skill rather than luck.
        </p>
      </section>
    </div>
  )
}
