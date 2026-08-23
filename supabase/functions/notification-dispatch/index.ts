// Claim due reminders, send them through the notification boundary, record the
// result. The provider half of `public.reminder_deliveries`.
//
// WHAT THIS IS NOT. It is not a scheduler, a retry policy or a delivery ledger:
// contracts 163 and 172 own all three. This claims what the ledger says is due,
// asks the boundary to deliver it, and writes the answer back. Every judgement
// it makes lives in `reminderEvents.ts` so it can be tested without a runtime.
//
// FAIL CLOSED, THREE WAYS, and each one is a different question:
//   * the caller key      — may this request run at all?
//   * `dry_run` on a row  — did the ledger clear THIS reminder to send?
//   * NOTIFICATIONS_DELIVERY — is this deployment allowed to notify players?
// All three must pass. A credential in scope is not consent, and neither is a
// scheduled row.
//
// IT HAS A CALLER NOW. Contract 216 schedules `player-reminder-dispatch`, which
// posts a run id here every five minutes.
//
// AND FROM CONTRACT 217 IT HAS TWO CHANNELS. The claimed row names one — `push`
// where the player has a live subscription, `email` otherwise — and this
// function performs whichever it was handed. Each channel needs its own
// credential, so the deployment gate now asks whether ANY sender is configured
// and each row is refused by name where its own is not. Web push needs no
// provider account: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and
// `VAPID_SUBJECT` are generated once by an operator and belong to nobody else.
//
// A run id arrives in the body and MUST be closed on every path this function
// can reach, including the refusals. That is the half the delivery ledger
// cannot record: the deployment gate refuses before anything is claimed, so
// `reminder_deliveries` is left with nothing to show for it. See
// docs/ops/notification-delivery.md.

import { authorized } from '../_shared/callerAuthorization.ts'
import type { NotificationEvent } from '../_shared/notifications/notificationEvents.ts'
import { buildPushPayload } from '../_shared/push/pushPayload.ts'
import {
  sendWebPush,
  summarisePushOutcomes,
  type PushOutcome,
  type StoredPushSubscription,
  type VapidKeys,
} from '../_shared/push/webPush.ts'
import {
  mapReminderToEvent,
  sendingIsPermitted,
  type ActionItem,
  type ClaimedReminder,
} from './reminderEvents.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

// Underscored, not the function slug: Supabase rejects a hyphen in a secret key
// name. `provider-poll` learned this the hard way and the symptom was a 500
// about a missing key, so it is stated here rather than rediscovered.
const CALLER_KEY_NAME = 'notification_dispatch'
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }
const DEFAULT_BATCH = 25

interface DispatchSummary {
  claimed: number
  delivered: number
  refused: number
  skipped: number
  /** Contract 217. Which channel carried what, so a run says more than a total. */
  deliveredByEmail: number
  deliveredByPush: number
}

