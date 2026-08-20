import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configureClientErrorReporter,
  installCspViolationCapture,
  normaliseClientError,
  reportClientError,
  type ClientErrorEvent,
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

  /*
   * THE PATH IS WHERE THIS APPLICATION KEEPS ITS SECRETS, and the sanitiser used
   * to return `origin + pathname` verbatim. An invite code IS the invitation —
   * contract 152 hardened the generator because possession of a code is what
   * gets someone into a private league — so a code quoted in an error message
   * reached Sentry intact. These use a realistic six-character upper-case code
   * and a real-shaped UUID, because the point is that neither can be told apart
   * from an ordinary path word by inspection.
   */
  const INVITE_CODE = 'K7QM2X'
  const PLAYER_UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'

  it('never transmits an invite code from a /join URL', () => {
    const error = new Error(`Join failed at https://predictorhub.netlify.app/join/${INVITE_CODE}`)
    const safe = normaliseClientError(error)

    expect(safe.message).not.toContain(INVITE_CODE)
    expect(safe.message).toContain('/[invite]')
  })

  it('never transmits a league or player identifier from a path', () => {
    const error = new Error(
      `Render failed at https://predictorhub.netlify.app/league/${PLAYER_UUID} and ` +
        `https://predictorhub.netlify.app/h2h/${PLAYER_UUID}`,
    )
    error.stack = `Error\n    at https://predictorhub.netlify.app/tournament/profile/${PLAYER_UUID}:1:1`

    const safe = normaliseClientError(error)

    expect(safe.message).not.toContain(PLAYER_UUID)
    expect(safe.message).toContain('/[league]')
    expect(safe.message).toContain('/[head-to-head]')
    // `/tournament/profile/:playerId` is not a category `routeCategory` names, so
    // it falls to structural redaction rather than passing through.
    expect(safe.stack).not.toContain(PLAYER_UUID)
    expect(safe.stack).toContain('[id]')
  })

  it('redacts an identifier in a stack line as well as a message', () => {
    const error = new Error('boom')
    error.stack = `Error: boom\n    at https://predictorhub.netlify.app/join/${INVITE_CODE}:12:5`

    const safe = normaliseClientError(error)

    expect(safe.stack).not.toContain(INVITE_CODE)
    expect(safe.stack).toContain('/[invite]')
  })

  it('keeps a foreign endpoint readable while redacting its identifiers', () => {
    // Losing the RPC name would make a Supabase failure much harder to read and
    // would gain nothing: the name is not a value belonging to anyone.
    const error = new Error(
      `Request failed: https://iouzoutneyjpugbbtdem.supabase.co/rest/v1/rpc/admin_ai_dashboard ` +
        `and https://iouzoutneyjpugbbtdem.supabase.co/storage/v1/object/${PLAYER_UUID}`,
    )

    const safe = normaliseClientError(error)

    expect(safe.message).toContain('/rest/v1/rpc/admin_ai_dashboard')
    expect(safe.message).not.toContain(PLAYER_UUID)
    expect(safe.message).toContain('/storage/v1/object/[id]')
  })

  it('does not transmit raw database errors or their stack detail', () => {
    const error = new Error(
      'duplicate key value violates unique constraint profiles_pkey',
    )
    error.stack =
      'Error: duplicate key value violates unique constraint profiles_pkey\n' +
      '    at savePrediction (src/service.ts:10:2)'

    const safe = normaliseClientError(error)

    expect(safe.message).toBe('A database operation failed.')
    expect(safe.message).not.toContain('profiles_pkey')
    expect(safe.stack).toBeNull()
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
    ['/competitions/premier-league/2026-27/games/match-predictor', 'season-predictor'],
    [
      '/competitions/premier-league/2026-27/games/match-predictor/standings',
      'season-standings',
    ],
    ['/competitions/scottish-premiership/2026-27/games/lms', 'season-lms'],
    ['/competitions/premier-league/2026-27/main-predictor', 'unknown'],
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

/**
 * `SEC-002` — collecting what the report-only Content-Security-Policy finds.
 *
 * `netlify.toml` serves a tightened policy beside the enforced one so real
 * traffic can answer whether `style-src 'unsafe-inline'` is still needed. These
 * assert the three properties that make that measurement worth having: it hears
 * the report-only violations, it ignores the enforced ones, and it does not
 * carry page content into telemetry.
 */
describe('report-only CSP violation capture', () => {
  function violation(
    overrides: Partial<SecurityPolicyViolationEvent> = {},
  ): SecurityPolicyViolationEvent {
    // jsdom raises no real violations, so the event is constructed. Every field
    // read by the capture is supplied.
    const event = new Event(
      'securitypolicyviolation',
    ) as unknown as Record<string, unknown>
    Object.assign(event, {
      effectiveDirective: 'style-src-elem',
      disposition: 'report',
      blockedURI: 'inline',
      sourceFile: 'https://example.test/assets/index.js',
      sample: 'a { content: "something a player typed" }',
      ...overrides,
    })
    return event as unknown as SecurityPolicyViolationEvent
  }

  function capture() {
    const events: ClientErrorEvent[] = []
    restoreReporter = configureClientErrorReporter((event) => {
      events.push(event)
    })
    const remove = installCspViolationCapture()
    return { events, remove }
  }

  it('reports a report-only violation, naming the directive', () => {
    const { events, remove } = capture()
    document.dispatchEvent(violation())
    remove()

    expect(events).toHaveLength(1)
    expect(events[0]?.source).toBe('csp-violation')
    expect(events[0]?.error.message).toContain('style-src-elem')
    expect(events[0]?.error.message).toContain('inline')
  })

  it('ignores an ENFORCED violation, which whatever broke already reports', () => {
    const { events, remove } = capture()
    document.dispatchEvent(violation({ disposition: 'enforce' }))
    remove()

    expect(events).toHaveLength(0)
  })

  it('reports one violation per directive, not one per element', () => {
    const { events, remove } = capture()
    document.dispatchEvent(violation())
    document.dispatchEvent(violation())
    document.dispatchEvent(violation({ effectiveDirective: 'style-src-attr' }))
    remove()

    expect(events).toHaveLength(2)
  })

  it('never carries the offending content into telemetry', () => {
    const { events, remove } = capture()
    document.dispatchEvent(violation())
    remove()

    // `report-sample` is deliberately absent from the policy, and nothing here
    // reads `sample` even when a browser supplies one: nothing guarantees a
    // page's inline content is free of something a player typed.
    const serialised = JSON.stringify(events)
    expect(serialised).not.toContain('something a player typed')
  })

  it('stops listening once removed', () => {
    const { events, remove } = capture()
    remove()
    document.dispatchEvent(violation())

    expect(events).toHaveLength(0)
  })
})
