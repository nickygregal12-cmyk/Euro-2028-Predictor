import { useEffect, useMemo, useState } from 'react'
import { releaseIdentity } from '../../services/observability/releaseIdentity'
import { snapshotAllowsCapability } from '../../services/supabase/adminAccess'
import { fetchPublicCapacity } from '../../services/supabase/publicCapacity'
import type { PublicCapacity } from '../../services/supabase/publicCapacityModel'
import { fetchReminderDeliveryHealth, type ReminderDeliveryHealth } from '../../services/supabase/reminderDeliveryHealth'
import { presentReminderJobs } from '../../services/supabase/reminderDeliveryHealthModel'
import { useAdminAccess } from './AdminAccessContext'
import { ControlRoomPage, Panel, ReadState, Stat, StatusPill, type OperationalState } from './ControlRoomUi'
import styles from './controlRoom.module.css'

type CapacityRead = { status: 'loading' } | { status: 'failed'; message: string } | { status: 'ready'; value: PublicCapacity }
type SchedulerRead = { status: 'loading' } | { status: 'failed'; message: string } | { status: 'ready'; value: ReminderDeliveryHealth }
type SchedulerPresentation = { state: OperationalState; label: string; detail: string }
type SchedulerJobs = ReturnType<typeof presentReminderJobs>

function contractState(): { state: OperationalState; label: string; detail: string } {
  if (releaseIdentity.hostedContract === null) return { state: 'unknown', label: 'Hosted contract unknown', detail: `Application requires contract ${releaseIdentity.applicationContract}.` }
  if (releaseIdentity.hostedContract === releaseIdentity.applicationContract) return { state: 'healthy', label: `Contract ${releaseIdentity.hostedContract}`, detail: 'Application and hosted database contract match.' }
  if (releaseIdentity.hostedContract < releaseIdentity.applicationContract) return { state: 'critical', label: `${releaseIdentity.hostedContract} / ${releaseIdentity.applicationContract}`, detail: 'Hosted database is behind the application contract.' }
  return { state: 'warning', label: `${releaseIdentity.hostedContract} / ${releaseIdentity.applicationContract}`, detail: 'Hosted database is ahead of the application build.' }
}

function percent(used: number, limit: number): number {
  return limit > 0 ? Math.round((used / limit) * 100) : 0
}

function presentSchedulerStatus(
  allowed: boolean,
  read: SchedulerRead | null,
  jobs: SchedulerJobs | null,
): SchedulerPresentation {
  if (!allowed) {
    return {
      state: 'unknown',
      label: 'Outside this capability',
      detail: 'Scheduler health requires the competitions admin capability.',
    }
  }
  if (read === null || read.status === 'loading') {
    return { state: 'unknown', label: 'Loading', detail: 'Reading the bounded scheduler catalogue.' }
  }
  if (read.status === 'failed') {
    return { state: 'warning', label: 'Read failed', detail: read.message }
  }
  if (jobs === null) {
    return {
      state: 'unknown',
      label: 'Scheduler catalogue unavailable',
      detail: 'The scheduler read completed without a presentable job catalogue.',
    }
  }
  if (jobs.missing === null) {
    return {
      state: 'unknown',
      label: 'Cron catalogue unreadable',
      detail: 'The bounded authority could not inspect cron.job.',
    }
  }
  if (jobs.missing.length > 0) {
    return {
      state: 'critical',
      label: `${jobs.missing.length} expected job(s) missing`,
      detail: jobs.missing.join(' · '),
    }
  }
  return {
    state: 'healthy',
    label: 'Expected jobs active',
    detail: 'All three Contract 172 jobs are present and active.',
  }
}

