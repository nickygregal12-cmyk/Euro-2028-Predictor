import { useEffect, useState } from 'react'
import { Alert, Skeleton } from '../../design-system'
import {
  presentReminderJobs,
  type ReminderDeliveryHealth,
} from '../../services/supabase/reminderDeliveryHealthModel'
import { seasonAdminRefusal } from './seasonAdminModel'
import styles from './ReminderHealthPanel.module.css'

/**
 * Contract 172's operational health for the action centre and the reminder
 * ledger.
 *
 * WHY THIS PANEL EXISTS, AND IT IS NOT "BECAUSE A READ WAS AVAILABLE". Three
 * contracts in a row — 162, 163 and 170 — each shipped a generator and each
 * ended by recording, accurately, that nothing called it. What made that
 * survivable for so long is that the ledger reads the same either way: an
 * inbox with no items and a scheduler that was never installed are both zero.
 * The read separates them, and this panel's whole job is to keep them separate
 * on screen. It leads with the JOBS, not with the counts, for that reason.
 *
 * NOTHING SENDS, AND THE PANEL SAYS SO RATHER THAN LEAVING IT TO BE INFERRED.
 * `process_reminder_schedule` is scheduled with an empty argument list so its
 * `dry_run` default applies, no job names `claim_due_reminders`, and
 * `SITE-007` still blocks the transactional sender on the brand decision. A
 * queue of pending reminders on this page is therefore the correct state, not
 * a backlog — and an administrator reading "412 pending" with no explanation
 * would reasonably conclude a sender had fallen over.
 *
 * THERE IS NO CONTROL ON IT. No run-now, no retry, no clear, no send. Every
 * driver is `service_role`-only by design and the sender does not exist; a
 * button here would either do nothing or be the first step toward the brand
 * decision being taken by accident.
 *
 * IT NAMES NOBODY. Contract 172 returns no user id, action key, display name,
 * address or provider error text, and there is nothing in this component that
 * could render one. How many failed is an operations fact; which player failed
 * is theirs.
 *
 * "COULD NOT LOOK" IS NOT "NOTHING SCHEDULED". The server returns a null job
 * list when the definer could not read `cron.job`, and an empty one when it
 * looked and found none. Those get different sentences here, because the
 * reassuring reading of the first is exactly the mistake this contract exists
 * to stop being made.
 */

export type ReminderHealthPanelProps = {
  /** Injected by the page; the panel calls no service itself. */
  load: () => Promise<ReminderDeliveryHealth>
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; health: ReminderDeliveryHealth }

const JOB_PURPOSE: Record<string, string> = {
  'player-action-centre-generate': 'Builds and expires action-centre items',
  'player-reminder-schedule': 'Queues reminders for items with a deadline',
  'player-reminder-reclaim-stalled': 'Returns stalled deliveries to the queue',
}

const ACTION_TYPE_LABEL: Record<string, string> = {
  lms_pick: 'Last Man Standing pick',
  matchweek_card: 'Matchweek card',
  matchweek_settled: 'Settled matchweek recap',
}

function when(value: string | null): string {
  if (!value) return ''
  const at = new Date(value)
  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
}

export function ReminderHealthPanel({ load }: ReminderHealthPanelProps) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    setState({ kind: 'loading' })
    load()
      .then((health) => {
        if (active) setState({ kind: 'ready', health })
      })
      .catch((error: unknown) => {
        if (active) setState({ kind: 'failed', message: seasonAdminRefusal(error) })
      })
    return () => {
      active = false
    }
  }, [load])

  return (
    <section className={styles.panel} aria-labelledby="reminder-health-heading">
      <h2 className={styles.heading} id="reminder-health-heading">
        Action centre and reminders
      </h2>
      <p className={styles.caption}>
        Whether the three scheduled jobs are running, and what the two ledgers hold. Counts and
        instants only — no player is named here.
      </p>

      {state.kind === 'loading' ? <Skeleton height={140} radius="card" /> : null}
      {state.kind === 'failed' ? <Alert variant="warning">{state.message}</Alert> : null}
      {state.kind === 'ready' ? <Health health={state.health} /> : null}
    </section>
  )
}

