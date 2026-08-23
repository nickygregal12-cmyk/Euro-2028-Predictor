// A claimed reminder row -> a notification event, as a pure decision.
//
// Extracted for the same reason `provider-poll/authorization.ts` is: `index.ts`
// calls `Deno.serve` at module scope and exports nothing, so it cannot be
// imported by the Vitest suite. This module holds every judgement the dispatch
// loop makes, so each one is assertable with fabricated input and no runtime.
//
// The scope is deliberately narrow. `public.reminder_deliveries` schedules
// DEADLINE reminders — `reminder_kind` is `deadline` or `final_call` — so those
// are the only events wired. The other seventeen kinds in the taxonomy stay
// defined and unemitted until something actually produces rows for them;
// inventing a scheduler for them here would be building a second authority
// beside a ledger that already exists.
//
// NOTHING IS INVENTED. Where the ledger and the action item do not between them
// supply a required field, the row is REJECTED with a reason rather than sent
// with a plausible guess. A reminder naming the wrong matchweek is worse than a
// reminder that did not go out, because the second one gets retried and the
// first one gets believed.

import type { NotificationEvent } from '../_shared/notifications/notificationEvents.ts'

/** One row of `public.claim_due_reminders`. */
export interface ClaimedReminder {
  readonly id: string
  readonly user_id: string
  readonly email: string | null
  readonly action_key: string
  readonly reminder_kind: string
  readonly deadline_at: string
  readonly attempts: number
  readonly dry_run: boolean
  /**
   * Contract 217. Which channel the claim chose for THIS attempt, decided from
   * the player's live push subscriptions rather than fixed when the reminder
   * was scheduled. The dispatcher performs it and does not decide again.
   */
  readonly channel: 'email' | 'push'
}

/** The `public.player_action_items` row the reminder's `action_key` names. */
export interface ActionItem {
  readonly action_type: string
  readonly tournament_id: string
  readonly competition_id: string | null
  readonly context: Record<string, unknown> | null
}

export type ReminderRejection =
  /** No action item matches the reminder's (user_id, action_key). */
  | 'action-item-missing'
  /** The reminder is for something this wiring deliberately does not send. */
  | `unsupported-action-type:${string}`
  /** `reminder_kind` is outside the ledger's own check constraint. */
  | `unsupported-reminder-kind:${string}`
  /** The action item carries no matchweek, so the event cannot be built. */
  | 'matchweek-unavailable'

export type ReminderMapping =
  | { readonly ok: true; readonly event: NotificationEvent }
  | { readonly ok: false; readonly reason: ReminderRejection }

/**
 * The only action type this wiring sends for.
 *
 * `lms_pick_due`, `cup_penalty_number_due`, `matchweek_settled`,
 * `game_consequence` and `league_invitation` are all real action types with
 * plausible-looking homes in the taxonomy, and none of them is wired: each
 * needs its own evidence about what the notification should say, and guessing
 * is how a player gets told something the domain never claimed.
 */
const SUPPORTED_ACTION_TYPE = 'matchweek_predictions_due'

/** Reads a positive integer from the action item's untyped context blob. */
function integerFrom(context: Record<string, unknown> | null, key: string): number | null {
  const value = context?.[key]
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value
  // Numbers arriving as JSON strings are accepted; anything else is not
  // coerced, because `Number('')` is 0 and that would invent a matchweek zero.
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return null
}

/**
 * Map one claimed reminder onto the event to deliver.
 *
 * `occurredAt` is supplied by the caller rather than read from a clock here, so
 * the mapping stays pure and a test can assert an exact payload.
 */
export function mapReminderToEvent(
  reminder: ClaimedReminder,
  actionItem: ActionItem | null,
  occurredAt: string,
): ReminderMapping {
  if (!actionItem) return { ok: false, reason: 'action-item-missing' }

  if (actionItem.action_type !== SUPPORTED_ACTION_TYPE) {
    return {
      ok: false,
      reason: `unsupported-action-type:${actionItem.action_type}`,
    }
  }

  const matchweek = integerFrom(actionItem.context, 'matchweek')
  if (matchweek === null) return { ok: false, reason: 'matchweek-unavailable' }

  // A bonus competition owns the reminder when there is one; otherwise the
  // tournament does. Both are real identifiers from the action item — neither
  // is derived, and `competitionId` is never left blank.
  const competitionId = actionItem.competition_id ?? actionItem.tournament_id

  // Not counted by the ledger, and not guessable. `null` is the honest answer
  // and the taxonomy carries it through as "not available" rather than zero.
  const outstandingFixtures = integerFrom(actionItem.context, 'outstandingFixtures')

  switch (reminder.reminder_kind) {
    case 'deadline':
      return {
        ok: true,
        event: {
          kind: 'prediction.window_closing',
          recipientId: reminder.user_id,
          competitionId,
          occurredAt,
          matchweek,
          closesAt: reminder.deadline_at,
          outstandingFixtures,
        },
      }
    case 'final_call':
      // The last-call reminder says what is still outstanding, so it needs a
      // count. Without one it is refused rather than downgraded, because
      // "you have fixtures left" with no number is a worse notification than
      // none and would still be recorded as sent.
      if (outstandingFixtures === null) {
        return { ok: false, reason: 'matchweek-unavailable' }
      }
      return {
        ok: true,
        event: {
          kind: 'prediction.entries_outstanding',
          recipientId: reminder.user_id,
          competitionId,
          occurredAt,
          matchweek,
          outstandingFixtures,
        },
      }
    default:
      return {
        ok: false,
        reason: `unsupported-reminder-kind:${reminder.reminder_kind}`,
      }
  }
}

/**
 * Whether a claimed row may actually be sent for.
 *
 * `dry_run` is the ledger's own switch and is honoured independently of
 * `NOTIFICATIONS_DELIVERY`. Two switches, both of which must be off, is the
 * design rather than an oversight: one is a property of the scheduled row and
 * the other of the deployment.
 */
export function sendingIsPermitted(reminder: ClaimedReminder): boolean {
  return reminder.dry_run === false
}
