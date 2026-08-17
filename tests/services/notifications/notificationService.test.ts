import { describe, expect, it, vi } from 'vitest'
import type { NotificationEvent } from '../../../supabase/functions/_shared/notifications/notificationEvents'
import {
  DEFAULT_NOVU_API_ORIGIN,
  createDisabledNotificationService,
  createNotificationService,
  resolveNotificationConfiguration,
} from '../../../supabase/functions/_shared/notifications/notificationService'

/**
 * The boundary's contract: fail closed, never throw, and say which door shut.
 */

const EVENT: NotificationEvent = {
  kind: 'lms.eliminated',
  recipientId: 'player-1',
  competitionId: 'competition-1',
  occurredAt: '2026-08-17T12:00:00.000Z',
  round: 3,
  selectionLabel: 'Arsenal',
}

const MALFORMED = { ...EVENT, recipientId: '' }

describe('resolveNotificationConfiguration', () => {
  it('is unconfigured with no credential', () => {
    expect(resolveNotificationConfiguration({})).toEqual({
      configured: false,
      reason: 'not-configured',
    })
  })

  it('refuses a credential that was never granted delivery authority', () => {
    // The case this whole switch exists for: a key in scope is not consent to
    // send to real players.
    expect(
      resolveNotificationConfiguration({ NOVU_API_KEY: 'secret' }),
    ).toEqual({ configured: false, reason: 'delivery-not-authorised' })
  })

  it.each(['true', '1', 'yes', 'on', '', 'disabled'])(
    'does not accept %o as delivery authority',
    (value) => {
      // A generic truthy value must not enable sending. That is how a switch
      // gets flipped by a template that meant something else entirely.
      const result = resolveNotificationConfiguration({
        NOVU_API_KEY: 'secret',
        NOTIFICATIONS_DELIVERY: value,
      })
      expect(result.configured).toBe(false)
    },
  )

  it.each(['enabled', 'Enabled', 'ENABLED', '  enabled  '])(
    'accepts %o, because case and stray whitespace carry no intent',
    (value) => {
      // Deliberately forgiving on presentation and strict on the word. An
      // operator who wrote `Enabled`, or whose YAML added a trailing space,
      // meant to enable — and refusing them would look like a delivery
      // outage rather than a configuration error.
      const result = resolveNotificationConfiguration({
        NOVU_API_KEY: 'secret',
        NOTIFICATIONS_DELIVERY: value,
      })
      expect(result.configured).toBe(true)
    },
  )

  it('configures when both the credential and the authority are present', () => {
    const result = resolveNotificationConfiguration({
      NOVU_API_KEY: '  secret  ',
      NOTIFICATIONS_DELIVERY: 'enabled',
      NOTIFICATIONS_ENVIRONMENT: 'staging',
    })

    expect(result).toEqual({
      configured: true,
      configuration: {
        apiKey: 'secret',
        apiOrigin: DEFAULT_NOVU_API_ORIGIN,
        environmentLabel: 'staging',
      },
    })
  })

  it('allows the API origin to be redirected for a self-hosted Novu', () => {
    const result = resolveNotificationConfiguration({
      NOVU_API_KEY: 'secret',
      NOTIFICATIONS_DELIVERY: 'enabled',
      NOVU_API_ORIGIN: 'https://novu.internal.example',
    })
    expect(result.configured && result.configuration.apiOrigin).toBe(
      'https://novu.internal.example',
    )
  })

  it('never reads a VITE_-prefixed variable', () => {
    // A VITE_ name would be inlined into the browser bundle by Vite. Passing
    // one must not configure anything.
    const result = resolveNotificationConfiguration({
      VITE_NOVU_API_KEY: 'secret',
      VITE_NOTIFICATIONS_DELIVERY: 'enabled',
    })
    expect(result).toEqual({ configured: false, reason: 'not-configured' })
  })
})

