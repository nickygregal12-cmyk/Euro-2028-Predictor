import { useEffect, useState } from 'react'
import { Alert, Button, Modal, Skeleton, Workspace } from '../../design-system'
import {
  AI_LAB_LEAGUES,
  type AiJob,
  type AiLabSnapshot,
  type AiMarketEvidence,
  type AiMetricSlice,
  type AiModel,
  type AiPrediction,
  type AiRecentResult,
} from '../../services/supabase/aiLabModel'
import { fetchAiLabSnapshot, promoteAiModel } from '../../services/supabase/aiLab'
import {
  fetchAiCoverage,
  fetchAiOperationalHealth,
  fetchAiResultsReview,
} from '../../services/supabase/aiLabCoverage'
import type {
  AiCoverage,
  AiHealth,
  AiResultsReview,
} from '../../services/supabase/aiLabCoverageModel'
import { BetBuilderPanel } from './BetBuilderPanel'
import {
  CoverageFixtures,
  CoverageSummary,
  OperationalHealth,
  ResultsReview,
} from './AiLabCoverageViews'
import { userFacingError } from '../../shared/errors/userFacingError'
import styles from './AiLabPage.module.css'

type View =
  | 'overview'
  | 'coverage'
  | 'results'
  | 'predictions'
  | 'betting'
  | 'betBuilder'
  | 'operations'
type State =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; snapshot: AiLabSnapshot }

const VIEW_LABELS: readonly { key: View; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'coverage', label: 'This weekend' },
  { key: 'results', label: 'Recent results' },
  { key: 'predictions', label: 'Predictions' },
  { key: 'betting', label: 'Betting evidence' },
  { key: 'betBuilder', label: 'Bet Builder' },
  { key: 'operations', label: 'Operations' },
]

/**
 * Contract 201's three reads, kept in their own request rather than folded into
 * `fetchAiLabSnapshot`. They are windowed and the snapshot is not, and an
 * operator changing the window should not re-read nine other RPCs to do it.
 */
type LabContext =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | {
      kind: 'ready'
      health: AiHealth
      coverage: AiCoverage
      review: AiResultsReview
    }

const COVERAGE_DAYS_AHEAD = 7
const REVIEW_DAYS_BACK = 7

function percent(value: number | null, digits = 1): string {
  return value === null ? '—' : `${(value * 100).toFixed(digits)}%`
}

function decimal(value: number | null, digits = 3): string {
  return value === null ? '—' : value.toFixed(digits)
}

