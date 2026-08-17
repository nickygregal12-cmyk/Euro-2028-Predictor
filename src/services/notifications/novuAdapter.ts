/**
 * The Novu adapter.
 *
 * One implementation of the boundary in `notificationService.ts`. Everything
 * Novu-specific lives here and nowhere else, so replacing the provider is a
 * matter of writing a sibling file rather than editing the application.
 *
 * **It talks to Novu's HTTP API directly rather than through an SDK.** That is
 * a deliberate choice, not an omission. The repository ships a browser bundle
 * under a measured budget; adding a provider SDK to `package.json` puts a
 * package one careless import away from that bundle and adds a supply-chain
 * surface for what is, in the end, one authenticated POST. `fetch` is already
 * available on every runtime this repository targets.
 *
 * **It is server-side only.** `NOVU_API_KEY` is a secret key with full
 * environment authority; in a browser it would be readable by every visitor.
 * The adapter refuses to construct itself where a DOM is present, so a
 * mistaken import fails immediately and loudly rather than shipping a
 * credential.
 */

import {
  createNotificationService,
  type NotificationConfiguration,
  type NotificationService,
  type PayloadTransport,
} from './notificationService'

/** Novu's trigger endpoint, relative to the configured API origin. */
const TRIGGER_PATH = '/v1/events/trigger'

/**
 * True when this module is executing somewhere a secret must never exist.
 *
 * Checked at construction rather than at send time so the failure surfaces
 * when the wiring is wrong, not on the first notification months later.
 */
function looksLikeBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

export class NotificationCredentialInBrowserError extends Error {
  constructor() {
    super(
      'The Novu adapter requires a secret API key and must never be constructed in a browser. ' +
        'Trigger notifications from a server-side context instead.',
    )
    this.name = 'NotificationCredentialInBrowserError'
  }
}

/**
 * Build the transport for a configured Novu environment.
 *
 * Deliberately not exported. The tests drive the real entry point below and
 * assert on the request MSW receives, which exercises this and the browser
 * guard together — reaching past that guard to test the transport in isolation
 * would prove the wrong thing.
 */
function createNovuTransport(
  configuration: NotificationConfiguration,
  fetchImplementation: typeof fetch = fetch,
): PayloadTransport {
  return async (payload) => {
    const response = await fetchImplementation(
      `${configuration.apiOrigin}${TRIGGER_PATH}`,
      {
        method: 'POST',
        headers: {
          // Novu's documented scheme for a secret key.
          Authorization: `ApiKey ${configuration.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: payload.workflowId,
          to: { subscriberId: payload.recipientId },
          transactionId: payload.transactionId,
          payload: {
            ...payload.data,
            category: payload.category,
            occurredAt: payload.occurredAt,
          },
        }),
      },
    )

    // Any non-2xx is a refusal. The body is deliberately not inspected or
    // logged: a provider error body can echo the request, and the request
    // carries player identifiers.
    return { delivered: response.ok }
  }
}

/**
 * The Novu-backed notification service.
 *
 * Throws only for the one programming error worth refusing outright — being
 * constructed in a browser. Every other failure is reported through
 * `DeliveryOutcome`.
 */
export function createNovuNotificationService(
  configuration: NotificationConfiguration,
  fetchImplementation: typeof fetch = fetch,
): NotificationService {
  if (looksLikeBrowser()) throw new NotificationCredentialInBrowserError()
  return createNotificationService(
    createNovuTransport(configuration, fetchImplementation),
  )
}
