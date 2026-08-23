import { useEffect, useMemo, useState } from 'react'
import { formatKickoffWithDay } from '../../shared/time/kickoff'
import { Alert, Button, Skeleton, Workspace } from '../../design-system'
import {
  AI_LAB_LEAGUES,
  type AiLabSnapshot,
  type AiModel,
} from '../../services/supabase/aiLabModel'
import { fetchAiLabSnapshot } from '../../services/supabase/aiLab'
import {
  fetchAiCoverage,
  fetchAiOperationalHealth,
  fetchAiResultsReview,
} from '../../services/supabase/aiLabCoverage'
import type {
  AiCoverage,
  AiHealth,
  AiResultsReview,
  CoverageFixture,
} from '../../services/supabase/aiLabCoverageModel'
import { userFacingError } from '../../shared/errors/userFacingError'
import { BetBuilderPanel } from './BetBuilderPanel'
import {
  forecastVerdict,
  marketComparison,
  scorelineHealth,
  valueVerdict,
} from './aiLabInsights'
import styles from './AiLabPage.module.css'

type View = 'today' | 'performance' | 'builder' | 'models'

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; snapshot: AiLabSnapshot }

type LabContext =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; health: AiHealth; coverage: AiCoverage; review: AiResultsReview }

const VIEWS: readonly { key: View; label: string; description: string }[] = [
  { key: 'today', label: 'Today', description: 'Forecasts and current value in one place' },
  { key: 'performance', label: 'Performance', description: 'Is the model actually working?' },
  { key: 'builder', label: 'Bet Builder', description: 'Combine current value-qualified legs' },
  { key: 'models', label: 'Model Lab', description: 'Selected models and pipeline health' },
]

const COVERAGE_DAYS_AHEAD = 7
const REVIEW_DAYS_BACK = 7

function percent(value: number | null, digits = 1): string {
  return value === null ? '—' : `${(value * 100).toFixed(digits)}%`
}

function decimal(value: number | null, digits = 3): string {
  return value === null ? '—' : value.toFixed(digits)
}

