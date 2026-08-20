import { afterEach, describe, expect, it } from 'vitest'
import {
  configureClientErrorReporter,
  type ClientErrorEvent,
} from '../../../src/services/observability/clientObservability'
import { reportReadFailure } from '../../../src/services/observability/readFailure'

let restoreReporter: (() => void) | null = null

afterEach(() => {
  restoreReporter?.()
  restoreReporter = null
})

function capture(): ClientErrorEvent[] {
  const events: ClientErrorEvent[] = []
  restoreReporter = configureClientErrorReporter((event) => {
    events.push(event)
  })
  return events
}

describe('read failure observability', () => {
  it('groups a caught read by closed operation name and server code', () => {
    const events = capture()

    reportReadFailure('leaderboard.page', { code: 'PGRST301' })

    expect(events).toHaveLength(1)
    expect(events[0]?.source).toBe('operation-failure')
    expect(events[0]?.error.name).toBe('ReadFailure')
    expect(events[0]?.error.message).toBe(
      'Read operation failed: read=leaderboard.page code=PGRST301',
    )
  })

  it('distinguishes network failures without sending their message', () => {
    const events = capture()

    reportReadFailure(
      'match-centre.distribution',
      new TypeError('Failed to fetch https://example.invalid/private/player/123'),
    )

    expect(events[0]?.error.message).toContain('code=network')
    expect(events[0]?.error.message).not.toContain('example.invalid')
    expect(events[0]?.error.message).not.toContain('player')
  })

  it('refuses a value masquerading as a server code', () => {
    const events = capture()

    reportReadFailure('season-leaderboard.page', {
      code: 'permission denied for relation private_entries',
    })

    expect(events[0]?.error.message).toContain('code=unrecognised')
    expect(events[0]?.error.message).not.toContain('private_entries')
  })
})
