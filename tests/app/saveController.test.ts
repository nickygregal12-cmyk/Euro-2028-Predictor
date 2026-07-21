import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSaveController } from '../../src/app/providers/saveController'
import type { SaveStatus } from '../../src/domain/saveCoordinator'

// Exercises the impure runner end-to-end (its effects → real timers/promises)
// with a controllable mock save. The pure ordering is proven in
// saveCoordinator.test.ts; this proves the wiring executes those effects.

// A deferred promise whose settle we control, so we can order responses.
function deferred() {
  let resolve!: () => void
  let reject!: () => void
  const promise = new Promise<void>((res, rej) => {
    resolve = () => res()
    reject = () => rej(new Error('save failed'))
  })
  return { promise, resolve, reject }
}

// Let queued promise callbacks run.
const flush = () => Promise.resolve().then(() => Promise.resolve())

describe('createSaveController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps one save in flight and sends only the latest pending after it settles', async () => {
    const calls: { key: string; payload: unknown }[] = []
    const gates: ReturnType<typeof deferred>[] = []
    const statuses: SaveStatus[] = []
    const controller = createSaveController({
      performSave: (key, payload) => {
        calls.push({ key, payload })
        const d = deferred()
        gates.push(d)
        return d.promise
      },
      onStatus: (_key, status) => statuses.push(status),
    })

    controller.change('m:1', 'a') // issued immediately
    controller.change('m:1', 'b') // coalesced (not sent)
    controller.change('m:1', 'c') // replaces pending b
    expect(calls).toHaveLength(1)
    expect(calls[0].payload).toBe('a')

    gates[0].resolve()
    await flush()
    // Latest pending 'c' saves next; intermediate 'b' is never sent.
    expect(calls).toHaveLength(2)
    expect(calls[1].payload).toBe('c')

    gates[1].resolve()
    await flush()
    expect(calls).toHaveLength(2)
    expect(statuses.at(-1)).toBe('saved')
  })

  it('a newer change cancels a scheduled retry — no stale duplicate save fires', async () => {
    const calls: unknown[] = []
    const gates: ReturnType<typeof deferred>[] = []
    const controller = createSaveController({
      performSave: (_key, payload) => {
        calls.push(payload)
        const d = deferred()
        gates.push(d)
        return d.promise
      },
      onStatus: () => {},
    })

    controller.change('m:1', 'a') // seq1 issued
    gates[0].reject() // fails → schedules retry of 'a'
    await flush()
    expect(calls).toEqual(['a'])

    // Before the backoff elapses, a newer change supersedes: it must cancel the
    // scheduled retry and issue 'b' immediately.
    controller.change('m:1', 'b')
    expect(calls).toEqual(['a', 'b'])

    // Advancing well past the old backoff must NOT re-fire the cancelled 'a'
    // retry — otherwise a stale write would clobber 'b'.
    await vi.advanceTimersByTimeAsync(5000)
    expect(calls).toEqual(['a', 'b'])
  })

  it('auto-retries a failed save with backoff, then succeeds', async () => {
    const gates: ReturnType<typeof deferred>[] = []
    const statuses: SaveStatus[] = []
    const controller = createSaveController({
      performSave: () => {
        const d = deferred()
        gates.push(d)
        return d.promise
      },
      onStatus: (_k, s) => statuses.push(s),
    })

    controller.change('gb', 'x')
    expect(gates).toHaveLength(1)
    gates[0].reject()
    await flush()
    // Still 'saving' (retrying is not a distinct visual state), retry scheduled.
    expect(statuses.at(-1)).toBe('saving')
    expect(gates).toHaveLength(1)

    // Advance past the first backoff → retry fires a new save.
    await vi.advanceTimersByTimeAsync(600)
    expect(gates).toHaveLength(2)
    gates[1].resolve()
    await flush()
    expect(statuses.at(-1)).toBe('saved')
  })

  it('surfaces error after retries are exhausted, and manual retry re-sends', async () => {
    const gates: ReturnType<typeof deferred>[] = []
    let lastStatus: SaveStatus = 'idle'
    const controller = createSaveController({
      performSave: () => {
        const d = deferred()
        gates.push(d)
        return d.promise
      },
      onStatus: (_k, s) => {
        lastStatus = s
      },
    })

    controller.change('gb', 'x')
    // Fail the initial + both auto-retries.
    for (let i = 0; i < 3; i++) {
      gates[i].reject()
      await flush()
      await vi.advanceTimersByTimeAsync(RETRY_WAIT)
    }
    expect(lastStatus).toBe('error')

    // Manual retry re-issues the save.
    const before = gates.length
    controller.manualRetry('gb')
    expect(gates.length).toBe(before + 1)
    gates[before].resolve()
    await flush()
    expect(lastStatus).toBe('saved')
  })

  it('classifies a conflict via isConflict → terminal conflict, no retry', async () => {
    let rejectFn!: (err: unknown) => void
    const statuses: SaveStatus[] = []
    let saveCount = 0
    const controller = createSaveController({
      performSave: () => {
        saveCount++
        return new Promise<void>((_res, rej) => {
          rejectFn = rej
        })
      },
      onStatus: (_k, s) => statuses.push(s),
      isConflict: (err) => (err as { code?: string })?.code === 'PT409',
    })

    controller.change('gb', 'x')
    expect(saveCount).toBe(1)
    // Reject with the conflict-shaped error.
    rejectFn({ code: 'PT409' })
    await flush()
    expect(statuses.at(-1)).toBe('conflict')
    // A conflict is terminal: advancing timers must NOT auto-retry.
    await vi.advanceTimersByTimeAsync(5000)
    expect(saveCount).toBe(1)
  })

  it('dispose stops late responses from updating status', async () => {
    const gates: ReturnType<typeof deferred>[] = []
    const statuses: SaveStatus[] = []
    const controller = createSaveController({
      performSave: () => {
        const d = deferred()
        gates.push(d)
        return d.promise
      },
      onStatus: (_k, s) => statuses.push(s),
    })
    controller.change('m:1', 'a')
    controller.dispose()
    const countAtDispose = statuses.length
    gates[0].resolve()
    await flush()
    // No status pushed after dispose (the late 'result' is ignored).
    expect(statuses.length).toBe(countAtDispose)
  })
})

// Comfortably past the largest backoff used above (backoffDelay(2) = 1500ms).
const RETRY_WAIT = 2000
