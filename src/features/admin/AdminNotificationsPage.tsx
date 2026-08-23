import { useEffect, useMemo, useState } from 'react'
import { fetchReminderDeliveryHealth, type ReminderDeliveryHealth } from '../../services/supabase/reminderDeliveryHealth'
import { presentReminderJobs } from '../../services/supabase/reminderDeliveryHealthModel'
import { formatKickoffWithDay } from '../../shared/time/kickoff'
import { ControlRoomPage, Panel, ReadState, Stat, StatusPill } from './ControlRoomUi'
import styles from './controlRoom.module.css'

type Read = { status: 'loading' } | { status: 'failed'; message: string } | { status: 'ready'; value: ReminderDeliveryHealth }

function formatInstant(value: string | null): string {
  return formatKickoffWithDay(value) ?? 'Unknown'
}

export function AdminNotificationsPage() {
  const [read, setRead] = useState<Read>({ status: 'loading' })

  useEffect(() => {
    let active = true
    fetchReminderDeliveryHealth()
      .then((value) => { if (active) setRead({ status: 'ready', value }) })
      .catch((error) => { if (active) setRead({ status: 'failed', message: error instanceof Error ? error.message : 'Notification health read failed.' }) })
    return () => { active = false }
  }, [])

  const jobs = useMemo(() => read.status === 'ready' ? presentReminderJobs(read.value) : null, [read])

  return (
    <ControlRoomPage
      eyebrow="Delivery operations"
      title="Notifications"
      intro="Operational visibility over the existing action-centre and reminder ledger. The Control Room does not enable delivery: the sender remains off until its separately governed provider/deployment switches are deliberately configured."
    >
      {read.status === 'loading' ? <ReadState kind="loading" title="Loading notification operations" detail="Reading aggregate scheduler and delivery-ledger health. No reminder is claimed or sent." /> : null}
      {read.status === 'failed' ? <ReadState kind="failed" title="Notification health unavailable" detail={read.message} /> : null}

      {read.status === 'ready' ? (
        <>
          <div className={styles.grid4}>
            <Stat label="Delivery" value={read.value.senderConfigured ? 'Configured' : 'Disabled'} detail="Server-stated sender configuration" state={read.value.senderConfigured ? 'healthy' : 'disabled'} />
            <Stat label="Open action items" value={read.value.actions.open} detail={`Generated ${formatInstant(read.value.actions.lastGeneratedAt)}`} state={read.value.actions.openPastDeadline > 0 ? 'warning' : 'healthy'} />
            <Stat label="Pending reminders" value={read.value.deliveries.pendingLive + read.value.deliveries.pendingDryRun} detail={`${read.value.deliveries.pendingDryRun} dry-run · ${read.value.deliveries.pendingLive} live`} state={read.value.deliveries.pendingLive > 0 && !read.value.senderConfigured ? 'warning' : 'healthy'} />
            <Stat label="Terminal failures" value={read.value.deliveries.terminalFailures} detail={`${read.value.deliveries.stalledOverAnHour} stalled over one hour`} state={read.value.deliveries.terminalFailures > 0 || read.value.deliveries.stalledOverAnHour > 0 ? 'critical' : 'healthy'} />
          </div>

          <Panel
            title="Delivery status"
            description="The database states whether a sender exists; zeros in the ledger are never used to infer that answer."
            aside={<StatusPill state={read.value.senderConfigured ? 'healthy' : 'disabled'} label={read.value.senderConfigured ? 'Sender configured' : 'Delivery disabled'} />}
          >
            {!read.value.senderConfigured ? (
              <ReadState kind="not-configured" title="Transactional delivery is intentionally disabled" detail="Repository support exists, but the notification-dispatch runtime/provider is not enabled by this branch. No credential or delivery switch is exposed to the browser." />
            ) : null}
            <div className={styles.grid3}>
              <Stat label="Due now" value={read.value.deliveries.dueNow} />
              <Stat label="In flight" value={read.value.deliveries.inFlight} />
              <Stat label="Last ledger update" value={formatInstant(read.value.deliveries.lastUpdatedAt)} />
            </div>
          </Panel>

          <Panel title="Scheduler jobs" description="The expected jobs are named individually so two-of-three cannot look like generic scheduler health.">
            {jobs?.missing === null ? (
              <ReadState kind="stale" title="Cron catalogue unreadable" detail="The health authority could not inspect cron.job, so scheduler state is unknown rather than empty." />
            ) : (
              <ul className={styles.recordList}>
                {jobs?.jobs.map((job) => (
                  <li className={styles.recordRow} key={job.name}>
                    <div className={styles.rowSpread}>
                      <strong>{job.name}</strong>
                      <StatusPill state={job.active ? 'healthy' : 'critical'} label={job.active ? 'Active' : 'Missing / inactive'} />
                    </div>
                    <span className={styles.meta}>{job.schedule ?? 'No schedule returned'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Supported event scope" description="The notification taxonomy is broader than the send loop. This page keeps that distinction explicit instead of labelling every defined event as live.">
            <ul className={styles.recordList}>
              <li className={styles.recordRow}><div className={styles.rowSpread}><strong>Prediction deadline reminders</strong><StatusPill state="warning" label="Mapped; delivery off" /></div><span className={styles.meta}>Window-closing and entries-outstanding events are the currently mapped reminder-ledger path.</span></li>
              <li className={styles.recordRow}><div className={styles.rowSpread}><strong>LMS, social, league and result events</strong><StatusPill state="not-configured" label="Taxonomy only / not wired" /></div><span className={styles.meta}>A defined event name is not evidence that a provider workflow is configured or that an emitter exists.</span></li>
            </ul>
          </Panel>
        </>
      ) : null}
    </ControlRoomPage>
  )
}