export function AdminSystemPage() {
  const access = useAdminAccess()
  const canReadScheduler = snapshotAllowsCapability(access, 'competitions')
  const [capacity, setCapacity] = useState<CapacityRead>({ status: 'loading' })
  const [scheduler, setScheduler] = useState<SchedulerRead | null>(canReadScheduler ? { status: 'loading' } : null)

  useEffect(() => {
    let active = true
    fetchPublicCapacity()
      .then((value) => { if (active) setCapacity({ status: 'ready', value }) })
      .catch((error) => { if (active) setCapacity({ status: 'failed', message: error instanceof Error ? error.message : 'Capacity read failed.' }) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!canReadScheduler) return
    let active = true
    setScheduler({ status: 'loading' })
    fetchReminderDeliveryHealth()
      .then((value) => { if (active) setScheduler({ status: 'ready', value }) })
      .catch((error) => { if (active) setScheduler({ status: 'failed', message: error instanceof Error ? error.message : 'Scheduler health read failed.' }) })
    return () => { active = false }
  }, [canReadScheduler])

  const contract = contractState()
  const sentryEnabled = import.meta.env.VITE_SENTRY_ENABLED === 'true'
  const sentryDsnPresent = Boolean(import.meta.env.VITE_SENTRY_DSN?.trim())
  const posthogConfigured = Boolean(import.meta.env.VITE_POSTHOG_KEY?.trim())
  const schedulerJobs = useMemo(
    () => scheduler?.status === 'ready' ? presentReminderJobs(scheduler.value) : null,
    [scheduler],
  )
  const schedulerStatus = presentSchedulerStatus(canReadScheduler, scheduler, schedulerJobs)

  return (
    <ControlRoomPage eyebrow="Platform operations" title="System Health" intro="Release identity, database compatibility, scheduler state, operating capacity and connection configuration that this application can establish safely. External service health remains external unless a bounded server integration exists.">
      <div className={styles.grid4}>
        <Stat label="Environment" value={releaseIdentity.environment.toUpperCase()} detail={`Deploy ${releaseIdentity.deployId || 'unknown'}`} />
        <Stat label="Database contract" value={contract.label} detail={contract.detail} state={contract.state} />
        <Stat label="Scheduler" value={schedulerStatus.label} detail={schedulerStatus.detail} state={schedulerStatus.state} />
        <Stat label="Application commit" value={releaseIdentity.commit ? releaseIdentity.commit.slice(0, 8) : 'Unknown'} detail="Release identity embedded at build time" />
      </div>

      <Panel title="Connections" description="Configured does not mean healthy. Where the browser has no safe management API, the Control Room says so rather than probing with a secret.">
        <ul className={styles.connectionList}>
          <li className={styles.connectionRow}><div className={styles.rowSpread}><strong>Supabase</strong><StatusPill state={contract.state} label={contract.label} /></div><span className={styles.meta}>Release contract compatibility is the bounded health signal available to the application. Project: {releaseIdentity.supabaseProjectRef ?? 'unknown'}.</span></li>
          <li className={styles.connectionRow}><div className={styles.rowSpread}><strong>Scheduler / pg_cron</strong><StatusPill state={schedulerStatus.state} label={schedulerStatus.label} /></div><span className={styles.meta}>{schedulerStatus.detail}</span></li>
          <li className={styles.connectionRow}><div className={styles.rowSpread}><strong>Sentry</strong><StatusPill state={sentryEnabled && sentryDsnPresent ? 'unknown' : 'disabled'} label={sentryEnabled && sentryDsnPresent ? 'Configured · live health external' : 'Disabled / incomplete'} /></div><span className={styles.meta}>The browser DSN is a public ingest address, not a management credential. Issue rates and unresolved errors require server-side Sentry access and are not fetched here.</span></li>
          <li className={styles.connectionRow}><div className={styles.rowSpread}><strong>PostHog</strong><StatusPill state={posthogConfigured ? 'unknown' : 'disabled'} label={posthogConfigured ? 'Configured · reporting external' : 'Disabled'} /></div><span className={styles.meta}>Only intentional product events are captured; autocapture, automatic page views and replay are not used by the current client integration.</span></li>
          <li className={styles.connectionRow}><div className={styles.rowSpread}><strong>Netlify</strong><StatusPill state={releaseIdentity.deployId ? 'unknown' : 'not-configured'} label={releaseIdentity.deployId ? 'Release identified · logs external' : 'Deploy identity unavailable'} /></div><span className={styles.meta}>Build/deploy logs and environment-variable management stay in Netlify; no management token crosses into the browser.</span></li>
          <li className={styles.connectionRow}><div className={styles.rowSpread}><strong>Hosted BI</strong><StatusPill state="not-configured" label="Repository tooling only" /></div><span className={styles.meta}>Aggregate analytics views and a read-only role are defined in the repository, but a hosted reporting service is intentionally not provisioned by this application.</span></li>
        </ul>
      </Panel>

      <Panel title="Operating capacity" description="Current platform caps come from the aggregate-only public capacity authority. The database triggers remain the enforcement boundary.">
        {capacity.status === 'loading' ? <ReadState kind="loading" title="Loading capacity" detail="Reading aggregate counts and limits only." /> : null}
        {capacity.status === 'failed' ? <ReadState kind="failed" title="Capacity unavailable" detail={capacity.message} /> : null}
        {capacity.status === 'ready' ? (
          <div className={styles.grid4}>
            <Stat label="Users" value={`${capacity.value.publicUsersUsed} / ${capacity.value.publicUserLimit}`} detail={`${percent(capacity.value.publicUsersUsed, capacity.value.publicUserLimit)}% of operating limit`} state={capacity.value.signupAvailable ? 'healthy' : 'critical'} />
            <Stat label="Signup" value={capacity.value.signupAvailable ? 'Available' : 'At capacity'} detail="Preflight only; database remains authoritative" state={capacity.value.signupAvailable ? 'healthy' : 'critical'} />
            <Stat label="Leagues" value={`${capacity.value.leaguesUsed} / ${capacity.value.totalLeagueLimit}`} detail={`${percent(capacity.value.leaguesUsed, capacity.value.totalLeagueLimit)}% of operating limit`} state={capacity.value.leagueCreationAvailable ? 'healthy' : 'critical'} />
            <Stat label="League creation" value={capacity.value.leagueCreationAvailable ? 'Available' : 'At capacity'} detail="Aggregate limit state" state={capacity.value.leagueCreationAvailable ? 'healthy' : 'critical'} />
          </div>
        ) : null}
      </Panel>

      <Panel title="Feature & capability status" description="The Control Room distinguishes shipped code from enabled hosted capability.">
        <ul className={styles.recordList}>
          <li className={styles.recordRow}><div className={styles.rowSpread}><strong>vNext Football Hub destinations</strong><StatusPill state="healthy" label="Build-flag controlled" /></div><span className={styles.meta}>Each destination retains its existing route flag and legacy fallback; Admin does not change those cutover rules.</span></li>
          <li className={styles.recordRow}><div className={styles.rowSpread}><strong>Transactional notifications</strong><StatusPill state="disabled" label="Delivery disabled" /></div><span className={styles.meta}>The repository boundary exists, but this branch does not provision or enable a sender.</span></li>
          <li className={styles.recordRow}><div className={styles.rowSpread}><strong>Hosted BI / reporting</strong><StatusPill state="not-configured" /></div><span className={styles.meta}>Reporting views exist without a hosted reporting product.</span></li>
        </ul>
      </Panel>
    </ControlRoomPage>
  )
}
