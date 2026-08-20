import { afterEach, describe, expect, it } from 'vitest'
import {
  configureClientErrorReporter,
  type ClientErrorEvent,
} from '../../../src/services/observability/clientObservability'
import { reportFatalRenderError } from '../../../src/services/observability/fatalRenderError'

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

describe('fatal render correlation reporting', () => {
  it('carries the exact safe support reference under the React source', () => {
    const events = capture()
    const error = new Error('private detail that must not be copied')
    error.stack = 'Error: private detail\n    at BrokenView (/app/src/BrokenView.tsx:10:4)'

    reportFatalRenderError(
      error,
      'FPH-20260820160000-A1B2',
      '\n    at BrokenView (/app/src/BrokenView.tsx:10:4)',
    )

    expect(events).toHaveLength(1)
    expect(events[0]?.source).toBe('react')
    expect(events[0]?.error.message).toBe(
      'Fatal application error: reference=FPH-20260820160000-A1B2',
    )
    expect(events[0]?.error.message).not.toContain('private detail')
    expect(events[0]?.error.stack).not.toContain('private detail')
    expect(events[0]?.error.stack).toContain('BrokenView')
    expect(events[0]?.error.componentStack).toContain('BrokenView')
  })

  it('refuses an injected or malformed reference', () => {
    const events = capture()

    reportFatalRenderError(
      new Error('boom'),
      'FPH-good\nemail=person@example.com',
    )

    expect(events[0]?.error.message).toContain('FPH-INVALID-REFERENCE')
    expect(events[0]?.error.message).not.toContain('person@example.com')
  })
})
