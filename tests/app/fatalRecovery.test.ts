import { describe, expect, it } from 'vitest'

import {
  CRASH_COUNT_KEY,
  RECOVERY_THRESHOLD,
  clearFailureCount,
  clearLocalSession,
  correlationReference,
  recordFailure,
  recoverableKeys,
  type KeyValueStore,
} from '../../src/app/fatalRecovery'

/**
 * `UX-004`: the fatal fallback offered only a reload, so a DETERMINISTIC fault
 * failed again on every attempt and locked the user out. These assertions cover
 * the two halves that make the second remedy safe: it escalates only once the
 * fault has proved deterministic, and it removes the session and nothing else.
 *
 * The destructive half is the one worth over-testing. A recovery path that
 * clears too much is a worse defect than the crash it recovers from, so the
 * selection rule is asserted against keys that a careless `startsWith('sb-')`
 * or a bare `clear()` would take.
 */

function store(initial: Record<string, string> = {}): KeyValueStore & {
  snapshot(): Record<string, string>
} {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    snapshot: () => Object.fromEntries(map),
  }
}

describe('what the recovery is willing to remove', () => {
  it('selects the Supabase auth session, including its numbered chunks', () => {
    const subject = store({
      'sb-iouzoutneyjpugbbtdem-auth-token': 'a',
      'sb-iouzoutneyjpugbbtdem-auth-token.0': 'b',
      'sb-iouzoutneyjpugbbtdem-auth-token.1': 'c',
    })

    expect(recoverableKeys(subject)).toEqual([
      'sb-iouzoutneyjpugbbtdem-auth-token',
      'sb-iouzoutneyjpugbbtdem-auth-token.0',
      'sb-iouzoutneyjpugbbtdem-auth-token.1',
    ])
  })

  it('leaves everything else on the origin alone', () => {
    // Each of these would be taken by a `startsWith('sb-')` check or a bare
    // `clear()`. Destroying another tenant's state while recovering from our
    // own crash is the failure this test exists for.
    const subject = store({
      'sb-project-auth-token': 'ours',
      'sb-something-else': 'not an auth token',
      'sbx-project-auth-token': 'different prefix',
      'theme-preference': 'dark',
      'unrelated-app:cart': 'do not touch',
      'sb-project-auth-token-suffix': 'not the key either',
    })

    expect(recoverableKeys(subject)).toEqual(['sb-project-auth-token'])
  })

  it('removes exactly the selected keys and returns them', () => {
    const subject = store({
      'sb-project-auth-token': 'ours',
      'theme-preference': 'dark',
    })

    expect(clearLocalSession(subject)).toEqual(['sb-project-auth-token'])
    expect(subject.snapshot()).toEqual({ 'theme-preference': 'dark' })
  })

  it('reports an empty removal rather than claiming a sign-out it did not do', () => {
    const subject = store({ 'theme-preference': 'dark' })

    expect(clearLocalSession(subject)).toEqual([])
    expect(subject.snapshot()).toEqual({ 'theme-preference': 'dark' })
  })
})

describe('escalation from reload to recovery', () => {
  it('offers reload alone on the first failure', () => {
    // Most faults are transient, and a reload is the cheapest thing that clears
    // them. Escalating immediately would sign people out over a blip.
    expect(recordFailure(store()).offerRecovery).toBe(false)
  })

  it('offers recovery once the fault has repeated', () => {
    const subject = store()

    expect(recordFailure(subject).failures).toBe(1)
    const second = recordFailure(subject)

    expect(second.failures).toBe(RECOVERY_THRESHOLD)
    expect(second.offerRecovery).toBe(true)
  })

  it('keeps counting past the threshold rather than resetting', () => {
    const subject = store({ [CRASH_COUNT_KEY]: '5' })

    expect(recordFailure(subject)).toEqual({ failures: 6, offerRecovery: true })
  })

  it('treats a corrupt counter as no previous failure', () => {
    // The counter lives in the same storage the crash may have corrupted, so it
    // cannot be trusted to be a number. Reading `NaN` and escalating would sign
    // a user out on their first crash.
    for (const corrupt of ['', 'NaN', 'null', '-4', 'not-a-number']) {
      expect(recordFailure(store({ [CRASH_COUNT_KEY]: corrupt })).failures).toBe(1)
    }
  })

  it('clears the counter so a later unrelated crash starts from reload again', () => {
    const subject = store({ [CRASH_COUNT_KEY]: '3', 'theme-preference': 'dark' })
    clearFailureCount(subject)

    expect(subject.snapshot()).toEqual({ 'theme-preference': 'dark' })
  })
})

describe('the support reference', () => {
  it('is derived from the instant and carries no error detail', () => {
    const reference = correlationReference(new Date('2026-08-06T15:04:05.678Z'), 0.5)

    expect(reference).toBe('FPH-20260806150405-8000')
  })

  it('is stable in shape whatever the entropy', () => {
    for (const entropy of [0, 0.999999, 0.123]) {
      expect(correlationReference(new Date('2026-01-02T03:04:05.000Z'), entropy)).toMatch(
        /^FPH-\d{14}-[0-9A-F]{4}$/,
      )
    }
  })
})