/** The dispatcher's whole body: the run this invocation belongs to. */
interface DispatchRequest {
  runId?: unknown
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function required(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

/**
 * This deployment's push identity, or null where an operator has not set one.
 *
 * ALL THREE OR NONE. A public key without its private key signs nothing, and a
 * pair without a subject is refused by some push services and accepted by
 * others — a half-configured channel that fails only in production is worse
 * than one that is plainly off.
 */
function readVapidKeys(): VapidKeys | null {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')?.trim()
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')?.trim()
  const subject = Deno.env.get('VAPID_SUBJECT')?.trim()
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

/** Call a Postgres function as the service role. */
async function rpc(
  supabaseUrl: string,
  serviceKey: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  if (!response.ok) {
    // The body is not echoed: a PostgREST error quotes the request, and these
    // requests carry player identifiers.
    throw new Error(`${name} failed with ${response.status}`)
  }
  return await response.json()
}

/** The action item a reminder names, or null when there is none. */
async function readActionItem(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  actionKey: string,
): Promise<ActionItem | null> {
  const query = new URLSearchParams({
    select: 'action_type,tournament_id,competition_id,context',
    user_id: `eq.${userId}`,
    action_key: `eq.${actionKey}`,
    limit: '1',
  })
  const response = await fetch(
    `${supabaseUrl}/rest/v1/player_action_items?${query}`,
    {
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
      },
    },
  )
  if (!response.ok) return null
  const rows = (await response.json()) as ActionItem[]
  return rows[0] ?? null
}

/**
 * Every browser this player has granted permission to.
 *
 * Read at send time by the same service-role REST route `readActionItem` uses.
 * The keys are deliberately not carried on the claimed row: a claim returns one
 * row per reminder and a player may have three devices, and widening the claim
 * to a key-bearing join would put credentials-shaped values in the ledger's own
 * return for every row whether or not it is going by push.
 */
async function readPushSubscriptions(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
): Promise<StoredPushSubscription[]> {
  const query = new URLSearchParams({
    select: 'endpoint,p256dh,auth',
    user_id: `eq.${userId}`,
  })
  const response = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?${query}`, {
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
  })
  if (!response.ok) return []
  return (await response.json()) as StoredPushSubscription[]
}

/**
 * Deliver one reminder to every device the player has, and prune the dead ones.
 *
 * PRUNING HAPPENS ON 404 AND 410 ONLY, which `sendWebPush` is the single place
 * that decides. Deleting on a 500 would let a push service having a bad ten
 * minutes opt every player out of a channel they chose, and the row would then
 * be gone before anybody noticed.
 */
async function deliverByPush(
  supabaseUrl: string,
  serviceKey: string,
  reminder: ClaimedReminder,
  event: NotificationEvent,
  keys: VapidKeys,
): Promise<{ delivered: boolean; reason: string | null }> {
  // The SAME event the email channel would have sent, worded for a lock screen
  // instead of for an inbox. Building a second event here would be a second
  // answer to "what is this reminder about".
  const mapped = buildPushPayload(event)
  if (!mapped.ok) return { delivered: false, reason: mapped.reason }

  const subscriptions = await readPushSubscriptions(supabaseUrl, serviceKey, reminder.user_id)
  const nowSeconds = Math.floor(Date.now() / 1000)
  // Never outlive the deadline it is about. A reminder held by a push service
  // and delivered after the lock is worse than one that never arrived.
  const ttlSeconds = Math.floor(
    (new Date(reminder.deadline_at).getTime() - Date.now()) / 1000,
  )

  const outcomes: PushOutcome[] = []
  for (const subscription of subscriptions) {
    const outcome = await sendWebPush({
      subscription,
      payload: JSON.stringify(mapped.payload),
      keys,
      ttlSeconds,
      nowSeconds,
    })
    outcomes.push(outcome)
    if (outcome.kind === 'gone') {
      await rpc(supabaseUrl, serviceKey, 'prune_push_subscription', {
        p_endpoint: subscription.endpoint,
      }).catch((error) => {
        // A prune that fails costs one wasted attempt on the next run, which is
        // strictly better than failing a delivery that already succeeded.
        console.error('could not prune a dead endpoint:', (error as Error).message)
      })
    }
  }

  return summarisePushOutcomes(outcomes)
}

/**
 * Close the run the dispatcher opened.
 *
 * Optional on purpose. A `curl` during an investigation has no run to close and
 * refusing it would make this function untestable by hand; a scheduled call
 * always carries one.
 *
 * A failure to close is logged and swallowed. An unreported run is ALREADY the
 * signal for "the sender did not come back", so failing the dispatch because
 * the bookkeeping failed would turn an observability problem into a delivery
 * one.
 */
async function closeRun(
  supabaseUrl: string,
  serviceKey: string,
  runId: string | null,
  outcome: 'completed' | 'delivery-disabled',
  summary: DispatchSummary | null,
  detail: string | null,
): Promise<void> {
  if (!runId) return
  try {
    await rpc(supabaseUrl, serviceKey, 'record_reminder_dispatch_run', {
      p_run_id: runId,
      p_outcome: outcome,
      p_claimed: summary?.claimed ?? 0,
      p_delivered: summary?.delivered ?? 0,
      p_refused: summary?.refused ?? 0,
      p_skipped: summary?.skipped ?? 0,
      p_detail: detail,
    })
  } catch (error) {
    console.error('could not close dispatch run:', (error as Error).message)
  }
}

Deno.serve(async (request: Request) => {
  let callerKey: string
  try {
    callerKey = required(CALLER_KEY_NAME)
  } catch {
    return json({ error: 'caller key is not configured' }, 500)
  }

  // Refused identically to a wrong key, so the response cannot distinguish
  // "no header" from "wrong header".
  if (!authorized(request, callerKey)) {
    return json({ error: 'unauthorized' }, 401)
  }

  let supabaseUrl: string
  let serviceKey: string
  try {
    supabaseUrl = required('SUPABASE_URL')
    serviceKey = required('SUPABASE_SERVICE_ROLE_KEY')
  } catch (error) {
    return json({ error: (error as Error).message }, 500)
  }

  // The deployment-level switch. Checked BEFORE anything is claimed, so an
  // unauthorised deployment does not move rows into `sending` and then decline
  // to send them.
  // Read AFTER the caller key check, deliberately. An unauthorised caller must
  // not be able to write to the run ledger, so a run posted with a wrong key
  // stays open and shows up as unreported — which is the honest picture: the
  // database asked, and nothing it trusts answered.
  const requested = (await request.json().catch(() => ({}))) as DispatchRequest
  const runId = typeof requested.runId === 'string' ? requested.runId : null

  const deliveryEnabled =
    Deno.env.get('NOTIFICATIONS_DELIVERY')?.trim().toLowerCase() === 'enabled'
  const novuApiKey = Deno.env.get('NOVU_API_KEY')?.trim()
  const vapidKeys = readVapidKeys()

  // TWO GATES, NOT ONE, from contract 217. `NOTIFICATIONS_DELIVERY` is consent
  // and is not negotiable; a credential is capability, and there are now two
  // channels that could supply it. A deployment with VAPID keys and no email
  // provider is a working deployment, which is the point of adding push.
  if (!deliveryEnabled || (!novuApiKey && !vapidKeys)) {
    // WHICH sender is missing, never what any of them contains. Whether a
    // credential is present is an operations fact; its value is not.
    await closeRun(
      supabaseUrl,
      serviceKey,
      runId,
      'delivery-disabled',
      null,
      `deliveryEnabled=${deliveryEnabled} emailSender=${Boolean(novuApiKey)} ` +
        `pushSender=${Boolean(vapidKeys)}`,
    )
    return json(
      {
        error: 'delivery is not authorised for this deployment',
        deliveryEnabled,
        // Kept under its old name: contract 216's operations documentation and
        // the run ledger's detail strings both read it, and renaming a field
        // to add a sibling is a change nobody asked for.
        credentialPresent: Boolean(novuApiKey),
        pushCredentialPresent: Boolean(vapidKeys),
      },
      503,
    )
  }

  const apiOrigin =
    Deno.env.get('NOVU_API_ORIGIN')?.trim() || 'https://api.novu.co'

  const summary: DispatchSummary = {
    claimed: 0,
    delivered: 0,
    refused: 0,
    skipped: 0,
    deliveredByEmail: 0,
    deliveredByPush: 0,
  }

  // `false` means "this sender imposes no dry run of its own". Before contract
  // 216 it CLEARED the ledger's own flag and handed back its own answer, which
  // is why `sendingIsPermitted` below could never refuse. The claim tightens
  // and never clears now, so the row's own value survives and this argument
  // finally reads as it always looked.
  const claimed = (await rpc(supabaseUrl, serviceKey, 'claim_due_reminders', {
    p_limit: DEFAULT_BATCH,
    p_dry_run: false,
  })) as ClaimedReminder[]

  summary.claimed = claimed.length

  for (const reminder of claimed) {
    // One clock read per row, passed into the pure mapper rather than read
    // inside it.
    const occurredAt = new Date().toISOString()

    if (!sendingIsPermitted(reminder)) {
      summary.skipped += 1
      await rpc(supabaseUrl, serviceKey, 'record_reminder_result', {
        p_id: reminder.id,
        p_sent: false,
        // The channel the row was claimed for. Recording every dry run as
        // `novu` would make the ledger say a push reminder went nowhere by
        // email, which is two wrong facts rather than one missing one.
        p_provider: reminder.channel === 'push' ? 'web-push' : 'novu',
        p_provider_message_id: null,
        p_error: 'ledger-dry-run',
      })
      continue
    }

    const actionItem = await readActionItem(
      supabaseUrl,
      serviceKey,
      reminder.user_id,
      reminder.action_key,
    )
    const mapped = mapReminderToEvent(reminder, actionItem, occurredAt)

    if (!mapped.ok) {
      summary.refused += 1
      // Recorded as not sent WITH the reason, so an unwired action type shows
      // up in the ledger as a named refusal rather than as a mystery.
      await rpc(supabaseUrl, serviceKey, 'record_reminder_result', {
        p_id: reminder.id,
        p_sent: false,
        p_provider: reminder.channel === 'push' ? 'web-push' : 'novu',
        p_provider_message_id: null,
        p_error: mapped.reason,
      })
      continue
    }

    // WHICHEVER CHANNEL THE LEDGER CHOSE. The claim decided it from the live
    // subscriptions, and this function performs it rather than deciding again:
    // a second opinion here could send by email a reminder the ledger recorded
    // as push, and the ledger is what an operator reads.
    if (reminder.channel === 'push') {
      if (!vapidKeys) {
        // Named, not silent. A row claimed as push in a deployment with no
        // push credential is a configuration gap, and the retry will say email
        // only once the player's last device is pruned — which it is not.
        summary.refused += 1
        await rpc(supabaseUrl, serviceKey, 'record_reminder_result', {
          p_id: reminder.id,
          p_sent: false,
          p_provider: 'web-push',
          p_provider_message_id: null,
          p_error: 'push-sender-not-configured',
        })
        continue
      }

      const push = await deliverByPush(
        supabaseUrl,
        serviceKey,
        reminder,
        mapped.event,
        vapidKeys,
      )

      if (push.delivered) {
        summary.delivered += 1
        summary.deliveredByPush += 1
      } else {
        summary.refused += 1
      }

      await rpc(supabaseUrl, serviceKey, 'record_reminder_result', {
        p_id: reminder.id,
        p_sent: push.delivered,
        p_provider: 'web-push',
        // A push service issues no message id, so there is none to record.
        // Inventing one would put a value in the ledger no support enquiry
        // could ever look up.
        p_provider_message_id: null,
        p_error: push.reason,
      })
      continue
    }

    if (!novuApiKey) {
      summary.refused += 1
      await rpc(supabaseUrl, serviceKey, 'record_reminder_result', {
        p_id: reminder.id,
        p_sent: false,
        p_provider: 'novu',
        p_provider_message_id: null,
        p_error: 'email-sender-not-configured',
      })
      continue
    }

    // Imported here rather than at module scope: the adapter refuses to be
    // constructed where a DOM exists, and this keeps the boundary's own
    // browser guard the single place that rule lives.
    const { createNovuNotificationService } = await import(
      '../_shared/notifications/novuAdapter.ts'
    )
    const service = createNovuNotificationService({
      apiKey: novuApiKey,
      apiOrigin,
      environmentLabel: Deno.env.get('NOTIFICATIONS_ENVIRONMENT')?.trim() || 'unknown',
    })

    const outcome = await service.deliver(mapped.event)

    if (outcome.delivered) {
      summary.delivered += 1
      summary.deliveredByEmail += 1
    } else {
      summary.refused += 1
    }

    await rpc(supabaseUrl, serviceKey, 'record_reminder_result', {
      p_id: reminder.id,
      p_sent: outcome.delivered,
      p_provider: 'novu',
      // Novu's own transaction id when it gave one. Never this boundary's
      // idempotency key, which Novu did not issue.
      p_provider_message_id: outcome.delivered ? outcome.providerMessageId : null,
      p_error: outcome.delivered ? null : outcome.reason,
    })
  }

  await closeRun(supabaseUrl, serviceKey, runId, 'completed', summary, null)

  return json(summary, 200)
})
