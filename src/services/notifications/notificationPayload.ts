/**
 * Domain event -> provider-neutral delivery payload.
 *
 * Pure. No network, no clock, no storage, no React, no provider SDK. That is
 * what makes the mapping testable without a Novu account, and what stops a
 * delivery outage from being able to change what an event MEANS.
 *
 * A malformed event produces a typed rejection rather than an exception or a
 * half-built payload. Notification delivery is a background concern: it must
 * fail quietly and visibly, never take a request down with it.
 */

import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationEvent,
  type NotificationEventKind,
} from './notificationEvents'

/**
 * What a provider adapter receives. Deliberately flat and primitive-valued:
 * anything a template can interpolate, and nothing a provider has to
 * understand about football.
 */
export interface NotificationPayload {
  /** Stable per-kind workflow identifier the provider triggers. */
  readonly workflowId: string
  readonly recipientId: string
  readonly category: NotificationCategory
  readonly occurredAt: string
  /**
   * Idempotency key. Two attempts to deliver the same domain fact to the same
   * player must collapse to one notification, so retries and overlapping
   * schedulers cannot produce duplicates.
   */
  readonly transactionId: string
  readonly data: Readonly<Record<string, string | number | boolean | null>>
}

export type PayloadRejectionReason =
  | 'unknown-kind'
  | 'missing-recipient'
  | 'missing-competition'
  | 'invalid-timestamp'

export type PayloadResult =
  | { readonly ok: true; readonly payload: NotificationPayload }
  | { readonly ok: false; readonly reason: PayloadRejectionReason }

/**
 * Workflow identifiers.
 *
 * Kept as an explicit total map rather than a string transformation of the
 * kind. A generated identifier silently changes when an event kind is renamed,
 * which would repoint delivery at a workflow that does not exist while every
 * type still checks.
 */
const WORKFLOW_IDS: Record<NotificationEventKind, string> = {
  'prediction.window_closing': 'predictions-window-closing',
  'prediction.entries_outstanding': 'predictions-entries-outstanding',
  'prediction.locked': 'predictions-locked',
  'matchweek.opened': 'predictions-matchweek-opened',
  'league.invitation_received': 'leagues-invitation-received',
  'league.rank_changed': 'leagues-rank-changed',
  'league.overtaken': 'leagues-overtaken',
  'league.rival_moved': 'leagues-rival-moved',
  'social.followed_player_activity': 'social-followed-player-activity',
  'social.head_to_head_moved': 'social-head-to-head-moved',
  'lms.round_opened': 'lms-round-opened',
  'lms.selection_confirmed': 'lms-selection-confirmed',
  'lms.survived': 'lms-survived',
  'lms.eliminated': 'lms-eliminated',
  'lms.next_round_available': 'lms-next-round-available',
  'results.matchweek_points': 'results-matchweek-points',
  'results.exact_score': 'results-exact-score',
  'results.rank_movement': 'results-rank-movement',
  'results.competition_milestone': 'results-competition-milestone',
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoInstant(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false
  const parsed = Date.parse(value)
  return Number.isFinite(parsed)
}

/**
 * The event's own fields, minus the ones every event carries.
 *
 * Those three are represented on the payload directly, so repeating them
 * inside `data` would give a template two places to read the same fact from.
 */
function eventData(
  event: NotificationEvent,
): Record<string, string | number | boolean | null> {
  const data: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(event)) {
    if (key === 'kind' || key === 'recipientId' || key === 'occurredAt') continue
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      // `null` is copied through deliberately. It means "not available", and a
      // template that renders it as 0 or "" is stating something the domain
      // did not.
      data[key] = value
    }
  }
  return data
}

/**
 * A stable key for one domain fact reaching one player.
 *
 * Built from the fields that identify the fact rather than from a random value
 * or the wall clock, so the same event mapped twice yields the same key and the
 * provider can collapse the duplicate.
 */
function transactionId(event: NotificationEvent): string {
  const discriminators = Object.entries(event)
    .filter(([key]) => key !== 'recipientId' && key !== 'kind')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('|')

  return `${event.kind}:${event.recipientId}:${discriminators}`
}

/**
 * Map one domain event onto a delivery payload.
 *
 * Validation is structural only. This function does not decide whether the
 * event is TRUE — that was settled by whichever authority emitted it — it
 * decides whether it is well-formed enough to hand to a provider.
 */
export function buildNotificationPayload(
  event: NotificationEvent,
): PayloadResult {
  const workflowId = WORKFLOW_IDS[event.kind]
  const category = NOTIFICATION_CATEGORIES[event.kind]
  // Guards against an event arriving across a boundary the types did not
  // police, such as a queue payload or a database row.
  if (!workflowId || !category) return { ok: false, reason: 'unknown-kind' }

  if (!isNonEmptyString(event.recipientId)) {
    return { ok: false, reason: 'missing-recipient' }
  }
  if (!isNonEmptyString(event.competitionId)) {
    return { ok: false, reason: 'missing-competition' }
  }
  if (!isIsoInstant(event.occurredAt)) {
    return { ok: false, reason: 'invalid-timestamp' }
  }

  return {
    ok: true,
    payload: {
      workflowId,
      recipientId: event.recipientId,
      category,
      occurredAt: event.occurredAt,
      transactionId: transactionId(event),
      data: eventData(event),
    },
  }
}
