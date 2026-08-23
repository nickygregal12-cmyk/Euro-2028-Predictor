/**
 * Contract 172's `admin_reminder_delivery_health`, decoded. Pure: no Supabase
 * import, no network, no clock — the configured wrapper is
 * `reminderDeliveryHealth.ts`.
 *
 * WHY THE READ EXISTS AT ALL, restated here because it is the whole reason a
 * surface must not simplify it. "No reminders are scheduled" and "the scheduler
 * is not running" are the same number read from the ledger, and that ambiguity
 * is exactly how contracts 162, 163 and 170 each shipped a generator with no
 * caller. So the jobs are reported beside the rows, and a decoder that dropped
 * either half would put the ambiguity straight back.
 *
 * `jobs: null` IS NOT `jobs: []`. The server returns null when the definer
 * could not read `cron.job` at all, and an empty array when it looked and found
 * none. "I could not look" and "there is nothing scheduled" are different
 * operational facts and are kept apart by type here, because collapsing them
 * would report a healthy platform as a broken one and a broken one as healthy.
 *
 * IT CARRIES NO PLAYER. Contract 172 returns counts, instants and job rows and
 * deliberately no user id, action key, display name, address or provider error
 * text — a reminder is about a named player's outstanding pick, so a health
 * read that named rows would be a disclosure surface wearing an operations
 * badge. There is nothing in this file that could decode one, and nothing may
 * be added that does.
 *
 * `senderConfigured` IS STATED BY THE SERVER, NEVER INFERRED. A ledger with no
 * live rows reads identically whether nothing has been queued yet or no sender
 * exists to queue for, and only the second is `SITE-007`. The server says which
 * it is; this reads that word rather than guessing from a zero.
 */

export type ReminderJob = {
  name: string
  /** The stored cron expression, verbatim. Never parsed or re-described. */
  schedule: string
  active: boolean
}

export type ReminderDeliveryCounts = {
  total: number
  /** Rows by the server's own status token, whatever tokens it used. */
  byStatus: Readonly<Record<string, number>>
  pendingLive: number
  pendingDryRun: number
  dueNow: number
  inFlight: number
  /** A sender that died mid-delivery. With no sender at all this stays zero. */
  stalledOverAnHour: number
  oldestPendingScheduledFor: string | null
  lastUpdatedAt: string | null
  terminalFailures: number
  withdrawn: number
  maxAttemptsSeen: number
}

export type ActionCentreCounts = {
  total: number
  open: number
  completed: number
  invalidated: number
  /** Open items by action type, using the server's own type tokens. */
  byType: Readonly<Record<string, number>>
  lastGeneratedAt: string | null
  /** The expiry sweep failing to close an item. Zero is the only right value. */
  openPastDeadline: number
}

/**
 * Why a sender is or is not configured, which is three answers and not two.
 *
 * `configured: false` with no error means no secrets. `configured: false` WITH
 * an error means a sender that cannot start — an endpoint recorded with the
 * wrong scheme, say. Collapsing the second into the first would tell an
 * administrator "no sender" when the truth is "a sender you have already set up
 * and which is refusing", and send them to the wrong place entirely.
 *
 * `jobActive: null` is "could not read `cron.job`", never "the job is off".
 */
export type ReminderSenderConfiguration = {
  configured: boolean
  secretsPresent: boolean
  jobActive: boolean | null
  error: string | null
}

/**
 * What the dispatch job has been doing, which the DELIVERY ledger cannot say.
 *
 * The deployment gate refuses before anything is claimed, so a refused run
 * leaves no row in `reminder_deliveries` at all. Without these counts a correct
 * silent refusal and a dead cron job are the same picture.
 */
export type ReminderDispatchHealth = {
  runsTotal: number
  runsLastHour: number
  /** Posted and never answered: an unreachable endpoint or a rejected key. */
  unreportedOverTenMinutes: number
  lastRequestedAt: string | null
  lastReportedAt: string | null
  lastConfigured: boolean | null
  /** The server's own outcome token, or null while a run is still open. */
  lastOutcome: string | null
  lastDueAtRequest: number | null
  lastClaimed: number | null
  lastDelivered: number | null
  lastRefused: number | null
  lastSkipped: number | null
  /** This database's own string. Never a provider's message about a person. */
  lastDetail: string | null
  deliveryDisabledLastHour: number
  notConfiguredLastHour: number
}