function Health({ health }: { health: ReminderDeliveryHealth }) {
  const jobs = presentReminderJobs(health)

  return (
    <>
      {/* The scheduler first. Every count below it is meaningless if these are
          not running, and reading them in the other order is how three
          contracts' worth of empty inbox looked normal. */}
      {jobs.missing === null ? (
        <Alert variant="warning" title="The scheduled jobs could not be read">
          The read could not see the job table, so whether these are running is unknown. This is
          not a report that nothing is scheduled — the counts below may be stale for that reason.
        </Alert>
      ) : jobs.missing.length > 0 ? (
        <Alert variant="warning" title="Not every job is running">
          {jobs.missing.join(', ')} {jobs.missing.length === 1 ? 'is' : 'are'} absent or inactive.
          Anything the missing job owns will simply not happen, and the ledgers below will look
          quiet rather than broken.
        </Alert>
      ) : null}

      <ul className={styles.jobs}>
        {jobs.jobs.map((job) => (
          <li key={job.name} className={styles.job} data-state={jobState(job.active, jobs.missing)}>
            <span className={styles.jobName}>{job.name}</span>
            <span className={styles.jobPurpose}>{JOB_PURPOSE[job.name] ?? ''}</span>
            <span className={styles.jobMeta}>
              {jobs.missing === null
                ? 'Unknown'
                : job.active
                  ? `Active · ${job.schedule ?? 'schedule not reported'}`
                  : 'Not scheduled'}
            </span>
          </li>
        ))}
      </ul>

      <dl className={styles.summary}>
        <Figure label="Open actions" value={String(health.actions.open)} />
        <Figure label="Completed" value={String(health.actions.completed)} />
        <Figure
          label="Open past deadline"
          value={String(health.actions.openPastDeadline)}
          tone={health.actions.openPastDeadline > 0 ? 'alert' : 'quiet'}
        />
        <Figure
          label="Stalled deliveries"
          value={String(health.deliveries.stalledOverAnHour)}
          tone={health.deliveries.stalledOverAnHour > 0 ? 'alert' : 'quiet'}
        />
      </dl>

      {health.actions.openPastDeadline > 0 ? (
        <Alert variant="warning" title="Items are open past their own deadline">
          The expiry sweep closes an item once its lock has passed, so this should be zero once the
          generator has run. A non-zero value means the sweep is not reaching them.
        </Alert>
      ) : null}

      {/* Named rather than counted, so an operator can see WHICH generator is
          producing nothing. A total of zero across three types and a total of
          zero for one of them are different problems. */}
      <div className={styles.byType}>
        <h3 className={styles.subheading}>Open items by type</h3>
        {Object.keys(health.actions.byType).length === 0 ? (
          <p className={styles.caption}>
            No open items of any type.{' '}
            {health.actions.lastGeneratedAt
              ? `The generator last ran ${when(health.actions.lastGeneratedAt)}.`
              : 'The generator has never recorded a run against this platform.'}
          </p>
        ) : (
          <ul className={styles.tally}>
            {Object.entries(health.actions.byType).map(([type, count]) => (
              <li key={type} className={styles.tallyRow}>
                <span>{ACTION_TYPE_LABEL[type] ?? type}</span>
                <span className={styles.tallyCount}>{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.byType}>
        <h3 className={styles.subheading}>Reminder ledger</h3>
        {/* The sender is the whole context for every number in this block, so
            it is stated before them rather than after. */}
        {health.senderConfigured ? null : (
          <Alert variant="info" title="No sender is configured">
            Reminders are scheduled and never sent: the job runs with its dry run on, and nothing
            in the platform claims a delivery. A queue here is the expected state rather than a
            backlog. Choosing a transactional sender is blocked on the brand decision.
          </Alert>
        )}
        <ul className={styles.tally}>
          <li className={styles.tallyRow}>
            <span>Queued, dry run</span>
            <span className={styles.tallyCount}>{health.deliveries.pendingDryRun}</span>
          </li>
          <li className={styles.tallyRow}>
            <span>Queued, live</span>
            <span className={styles.tallyCount}>{health.deliveries.pendingLive}</span>
          </li>
          <li className={styles.tallyRow}>
            <span>Due now</span>
            <span className={styles.tallyCount}>{health.deliveries.dueNow}</span>
          </li>
          <li className={styles.tallyRow}>
            <span>Abandoned</span>
            <span className={styles.tallyCount}>{health.deliveries.terminalFailures}</span>
          </li>
          <li className={styles.tallyRow}>
            <span>Withdrawn</span>
            <span className={styles.tallyCount}>{health.deliveries.withdrawn}</span>
          </li>
        </ul>
        {health.deliveries.oldestPendingScheduledFor ? (
          <p className={styles.caption}>
            The oldest queued reminder was scheduled for{' '}
            {when(health.deliveries.oldestPendingScheduledFor)}.
          </p>
        ) : null}
      </div>

      {health.asOf ? <p className={styles.caption}>Read at {when(health.asOf)}.</p> : null}
    </>
  )
}

/**
 * Three states rather than two. A job whose status could not be read is
 * `unknown`, and must not share a presentation with one measured as absent.
 */
function jobState(active: boolean, missing: readonly string[] | null): string {
  if (missing === null) return 'unknown'
  return active ? 'active' : 'absent'
}

function Figure({
  label,
  value,
  tone = 'quiet',
}: {
  label: string
  value: string
  tone?: 'quiet' | 'alert'
}) {
  return (
    <div className={styles.figure} data-tone={tone}>
      <dt className={styles.figureLabel}>{label}</dt>
      <dd className={styles.figureValue}>{value}</dd>
    </div>
  )
}
