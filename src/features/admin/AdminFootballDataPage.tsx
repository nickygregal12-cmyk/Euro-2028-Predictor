import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { fetchAdministeredSeasons, type AdministeredSeason } from '../../services/supabase/administeredSeasons'
import {
  fetchAdminAiOperationalHealth,
  fetchOddsApiAdminStatus,
  type AdminAiOperationalHealth,
  type OddsApiAdminStatus,
} from '../../services/supabase/adminOperations'
import { fetchProviderReviewQueues, type ProviderReviewQueues } from '../../services/supabase/providerReviewQueues'
import { formatKickoffWithDay } from '../../shared/time/kickoff'
import { ControlRoomPage, Panel, ReadState, Stat, StatusPill, type OperationalState } from './ControlRoomUi'
import styles from './controlRoom.module.css'

type Read<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly message: string }
  | { readonly status: 'ready'; readonly value: T }

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'The operational read failed.'
}

function quotaState(used: number | null, softCap: number | null): OperationalState {
  if (used === null || softCap === null || softCap <= 0) return 'unknown'
  const fraction = used / softCap
  if (fraction >= 0.9) return 'critical'
  if (fraction >= 0.75) return 'warning'
  return 'healthy'
}

function formatNumber(value: number | null): string {
  return value === null ? 'Unknown' : new Intl.NumberFormat('en-GB').format(value)
}

function formatInstant(value: string | null): string {
  return formatKickoffWithDay(value) ?? 'Unknown'
}

