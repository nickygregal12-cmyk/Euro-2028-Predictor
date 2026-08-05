import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ALLOWED_FIXTURE_STATUSES,
  COMPETITIONS,
  STATUS_MAP,
} from '../../scripts/ops/provider-bakeoff'

/**
 * The bake-off harness itself is mostly network, and network is not what goes
 * wrong with it. What goes wrong is the two lookup tables drifting away from
 * the things they claim to describe — and both drifts are silent until a real
 * season is running on them.
 */

describe('the status map targets only what the database allows', () => {
  const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260803193000_season_fixtures.sql'),
    'utf8',
  )

  it('reads the permitted statuses out of the migration rather than trusting the copy', () => {
    // If someone widens or narrows the CHECK, this is the assertion that
    // notices. The duplicated list in the harness exists so the mapping can be
    // tested without a database; that duplication is only safe while something
    // compares it to the original.
    const check = /status in \(([^)]*)\)/.exec(migration)
    expect(check, 'season_fixtures_status_allowed CHECK not found').toBeTruthy()
    const declared = [...check![1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort()
    expect(declared).toEqual([...ALLOWED_FIXTURE_STATUSES].sort())
  })

  it('never maps a provider status to a value the CHECK would reject', () => {
    for (const [raw, mapped] of Object.entries(STATUS_MAP)) {
      expect(
        ALLOWED_FIXTURE_STATUSES,
        `${raw} maps to "${mapped}", which season_fixtures would refuse`,
      ).toContain(mapped)
    }
  })

  it('keeps abandoned and void distinct, because settlement treats them oppositely', () => {
    // An abandoned fixture carries the prediction to the replay in full; a void
    // one leaves the matches-played denominator. Collapsing them — the obvious
    // simplification — silently changes everybody's points per game.
    const abandoned = Object.entries(STATUS_MAP).filter(([, v]) => v === 'abandoned')
    const voided = Object.entries(STATUS_MAP).filter(([, v]) => v === 'void')
    expect(abandoned.length).toBeGreaterThan(0)
    expect(voided.length).toBeGreaterThan(0)
    expect(abandoned.map(([k]) => k)).not.toEqual(voided.map(([k]) => k))
  })
})

describe('the competition table describes seasons this platform actually has', () => {
  const seedSql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260803193000_season_fixtures.sql'),
    'utf8',
  )

  it('names both seeded league seasons, including the discriminating one', () => {
    // The Scottish Premiership is the case that separates tiers: an entry plan
    // carrying the large European leagues and not the SPFL does not cover this
    // product, and a bake-off run only against the Premier League would report
    // a provider as suitable when it is not.
    const rows = Object.values(COMPETITIONS).map((entry) => entry.seasonRow)
    expect(rows).toContain('Premier League 2026/27')
    expect(rows).toContain('Scottish Premiership 2026/27')
    expect(seedSql).toContain('league_season')
  })

  it('declares an identifier slot for every provider the decoders support', () => {
    for (const [key, entry] of Object.entries(COMPETITIONS)) {
      expect(Object.keys(entry.ids).sort(), `${key} is missing a provider`).toEqual([
        'api-football',
        'football-data',
        'sportmonks',
      ])
    }
  })
})
