import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configureClientErrorReporter,
  normaliseClientError,
  reportClientError,
} from '../src/services/observability/clientObservability'
import { routeCategory } from '../src/services/observability/releaseIdentity'

let restoreReporter: (() => void) | null = null

afterEach(() => {
  restoreReporter?.()
  restoreReporter = null
  vi.restoreAllMocks()
})

describe('client observability redaction', () => {
  it('removes identity, credential, URL-query and local-path data', () => {
    const error = new Error(
      'Failed for person@example.com with Bearer secret-token at ' +
        'https://example.com/path?token=secret#fragment',
    )
    error.stack =
      'Error: person@example.com\n' +
      '    at /Users/nicky/project/src/file.ts:10:4\n' +
      '    at https://example.com/app.js?token=secret:1:1'

    const safe = normaliseClientError(error)

    expect(safe.message).not.toContain('person@example.com')
    expect(safe.message).not.toContain('secret-token')
    expect(safe.message).not.toContain('?token=secret')
    expect(safe.stack).not.toContain('/Users/nicky')
    expect(safe.stack).not.toContain('?token=secret')
    expect(safe.message).toContain('[redacted-email]')
  })

  it('does not transmit raw database errors', () => {
    const safe = normaliseClientError(
      new Error('duplicate key value violates unique constraint profiles_pkey'),
    )

    expect(safe.message).toBe('A database operation failed.')
    expect(safe.message).not.toContain('profiles_pkey')
  })
})

describe('client observability failure isolation', () => {
  it('never lets a reporter failure break the application path', () => {
    restoreReporter = configureClientErrorReporter(() => {
      throw new Error('reporter unavailable')
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => {
      reportClientError(new Error('render failed'), 'react', '/predict')
    }).not.toThrow()
  })

  it('passes only the controlled event envelope to a reporter', () => {
    const reporter = vi.fn()
    restoreReporter = configureClientErrorReporter(reporter)

    const event = reportClientError(
      new Error('Failed for person@example.com'),
      'startup',
      '/auth/login',
    )

    expect(reporter).toHaveBeenCalledOnce()
    expect(reporter).toHaveBeenCalledWith(event)
    expect(event.routeCategory).toBe('auth')
    expect(event.error.message).not.toContain('person@example.com')
    expect(event.release.application).toBe('euro28-predictor')
  })
})

describe('route categories', () => {
  it.each([
    ['/auth/login', 'auth'],
    ['/join/ABC', 'invite'],
    ['/predict/groups/A', 'predictor'],
    ['/league/example', 'league'],
    ['/h2h/example', 'head-to-head'],
    ['/match/M1', 'matches'],
    ['/profile', 'profile'],
    ['/more/scoring', 'more'],
    ['/', 'home'],
    ['/unrecognised', 'unknown'],
  ])('classifies %s as %s', (pathname, category) => {
    expect(routeCategory(pathname)).toBe(category)
  })
})