export function AdminFootballDataPage() {
  const [seasons, setSeasons] = useState<Read<AdministeredSeason[]>>({ status: 'loading' })
  const [seasonId, setSeasonId] = useState<string>('')
  const [review, setReview] = useState<Read<ProviderReviewQueues> | null>(null)
  const [odds, setOdds] = useState<Read<OddsApiAdminStatus>>({ status: 'loading' })
  const [aiHealth, setAiHealth] = useState<Read<AdminAiOperationalHealth>>({ status: 'loading' })

  useEffect(() => {
    let active = true
    fetchAdministeredSeasons()
      .then((rows) => {
        if (!active) return
        setSeasons({ status: 'ready', value: rows })
        setSeasonId((current) => current || rows[0]?.id || '')
      })
      .catch((error) => {
        if (active) setSeasons({ status: 'failed', message: messageOf(error) })
      })

    fetchOddsApiAdminStatus()
      .then((value) => {
        if (active) setOdds({ status: 'ready', value })
      })
      .catch((error) => {
        if (active) setOdds({ status: 'failed', message: messageOf(error) })
      })

    fetchAdminAiOperationalHealth()
      .then((value) => {
        if (active) setAiHealth({ status: 'ready', value })
      })
      .catch((error) => {
        if (active) setAiHealth({ status: 'failed', message: messageOf(error) })
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!seasonId) {
      setReview(null)
      return
    }
    let active = true
    setReview({ status: 'loading' })
    fetchProviderReviewQueues(seasonId)
      .then((value) => {
        if (active) setReview({ status: 'ready', value })
      })
      .catch((error) => {
        if (active) setReview({ status: 'failed', message: messageOf(error) })
      })
    return () => {
      active = false
    }
  }, [seasonId])

  const selectedSeason = seasons.status === 'ready'
    ? seasons.value.find((season) => season.id === seasonId) ?? null
    : null

  const reportedRemaining = useMemo(() => {
    if (odds.status !== 'ready') return null
    return odds.value.recentCalls.find((call) => call.reportedRemaining !== null) ?? null
  }, [odds])

  const reviewCount = review?.status === 'ready'
    ? review.value.queues.reduce((total, queue) => total + queue.unreviewed, 0)
      + review.value.pendingCalendarProposals
    : null

  const oddsState = odds.status === 'ready'
    ? quotaState(odds.value.monthToDateCredits, odds.value.softCap)
    : odds.status === 'failed'
      ? 'unknown'
      : 'unknown'

  return (
    <ControlRoomPage
      eyebrow="Football operations"
      title="Football Data"
      intro="Provider freshness, review queues and retained API-usage evidence. Opening this workspace performs protected database reads only; it never calls a paid football provider just to discover quota."
      actions={<Link className={styles.secondaryButton} to="/admin/season">Competition controls</Link>}
    >
      <div className={styles.grid4}>
        <Stat
          label="The Odds API"
          value={odds.status === 'ready' ? formatNumber(odds.value.monthToDateCredits) : '—'}
          detail="Credits recorded this month"
          state={oddsState}
        />
        <Stat
          label="Soft cap remaining"
          value={odds.status === 'ready' ? formatNumber(odds.value.remainingToSoftCap) : '—'}
          detail="Server-owned spending control"
          state={oddsState}
        />
        <Stat
          label="Provider-reported remaining"
          value={reportedRemaining ? formatNumber(reportedRemaining.reportedRemaining) : 'Unknown'}
          detail={reportedRemaining ? `Observed ${formatInstant(reportedRemaining.calledAt)}` : 'No retained quota header is available'}
          state={reportedRemaining ? 'healthy' : 'unknown'}
        />
        <Stat
          label="Review items"
          value={reviewCount === null ? '—' : reviewCount}
          detail={selectedSeason?.name ?? 'Choose a competition season'}
          state={reviewCount === null ? 'unknown' : reviewCount > 0 ? 'warning' : 'healthy'}
        />
      </div>

      <Panel title="API usage & allowances" description="The Odds API summary comes from retained `ai.api_budget` / `ai.api_usage` evidence. Threshold colours are presentation only; the server remains the spending authority.">
        {odds.status === 'loading' ? (
          <ReadState kind="loading" title="Loading retained quota evidence" detail="No provider call is being made." />
        ) : odds.status === 'failed' ? (
          <ReadState kind="failed" title="Quota summary unavailable" detail={odds.message} />
        ) : (
          <>
            <div className={styles.grid4}>
              <Stat label="Monthly allowance" value={formatNumber(odds.value.monthlyCredits)} detail="Configured authority" />
              <Stat label="Used" value={formatNumber(odds.value.monthToDateCredits)} detail="Recorded current period" />
              <Stat label="Soft cap" value={formatNumber(odds.value.softCap)} detail="Calls remain server-controlled" />
              <Stat label="Cost-model drift" value={formatNumber(odds.value.costModelDrift)} detail="Reported cost minus estimated cost" />
            </div>

            {odds.value.recentCalls.length === 0 ? (
              <ReadState kind="empty" title="No retained Odds API calls" detail="Zero history is shown as an empty ledger, not as a provider-health claim." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>When</th><th>Sport</th><th>Endpoint</th><th>Estimated</th><th>Reported</th><th>Provider remaining</th></tr>
                  </thead>
                  <tbody>
                    {odds.value.recentCalls.map((call, index) => (
                      <tr key={`${call.calledAt ?? 'unknown'}-${index}`}>
                        <td data-label="When">{formatInstant(call.calledAt)}</td>
                        <td data-label="Sport">{call.sportKey ?? 'Unknown'}</td>
                        <td data-label="Endpoint">{call.endpoint ?? 'Unknown'}</td>
                        <td data-label="Estimated">{formatNumber(call.estimatedCost)}</td>
                        <td data-label="Reported">{formatNumber(call.reportedCost)}</td>
                        <td data-label="Provider remaining">{formatNumber(call.reportedRemaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel title="Provider connections" description="Only facts exposed by bounded application authorities are stated. Configuration secrets are never returned to the browser.">
        <ul className={styles.connectionList}>
          <li className={styles.connectionRow}>
            <div className={styles.rowSpread}>
              <strong>The Odds API</strong>
              {aiHealth.status === 'ready' ? (
                <StatusPill
                  state={aiHealth.value.oddsApi.collectionEnabled === true ? 'healthy' : aiHealth.value.oddsApi.collectionEnabled === false ? 'disabled' : 'unknown'}
                  label={aiHealth.value.oddsApi.collectionEnabled === true ? 'Collection enabled' : aiHealth.value.oddsApi.collectionEnabled === false ? 'Collection disabled' : 'Unknown'}
                />
              ) : <StatusPill state="unknown" />}
            </div>
            <span className={styles.meta}>
              Last successful retained call: {aiHealth.status === 'ready' ? formatInstant(aiHealth.value.oddsApi.lastSuccessfulCallAt) : 'Unknown'}
            </span>
          </li>
          {['SportMonks', 'API-Football', 'football-data.org'].map((provider) => (
            <li className={styles.connectionRow} key={provider}>
              <div className={styles.rowSpread}>
                <strong>{provider}</strong>
                <StatusPill state="unknown" label="Health summary unavailable" />
              </div>
              <span className={styles.meta}>
                The ingestion layer supports this provider, but no browser-safe bounded admin health/quota summary currently states configuration, freshness or remaining allowance. The Control Room does not infer those facts from secret presence.
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Provider review queue"
        description="Five acknowledgement queues plus staged calendar proposals. Decisions stay in the existing Competition workspace."
        aside={reviewCount === null ? <StatusPill state="unknown" /> : <StatusPill state={reviewCount > 0 ? 'warning' : 'healthy'} label={reviewCount > 0 ? `${reviewCount} require attention` : 'Clear'} />}
      >
        {seasons.status === 'failed' ? (
          <ReadState kind="failed" title="Competition list unavailable" detail={seasons.message} />
        ) : seasons.status === 'loading' ? (
          <ReadState kind="loading" title="Loading administered competitions" detail="Draft seasons are included by the existing admin authority." />
        ) : seasons.value.length === 0 ? (
          <ReadState kind="empty" title="No administered league seasons" detail="No competition is invented to make the queue look populated." />
        ) : (
          <>
            <label>
              <span className={styles.meta}>Competition season</span>
              <select value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
                {seasons.value.map((season) => <option value={season.id} key={season.id}>{season.name}</option>)}
              </select>
            </label>
            {review?.status === 'loading' ? (
              <ReadState kind="loading" title="Loading review evidence" detail="The selected competition's bounded provider review RPC is running." />
            ) : review?.status === 'failed' ? (
              <ReadState kind="failed" title="Review queue unavailable" detail={review.message} />
            ) : review?.status === 'ready' ? (
              <ul className={styles.recordList}>
                {review.value.queues.map((queue) => (
                  <li className={styles.recordRow} key={queue.kind}>
                    <div className={styles.rowSpread}>
                      <strong>{queue.kind.replaceAll('_', ' ')}</strong>
                      <StatusPill state={queue.unreviewed > 0 ? 'warning' : 'healthy'} label={`${queue.unreviewed} unreviewed`} />
                    </div>
                    <span className={styles.meta}>{queue.items[0]?.summary ?? 'No current item in the bounded page.'}</span>
                  </li>
                ))}
                <li className={styles.recordRow}>
                  <div className={styles.rowSpread}>
                    <strong>Staged calendar proposals</strong>
                    <StatusPill state={review.value.pendingCalendarProposals > 0 ? 'warning' : 'healthy'} label={`${review.value.pendingCalendarProposals} pending`} />
                  </div>
                  <span className={styles.meta}>Approve/reject remains a separate deliberate lifecycle in Competition controls.</span>
                </li>
              </ul>
            ) : null}
          </>
        )}
      </Panel>

      <Panel title="Pipeline jobs" description="AI/odds operational job evidence is server-owned. General provider poll scheduler health still needs a bounded summary before it can be stated here.">
        {aiHealth.status === 'loading' ? (
          <ReadState kind="loading" title="Loading job health" detail="Waiting for the protected operational-health RPC." />
        ) : aiHealth.status === 'failed' ? (
          <ReadState kind="failed" title="Job health unavailable" detail={aiHealth.message} />
        ) : aiHealth.value.jobs.length === 0 ? (
          <ReadState kind="empty" title="No AI job history in the bounded window" detail="This is not treated as healthy scheduler state." />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Job</th><th>Last run</th><th>Last success</th><th>Failures (7d)</th></tr></thead>
              <tbody>
                {aiHealth.value.jobs.map((job) => (
                  <tr key={job.job}>
                    <td data-label="Job">{job.job}</td>
                    <td data-label="Last run">{formatInstant(job.lastRunAt)}</td>
                    <td data-label="Last success">{formatInstant(job.lastSuccessAt)}</td>
                    <td data-label="Failures (7d)">{formatNumber(job.failures7d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </ControlRoomPage>
  )
}