export type ReminderDeliveryHealth = {
  asOf: string | null
  /** Null when the read could not see `cron.job`; `[]` when it saw none. */
  jobs: readonly ReminderJob[] | null
  actions: ActionCentreCounts
  deliveries: ReminderDeliveryCounts
  senderConfigured: boolean
  /** Null when the server is older than contract 216 and said nothing. */
  sender: ReminderSenderConfiguration | null
  /** Null when the read could not look, which is not "no runs". */
  dispatch: ReminderDispatchHealth | null
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function countOf(value: unknown): number {
  // A count is a non-negative integer or it is not a count. Anything else
  // decodes to zero rather than to NaN, which would render as "NaN pending".
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function tallyOf(value: unknown): Readonly<Record<string, number>> {
  const row = objectOf(value)
  const out: Record<string, number> = {}
  for (const [key, count] of Object.entries(row)) {
    if (typeof count === 'number' && Number.isInteger(count) && count >= 0) out[key] = count
  }
  return out
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function countOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function mapSender(value: unknown): ReminderSenderConfiguration | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  return {
    // Absent decodes to false. Claiming a sender exists because a field was
    // missing is the one wrong answer here.
    configured: row.configured === true,
    secretsPresent: row.secrets_present === true,
    jobActive: booleanOrNull(row.job_active),
    error: stringOrNull(row.error),
  }
}

function mapDispatch(value: unknown): ReminderDispatchHealth | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  return {
    runsTotal: countOf(row.runs_total),
    runsLastHour: countOf(row.runs_last_hour),
    unreportedOverTenMinutes: countOf(row.unreported_over_ten_minutes),
    lastRequestedAt: stringOrNull(row.last_requested_at),
    lastReportedAt: stringOrNull(row.last_reported_at),
    lastConfigured: booleanOrNull(row.last_configured),
    lastOutcome: stringOrNull(row.last_outcome),
    // Null, not zero. "The run reported nothing yet" and "it claimed none" are
    // different facts and only one of them means the sender answered.
    lastDueAtRequest: countOrNull(row.last_due_at_request),
    lastClaimed: countOrNull(row.last_claimed),
    lastDelivered: countOrNull(row.last_delivered),
    lastRefused: countOrNull(row.last_refused),
    lastSkipped: countOrNull(row.last_skipped),
    lastDetail: stringOrNull(row.last_detail),
    deliveryDisabledLastHour: countOf(row.delivery_disabled_last_hour),
    notConfiguredLastHour: countOf(row.not_configured_last_hour),
  }
}

function mapJob(value: unknown): ReminderJob | null {
  const row = objectOf(value)
  const name = stringOrNull(row.jobname)
  if (name === null) return null
  return {
    name,
    schedule: stringOrNull(row.schedule) ?? '',
    // Absent is not active. A job whose flag this build cannot read must not be
    // rendered as running, because "running" is the reassuring answer.
    active: row.active === true,
  }
}

export function mapReminderDeliveryHealth(value: unknown): ReminderDeliveryHealth {
  const row = objectOf(value)
  const deliveries = objectOf(row.deliveries)
  const actions = objectOf(row.actions)

  return {
    asOf: stringOrNull(row.as_of),
    jobs: Array.isArray(row.jobs)
      ? row.jobs.map(mapJob).filter((job): job is ReminderJob => job !== null)
      : null,
    actions: {
      total: countOf(actions.total),
      open: countOf(actions.open),
      completed: countOf(actions.completed),
      invalidated: countOf(actions.invalidated),
      byType: tallyOf(actions.by_type),
      lastGeneratedAt: stringOrNull(actions.last_generated_at),
      openPastDeadline: countOf(actions.open_past_deadline),
    },
    deliveries: {
      total: countOf(deliveries.total),
      byStatus: tallyOf(deliveries.by_status),
      pendingLive: countOf(deliveries.pending_live),
      pendingDryRun: countOf(deliveries.pending_dry_run),
      dueNow: countOf(deliveries.due_now),
      inFlight: countOf(deliveries.in_flight),
      stalledOverAnHour: countOf(deliveries.stalled_over_an_hour),
      oldestPendingScheduledFor: stringOrNull(deliveries.oldest_pending_scheduled_for),
      lastUpdatedAt: stringOrNull(deliveries.last_updated_at),
      terminalFailures: countOf(deliveries.terminal_failures),
      withdrawn: countOf(deliveries.withdrawn),
      maxAttemptsSeen: countOf(deliveries.max_attempts_seen),
    },
    // Absent decodes to false. Claiming a sender exists because a field was
    // missing is the one wrong answer here.
    senderConfigured: row.sender_configured === true,
    sender: mapSender(row.sender),
    dispatch: mapDispatch(row.dispatch),
  }
}

/**
 * The four jobs the reminder path needs, by the names their contracts gave them.
 *
 * NAMED RATHER THAN COUNTED, so a surface can say WHICH one is missing. A
 * count of two out of three tells an operator that something is wrong and not
 * what to restart.
 */
const REMINDER_JOB_NAMES = [
  'player-action-centre-generate',
  'player-reminder-schedule',
  'player-reminder-reclaim-stalled',
  // Contract 216. The one that calls the sender; without it the other three
  // fill a queue nothing empties.
  'player-reminder-dispatch',
] as const

export type ReminderJobHealth = {
  /** Every expected job, present or not, in the contract's own order. */
  jobs: readonly { name: string; schedule: string | null; active: boolean }[]
  /** Null when `cron.job` could not be read: unknown, never "none scheduled". */
  missing: readonly string[] | null
}

/**
 * The scheduler's state, expressed as the four jobs that should exist rather
 * than as the rows that happen to be there.
 *
 * A job the server did not return is reported as absent BY NAME, and the whole
 * answer degrades to `missing: null` when the read could not see the table —
 * because an unreadable `cron.job` produces exactly the same empty list as a
 * scheduler that was never installed.
 */
export function presentReminderJobs(health: ReminderDeliveryHealth): ReminderJobHealth {
  const known = new Map((health.jobs ?? []).map((job) => [job.name, job]))
  return {
    jobs: REMINDER_JOB_NAMES.map((name) => {
      const job = known.get(name)
      return {
        name,
        schedule: job?.schedule || null,
        active: job?.active === true,
      }
    }),
    missing:
      health.jobs === null
        ? null
        : REMINDER_JOB_NAMES.filter((name) => known.get(name)?.active !== true),
  }
}
