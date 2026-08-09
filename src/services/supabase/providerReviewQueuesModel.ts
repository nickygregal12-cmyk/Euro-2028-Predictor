/**
 * Provider review queue parsing (contract 138). Pure: no Supabase import, no
 * network, no clock.
 *
 * FIVE QUEUES AND TWO THINGS THAT ARE NOT QUEUES, and keeping them apart is
 * most of what this file does.
 *
 * The five carry an unreviewed count and can be acknowledged: result refusals,
 * status observations, consumption problems, kickoff revisions and window
 * conflicts. `pending_calendar_proposals` is a COUNT ONLY — contract 132's
 * proposals have their own approve/reject lifecycle and acknowledging one would
 * be a second decision path over the same rows. `recent_result_changes` is an
 * audit trail rather than a queue: it has no unreviewed count and nothing to
 * acknowledge, because a recorded correction is history, not work.
 *
 * THE ITEM DETAIL IS KEPT AS THE SERVER SENT IT. Each queue's rows differ —
 * a kickoff revision has two instants, a window conflict has four and a round
 * that blocked it, a consumption problem has a free-form report — and inventing
 * one shape for all five would either lose fields or invent them. So the shared
 * part is modelled (id, when, and a one-line summary the surface can list) and
 * the rest travels as the raw record for a detail view to read. A parser that
 * flattened a report into a string would be deciding what an operator needs to
 * see about a failure it has never met.
 */

export type ReviewQueueKind =
  | 'result_refusal'
  | 'status_observation'
  | 'consumption'
  | 'kickoff_revision'
  | 'window_conflict'

export type ReviewQueueItem = {
  id: string
  /** When it happened, whatever the queue calls its timestamp. */
  at: string | null
  /** One line an operator can scan. Composed here from the queue's own fields. */
  summary: string
  /** Everything the server sent, for a detail view. Never re-shaped. */
  detail: Record<string, unknown>
}

export type ReviewQueue = {
  kind: ReviewQueueKind
  /** The server's count of everything unreviewed, which may exceed `items`. */
  unreviewed: number
  items: readonly ReviewQueueItem[]
}

