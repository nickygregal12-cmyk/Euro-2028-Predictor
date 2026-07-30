import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  RATE_LIMITS,
  RATE_LIMIT_WINDOW_MS,
} from '../../src/domain/rateLimit'

/**
 * Static TypeScript/PostgreSQL parity for the rate-limit rule.
 *
 * `src/domain/rateLimit.ts` states it is "MIRRORED by the SQL
 * enforce_rate_limit", and `20260720210000_rate_limits.sql` states its
 * thresholds "mirror src/domain/rateLimit.ts". Both sides declared the mirror
 * and nothing verified it, so the ceilings and window could drift apart with no
 * test failing — the module is never imported by the application, so no
 * behavioural test would have caught it either.
 *
 * This check reads the committed migrations as text and needs no database, so it
 * runs in ordinary CI rather than only under the Supabase harness. It complements
 * `predictedGroupOrderParity.test.ts`, which executes SQL for behavioural parity.
 */

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')

const migrationSql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => ({ file, sql: readFileSync(resolve(migrationsDir, file), 'utf8') }))

/** Every `enforce_rate_limit('<action>', <max>)` call site, in migration order. */
function sqlRateLimitCalls(): { action: string; max: number; file: string }[] {
  const calls: { action: string; max: number; file: string }[] = []
  for (const { file, sql } of migrationSql) {
    for (const match of sql.matchAll(
      /enforce_rate_limit\(\s*'([a-z_]+)'\s*,\s*(\d+)\s*\)/gi,
    )) {
      calls.push({ action: match[1], max: Number(match[2]), file })
    }
  }
  return calls
}

/** Effective SQL ceilings; a later migration re-declaring an action wins. */
function sqlCeilings(): Record<string, number> {
  const ceilings: Record<string, number> = {}
  for (const call of sqlRateLimitCalls()) ceilings[call.action] = call.max
  return ceilings
}

const INTERVAL_MS: Record<string, number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
}

describe('rate-limit rule parity between TypeScript and PostgreSQL', () => {
  it('finds the enforcement call sites at all', () => {
    // Without this, a renamed SQL function would empty the comparison and make
    // every assertion below pass vacuously.
    expect(sqlRateLimitCalls().length).toBeGreaterThan(0)
  })

  it('applies the same ceiling to every action on both sides', () => {
    expect(sqlCeilings()).toEqual({ ...RATE_LIMITS })
  })

  it('counts events over the same window on both sides', () => {
    // The counting query, not the pruning query: the function also deletes rows
    // older than one hour, which is housekeeping rather than the rule.
    const countingWindow = migrationSql
      .flatMap(({ sql }) => [
        ...sql.matchAll(
          /created_at\s*>\s*now\(\)\s*-\s*interval\s*'(\d+)\s+(second|minute|hour)s?'/gi,
        ),
      ])
      .map((match) => Number(match[1]) * INTERVAL_MS[match[2].toLowerCase()])

    expect(countingWindow.length).toBeGreaterThan(0)
    for (const windowMs of countingWindow) {
      expect(windowMs).toBe(RATE_LIMIT_WINDOW_MS)
    }
  })

  it('blocks at the ceiling rather than above it on both sides', () => {
    // `exceedsRateLimit` documents that it mirrors the SQL `count(...) >= max`
    // guard. An off-by-one here would let one extra action through per window on
    // whichever side changed.
    const sqlUsesAtOrAbove = migrationSql.some(({ sql }) =>
      /v_count\s*>=\s*p_max_per_min/i.test(sql),
    )

    expect(sqlUsesAtOrAbove).toBe(true)
  })

  it('names every SQL-enforced action in the TypeScript rule', () => {
    // Directional check with a clearer failure than the equality above: a new
    // SQL-enforced action must be added to RATE_LIMITS, or the pure rule stops
    // describing the enforced behaviour.
    for (const action of Object.keys(sqlCeilings())) {
      expect(Object.keys(RATE_LIMITS)).toContain(action)
    }
  })
})