function signedPercent(value: number | null, digits = 1): string {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`
}

function when(value: string | null): string {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return date.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

function shortDate(value: string | null): string {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function sampleLabel(count: number): string {
  if (count < 30) return 'Very small sample'
  if (count < 100) return 'Early sample'
  if (count < 300) return 'Building evidence'
  return 'Established sample'
}

export function AiLabPage({
  previewSnapshot = null,
  previewContext = null,
}: {
  previewSnapshot?: AiLabSnapshot | null
  previewContext?: { health: AiHealth; coverage: AiCoverage; review: AiResultsReview } | null
} = {}) {
  const [league, setLeague] = useState<string | null>(null)
  const [view, setView] = useState<View>('today')
  const [reload, setReload] = useState(0)
  const [state, setState] = useState<State>(
    previewSnapshot ? { kind: 'ready', snapshot: previewSnapshot } : { kind: 'loading' },
  )
  const [context, setContext] = useState<LabContext>(
    previewContext
      ? { kind: 'ready', ...previewContext }
      : previewSnapshot
        ? { kind: 'failed', message: 'Preview context unavailable.' }
        : { kind: 'loading' },
  )

  useEffect(() => {
    if (previewSnapshot) {
      setState({ kind: 'ready', snapshot: previewSnapshot })
      return
    }
    let active = true
    setState({ kind: 'loading' })
    fetchAiLabSnapshot(league)
      .then((snapshot) => {
        if (active) setState({ kind: 'ready', snapshot })
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            kind: 'failed',
            message: userFacingError(error, 'The AI Lab could not be loaded.'),
          })
        }
      })
    return () => {
      active = false
    }
  }, [league, reload, previewSnapshot])

  useEffect(() => {
    if (previewContext) {
      setContext({ kind: 'ready', ...previewContext })
      return
    }
    if (previewSnapshot) return
    let active = true
    setContext({ kind: 'loading' })
    const now = new Date()
    const scope = league ? [league] : null
    Promise.all([
      fetchAiOperationalHealth(),
      fetchAiCoverage({
        from: now,
        to: new Date(now.getTime() + COVERAGE_DAYS_AHEAD * 86_400_000),
        leagues: scope,
      }),
      fetchAiResultsReview({
        from: new Date(now.getTime() - REVIEW_DAYS_BACK * 86_400_000),
        to: now,
        leagues: scope,
      }),
    ])
      .then(([health, coverage, review]) => {
        if (active) setContext({ kind: 'ready', health, coverage, review })
      })
      .catch((error: unknown) => {
        if (active) {
          setContext({
            kind: 'failed',
            message: userFacingError(error, 'Current forecast/value evidence could not be read.'),
          })
        }
      })
    return () => {
      active = false
    }
  }, [league, reload, previewSnapshot, previewContext])

  const snapshot = state.kind === 'ready' ? state.snapshot : null
  const currentContext = context.kind === 'ready' ? context : null
  const leagueName = league
    ? AI_LAB_LEAGUES.find((item) => item.key === league)?.name ?? league
    : 'All nine leagues'

  const comparison = currentContext ? marketComparison(currentContext.review) : null
  const exactHealth = useMemo(
    () => scorelineHealth(currentContext?.coverage.fixtures ?? []),
    [currentContext],
  )

  return (
    <Workspace width="full">
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Private model research · paper betting only</span>
            <h1 className={styles.title}>AI Lab</h1>
            <p className={styles.intro}>
              What the model thinks will happen, what the price makes worth considering, and the
              evidence for whether either deserves trust.
            </p>
          </div>
          <div className={styles.heroMeta}>
            <span className={styles.privatePill}>Nothing places a bet</span>
            <span>{snapshot ? `Snapshot ${when(snapshot.asOf)}` : 'Reading live evidence…'}</span>
          </div>
        </header>

        <section className={styles.toolbar} aria-label="AI Lab controls">
          <label>
            Competition
            <select value={league ?? ''} onChange={(event) => setLeague(event.target.value || null)}>
              <option value="">All nine leagues</option>
              {AI_LAB_LEAGUES.map((item) => (
                <option key={item.key} value={item.key}>{item.name}</option>
              ))}
            </select>
          </label>
          <p>{leagueName}</p>
          <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
            Refresh evidence
          </Button>
        </section>

        {state.kind === 'failed' ? (
          <Alert variant="warning" title="AI Lab unavailable">{state.message}</Alert>
        ) : null}
        {context.kind === 'failed' ? (
          <Alert variant="warning" title="Live evidence incomplete">{context.message}</Alert>
        ) : null}

        {snapshot && currentContext ? (
          <LabPulse snapshot={snapshot} review={currentContext.review} coverage={currentContext.coverage} />
        ) : (
          <div className={styles.pulseLoading} role="status" aria-label="Loading AI Lab headline evidence">
            <Skeleton height={92} radius="card" />
            <Skeleton height={92} radius="card" />
            <Skeleton height={92} radius="card" />
          </div>
        )}

        <nav className={styles.tabs} aria-label="AI Lab sections">
          {VIEWS.map((item) => (
            <button
              type="button"
              key={item.key}
              aria-pressed={view === item.key}
              onClick={() => setView(item.key)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </nav>

        {state.kind === 'loading' || context.kind === 'loading' ? (
          <div className={styles.loading} role="status" aria-label="Loading AI Lab">
            <Skeleton height={160} radius="card" />
            <Skeleton height={320} radius="card" />
          </div>
        ) : null}

        {snapshot && currentContext && view === 'today' ? (
          <TodayView coverage={currentContext.coverage} exactHealth={exactHealth} />
        ) : null}
        {snapshot && currentContext && view === 'performance' ? (
          <PerformanceView snapshot={snapshot} review={currentContext.review} comparison={comparison} />
        ) : null}
        {snapshot && currentContext && view === 'builder' ? <BetBuilderPanel /> : null}
        {snapshot && currentContext && view === 'models' ? (
          <ModelLabView snapshot={snapshot} health={currentContext.health} />
        ) : null}
      </div>
    </Workspace>
  )
}

function LabPulse({
  snapshot,
  review,
  coverage,
}: {
  snapshot: AiLabSnapshot
  review: AiResultsReview
  coverage: AiCoverage
}) {
  const comparison = marketComparison(review)
  return (
    <section className={styles.pulse} aria-label="AI Lab at a glance">
      <article>
        <span>Forecasting · last 7 days</span>
        <strong>{comparison ? (comparison.ahead ? 'Ahead of market' : 'Behind market') : 'Building comparison'}</strong>
        <small>
          {comparison
            ? `${Math.abs(comparison.gap).toFixed(4)} log loss · ${comparison.comparisons} comparable fixtures`
            : `${review.totals.gradedFixtures} graded fixtures`}
        </small>
      </article>
      <article>
        <span>Paper betting</span>
        <strong>{signedPercent(snapshot.betting.profit.roi)}</strong>
        <small>
          {snapshot.betting.profit.settledBets} settled · {sampleLabel(snapshot.betting.profit.settledBets).toLowerCase()}
        </small>
      </article>
      <article>
        <span>Current value window</span>
        <strong>{coverage.totals.actionableBets} BET · {coverage.totals.passed} PASS</strong>
        <small>{coverage.totals.fixtures} fixtures checked · no forced selections</small>
      </article>
    </section>
  )
}

function TodayView({
  coverage,
  exactHealth,
}: {
  coverage: AiCoverage
  exactHealth: ReturnType<typeof scorelineHealth>
}) {
  const fixtures = [...coverage.fixtures].sort(
    (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
  )

  return (
    <div className={styles.stack}>
      <section className={styles.explainer}>
        <div>
          <span>01 · Forecast</span>
          <strong>What is most likely?</strong>
          <p>The highest H/D/A probability. It is not automatically the best bet.</p>
        </div>
        <div>
          <span>02 · Value</span>
          <strong>Is anything mispriced?</strong>
          <p>A different result can be the value call if its odds compensate for being less likely.</p>
        </div>
        <div>
          <span>03 · Decision</span>
          <strong>BET or PASS</strong>
          <p>PASS is a successful answer when price, data or uncertainty is not good enough.</p>
        </div>
      </section>

      {exactHealth.concerning ? (
        <Alert variant="warning" title="Exact-score output is not discriminating enough">
          {exactHealth.topCount} of {exactHealth.sample} current forecasts share the same top exact
          score ({exactHealth.topScore}). The Lab therefore treats exact score as a diagnostic and
          leads with result probabilities and expected goals instead.
        </Alert>
      ) : null}

      <section className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>Next seven days</span>
          <h2>Forecast + value together</h2>
        </div>
        <p>{coverage.totals.fixtures} fixtures · {coverage.totals.withForecast} forecast</p>
      </section>

      {fixtures.length ? (
        <div className={styles.fixtureList}>
          {fixtures.map((fixture) => <FixtureCard key={fixture.fixtureId} fixture={fixture} />)}
        </div>
      ) : (
        <EmptyState title="No fixtures in this window" copy="There is nothing to forecast for the selected competition yet." />
      )}
    </div>
  )
}

function FixtureCard({ fixture }: { fixture: CoverageFixture }) {
  const forecast = forecastVerdict(fixture)
  const value = valueVerdict(fixture)
  const p = fixture.prediction
  const decision = fixture.decision

  return (
    <article className={styles.fixtureCard}>
      <header className={styles.fixtureHeader}>
        <div>
          <span className={styles.leagueCode}>{fixture.league}</span>
          <span>{formatKickoffWithDay(fixture.kickoffAt) ?? 'Not recorded'}</span>
        </div>
        <span className={styles.decisionPill} data-kind={value.kind}>{value.headline}</span>
      </header>

      <div className={styles.fixtureMain}>
        <div className={styles.matchForecast}>
          <p className={styles.teams}><strong>{fixture.home}</strong><span>v</span><strong>{fixture.away}</strong></p>
          {p && forecast ? (
            <>
              <div className={styles.forecastLead}>
                <span>Most likely result</span>
                <strong>{forecast.label} · {percent(forecast.probability, 0)}</strong>
              </div>
              <div className={styles.probabilities} role="group" aria-label="Match result probabilities">
                {([
                  ['H', fixture.home, p.pHome],
                  ['D', 'Draw', p.pDraw],
                  ['A', fixture.away, p.pAway],
                ] as const).map(([key, label, probability]) => (
                  <div key={key} data-peak={forecast.key === key}>
                    <span>{label}</span>
                    <strong>{percent(probability, 0)}</strong>
                  </div>
                ))}
              </div>
              <div className={styles.expectedGoals}>
                <span>Expected goals</span>
                <strong>{p.expHomeGoals?.toFixed(2) ?? '—'} – {p.expAwayGoals?.toFixed(2) ?? '—'}</strong>
                {p.predictedScore ? <small>Top exact score: {p.predictedScore} · diagnostic</small> : null}
              </div>
            </>
          ) : (
            <p className={styles.unavailable}>No current forecast has cleared the prediction integrity boundary.</p>
          )}
        </div>

        <div className={styles.valueCall} data-kind={value.kind}>
          <span className={styles.valueLabel}>{value.kind === 'bet' ? 'Value decision' : 'Gate decision'}</span>
          {value.kind === 'bet' && decision ? (
            <>
              <div className={styles.valueHeadline}>
                <strong>{value.selectionLabel}</strong>
                <span>{decision.oddsOffered?.toFixed(2) ?? '—'} @ {decision.bookmaker ?? 'book'}</span>
              </div>
              <div className={styles.valueNumbers}>
                <div><span>Model chance</span><strong>{percent(decision.modelProbability, 0)}</strong></div>
                <div><span>Market fair</span><strong>{percent(decision.marketFairProbability, 0)}</strong></div>
                <div><span>Model fair odds</span><strong>{decision.modelFairOdds?.toFixed(2) ?? '—'}</strong></div>
                <div><span>Est. EV</span><strong>{signedPercent(decision.modelEdge)}</strong></div>
              </div>
            </>
          ) : null}
          <p>{value.explanation}</p>
        </div>
      </div>

      {p ? (
        <details className={styles.fixtureDetails}>
          <summary>Evidence details</summary>
          <dl>
            <div><dt>Forecast</dt><dd>{p.modelVersion ?? '—'} · {p.horizon ?? '—'}</dd></div>
            <div><dt>Forecast made</dt><dd>{when(p.forecastMadeAt)}</dd></div>
            <div><dt>Data confidence</dt><dd>{fixture.quality?.dataConfidenceState ?? '—'} {percent(fixture.quality?.dataConfidence ?? null, 0)}</dd></div>
            <div><dt>Model agreement</dt><dd>{percent(fixture.quality?.agreement ?? null, 0)}</dd></div>
            <div><dt>Real books seen</dt><dd>{fixture.market.realBookCount}</dd></div>
            <div><dt>Value checked</dt><dd>{when(decision?.decidedAt ?? null)}</dd></div>
          </dl>
        </details>
      ) : null}
    </article>
  )
}

function PerformanceView({
  snapshot,
  review,
  comparison,
}: {
  snapshot: AiLabSnapshot
  review: AiResultsReview
  comparison: ReturnType<typeof marketComparison>
}) {
  const exactRate = snapshot.performance.graded
    ? snapshot.performance.exactScores / snapshot.performance.graded
    : null
  const currentModels = snapshot.models.filter((model) => model.status === 'current')
  const validationComparable = currentModels.filter(
    (model) => model.validationLogLoss !== null && model.marketLogLoss !== null,
  )
  const validationAhead = validationComparable.filter(
    (model) => (model.validationLogLoss ?? Number.POSITIVE_INFINITY) < (model.marketLogLoss ?? Number.NEGATIVE_INFINITY),
  ).length

  return (
    <div className={styles.stack}>
      <section className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>Evidence, not a victory lap</span>
          <h2>Is it actually any good?</h2>
        </div>
        <p>{review.sampleNote}</p>
      </section>

      <div className={styles.performanceColumns}>
        <section className={styles.performancePanel}>
          <header><span>Forecasting · all graded evidence</span><strong>{snapshot.performance.graded}</strong></header>
          <div className={styles.bigMetric}>
            <strong>{percent(snapshot.performance.accuracy, 1)}</strong>
            <span>result accuracy</span>
          </div>
          <dl className={styles.metricList}>
            <div><dt>Log loss</dt><dd>{decimal(snapshot.performance.meanLogLoss)}</dd></div>
            <div><dt>Exact score</dt><dd>{percent(exactRate, 1)}</dd></div>
            <div><dt>RPS</dt><dd>{decimal(snapshot.performance.meanRps)}</dd></div>
            <div><dt>Sample</dt><dd>{sampleLabel(snapshot.performance.graded)}</dd></div>
          </dl>
        </section>

        <section className={styles.performancePanel}>
          <header><span>Paper betting · settled advice</span><strong>{snapshot.betting.profit.settledBets}</strong></header>
          <div className={styles.bigMetric}>
            <strong>{signedPercent(snapshot.betting.profit.roi)}</strong>
            <span>stake-weighted ROI</span>
          </div>
          <dl className={styles.metricList}>
            <div><dt>P/L</dt><dd>{snapshot.betting.profit.pnl > 0 ? '+' : ''}{snapshot.betting.profit.pnl.toFixed(2)}u</dd></div>
            <div><dt>Hit rate</dt><dd>{percent(snapshot.betting.profit.hitRate, 1)}</dd></div>
            <div><dt>Mean CLV</dt><dd>{signedPercent(snapshot.betting.clv.mean)}</dd></div>
            <div><dt>Beat close</dt><dd>{percent(snapshot.betting.clv.beatCloseRate, 1)}</dd></div>
          </dl>
          <p className={styles.caveat}>{sampleLabel(snapshot.betting.profit.settledBets)} — do not treat current ROI as a stable expectation.</p>
        </section>
      </div>

      <section className={styles.marketPanel}>
        <div>
          <span className={styles.eyebrow}>Comparable window · last 7 days</span>
          <h3>{comparison ? (comparison.ahead ? 'Live probabilities beat the closing comparator' : 'Closing market still leads') : 'Closing comparison still building'}</h3>
          {comparison ? (
            <p>
              Model log loss {comparison.model.toFixed(4)} vs market {comparison.market.toFixed(4)} over {comparison.comparisons} fixtures. Lower is better; the gap is {Math.abs(comparison.gap).toFixed(4)}.
            </p>
          ) : (
            <p>No like-for-like market comparator is available for this review window yet.</p>
          )}
        </div>
        <div className={styles.validationVerdict}>
          <span>Held-out model validation</span>
          <strong>{validationAhead}/{validationComparable.length}</strong>
          <small>current models ahead of their stored market benchmark</small>
        </div>
      </section>

      <section className={styles.measurementGap}>
        <div>
          <span className={styles.eyebrow}>Bet Builder evidence</span>
          <h3>Combination performance is not measured yet</h3>
          <p>
            Individual value legs are persisted and settled. Browser-generated doubles, trebles and
            other combinations do not yet have an immutable slip-level history, so the Lab will not
            invent a Builder win rate or ROI.
          </p>
        </div>
        <span className={styles.pendingPill}>Measurement gap</span>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeading}>
          <div><span className={styles.eyebrow}>Last 7 days</span><h3>By league</h3></div>
          <span>{review.totals.gradedFixtures} canonical fixtures</span>
        </header>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th>League</th><th>Graded</th><th>Accuracy</th><th>Log loss</th><th>Exact</th></tr></thead>
            <tbody>
              {review.byLeague.map((row) => (
                <tr key={row.label}>
                  <td><strong>{AI_LAB_LEAGUES.find((item) => item.key === row.label)?.name ?? row.label}</strong></td>
                  <td>{row.gradedFixtures}</td>
                  <td>{row.gradedFixtures ? percent(row.resultCorrect / row.gradedFixtures, 1) : '—'}</td>
                  <td>{decimal(row.meanLogLoss)}</td>
                  <td>{row.exactScores === null ? '—' : row.exactScores}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function ModelLabView({ snapshot, health }: { snapshot: AiLabSnapshot; health: AiHealth }) {
  const current = snapshot.models.filter((model) => model.status === 'current')
  const challengers = snapshot.models.filter((model) => model.status === 'challenger' || model.status === 'candidate')

  return (
    <div className={styles.stack}>
      <section className={styles.lifecycleNote}>
        <div>
          <span className={styles.eyebrow}>Selected-model lifecycle</span>
          <h2>Verified activation is automatic</h2>
          <p>
            The Lab reports current and challenger evidence here. Routine model activation is owned
            by the verified selected-model lifecycle, not an admin “Promote” button, so the UI cannot
            become a second model-selection authority.
          </p>
        </div>
        <span>{current.length}/{health.models.expected} current</span>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeading}>
          <div><span className={styles.eyebrow}>Current selected set</span><h3>Model validation</h3></div>
          <span>{challengers.length} challenger{challengers.length === 1 ? '' : 's'} observed</span>
        </header>
        <div className={styles.modelGrid}>
          {current.map((model) => <ModelCard key={model.id} model={model} />)}
        </div>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeading}>
          <div><span className={styles.eyebrow}>Pipeline</span><h3>Can today's evidence be trusted?</h3></div>
          <span>Generated {when(health.generatedAt)}</span>
        </header>
        <div className={styles.healthGrid}>
          <HealthItem label="Fixtures" value={`${health.fixtures.upcoming7d} upcoming`} note={`sync ${when(health.fixtures.lastSyncAt)}`} />
          <HealthItem label="Forecasts" value={`${health.predictions.withCurrentForecast}/${health.predictions.upcomingFixtures}`} note={`predict ${when(health.predictions.lastPredictAt)}`} />
          <HealthItem label="Prices" value={`${health.prices.realBooksSeen7d.length} real books`} note={`latest ${when(health.prices.lastRealCaptureAt)}`} />
          <HealthItem label="Value" value={`${health.valueLoop.currentBets} BET · ${health.valueLoop.currentPasses} PASS`} note={`run ${when(health.valueLoop.lastRunAt)}`} />
          <HealthItem label="Settlement" value={`${health.settlement.settled}/${health.settlement.advised}`} note={`${health.settlement.playedAndUnsettled} played unsettled`} />
          <HealthItem label="Models" value={`${health.models.current}/${health.models.expected} current`} note={`train ${when(health.models.lastTrainAt)}`} />
        </div>
      </section>

      <section className={styles.twoColumn}>
        <article className={styles.panel}>
          <header className={styles.panelHeading}><div><span className={styles.eyebrow}>Odds API</span><h3>Budget</h3></div></header>
          <div className={styles.budgetFigure}>
            <strong>{snapshot.odds.monthToDateCredits}</strong>
            <span>of {snapshot.odds.softCap} soft-cap credits</span>
          </div>
          <p className={styles.caveat}>{snapshot.odds.remainingToSoftCap} credits remain before the configured soft cap.</p>
        </article>
        <article className={styles.panel}>
          <header className={styles.panelHeading}><div><span className={styles.eyebrow}>Training range</span><h3>Freshness</h3></div></header>
          <dl className={styles.metricList}>
            <div><dt>Newest trained through</dt><dd>{shortDate(health.models.newestTrainedThrough)}</dd></div>
            <div><dt>Oldest trained through</dt><dd>{shortDate(health.models.oldestTrainedThrough)}</dd></div>
            <div><dt>Current versions</dt><dd>{health.models.versions.length}</dd></div>
            <div><dt>Last train</dt><dd>{when(health.models.lastTrainAt)}</dd></div>
          </dl>
        </article>
      </section>
    </div>
  )
}

function ModelCard({ model }: { model: AiModel }) {
  const marketGap = model.validationLogLoss !== null && model.marketLogLoss !== null
    ? model.validationLogLoss - model.marketLogLoss
    : null
  const baselineGap = model.validationLogLoss !== null && model.baselineLogLoss !== null
    ? model.validationLogLoss - model.baselineLogLoss
    : null
  return (
    <article className={styles.modelCard}>
      <header>
        <div><span className={styles.leagueCode}>{model.league}</span><strong>{model.version}</strong></div>
        <span>{model.family}</span>
      </header>
      <dl>
        <div><dt>Validation accuracy</dt><dd>{percent(model.validationAccuracy, 1)}</dd></div>
        <div><dt>Validation log loss</dt><dd>{decimal(model.validationLogLoss)}</dd></div>
        <div><dt>vs baseline</dt><dd data-good={baselineGap !== null && baselineGap < 0}>{baselineGap === null ? '—' : `${baselineGap > 0 ? '+' : ''}${baselineGap.toFixed(3)}`}</dd></div>
        <div><dt>vs market</dt><dd data-good={marketGap !== null && marketGap < 0}>{marketGap === null ? '—' : `${marketGap > 0 ? '+' : ''}${marketGap.toFixed(3)}`}</dd></div>
      </dl>
      <small>{model.trainingMatches.toLocaleString()} training matches · trained {when(model.trainedAt)}</small>
    </article>
  )
}

function HealthItem({ label, value, note }: { label: string; value: string; note: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <section className={styles.empty}><strong>{title}</strong><p>{copy}</p></section>
}
