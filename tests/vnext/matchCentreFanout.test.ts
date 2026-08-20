import { describe, expect, it } from 'vitest'
import { mapSettledWithConcurrency } from '../../src/vnext/integration/matches/mapSettledWithConcurrency'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('Match Centre bounded league fan-out', () => {
  it('never starts more workers than the explicit ceiling', async () => {
    const gates = [deferred<number>(), deferred<number>(), deferred<number>(), deferred<number>()]
    let inFlight = 0
    let maximum = 0

    const result = mapSettledWithConcurrency([0, 1, 2, 3], 2, async (_item, index) => {
      inFlight += 1
      maximum = Math.max(maximum, inFlight)
      try {
        return await gates[index]!.promise
      } finally {
        inFlight -= 1
      }
    })

    await Promise.resolve()
    expect(maximum).toBe(2)
    expect(inFlight).toBe(2)

    gates[1]!.resolve(20)
    await Promise.resolve()
    await Promise.resolve()
    expect(maximum).toBe(2)

    gates[0]!.resolve(10)
    await Promise.resolve()
    await Promise.resolve()
    expect(maximum).toBe(2)

    gates[2]!.resolve(30)
    gates[3]!.resolve(40)
    await result
    expect(maximum).toBe(2)
  })

  it('returns results in server-list order even when completion order differs', async () => {
    const gates = [deferred<string>(), deferred<string>(), deferred<string>()]
    const result = mapSettledWithConcurrency(['first', 'second', 'third'], 3, (_item, index) =>
      gates[index]!.promise,
    )

    gates[2]!.resolve('third-result')
    gates[0]!.resolve('first-result')
    gates[1]!.resolve('second-result')

    expect(await result).toEqual([
      { status: 'fulfilled', value: 'first-result' },
      { status: 'fulfilled', value: 'second-result' },
      { status: 'fulfilled', value: 'third-result' },
    ])
  })

  it('captures one league failure and continues the other requested leagues', async () => {
    const results = await mapSettledWithConcurrency(['a', 'b', 'c'], 2, async (item) => {
      if (item === 'b') throw new Error('one league read failed')
      return item.toUpperCase()
    })

    expect(results[0]).toEqual({ status: 'fulfilled', value: 'A' })
    expect(results[1]?.status).toBe('rejected')
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'C' })
  })

  it('refuses an invalid concurrency value instead of accidentally becoming unbounded', async () => {
    await expect(mapSettledWithConcurrency([1], 0, async (value) => value)).rejects.toThrow(
      'concurrency must be a positive integer',
    )
    await expect(mapSettledWithConcurrency([1], 1.5, async (value) => value)).rejects.toThrow(
      'concurrency must be a positive integer',
    )
  })
})
