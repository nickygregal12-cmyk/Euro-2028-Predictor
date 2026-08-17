/**
 * The provider-neutral notification boundary.
 *
 * Application code depends on `NotificationService` and on nothing else in
 * this directory. The Novu adapter is one implementation behind it, and the
 * default is a service that delivers nothing.
 *
 * **Fail closed, and be loud about which door is shut.** An unconfigured
 * deployment does not send. A deployment that has credentials but has not been
 * given explicit delivery authority does not send either. Every refusal carries
 * a reason, because "nothing arrived" with no explanation is the hardest
 * possible thing to debug.
 *
 * **Ordinary rendering never depends on this.** No page, route, Storybook story
 * or vNext component may import it. Notification delivery being unavailable is
 * not a reason a player cannot see their predictions.
 *
 * **Scheduling, retry and the audit trail are NOT this module's job.**
 * `public.reminder_deliveries` (contracts 163 and 172) already owns when a
 * reminder is due, claiming it, counting attempts, abandoning it and
 * reclaiming stalled rows. This boundary is the provider half that ledger has
 * always been missing — so a retry loop, an attempt counter or a delivery
 * table added here would be a second authority for something already settled.
 * `docs/ops/notification-delivery.md` has the seam.
 */

import {
  buildNotificationPayload,
  type NotificationPayload,
  type PayloadRejectionReason,
} from './notificationPayload'
import type { NotificationEvent } from './notificationEvents'

export type DeliveryOutcome =
  | {
      readonly delivered: true
      /** This boundary's own idempotency key for the fact. */
      readonly transactionId: string
      /**
       * The provider's identifier for the accepted trigger, for tracing it in
       * the provider's own console. `null` when the provider acknowledged
       * without naming one.
       */
      readonly providerMessageId: string | null
    }
  | { readonly delivered: false; readonly reason: DeliveryRefusal }

export type DeliveryRefusal =
  /** No provider is configured for this deployment. */
  | 'not-configured'
  /** Configured, but this deployment has not been authorised to send. */
  | 'delivery-not-authorised'
  /** The event was not well-formed enough to send. */
  | `malformed-event:${PayloadRejectionReason}`
  /** The provider was unreachable, or answered with a transport-level error. */
  | 'provider-error'
  /**
   * The provider ACCEPTED the request and then did not act on it.
   *
   * This is its own outcome because it is not a transport failure and must not
   * be read as a success. Novu answers 2xx with a status of
   * `trigger_not_active`, `no_workflow_steps_defined` or `invalid_recipients`
   * when the workflow is missing, disabled, empty or the subscriber cannot be
   * resolved — every one of which is the ordinary state of an account somebody
   * has just created. Treating the HTTP status alone as delivery would report
   * a notification that was never sent.
   */
  | `provider-not-processed:${string}`

export interface NotificationService {
  /**
   * Attempt to deliver one domain event.
   *
   * Never throws. A caller in a request path must be able to `await` this
   * without a try/catch and without the result changing what it returns to the
   * player.
   */
  deliver(event: NotificationEvent): Promise<DeliveryOutcome>
}

/**
 * The default service: maps and validates the event, then delivers nothing.
 *
 * It still runs the mapping so that a malformed event is reported as malformed
 * rather than hidden behind "not configured" — otherwise a deployment would
 * only discover its payloads were broken on the day it switched delivery on.
 */
export function createDisabledNotificationService(
  reason: Extract<
    DeliveryRefusal,
    'not-configured' | 'delivery-not-authorised'
  > = 'not-configured',
): NotificationService {
  return {
    deliver(event) {
      const mapped = buildNotificationPayload(event)
      if (!mapped.ok) {
        return Promise.resolve({
          delivered: false,
          reason: `malformed-event:${mapped.reason}` as const,
        })
      }
      return Promise.resolve({ delivered: false, reason })
    },
  }
}

/**
 * What a provider adapter reports back.
 *
 * Three outcomes rather than a boolean, because "the provider took the request
 * and did nothing with it" is neither a success nor a transport failure, and
 * collapsing it into either one loses the only information that explains why
 * nothing arrived.
 */
