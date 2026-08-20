/**
 * A tiny FIFO concurrency gate for browser-side service calls.
 *
 * The gate limits the work itself, not merely the promises a caller creates.
 * That distinction matters when a UI maps over a list with `Promise.all`: every
 * promise may exist immediately while only `limit` network operations enter the
 * protected section.
 */
export function createConcurrencyGate(limit: number) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('concurrency limit must be a positive integer')
  }

  let active = 0
  const queue: Array<() => void> = []

  async function enter() {
    if (active >= limit) {
      await new Promise<void>((resolve) => queue.push(resolve))
    }
    active += 1
  }

  function leave() {
    active -= 1
    queue.shift()?.()
  }

  return async function run<T>(work: () => Promise<T>): Promise<T> {
    await enter()
    try {
      return await work()
    } finally {
      leave()
    }
  }
}
