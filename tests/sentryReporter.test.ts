import { describe, expect, it, vi } from 'vitest'
import type { ClientErrorEvent } from '../src/services/observability/clientObservability'
import {
  createSentryClientErrorReporter,
  parseSentryDsn,
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

describe('Sentry DSN validation', () => {
  it('builds an envelope endpoint from an approved cloud DSN', () => {
    expect(
      parseSentryDsn('https://public-key@o123.ingest.sentry.io/456'),
    ).toEqual({
      envelopeUrl:
        'https://o123.ingest.sentry.io/api/456/envelope/?sentry_key=public-key&sentry_version=7&sentry_client=euro28-predictor%2F1.0',
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

describe('Sentry client reporter', () => {
  it('sends only the controlled pre-sanitised envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response)
    const reporter = createSentryClientErrorReporter(
      'https://public-key@o123.ingest.sentry.io/456',
      fetchMock,
    )

    await reporter(safeEvent)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('o123.ingest.sentry.io/api/456/envelope/')
    expect(options.credentials).toBe('omit')
    expect(options.referrerPolicy).toBe('no-referrer')

    const envelopeLines = String(options.body).split('\n')
    expect(envelopeLines).toHaveLength(3)
    const payload = JSON.parse(envelopeLines[2]) as Record<string, unknown>
    const serialized = JSON.stringify(payload)

    expect(payload).not.toHaveProperty('user')
    expect(payload).not.toHaveProperty('request')
    expect(payload).not.toHaveProperty('breadcrumbs')
    expect(serialized).not.toContain('person@example.com')
    expect(serialized).not.toContain('Bearer ')
    expect(serialized).not.toContain('?token=')
    expect(serialized).toContain('A safe redacted failure occurred.')
    expect(serialized).toContain('deploy-preview')
    expect(serialized).toContain('predictor')
  })

  it('rejects unsuccessful provider responses for outer failure isolation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    } as Response)
    const reporter = createSentryClientErrorReporter(
      'https://public-key@o123.ingest.sentry.io/456',
      fetchMock,
    )

    await expect(reporter(safeEvent)).rejects.toThrow(
      'Sentry delivery failed with HTTP 429.',
    )
  })
})