export type TransportResult =
  | { readonly outcome: 'delivered'; readonly providerMessageId: string | null }
  | { readonly outcome: 'not-processed'; readonly providerStatus: string }
  | { readonly outcome: 'failed' }

/** How a configured provider actually sends one mapped payload. */
export type PayloadTransport = (
  payload: NotificationPayload,
) => Promise<TransportResult>

/**
 * Wrap a transport in the shared mapping, validation and never-throw contract,
 * so each provider adapter supplies only the part that is genuinely provider
 * specific.
 */
export function createNotificationService(
  transport: PayloadTransport,
): NotificationService {
  return {
    async deliver(event) {
      const mapped = buildNotificationPayload(event)
      if (!mapped.ok) {
        return { delivered: false, reason: `malformed-event:${mapped.reason}` }
      }

      try {
        const result = await transport(mapped.payload)
        switch (result.outcome) {
          case 'delivered':
            return {
              delivered: true,
              transactionId: mapped.payload.transactionId,
              providerMessageId: result.providerMessageId,
            }
          case 'not-processed':
            return {
              delivered: false,
              reason: `provider-not-processed:${result.providerStatus}`,
            }
          case 'failed':
            return { delivered: false, reason: 'provider-error' }
        }
      } catch {
        // Swallowed on purpose, and narrowly: a provider outage may not
        // propagate into whatever domain operation emitted the event.
        return { delivered: false, reason: 'provider-error' }
      }
    },
  }
}

/* ------------------------------------------------------------------ *
 * Environment contract
 * ------------------------------------------------------------------ */

export interface NotificationConfiguration {
  readonly apiKey: string
  readonly apiOrigin: string
  readonly environmentLabel: string
}

export type ConfigurationResult =
  | { readonly configured: true; readonly configuration: NotificationConfiguration }
  | {
      readonly configured: false
      readonly reason: Extract<
        DeliveryRefusal,
        'not-configured' | 'delivery-not-authorised'
      >
    }

export const DEFAULT_NOVU_API_ORIGIN = 'https://api.novu.co'

/**
 * Resolve delivery configuration from a SERVER-side environment.
 *
 * Two separate switches, and both must be thrown:
 *
 *   `NOVU_API_KEY`             the credential
 *   `NOTIFICATIONS_DELIVERY`   the word `enabled`, and nothing else
 *
 * Requiring the second is what stops a preview, a CI job or a developer machine
 * that happens to have a key in scope from sending real notifications to real
 * players. A credential is not consent.
 *
 * `NOVU_API_KEY` is deliberately not a `VITE_` name. Vite only inlines
 * `VITE_`-prefixed variables, so this key cannot reach a browser bundle even if
 * a caller were added in the wrong place —
 * `tests/services/notifications/notificationSecrets.test.ts` holds that.
 */
export function resolveNotificationConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): ConfigurationResult {
  const apiKey = environment.NOVU_API_KEY?.trim()
  if (!apiKey) return { configured: false, reason: 'not-configured' }

  // One word, and only that word. `true`, `1` and `yes` do NOT enable
  // delivery — a generic truthy value is how a switch gets flipped by a
  // template that meant something else, so an ambiguous value fails towards
  // silence.
  //
  // Case and surrounding whitespace are forgiven, because they carry no
  // intent: an operator who wrote `Enabled` or picked up a trailing space from
  // a YAML block plainly meant to enable, and refusing that would present as a
  // delivery outage rather than as a configuration error.
  if (environment.NOTIFICATIONS_DELIVERY?.trim().toLowerCase() !== 'enabled') {
    return { configured: false, reason: 'delivery-not-authorised' }
  }

  const origin = environment.NOVU_API_ORIGIN?.trim()

  return {
    configured: true,
    configuration: {
      apiKey,
      apiOrigin: origin && origin.length > 0 ? origin : DEFAULT_NOVU_API_ORIGIN,
      environmentLabel: environment.NOTIFICATIONS_ENVIRONMENT?.trim() || 'unknown',
    },
  }
}
