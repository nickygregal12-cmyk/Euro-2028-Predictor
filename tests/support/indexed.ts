/**
 * Indexed reads that say what went wrong when the element is not there.
 *
 * WHY THIS EXISTS. Under `noUncheckedIndexedAccess` every `array[i]` is
 * `T | undefined`, which is the truth: nothing about `[0]` proves the array is
 * non-empty. A test that then reads a property off it has two honest options,
 * and a dishonest one.
 *
 * The dishonest option is `array[0]!`. It silences the checker, and when the
 * array really is empty the failure arrives as "Cannot read properties of
 * undefined (reading 'combinedOdds')" — a message about the assertion's
 * plumbing rather than about the fixture that came back empty. Worse, `!` reads
 * as a proven claim while proving nothing, which is exactly the defect class
 * `TYPE-002` was opened against.
 *
 * These helpers are the honest option: the read is checked, and a missing
 * element fails the test immediately with the index and the length it actually
 * found. The test still fails — which is correct, an empty fixture IS a
 * failure — but it fails saying what was missing.
 *
 * Test-support only. Production code states its own invariants in place, where
 * the surrounding rule can be named; see `src/domain/tournament/bracketHealth.ts`.
 */

/**
 * The value at `key`, or a failure naming what was missing.
 *
 * Overloaded for both shapes the suites index into: a positional collection
 * (array, tuple, `NodeList`, regex match) reports the length it actually found,
 * and a keyed record reports the key, because "index 3 of 2" and "no such key
 * --danger" are different diagnostics and both are worth having.
 */
export function at<T>(items: ArrayLike<T>, index: number, what?: string): T
export function at<T>(items: Record<string, T>, key: string, what?: string): T
export function at<T>(
  items: ArrayLike<T> | Record<string, T>,
  key: number | string,
  what = 'element',
): T {
  const item = (items as Record<string | number, T | undefined>)[key]
  if (item === undefined) {
    const where =
      typeof key === 'number'
        ? `index ${key}, but the collection holds ${(items as ArrayLike<T>).length}`
        : `key ${key}`
    throw new Error(`expected ${what} at ${where}`)
  }
  return item
}

/** The first element, or a failure saying the collection was empty. */
export function first<T>(items: ArrayLike<T>, what = 'element'): T {
  return at(items, 0, what)
}

/** The last element, or a failure saying the collection was empty. */
export function last<T>(items: ArrayLike<T>, what = 'element'): T {
  return at(items, items.length - 1, what)
}