describe('createDisabledNotificationService', () => {
  it('delivers nothing and says why', async () => {
    await expect(
      createDisabledNotificationService().deliver(EVENT),
    ).resolves.toEqual({ delivered: false, reason: 'not-configured' })
  })

  it('reports an unauthorised deployment distinctly from an unconfigured one', async () => {
    await expect(
      createDisabledNotificationService('delivery-not-authorised').deliver(EVENT),
    ).resolves.toEqual({ delivered: false, reason: 'delivery-not-authorised' })
  })

  it('still reports a malformed event as malformed', async () => {
    // Otherwise a deployment only discovers its payloads are broken on the day
    // it switches delivery on.
    await expect(
      createDisabledNotificationService().deliver(MALFORMED as NotificationEvent),
    ).resolves.toEqual({
      delivered: false,
      reason: 'malformed-event:missing-recipient',
    })
  })
})

describe('createNotificationService', () => {
  it('delivers a well-formed event through the transport', async () => {
    const transport = vi
      .fn()
      .mockResolvedValue({ outcome: 'delivered', providerMessageId: 'novu-txn-1' })
    const result = await createNotificationService(transport).deliver(EVENT)

    expect(result.delivered).toBe(true)
    expect(transport).toHaveBeenCalledOnce()
    expect(transport.mock.calls[0]?.[0]).toMatchObject({
      workflowId: 'lms-eliminated',
      recipientId: 'player-1',
      category: 'last-man-standing',
    })
  })

  it("carries the provider's own identifier back to the caller", async () => {
    // This is what `record_reminder_result(p_provider_message_id)` records, so
    // it has to be the provider's value rather than this boundary's key.
    const transport = vi
      .fn()
      .mockResolvedValue({ outcome: 'delivered', providerMessageId: 'novu-txn-1' })
    const result = await createNotificationService(transport).deliver(EVENT)

    expect(result).toMatchObject({
      delivered: true,
      providerMessageId: 'novu-txn-1',
    })
    if (result.delivered) {
      expect(result.providerMessageId).not.toBe(result.transactionId)
    }
  })

  it('accepts a provider that acknowledges without naming an identifier', async () => {
    const transport = vi
      .fn()
      .mockResolvedValue({ outcome: 'delivered', providerMessageId: null })
    const result = await createNotificationService(transport).deliver(EVENT)
    expect(result).toMatchObject({ delivered: true, providerMessageId: null })
  })

  it('never reaches the transport with a malformed event', async () => {
    const transport = vi
      .fn()
      .mockResolvedValue({ outcome: 'delivered', providerMessageId: null })
    const result = await createNotificationService(transport).deliver(
      MALFORMED as NotificationEvent,
    )

    expect(result).toEqual({
      delivered: false,
      reason: 'malformed-event:missing-recipient',
    })
    expect(transport).not.toHaveBeenCalled()
  })

  it('reports a failing transport without throwing', async () => {
    const transport = vi.fn().mockResolvedValue({ outcome: 'failed' })
    await expect(
      createNotificationService(transport).deliver(EVENT),
    ).resolves.toEqual({ delivered: false, reason: 'provider-error' })
  })

  it('does not report delivery when the provider declined to act', async () => {
    // The case that matters on a new account: the request was accepted and the
    // notification was never sent. Reporting it as delivered would be a lie
    // the ledger then records as success.
    const transport = vi
      .fn()
      .mockResolvedValue({ outcome: 'not-processed', providerStatus: 'trigger_not_active' })

    await expect(
      createNotificationService(transport).deliver(EVENT),
    ).resolves.toEqual({
      delivered: false,
      reason: 'provider-not-processed:trigger_not_active',
    })
  })

  it('absorbs a thrown transport error', async () => {
    // A caller in a request path must be able to await this without a
    // try/catch. A notification outage may not fail a prediction.
    const transport = vi.fn().mockRejectedValue(new Error('socket hang up'))
    await expect(
      createNotificationService(transport).deliver(EVENT),
    ).resolves.toEqual({ delivered: false, reason: 'provider-error' })
  })
})
