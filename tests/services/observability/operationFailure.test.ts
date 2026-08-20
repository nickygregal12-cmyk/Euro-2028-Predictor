import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configureClientErrorReporter,
  type ClientErrorEvent,
} from '../../../src/services/observability/clientObservability'
import {
  reportOperationFailure,
  serverCodeOf,
} from '../../../src/services/observability/operationFailure'
import { createSaveController } from '../../../src/app/providers/saveController'

/**
 * `C1` — a competitive action that failed is observable, and carries nothing it
 * should not.
 *
 * THE GAP THESE CLOSE. `reportClientError` was called from exactly two places
 * in the application: the entry point and the startup instrument. Every failure
 * a player actually meets — a prediction that would not save, a Joker that was
 * refused — is CAUGHT, turned into a sentence and shown on screen, which
 * reaches neither `window.onerror` nor an unhandled rejection. A matchweek in
 * which every save failed would have produced a silent Sentry project.
 *
 * The privacy assertions are the ones worth having a gate for, because the
 * pressure over time is always to add "just one more field" to make an issue
 * easier to debug, and the field that makes a save failure easiest to debug is
 * the scoreline.
 */

let restoreReporter: (() => void) | null = null

afterEach(() => {
  restoreReporter?.()
  restoreReporter = null
  vi.restoreAllMocks()
})

function capture() {
  const events: ClientErrorEvent[] = []
  restoreReporter = configureClientErrorReporter((event) => {
    events.push(event)
  })
  return events
}

describe('what a reported operation failure says', () => {
  it('names the operation and the outcome, under its own source', () => {
    const events = capture()
    reportOperationFailure('prediction.save', {
      outcome: 'failed',
      serverCode: 'PGRST301',
      matchweek: 12,
    })

    expect(events).toHaveLength(1)
    expect(events[0]?.source).toBe('operation-failure')
    expect(events[0]?.error.name).toBe('OperationFailure')
    expect(events[0]?.error.message).toContain('operation=prediction.save')
    expect(events[0]?.error.message).toContain('outcome=failed')
    expect(events[0]?.error.message).toContain('code=PGRST301')
    expect(events[0]?.error.message).toContain('matchweek=12')
  })

  it('distinguishes a refusal from a thing that gave up', () => {
    const events = capture()
    reportOperationFailure('prediction.save', { outcome: 'conflict' })
    expect(events[0]?.error.message).toContain('outcome=conflict')
  })

  it('refuses a server "code" that is really a message', () => {
    // The leak this prevents: a caller passing `error.message` to `serverCode`
    // because it looked like the useful field. A database message can quote the
    // row that caused it.
    const events = capture()
    reportOperationFailure('lms.pick', {
      outcome: 'failed',
      serverCode: 'duplicate key value violates unique constraint "picks_pkey"',
    })

    expect(events[0]?.error.message).toContain('code=unrecognised')
    expect(events[0]?.error.message).not.toContain('picks_pkey')
  })
})

describe('the server code, read from a rejection', () => {
  it.each([
    [{ code: 'PGRST116' }, 'PGRST116'],
    [{ status: 409 }, '409'],
    [Object.assign(new TypeError('Failed to fetch')), 'network'],
    [{}, 'unknown'],
    ['a string', 'unknown'],
    [null, 'unknown'],
  ])('reads %j as %s', (error, expected) => {
    expect(serverCodeOf(error)).toBe(expected)
  })
})

describe('the save authority reports only what stopped trying', () => {
  /** A controller whose save always rejects with the given error. */
  function failingController(error: unknown) {
    const failures: { key: string; outcome: string; error: unknown }[] = []
    const statuses: string[] = []
    const controller = createSaveController({
      performSave: () => Promise.reject(error),
      onStatus: (_key, status) => statuses.push(status),
      isConflict: () => true,
      onTerminalFailure: (key, failed, outcome) => {
        failures.push({ key, outcome, error: failed })
      },
    })
    return { controller, failures, statuses }
  }

  it('reports a terminal failure once, with the error it stopped on', async () => {
    const rejection = { code: 'PGRST204' }
    const { controller, failures } = failingController(rejection)

    controller.change('m:match-1', { home: 2, away: 1 })
    await controller.waitForSettled()

    expect(failures).toHaveLength(1)
    expect(failures[0]?.key).toBe('m:match-1')
    expect(failures[0]?.outcome).toBe('conflict')
    expect(failures[0]?.error).toBe(rejection)
  })

  it('says nothing at all when the save succeeds', async () => {
    const failures: unknown[] = []
    const controller = createSaveController({
      performSave: () => Promise.resolve(),
      onStatus: () => {},
      onTerminalFailure: (key, error, outcome) => failures.push({ key, error, outcome }),
    })

    controller.change('m:match-1', { home: 0, away: 0 })
    await controller.waitForSettled()
    expect(failures).toEqual([])
  })

  it('never sees the payload, so a scoreline cannot reach telemetry', async () => {
    const { controller, failures } = failingController({ code: 'PGRST204' })

    controller.change('m:match-1', { home: 3, away: 2, secret: 'not for sharing' })
    await controller.waitForSettled()

    // The callback's signature is key, error, outcome — there is no parameter a
    // payload could arrive through, which is the property rather than the
    // observation.
    expect(JSON.stringify(failures)).not.toContain('secret')
    expect(JSON.stringify(failures)).not.toContain('"home"')
  })
})

describe('nothing a player typed can reach telemetry through this path', () => {
  it('carries no prediction, code, name or free text, whatever is attempted', () => {
    const events = capture()
    reportOperationFailure('league.join', {
      outcome: 'failed',
      competitionId: '11111111-2222-3333-4444-555555555555',
      seasonId: '66666666-7777-8888-9999-000000000000',
      matchweek: 12,
      serverCode: '403',
    })

    const serialised = JSON.stringify(events)
    // Opaque ids and integers only. The type has no field for a league name, an
    // invite code, a scoreline or an account, so this asserts the shape stayed
    // that way rather than that one call behaved.
    expect(serialised).toContain('11111111-2222-3333-4444-555555555555')
    expect(serialised).not.toMatch(/[A-Z]{3}[0-9]{3}/) // an invite code's shape
    expect(events[0]?.error.message.split(' ').length).toBeLessThan(12)
  })
})
