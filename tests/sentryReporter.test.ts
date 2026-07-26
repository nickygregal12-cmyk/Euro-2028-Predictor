import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClientErrorEvent } from '../src/services/observability/clientObservability'
import {
  createSentryClientErrorReporter,
  parseSentryDsn,
  sanitiseSentryErrorEvent,
  sanitiseSentryTransaction,
} from '../src/services/observability/sentryReporter'

const safeEvent: ClientErrorEvent = {
  schemaVersion: 1,
  eventId: '12345678-1234-1234-1234-123456789abc',
  occurredAt: '2026-07-26T10:00:00.000Z',
  source: 'react',
  routeCategory: 'predictor',
  release: {
    application: 'euro28-predictor',
    environment: 'deploy-preview',
    commit: 'abcdef1234567890',
    deployId: 'deploy-123',
    applicationContract: 35,
    hostedContract: 35,
    supabaseProjectRef: 'iouzoutneyjpugbbtdem',
  },
  error: {
    name: 'Error',
    message: 'A safe redacted failure occurred.',
    stack: 'Error: safe failure\n    at [redacted-local-path]',
    componentStack: 'Component at [redacted-local-path]',
  },
}

afterEach(() => {
  window.history.replaceState({}, '', '/')
  vi.restoreAllMocks()
})

describe('Sentry DSN validation', () => {
  it('accepts an approved public cloud DSN', () => {
    expect(
      parseSentryDsn('https://public-key@o123.ingest.sentry.io/456'),
    ).toEqual({
      dsn: 'https://public-key@o123.ingest.sentry.io/456',
      ingestOrigin: 'https://o123.ingest.sentry.io',
    })
  })

  it.each([
    'http://public-key@o123.ingest.sentry.io/456',
    'https://public-key:secret@o123.ingest.sentry.io/456',
    'https://public-key@example.com/456',
    'https://public-key@o123.ingest.sentry.io/not-a-project',
  ])('rejects unsafe or unsupported DSN %s', (dsn) => {
    expect(() => parseSentryDsn(dsn)).toThrow()
  })
})

describe('Sentry React SDK reporter', () => {
  it('passes only the pre-sanitised error and controlled event to capture', () => {
    const capture = vi.fn()
    const reporter = createSentryClientErrorReporter(capture)

    reporter(safeEvent)

    expect(capture).toHaveBeenCalledOnce()
    const [error, event] = capture.mock.calls[0] as [Error, ClientErrorEvent]
    expect(error.name).toBe('Error')
    expect(error.message).toBe('A safe redacted failure occurred.')
    expect(error.stack).toContain('[redacted-local-path]')
    expect(event).toBe(safeEvent)
  })

  it('drops any SDK error event not marked as controlled', () => {
    expect(
      sanitiseSentryErrorEvent({
        tags: { route_category: 'predictor' },
      }),
    ).toBeNull()
  })

  it('removes unsafe SDK fields from a controlled error event', () => {
    const event = {
      tags: {
        euro28_controlled_event: 'true',
        route_category: 'predictor',
        unsafe_tag: 'person@example.com',
      },
      contexts: {
        trace: { trace_id: 'safe' },
        euro28_release: { commit: 'abcdef' },
        browser: { name: 'private-browser-context' },
      },
      user: { email: 'person@example.com' },
      request: { url: 'https://example.com/?token=secret' },
      breadcrumbs: [{ message: 'private interaction' }],
      extra: {
        redacted_component_stack: '[redacted-local-path]',
        private_payload: 'secret',
      },
    }

    expect(sanitiseSentryErrorEvent(event)).toBe(event)
    expect(event).not.toHaveProperty('user')
    expect(event).not.toHaveProperty('request')
    expect(event).not.toHaveProperty('breadcrumbs')
    expect(event.tags).not.toHaveProperty('unsafe_tag')
    expect(event.contexts).not.toHaveProperty('browser')
    expect(event.extra).not.toHaveProperty('private_payload')
  })

  it('reduces tracing to a controlled route category without child spans', () => {
    window.history.replaceState({}, '', '/predict/groups/A?token=secret')
    const transaction = {
      transaction: '/predict/groups/A?token=secret',
      spans: [{ description: 'https://example.com/?token=secret' }],
      user: { email: 'person@example.com' },
      request: { url: 'https://example.com/?token=secret' },
      breadcrumbs: [{ message: 'private interaction' }],
      contexts: {
        trace: { trace_id: 'safe' },
        browser: { name: 'private-browser-context' },
      },
      tags: { unsafe_tag: 'secret' },
    }

    expect(sanitiseSentryTransaction(transaction)).toBe(transaction)
    expect(transaction.transaction).toBe('predictor')
    expect(transaction.spans).toEqual([])
    expect(transaction).not.toHaveProperty('user')
    expect(transaction).not.toHaveProperty('request')
    expect(transaction.contexts).toEqual({ trace: { trace_id: 'safe' } })
    expect(transaction.tags).toMatchObject({ route_category: 'predictor' })
    expect(JSON.stringify(transaction)).not.toContain('?token=secret')
    expect(JSON.stringify(transaction)).not.toContain('person@example.com')
  })
})