export type ProviderReviewQueues = {
  competition: { id: string; name: string; seasonKey: string }
  limit: number
  queues: readonly ReviewQueue[]
  /** Contract 132's staged calendar. A count only; it has its own lifecycle. */
  pendingCalendarProposals: number
  /** Contract 125's audit trail. History, not work. */
  recentResultChanges: readonly ReviewQueueItem[]
  /** True when nothing anywhere needs a person. */
  clear: boolean
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function integerOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function fixtureName(value: unknown): string | null {
  const fixture = objectOf(value)
  const home = stringOrNull(fixture.home)
  const away = stringOrNull(fixture.away)
  return home && away ? `${home} v ${away}` : null
}

/**
 * The one line each queue shows in a list.
 *
 * Composed per queue rather than generically, because the useful fact differs:
 * a refusal is about a reason, a revision is about two instants, a conflict is
 * about which round blocked which. A generic "item 4f2c…" would be a list
 * nobody can triage from.
 */
function summarise(kind: ReviewQueueKind, row: Record<string, unknown>): string {
  const fixture = fixtureName(row.fixture)

  switch (kind) {
    case 'result_refusal':
      return [
        fixture ?? 'A fixture',
        `— refused: ${stringOrNull(row.reason) ?? 'no reason recorded'}`,
        stringOrNull(row.provider) ? `(${String(row.provider)})` : null,
      ]
        .filter(Boolean)
        .join(' ')
    case 'status_observation':
      return `Unmapped status “${stringOrNull(row.provider_status) ?? 'unknown'}” from ${
        stringOrNull(row.provider) ?? 'a provider'
      }, on ${integerOr(row.fixtures, 0)} fixture${integerOr(row.fixtures, 0) === 1 ? '' : 's'}`
    case 'consumption':
      return `Response not consumed: ${stringOrNull(row.outcome) ?? 'unknown outcome'}`
    case 'kickoff_revision':
      return `${fixture ?? 'A fixture'} — kickoff moved by ${
        stringOrNull(row.provider) ?? 'a provider'
      }`
    case 'window_conflict':
      return `${stringOrNull(row.round) ?? 'A round'} — window refresh refused, blocked by ${
        stringOrNull(row.blocked_by) ?? 'another round'
      }`
  }
}

/** Each queue names its own timestamp; there is no shared column to read. */
const WHEN: Record<ReviewQueueKind, string> = {
  result_refusal: 'refused_at',
  status_observation: 'observed_at',
  consumption: 'consumed_at',
  kickoff_revision: 'applied_at',
  window_conflict: 'detected_at',
}

const QUEUE_KEYS: Record<ReviewQueueKind, string> = {
  result_refusal: 'result_refusals',
  status_observation: 'status_observations',
  consumption: 'consumption_problems',
  kickoff_revision: 'kickoff_revisions',
  window_conflict: 'window_conflicts',
}

function mapItem(kind: ReviewQueueKind, value: unknown): ReviewQueueItem | null {
  const row = objectOf(value)
  const id = stringOrNull(row.id)
  // No id, nothing to acknowledge. Listing it would offer an action that cannot
  // be taken.
  if (!id) return null

  return {
    id,
    at: stringOrNull(row[WHEN[kind]]),
    summary: summarise(kind, row),
    detail: row,
  }
}

function mapQueue(kind: ReviewQueueKind, value: unknown): ReviewQueue {
  const row = objectOf(value)
  const raw = Array.isArray(row.items) ? row.items : []
  return {
    kind,
    unreviewed: integerOr(row.unreviewed, 0),
    items: raw
      .map((item) => mapItem(kind, item))
      .filter((item): item is ReviewQueueItem => item !== null),
  }
}

function mapChange(value: unknown): ReviewQueueItem | null {
  const row = objectOf(value)
  const id = stringOrNull(row.id)
  if (!id) return null

  const result = objectOf(row.result)
  const score =
    typeof result.home === 'number' && typeof result.away === 'number'
      ? `${result.home}-${result.away}`
      : 'cleared'

  return {
    id,
    at: stringOrNull(row.recorded_at),
    summary: `${fixtureName(row.fixture) ?? 'A fixture'} — ${
      stringOrNull(row.action) ?? 'changed'
    } to ${score} by ${stringOrNull(row.by) ?? 'unknown'}`,
    detail: row,
  }
}

export function mapProviderReviewQueues(value: unknown): ProviderReviewQueues {
  const payload = objectOf(value)
  const competition = objectOf(payload.competition)

  const id = stringOrNull(competition.id)
  const name = stringOrNull(competition.name)
  const seasonKey = stringOrNull(competition.season_key)

  if (!id || !name || !seasonKey) {
    throw new Error('The provider review response was not in the expected shape.')
  }

  const queues = (Object.keys(QUEUE_KEYS) as ReviewQueueKind[]).map((kind) =>
    mapQueue(kind, payload[QUEUE_KEYS[kind]]),
  )

  const rawChanges = Array.isArray(payload.recent_result_changes)
    ? payload.recent_result_changes
    : []

  const pendingCalendarProposals = integerOr(payload.pending_calendar_proposals, 0)

  return {
    competition: { id, name, seasonKey },
    limit: integerOr(payload.limit, 20),
    queues,
    pendingCalendarProposals,
    recentResultChanges: rawChanges
      .map(mapChange)
      .filter((item): item is ReviewQueueItem => item !== null),
    // History does not count towards this. A season with corrections recorded
    // and nothing unreviewed needs nobody, and saying otherwise would train an
    // operator to ignore the indicator.
    clear:
      pendingCalendarProposals === 0 && queues.every((queue) => queue.unreviewed === 0),
  }
}
