/**
 * Map every item while limiting how many workers may be in flight at once.
 *
 * Result slots are keyed to input position rather than completion order, and an
 * individual rejection is captured rather than aborting the rest. This is used
 * by Match Centre's private-league panels: bounding transport concurrency must
 * never mean dropping requested leagues or changing their server order.
 */
export async function mapSettledWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('concurrency must be a positive integer')
  }
  if (items.length === 0) return []

  const results = new Array<PromiseSettledResult<R>>(items.length)
  let next = 0

  async function run() {
    while (true) {
      const index = next
      if (index >= items.length) return
      next += 1
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index] as T, index) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => run(),
  )
  await Promise.all(runners)
  return results
}
