import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createConcurrencyGate } from '../../../src/services/concurrency/boundedGate'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('bounded concurrency gate', () => {
  it('limits the protected work while allowing every caller to queue', async () => {
    const run = createConcurrencyGate(2)
    const gates = [deferred<number>(), deferred<number>(), deferred<number>(), deferred<number>()]
    let active = 0
    let maximum = 0

    const calls = gates.map((gate) =>
      run(async () => {
        active += 1
        maximum = Math.max(maximum, active)
        try {
          return await gate.promise
        } finally {
          active -= 1
        }
      }),
    )

    await Promise.resolve()
    expect(active).toBe(2)
    expect(maximum).toBe(2)

    gates[0]!.resolve(10)
    await Promise.resolve()
    await Promise.resolve()
    expect(maximum).toBe(2)

    gates[1]!.resolve(20)
    await Promise.resolve()
    await Promise.resolve()
    expect(maximum).toBe(2)

    gates[2]!.resolve(30)
    gates[3]!.resolve(40)
    await expect(Promise.all(calls)).resolves.toEqual([10, 20, 30, 40])
    expect(maximum).toBe(2)
  })

  it('releases a slot after a rejection so later work is not stranded', async () => {
    const run = createConcurrencyGate(1)
    const first = run(async () => {
      throw new Error('failed read')
    })
    const second = run(async () => 'next read')

    await expect(first).rejects.toThrow('failed read')
    await expect(second).resolves.toBe('next read')
  })

  it('refuses invalid limits rather than silently becoming unbounded', () => {
    expect(() => createConcurrencyGate(0)).toThrow('concurrency limit must be a positive integer')
    expect(() => createConcurrencyGate(1.5)).toThrow(
      'concurrency limit must be a positive integer',
    )
  })

  it('is the gate used by the season league prediction RPC with an explicit ceiling of four', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/services/supabase/seasonLeaguePredictions.ts'),
      'utf8',
    )
    expect(source).toContain("import { createConcurrencyGate } from '../concurrency/boundedGate'")
    expect(source).toContain('export const SEASON_LEAGUE_PREDICTION_READ_CONCURRENCY = 4')
    expect(source).toContain(
      'const runSeasonLeaguePredictionRead = createConcurrencyGate(\n  SEASON_LEAGUE_PREDICTION_READ_CONCURRENCY,\n)',
    )
    expect(source).toContain('return runSeasonLeaguePredictionRead(async () => {')
  })
})
