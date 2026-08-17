// @vitest-environment node
//
// The adapter is server-side code by construction — it holds a secret key and
// refuses to exist where a DOM does. Running its suite under the default jsdom
// environment would make every case hit that refusal, so this file runs where
// the code actually runs. The browser-refusal case stubs a DOM back in.
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { NotificationEvent } from '../../../src/services/notifications/notificationEvents'
import { DEFAULT_NOVU_API_ORIGIN } from '../../../src/services/notifications/notificationService'
import {
  NotificationCredentialInBrowserError,
  createNovuNotificationService,
} from '../../../src/services/notifications/novuAdapter'

/**
 * The Novu adapter across a real HTTP boundary.
 *
 * MSW rather than a replaced `fetch`, matching the HIBP boundary suite: the
 * production request construction, headers and body all have to be right,
 * because the assertion is made on the request MSW actually received.
 *
 * `onUnhandledRequest: 'error'` is what proves "no accidental sends" — any
 * request this suite did not explicitly expect fails the test rather than
 * quietly leaving the machine.
 */

const TRIGGER_URL = `${DEFAULT_NOVU_API_ORIGIN}/v1/events/trigger`

const CONFIGURATION = {
  apiKey: 'test-key-not-a-real-credential',
  apiOrigin: DEFAULT_NOVU_API_ORIGIN,
  environmentLabel: 'test',
} as const

const EVENT: NotificationEvent = {
  kind: 'league.overtaken',
  recipientId: 'player-1',
  competitionId: 'competition-1',
  occurredAt: '2026-08-17T12:00:00.000Z',
  leagueId: 'league-1',
  leagueName: 'The Office',
  overtakenByDisplayName: 'Sam',
  currentRank: 3,
  pointsBehind: null,
}

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

afterAll(() => {
  server.close()
})

describe('createNovuNotificationService', () => {
  it('refuses to exist in a browser', () => {
    // The credential is a secret key with full environment authority. In a
    // browser every visitor could read it, so this fails at construction
    // rather than on the first send months later.
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', {})

    expect(() => createNovuNotificationService(CONFIGURATION)).toThrow(
      NotificationCredentialInBrowserError,
    )
  })

  it('triggers the mapped workflow for the mapped subscriber', async () => {
    const requests: { body: unknown; authorization: string | null }[] = []

    server.use(
      http.post(TRIGGER_URL, async ({ request }) => {
        requests.push({
          body: await request.json(),
          authorization: request.headers.get('authorization'),
        })
        return HttpResponse.json({ data: { acknowledged: true } })
      }),
    )

    const result = await createNovuNotificationService(CONFIGURATION).deliver(EVENT)

    expect(result.delivered).toBe(true)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.authorization).toBe(`ApiKey ${CONFIGURATION.apiKey}`)
    expect(requests[0]?.body).toMatchObject({
      name: 'leagues-overtaken',
      to: { subscriberId: 'player-1' },
      payload: {
        leagueName: 'The Office',
        currentRank: 3,
        category: 'leagues',
      },
    })
  })

  it('sends an idempotency key so a retry cannot duplicate a notification', async () => {
    const transactionIds: unknown[] = []

    server.use(
      http.post(TRIGGER_URL, async ({ request }) => {
        const body = (await request.json()) as { transactionId?: unknown }
        transactionIds.push(body.transactionId)
        return HttpResponse.json({ data: { acknowledged: true } })
      }),
    )

    const service = createNovuNotificationService(CONFIGURATION)
    await service.deliver(EVENT)
    await service.deliver(EVENT)

    expect(transactionIds).toHaveLength(2)
    expect(transactionIds[0]).toBe(transactionIds[1])
    expect(transactionIds[0]).toEqual(expect.any(String))
  })

  it('sends null as null rather than as zero', async () => {
    let body: { payload?: Record<string, unknown> } | undefined

    server.use(
      http.post(TRIGGER_URL, async ({ request }) => {
        body = (await request.json()) as { payload?: Record<string, unknown> }
        return HttpResponse.json({ data: { acknowledged: true } })
      }),
    )

    await createNovuNotificationService(CONFIGURATION).deliver(EVENT)

    // The event says how far behind is not established. A 0 on the wire would
    // make Novu's template say the player is level, which is a different claim.
    expect(body?.payload).toHaveProperty('pointsBehind', null)
  })

  it('never contacts the provider for a malformed event', async () => {
    // No handler is registered, so onUnhandledRequest: 'error' turns any
    // outbound request into a failure. Nothing should leave.
    const result = await createNovuNotificationService(CONFIGURATION).deliver({
      ...EVENT,
      recipientId: '',
    })

    expect(result).toEqual({
      delivered: false,
      reason: 'malformed-event:missing-recipient',
    })
  })

  it('reports a provider rejection without throwing', async () => {
    server.use(
      http.post(TRIGGER_URL, () =>
        HttpResponse.json({ message: 'no such workflow' }, { status: 422 }),
      ),
    )

    await expect(
      createNovuNotificationService(CONFIGURATION).deliver(EVENT),
    ).resolves.toEqual({ delivered: false, reason: 'provider-error' })
  })

  it('reports an unreachable provider without throwing', async () => {
    server.use(http.post(TRIGGER_URL, () => HttpResponse.error()))

    await expect(
      createNovuNotificationService(CONFIGURATION).deliver(EVENT),
    ).resolves.toEqual({ delivered: false, reason: 'provider-error' })
  })

  it('honours a self-hosted API origin', async () => {
    const selfHosted = 'https://novu.internal.example'
    let reached = false

    server.use(
      http.post(`${selfHosted}/v1/events/trigger`, () => {
        reached = true
        return HttpResponse.json({ data: { acknowledged: true } })
      }),
    )

    await createNovuNotificationService({
      ...CONFIGURATION,
      apiOrigin: selfHosted,
    }).deliver(EVENT)

    expect(reached).toBe(true)
  })
})
