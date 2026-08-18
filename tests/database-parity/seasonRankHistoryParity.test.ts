import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 192 — position over time, and one season-long rivalry.
 *
 * WHAT THESE GUARDS EXIST FOR is that contract 192 adds a SECOND function that
 * ranks a season, and a second ranking is the thing this repository has spent
 * several contracts refusing to create. The mitigation is that it reuses
 * contract 94's expression and its whole field, and that
 * `240_season_rank_history_and_rivalry.sql` RUNS BOTH AUTHORITIES and requires
 * them to agree rather than comparing their `order by` clauses by eye.
 *
 * These assertions hold the properties that survive a rewrite. The behavioural
 * proof is the pgTAP differential, which runs against a rebuilt schema in CI.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')
const testsDirectory = resolve(repositoryRoot, 'supabase/tests')

const CONTRACT_192 = '20260817130000_season_rank_history_and_rivalry.sql'
const CONTRACT_94 = '20260804223000_season_standings_parity.sql'
const SUITE_192 = '240_season_rank_history_and_rivalry.sql'

function read(directory: string, file: string): string {
  return readFileSync(resolve(directory, file), 'utf8')
}

/** Comments stripped, whitespace collapsed. Prose is not the contract. */
function executable(text: string): string {
  return text
    .replaceAll(/--.*$/gm, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

const migration = read(migrationsDirectory, CONTRACT_192)
const body = executable(migration)

/**
 * The migration's function definitions, WITHOUT its in-transaction guard block.
 *
 * The guard quotes the very strings it forbids — `'your_prediction'`,
 * `p_now`, `left join public.season_matchweek_scores` — so an assertion that
 * searched the whole file would match the guard and fail against a correct
 * implementation. That happened on the first draft of this suite and on
 * contract 191's, which is why it is stated here rather than discovered again.
 */
const definitions = body.slice(0, body.indexOf('do $$ declare v_history'))
const canonical = executable(read(migrationsDirectory, CONTRACT_94))
const suite = read(testsDirectory, SUITE_192)

describe('there is one interpretation of a tie, not two', () => {
  it('ranks with the same function the canonical standings rank with', () => {
    // Both must say `rank()`. `dense_rank` gives 1, 2, 2, 3 where the authority
    // gives 1, 2, 2, 4, and `row_number` breaks ties arbitrarily.
    expect(canonical).toContain('rank() over (order by totals.points desc)')
    expect(body).toContain(
      'rank() over ( partition by cumulative.ordinal order by cumulative.points desc )',
    )
  })

  it('introduces no other ranking function anywhere in the contract', () => {
    expect(definitions).not.toContain('dense_rank()')
    // `row_number` is legitimate for paging, and this contract pages nothing.
    expect(definitions).not.toContain('row_number()')
  })

  it('ranks over the season’s whole field, as the canonical standings do', () => {
    // Deriving the field from who has SCORED shrinks it in early matchweeks and
    // inflates everybody's position — and it looks entirely reasonable.
    expect(canonical).toContain('from public.entries entry')
    expect(body).toContain('from public.entries entry where entry.tournament_id = p_tournament_id')
  })

  it('accumulates by matchweek number rather than by settlement time', () => {
    // A postponed matchweek settles late. ADR 0020's amendment and contract
    // 150's ordering both say a matchweek keeps its number.
    expect(body).toContain('order by settled.ordinal')
    expect(definitions).not.toMatch(/order by [a-z_]*\.settled_at/)
  })
})

describe('the differential is real and can fail', () => {
  it('runs both authorities rather than asserting they match', () => {
    expect(suite).toContain('predictor_internal.season_standings(')
    expect(suite).toContain('predictor_internal.season_rank_history(')
    expect(suite).toContain('the rank history agrees with the canonical standings')
  })

  it('requires the fixture to contain ties', () => {
    // THE ASSERTION ABOUT THE ASSERTION. A differential over twelve distinct
    // totals passes against `dense_rank` and `row_number` alike, so the suite
    // proves its own fixture has collisions before trusting the comparison.
    expect(suite).toContain('the fixture really does contain ties')
  })

  it('covers the late joiner and the player who banked nothing', () => {
    expect(suite).toContain('a player who joined late is in the table on zero')
    expect(suite).toContain('a matchweek the opponent could not play is not part of the record')
    expect(suite).toContain('rather than a whitewash')
  })

  it('covers a matchweek that settled out of order', () => {
    expect(suite).toContain('even where a matchweek settled out of order')
  })
})

describe('the comparison discloses no more than the reads it is built on', () => {
  it('takes its permission from contract 191’s single authority', () => {
    expect(body).toContain('predictor_internal.season_player_reach(')
    // And re-runs contract 191's catalogue guard, so this contract cannot be
    // the migration that quietly adds a second visibility rule.
    expect(body).toContain(
      'perform predictor_internal.assert_single_season_player_visibility_authority();',
    )
  })

  it('speaks only about matchweeks the lock authority has released', () => {
    expect(body).toContain('predictor_internal.season_matchweek_lock_at(')
    expect(body).not.toContain('lock_at from public.tournaments')
  })

  it('never accepts a caller-supplied instant', () => {
    // Asserted on declared parameter TYPES rather than names, because the
    // migration's own guard contains the strings it forbids.
    expect(definitions).not.toMatch(/p_\w+ timestamp/)
  })

  it('returns no individual prediction', () => {
    // The rivalry read counts exact scores and correct outcomes; it must not
    // carry a scoreline. Contract 129 owns that, per matchweek, after the lock.
    expect(definitions).not.toContain("'your_prediction'")
    expect(definitions).not.toContain("'their_prediction'")
  })

  it('counts a head-to-head matchweek only when both players banked it', () => {
    // The whole difference between an honest record and a manufactured 12-0 is
    // one word. Both joins onto the banked scores must be INNER.
    expect(definitions).not.toContain('left join public.season_matchweek_scores mine')
    expect(definitions).not.toContain('left join public.season_matchweek_scores theirs')
    expect(definitions).toContain('join public.season_matchweek_scores mine')
    expect(definitions).toContain('join public.season_matchweek_scores theirs')
  })

  it('emits the auth identifier only where a profile will answer', () => {
    expect(definitions).not.toMatch(/'playerId', to_jsonb\(side\.user_id\)\)/)
    expect(body).toContain("case when v_reach in ('self', 'profile') then to_jsonb(side.user_id) end")
  })
})

describe('the reads are bounded', () => {
  it('caps the history above any real calendar rather than leaving it open', () => {
    expect(body).toContain('limit 60')
  })

  it('clamps the recent window rather than trusting the caller', () => {
    expect(body).toContain('least(greatest(coalesce(p_recent, 5), 1), 20)')
  })

  it('answers a whole comparison in one call', () => {
    // The point of the contract. If this ever grew a per-matchweek parameter,
    // the browser loop contract 192 exists to prevent would be back.
    expect(body).toContain('get_season_rivalry( p_tournament_id uuid, p_opponent_ref uuid, p_recent integer default 5 )')
  })
})

describe('nothing here writes', () => {
  it('contains no insert, update or delete', () => {
    expect(definitions).not.toMatch(/\b(insert into|update|delete from) public\./)
  })
})