function signed(value: number, suffix = ''): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}${suffix}`
}

function when(value: string | null): string {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return date.toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

function pickLabel(pick: string): string {
  return ({ H: 'Home', D: 'Draw', A: 'Away' } as Record<string, string>)[pick] ?? pick
}

export function AiLabPage({ previewSnapshot = null }: { previewSnapshot?: AiLabSnapshot | null } = {}) {
  const [league, setLeague] = useState<string | null>(null)
  const [view, setView] = useState<View>('overview')
  const [reload, setReload] = useState(0)
  const [state, setState] = useState<State>(
    previewSnapshot ? { kind: 'ready', snapshot: previewSnapshot } : { kind: 'loading' },
  )
  const [context, setContext] = useState<LabContext>(
    previewSnapshot ? { kind: 'failed', message: 'Preview snapshot' } : { kind: 'loading' },
  )
  const [promotion, setPromotion] = useState<AiModel | null>(null)
  const [promotionReason, setPromotionReason] = useState('')
  const [promotionBusy, setPromotionBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

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
    if (previewSnapshot) return
    let active = true
    setContext({ kind: 'loading' })
    const now = new Date()
    const coverageWindow = {
      from: now,
      to: new Date(now.getTime() + COVERAGE_DAYS_AHEAD * 86400000),
      leagues: league ? [league] : null,
    }
    const reviewWindow = {
      from: new Date(now.getTime() - REVIEW_DAYS_BACK * 86400000),
      to: now,
      leagues: league ? [league] : null,
    }
    Promise.all([
      fetchAiOperationalHealth(),
      fetchAiCoverage(coverageWindow),
      fetchAiResultsReview(reviewWindow),
    ])
      .then(([health, coverage, review]) => {
        if (active) setContext({ kind: 'ready', health, coverage, review })
      })
      .catch((error: unknown) => {
        if (active) {
          setContext({
            kind: 'failed',
            message: userFacingError(
              error,
              'Coverage, health and the results review could not be read.',
            ),
          })
        }
      })
    return () => {
      active = false
    }
  }, [league, reload, previewSnapshot])

  async function confirmPromotion() {
    if (!promotion || promotionReason.trim().length < 10) return
    setPromotionBusy(true)
    setNotice(null)
    try {
      await promoteAiModel(promotion.id, promotionReason.trim())
      setNotice(`${promotion.league} ${promotion.version} is now the current model.`)
      setPromotion(null)
      setPromotionReason('')
      setReload((value) => value + 1)
    } catch (error: unknown) {
      setNotice(userFacingError(error, 'That model could not be promoted.'))
    } finally {
      setPromotionBusy(false)
    }
  }

  const snapshot = state.kind === 'ready' ? state.snapshot : null
  const filteredLeagueName = league
    ? AI_LAB_LEAGUES.find((item) => item.key === league)?.name ?? league
    : 'All nine leagues'

  return (
    <Workspace width="full">
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Private analysis · administrators only</span>
            <h1 className={styles.title}>AI Lab</h1>
            <p className={styles.intro}>
              Model accuracy, live predictions, value evidence and the health of the full
              fixture-to-CLV pipeline. This laboratory cannot alter player predictions or official
              football results.
            </p>
          </div>
          <div className={styles.heroStatus}>
            <span className={styles.privatePill}>Paper betting only</span>
            <span className={styles.asOf}>
              {snapshot ? `Read ${when(snapshot.asOf)}` : 'Reading the lab…'}
            </span>
          </div>
        </header>

        <section className={styles.toolbar} aria-label="AI Lab controls">
          <label className={styles.selectLabel}>
            League
            <select
              value={league ?? ''}
              onChange={(event) => setLeague(event.target.value || null)}
            >
              <option value="">All nine leagues</option>
              {AI_LAB_LEAGUES.map((item) => (
                <option value={item.key} key={item.key}>{item.name}</option>
              ))}
            </select>
          </label>
          <span className={styles.scope}>{filteredLeagueName}</span>
          <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
            Refresh data
          </Button>
        </section>

        <nav className={styles.tabs} aria-label="AI Lab sections">
          {VIEW_LABELS.map((item) => (
            <button
              type="button"
              key={item.key}
              aria-pressed={view === item.key}
              onClick={() => setView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {notice ? <Alert variant="info">{notice}</Alert> : null}
        {state.kind === 'loading' ? <LoadingDashboard /> : null}
        {state.kind === 'failed' ? (
          <Alert variant="warning" title="AI Lab unavailable">
            {state.message}
            <div className={styles.retry}>
              <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
                Try again
              </Button>
            </div>
          </Alert>
        ) : null}
        {view === 'overview' && context.kind === 'ready' ? (
          <OperationalHealth health={context.health} />
        ) : null}
        {view === 'overview' && context.kind === 'failed' && !previewSnapshot ? (
          <Alert variant="warning" title="Pipeline health unavailable">{context.message}</Alert>
        ) : null}
        {snapshot && view === 'overview' ? (
          <Overview snapshot={snapshot} modelTarget={league ? 1 : AI_LAB_LEAGUES.length} onPromote={setPromotion} />
        ) : null}
        {view === 'coverage' ? (
          context.kind === 'ready' ? (
            <div className={styles.stack}>
              <CoverageSummary coverage={context.coverage} />
              <CoverageFixtures coverage={context.coverage} />
            </div>
          ) : context.kind === 'failed' ? (
            <Alert variant="warning" title="Coverage unavailable">{context.message}</Alert>
          ) : (
            <LoadingDashboard />
          )
        ) : null}
        {view === 'results' ? (
          context.kind === 'ready' ? (
            <ResultsReview review={context.review} />
          ) : context.kind === 'failed' ? (
            <Alert variant="warning" title="Results review unavailable">{context.message}</Alert>
          ) : (
            <LoadingDashboard />
          )
        ) : null}
        {snapshot && view === 'predictions' ? <Predictions snapshot={snapshot} /> : null}
        {snapshot && view === 'betting' ? <Betting snapshot={snapshot} /> : null}
        {view === 'betBuilder' ? (
          <div className={styles.stack}>
            {context.kind === 'ready' ? (
              <CoverageSummary coverage={context.coverage} />
            ) : null}
            <BetBuilderPanel />
          </div>
        ) : null}
        {snapshot && view === 'operations' ? <Operations snapshot={snapshot} /> : null}

        <Modal
          open={promotion !== null}
          onClose={() => {
            if (!promotionBusy) {
              setPromotion(null)
              setPromotionReason('')
            }
          }}
          title="Promote model"
          footer={
            <>
              <Button
                variant="secondary"
                disabled={promotionBusy}
                onClick={() => { setPromotion(null); setPromotionReason('') }}
              >
                Cancel
              </Button>
              <Button
                loading={promotionBusy}
                disabled={promotionReason.trim().length < 10}
                onClick={confirmPromotion}
              >
                Make current
              </Button>
            </>
          }
        >
          <p className={styles.modalCopy}>
            {promotion
              ? `${promotion.league} ${promotion.version} will replace the current model for that league.`
              : ''}{' '}
            Promotion is an audited human decision and does not publish betting selections.
          </p>
          <label className={styles.reasonLabel}>
            Reason for promotion
            <textarea
              value={promotionReason}
              onChange={(event) => setPromotionReason(event.target.value)}
              rows={4}
              minLength={10}
              placeholder="Summarise the validation evidence and why this model should become current."
            />
          </label>
        </Modal>
      </div>
    </Workspace>
  )
}

function LoadingDashboard() {
  return (
    <div className={styles.loading} role="status" aria-label="Loading AI Lab">
      <Skeleton height={116} radius="card" />
      <Skeleton height={280} radius="card" />
      <Skeleton height={220} radius="card" />
    </div>
  )
}

function Overview({
  snapshot,
  modelTarget,
  onPromote,
}: {
  snapshot: AiLabSnapshot
  modelTarget: number
  onPromote: (model: AiModel) => void
}) {
  const currentModels = snapshot.models.filter((model) => model.status === 'current').length
  return (
    <div className={styles.stack}>
      <section className={styles.metricGrid} aria-label="AI performance summary">
        <Metric label="Graded predictions" value={String(snapshot.performance.graded)} hint="Evidence sample" />
        <Metric label="Result accuracy" value={percent(snapshot.performance.accuracy)} hint={`${snapshot.performance.resultCorrect} correct`} />
        <Metric label="Mean log loss" value={decimal(snapshot.performance.meanLogLoss)} hint="Lower is better" />
        <Metric
          label="Current models"
          value={`${currentModels} / ${modelTarget}`}
          hint={modelTarget === 1 ? 'Selected league' : 'Across all leagues'}
        />
        <Metric label="Mean CLV" value={percent(snapshot.betting.clv.mean, 2)} hint={`${snapshot.betting.clv.observations} closing lines`} tone={snapshot.betting.clv.significant ? 'positive' : 'neutral'} />
        <Metric label="Odds budget" value={`${snapshot.odds.monthToDateCredits} / ${snapshot.odds.softCap}`} hint="Credits this month" />
      </section>

      {!snapshot.publicationPublicEnabled && !snapshot.bettingGate.currentlyPublic ? (
        <Alert variant="info" title="The laboratory remains private">
          Model outputs and betting evidence are visible only here. Nothing is published to players,
          and the evidence gates remain separate from this dashboard.
        </Alert>
      ) : (
        <Alert variant="warning" title="A publication gate is enabled">
          Review the model and betting publication settings before relying on a public output.
        </Alert>
      )}

      <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <PanelHeading title="Models" meta={`${snapshot.models.length} trained`} />
          {snapshot.models.length === 0 ? (
            <Empty title="No models trained yet" copy="The first training run will appear here with its validation record. Nothing is inferred from an empty model table." />
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>League / model</th><th>Matches</th><th>Accuracy</th><th>Log loss</th><th>Status</th><th><span className={styles.srOnly}>Action</span></th></tr></thead>
                <tbody>
                  {snapshot.models.map((model) => (
                    <tr key={model.id}>
                      <td><strong>{model.league} · {model.version}</strong><span>{model.family} · {when(model.trainedAt)}</span></td>
                      <td>{model.trainingMatches}</td>
                      <td>{percent(model.validationAccuracy)}</td>
                      <td>{decimal(model.validationLogLoss)}</td>
                      <td><StatePill state={model.status} /></td>
                      <td>{model.status === 'challenger' ? <button className={styles.textAction} type="button" onClick={() => onPromote(model)}>Promote</button> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <PanelHeading title="Calibration" meta={`${snapshot.calibration.reduce((sum, item) => sum + item.observations, 0)} observations`} />
          {snapshot.calibration.length === 0 ? (
            <Empty title="Awaiting graded predictions" copy="Calibration needs predictions with known outcomes. The chart will compare stated confidence with the rate achieved." />
          ) : (
            <div className={styles.calibration}>
              {snapshot.calibration.map((point) => (
                <div className={styles.calibrationRow} key={point.bucket}>
                  <span>{percent(point.meanPredicted, 0)} confidence</span>
                  <div className={styles.track}><span style={{ width: `${Math.min(100, point.actualRate * 100)}%` }} /></div>
                  <strong>{percent(point.actualRate, 0)}</strong>
                  <small>{point.observations} matches</small>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Breakdown title="Performance by league" values={snapshot.breakdown.byLeague} />
    </div>
  )
}

function Predictions({ snapshot }: { snapshot: AiLabSnapshot }) {
  return (
    <div className={styles.twoColumn}>
      <section className={styles.panel}>
        <PanelHeading title="Upcoming predictions" meta={`${snapshot.upcoming.length} fixtures`} />
        {snapshot.upcoming.length === 0 ? (
          <Empty title="No upcoming predictions" copy="A prediction appears only after a verified current model has scored a resolved AI Lab fixture." />
        ) : <ul className={styles.matchList}>{snapshot.upcoming.map((item) => <UpcomingRow key={item.id} item={item} />)}</ul>}
      </section>
      <section className={styles.panel}>
        <PanelHeading title="Recent graded results" meta={`${snapshot.recent.length} fixtures`} />
        {snapshot.recent.length === 0 ? (
          <Empty title="No graded predictions" copy="Results appear after the fixture is played and the prediction has been graded against the recorded score." />
        ) : <ul className={styles.matchList}>{snapshot.recent.map((item) => <ResultRow key={item.id} item={item} />)}</ul>}
      </section>
    </div>
  )
}

function UpcomingRow({ item }: { item: AiPrediction }) {
  const values = [item.pHome, item.pDraw, item.pAway]
  const peak = Math.max(...values)
  return (
    <li className={styles.matchRow}>
      <div className={styles.matchTop}><span className={styles.leagueCode}>{item.league}</span><time>{when(item.kickoffAt)}</time></div>
      <strong className={styles.fixture}>{item.home} <span>v</span> {item.away}</strong>
      <div className={styles.probabilities}>
        {([['H', item.pHome], ['D', item.pDraw], ['A', item.pAway]] as const).map(([label, value]) => (
          <span data-peak={value === peak} key={label}>{label} <strong>{percent(value, 0)}</strong></span>
        ))}
      </div>
      <p className={styles.rowMeta}>Pick: {pickLabel(item.predictedResult)}{item.predictedScore ? ` · ${item.predictedScore}` : ''} · model {item.modelVersion}</p>
    </li>
  )
}

function ResultRow({ item }: { item: AiRecentResult }) {
  return (
    <li className={styles.matchRow}>
      <div className={styles.matchTop}><span className={styles.leagueCode}>{item.league}</span><StatePill state={item.resultCorrect ? 'correct' : 'missed'} /></div>
      <strong className={styles.fixture}>{item.home} <span>{item.actualHomeGoals ?? '—'}–{item.actualAwayGoals ?? '—'}</span> {item.away}</strong>
      <p className={styles.rowMeta}>Predicted {pickLabel(item.predictedResult)}{item.predictedScore ? ` · ${item.predictedScore}` : ''} · log loss {decimal(item.logLoss)}</p>
    </li>
  )
}

function Betting({ snapshot }: { snapshot: AiLabSnapshot }) {
  const checks = [
    ['Settled evidence', snapshot.bettingGate.settledBets],
    ['Mean CLV', snapshot.bettingGate.meanClv],
    ['CLV interval above zero', snapshot.bettingGate.clvCiAboveZero],
    ['Bookmaker licences', snapshot.bettingGate.bookmakerLicences],
    ['18+ gate', snapshot.bettingGate.ageGate],
    ['Safer gambling signpost', snapshot.bettingGate.saferGamblingSignpost],
    ['Full record', snapshot.bettingGate.fullRecordPublished],
  ] as const
  return (
    <div className={styles.stack}>
      <section className={styles.metricGrid}>
        <Metric label="CLV observations" value={String(snapshot.betting.clv.observations)} hint={`${snapshot.betting.profit.settledBets} settled bets`} />
        <Metric label="Mean CLV" value={percent(snapshot.betting.clv.mean, 2)} hint={snapshot.betting.clv.ciLow === null ? 'Interval needs more data' : `${percent(snapshot.betting.clv.ciLow, 2)} to ${percent(snapshot.betting.clv.ciHigh, 2)}`} tone={snapshot.betting.clv.significant ? 'positive' : 'neutral'} />
        <Metric label="Beat the close" value={percent(snapshot.betting.clv.beatCloseRate)} hint="Valid closing prices" />
        <Metric label="Flat-unit ROI" value={percent(snapshot.betting.profit.roi, 2)} hint={`${snapshot.betting.profit.settledBets} settled`} />
        <Metric label="Open bets" value={String(snapshot.betting.open.bets)} hint={`${snapshot.betting.open.exposure.toFixed(2)}u exposure`} />
        <Metric label="Paper P&L" value={signed(snapshot.betting.profit.pnl, 'u')} hint={`${snapshot.betting.profit.staked.toFixed(2)}u staked`} tone={snapshot.betting.profit.pnl > 0 ? 'positive' : snapshot.betting.profit.pnl < 0 ? 'negative' : 'neutral'} />
      </section>
      <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <PanelHeading title="Evidence by market" meta={`${snapshot.markets.length} markets`} />
          {snapshot.markets.length === 0 ? <Empty title="No markets configured" copy="The market registry returned no evidence rows." /> : (
            <div className={styles.marketGrid}>{snapshot.markets.map((market) => <MarketCard key={market.code} market={market} />)}</div>
          )}
        </section>
        <section className={styles.panel}>
          <PanelHeading title="Public evidence gate" meta={snapshot.bettingGate.currentlyPublic ? 'Enabled' : 'Closed'} />
          <p className={styles.panelCopy}>Every requirement is server-owned. This screen reports the gate and cannot weaken it.</p>
          <ul className={styles.checkList}>
            {checks.map(([label, check]) => <li key={label} data-met={check.met}><span>{label}</span><strong>{check.met ? 'Met' : 'Not met'}</strong></li>)}
          </ul>
        </section>
      </div>
    </div>
  )
}

function MarketCard({ market }: { market: AiMarketEvidence }) {
  return (
    <article className={styles.marketCard} data-ready={market.meetsEvidenceBar}>
      <div className={styles.marketHeader}><div><span>{market.code}</span><strong>{market.name}</strong></div><StatePill state={market.meetsEvidenceBar ? 'trusted' : 'learning'} /></div>
      <dl><div><dt>CLV</dt><dd>{percent(market.meanClv, 2)}</dd></div><div><dt>Observations</dt><dd>{market.clvObservations} / {market.requiredBets}</dd></div><div><dt>Flat ROI</dt><dd>{percent(market.flatUnitRoi, 2)}</dd></div></dl>
      <p>{market.settledBets} settled bets · {market.freeHistoricalOdds ? 'free historical odds' : market.derivedFromScoreline ? 'derived from scoreline model' : 'live evidence only'}</p>
    </article>
  )
}

function Operations({ snapshot }: { snapshot: AiLabSnapshot }) {
  const budgetPct = snapshot.odds.softCap > 0
    ? Math.min(100, snapshot.odds.monthToDateCredits / snapshot.odds.softCap * 100)
    : 0
  return (
    <div className={styles.stack}>
      <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <PanelHeading title="Odds API budget" meta={`${snapshot.odds.remainingToSoftCap} credits available`} />
          <div className={styles.budgetFigure}><strong>{snapshot.odds.monthToDateCredits}</strong><span>of {snapshot.odds.softCap} soft cap · {snapshot.odds.monthlyCredits} plan</span></div>
          <div className={styles.budgetTrack} role="progressbar" aria-valuemin={0} aria-valuemax={snapshot.odds.softCap} aria-valuenow={snapshot.odds.monthToDateCredits}><span style={{ width: `${budgetPct}%` }} /></div>
          <p className={styles.panelCopy}>Reported-versus-estimated cost drift: {signed(snapshot.odds.costModelDrift)} credits. The database refuses a call that would exceed the soft cap.</p>
        </section>
        <section className={styles.panel}>
          <PanelHeading title="Fixture matching" meta={`${snapshot.odds.eventMatching.eventsSeen} events`} />
          <dl className={styles.inlineStats}><div><dt>Matched</dt><dd>{snapshot.odds.eventMatching.matchedToFixture}</dd></div><div><dt>Unmatched</dt><dd>{snapshot.odds.eventMatching.eventsSeen - snapshot.odds.eventMatching.matchedToFixture}</dd></div></dl>
          {snapshot.odds.eventMatching.unmatched.length > 0 ? <p className={styles.panelCopy}>Unmatched: {snapshot.odds.eventMatching.unmatched.slice(0, 8).join(', ')}</p> : <p className={styles.panelCopy}>No unresolved team names are recorded.</p>}
        </section>
      </div>
      <section className={styles.panel}>
        <PanelHeading title="Pipeline jobs" meta={`${snapshot.jobs.length} recorded jobs`} />
        {snapshot.jobs.length === 0 ? <Empty title="No job run has been recorded" copy="The schedules may be installed, but this ledger does not claim a job succeeded until it has written a run." /> : <div className={styles.jobGrid}>{snapshot.jobs.map((job) => <JobCard key={job.name} job={job} />)}</div>}
      </section>
      <section className={styles.panel}>
        <PanelHeading title="Recent paid-provider calls" meta={`${snapshot.odds.recentCalls.length} calls`} />
        {snapshot.odds.recentCalls.length === 0 ? <Empty title="No provider credits used" copy="No paid-provider call has been recorded. The first scheduled Production collection will appear here with its exact database-accounted cost." /> : (
          <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>When</th><th>League</th><th>Endpoint</th><th>Cost</th><th>Rows</th><th>Remaining</th></tr></thead><tbody>{snapshot.odds.recentCalls.map((call, index) => <tr key={`${call.calledAt}-${index}`}><td>{when(call.calledAt)}</td><td>{call.sportKey ?? '—'}</td><td>{call.endpoint}</td><td>{call.reportedCost ?? call.estimatedCost}</td><td>{call.rowsReturned}</td><td>{call.reportedRemaining ?? '—'}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  )
}

function JobCard({ job }: { job: AiJob }) {
  return <article className={styles.jobCard}><div><strong>{job.name}</strong><StatePill state={job.status} /></div><span>{job.rowsWritten} rows · {when(job.finishedAt ?? job.startedAt)}</span>{job.message ? <p>{job.message}</p> : null}</article>
}

function Breakdown({ title, values }: { title: string; values: Readonly<Record<string, AiMetricSlice>> }) {
  const entries = Object.entries(values)
  return <section className={styles.panel}><PanelHeading title={title} meta={`${entries.length} groups`} />{entries.length === 0 ? <Empty title="No performance breakdown yet" copy="This report needs graded predictions with their model features intact." /> : <div className={styles.breakdownGrid}>{entries.map(([key, value]) => <article key={key}><strong>{key}</strong><span>{value.observations} graded</span><dl><div><dt>Accuracy</dt><dd>{percent(value.accuracy)}</dd></div><div><dt>Log loss</dt><dd>{decimal(value.logLoss)}</dd></div></dl></article>)}</div>}</section>
}

function Metric({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint: string; tone?: 'neutral' | 'positive' | 'negative' }) {
  return <article className={styles.metric} data-tone={tone}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>
}

function PanelHeading({ title, meta }: { title: string; meta: string }) {
  return <div className={styles.panelHeading}><h2>{title}</h2><span>{meta}</span></div>
}

function Empty({ title, copy }: { title: string; copy: string }) {
  return <div className={styles.empty}><span className={styles.emptyMark} aria-hidden="true" /><strong>{title}</strong><p>{copy}</p></div>
}

function StatePill({ state }: { state: string }) {
  const positive = ['current', 'correct', 'trusted', 'succeeded', 'success', 'complete', 'completed'].includes(state.toLowerCase())
  const negative = ['failed', 'missed', 'error'].includes(state.toLowerCase())
  return <span className={styles.statePill} data-tone={positive ? 'positive' : negative ? 'negative' : 'neutral'}>{state || 'unknown'}</span>
}
