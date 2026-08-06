import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract 125's season result entry, against the boundary it must not move.
 *
 * THE GUARD THAT MATTERS IS THE SOLE-WRITER SCAN. This repository's standing
 * rule is that live and provider data is provisional and protected
 * confirmation/correction is the official scoring gate. Contract 125 does not
 * add a mechanism to enforce that — it relies on a fact: contract 117's
 * importer writes `kickoff_at` and nothing else, so after this contract exactly
 * four functions write `season_fixtures`, and only three of them can write a
 * score.
 *
 * A fact is only a guarantee while something checks it. A future ingestion
 * contract that sets `home_score` from a provider payload would break the gate
 * without touching a single file this test names, which is why the scan runs
 * over every migration rather than over contract 125's.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

function migration(file: string): string {
  return readFileSync(resolve(migrationsDirectory, file), 'utf8')
}

const CONTRACT_125 = '20260806160000_season_fixture_result_entry.sql'
const source = migration(CONTRACT_125)

/**
 * The migration with its prose removed.
 *
 * Needed because this contract's header EXPLAINS at length that it deliberately
 * does not call the scoring job — so a scan for that call over the raw text
 * finds the sentence saying it is absent and reports it as present. The first
 * run of this guard did exactly that.
 */
const executableSource = source.replaceAll(/^[ \t]*--.*$/gm, '')

/** Every migration's text, comments stripped, so prose cannot trip the scans. */
const executableMigrations = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .map((file) => ({ file, sql: migration(file).replaceAll(/^[ \t]*--.*$/gm, '') }))

/** The routine a match sits inside, for a message that names the culprit. */
function enclosingRoutine(sql: string, at: number): string {
  return (
    [
      ...sql
        .slice(0, at)
        .matchAll(/create\s+(?:or\s+replace\s+)?function\s+[a-z_]+\.([a-z_]+)\s*\(/gi),
    ].at(-1)?.[1] ?? '(statement level)'
  )
}

describe('only the confirmation path can give a season fixture a score', () => {
  const SCORE_WRITE = /update\s+public\.season_fixtures\b[\s\S]{0,400}?\bset\b[\s\S]{0,300}?\b(?:home_score|away_score)\s*=/gi

  const writers = executableMigrations.flatMap(({ file, sql }) =>
    [...sql.matchAll(SCORE_WRITE)].map((match) => ({
      file,
      routine: enclosingRoutine(sql, match.index),
    })),
  )

  it('finds the write it is scanning for', () => {
    // If the regex stops matching, the assertion below passes on an empty list.
    expect(writers.length).toBeGreaterThan(0)
  })

  it('is written by record_season_fixture_result and nothing else', () => {
    const others = writers.filter((writer) => writer.routine !== 'record_season_fixture_result')
    expect(
      others.map((writer) => `${writer.file}: ${writer.routine}`),
      'something other than the confirmation path writes a season fixture score; ' +
        'provider data is provisional and confirmation is the official gate',
    ).toEqual([])
  })

  it('leaves the provider importer unable to write one', () => {
    // Contract 117 chose to revise a kickoff and nothing else. That choice is
    // what makes the gate hold without a new mechanism, so it is asserted here
    // rather than assumed to stay true.
    const importer = migration('20260805130000_provider_fixture_revision_import.sql')
    const redefinition = migration('20260806140000_round_window_stale_refresh.sql')
    for (const text of [importer, redefinition]) {
      expect(text).not.toMatch(/set\s+kickoff_at[\s\S]{0,200}?home_score/)
      expect(text).not.toMatch(/set[^;]{0,200}home_score\s*=/)
    }
  })
})

describe('the administrator gate is the same one the tournament path uses', () => {
  const ENTRY_POINTS = [
    'admin_confirm_season_fixture_result',
    'admin_correct_season_fixture_result',
    'admin_clear_season_fixture_result',
  ] as const

  it.each(ENTRY_POINTS)('%s calls require_result_admin before doing anything', (name) => {
    const body = new RegExp(
      `create or replace function public\\.${name}\\(([\\s\\S]*?)\\$\\$;`,
    ).exec(source)?.[1]
    expect(body, `${name} is not defined`).toBeDefined()
    expect(body).toContain('perform predictor_internal.require_result_admin();')
    // The gate runs first. A guard after the write is not a guard.
    expect(body?.indexOf('require_result_admin')).toBeLessThan(
      body?.indexOf('record_season_fixture_result') ?? Infinity,
    )
  })

  it('defines no second admin model', () => {
    expect(source).not.toMatch(/admin_role|admin_capabilities/)
  })

  it('keeps the writer beneath the gate unreachable by any role', () => {
    expect(source).toMatch(
      /revoke all on function predictor_internal\.record_season_fixture_result\([\s\S]{0,80}?\)\s+from public, anon, authenticated, service_role/,
    )
    expect(source).not.toMatch(
      /grant execute on function predictor_internal\.record_season_fixture_result/,
    )
  })

  it('grants the three entry points to authenticated, as every admin RPC is shaped', () => {
    for (const name of ENTRY_POINTS) {
      expect(source).toMatch(new RegExp(`grant execute on function public\\.${name}\\(`))
    }
    expect(source).not.toMatch(/grant execute on function public\.admin_\w+ to anon/)
  })
})

describe('the contract writes a result and settles nothing', () => {
  it('never calls the scoring job or the settler', () => {
    // `process_due_season_matchweek_scores` rederives every league season on
    // every run with no "already scored" filter, precisely so a correction is
    // picked up without its writer knowing anything about scoring. Calling it
    // here would put a second answer beside that one.
    expect(executableSource).not.toContain('settle_season_matchweek_scores')
    expect(executableSource).not.toContain('process_due_season_matchweek_scores')
    expect(executableSource).not.toMatch(/insert into public\.season_matchweek_scores/)
  })

  it('writes no score, standing, prediction or lock of its own', () => {
    for (const relation of [
      'season_matchweek_scores',
      'season_predictions',
      'season_matchweek_jokers',
      'bonus_score_events',
    ]) {
      expect(executableSource).not.toMatch(new RegExp(`(insert into|update)\\s+public\\.${relation}`))
    }
  })
})

describe('a league result is ninety minutes and may be drawn', () => {
  it('takes one pair of scores, with no method, extra time or penalties', () => {
    // The tournament RPCs carry all three because a knockout tie must produce a
    // winner. A league fixture cannot, so their absence here is the rule rather
    // than an omission — and a later signature that grew them would be scoring
    // a season matchweek by a rule ADR 0012 does not have.
    expect(source).toMatch(
      /create or replace function public\.admin_confirm_season_fixture_result\(\s*p_season_fixture_id uuid,\s*p_home smallint,\s*p_away smallint,\s*p_reason text default null\s*\)/,
    )
    expect(source).not.toMatch(/p_method|p_home_120|p_home_penalties/)
  })

  it('requires a reason to change or remove a result, and not to record one', () => {
    // Deliberately stricter than the tournament path. By the time a season
    // result is corrected, points have been banked against it.
    expect(source).toMatch(
      /if p_action in \('correct', 'clear'\) and v_reason is null then/,
    )
    expect(source).toMatch(
      /create or replace function public\.admin_confirm_season_fixture_result\([\s\S]{0,200}?p_reason text default null/,
    )
    expect(source).toMatch(
      /create or replace function public\.admin_correct_season_fixture_result\([\s\S]{0,200}?p_reason text\s*\n\s*\)/,
    )
  })

  it('accepts a postponed fixture that was eventually played', () => {
    expect(source).toMatch(/v_fixture\.status not in \('scheduled', 'postponed'\)/)
  })

  it('refuses a correction that changes nothing', () => {
    expect(source).toMatch(
      /if v_fixture\.home_score = p_home and v_fixture\.away_score = p_away then/,
    )
  })
})

describe('the revision record is evidence', () => {
  it('cannot be updated or deleted at all, unlike the two review queues', () => {
    // Contracts 117 and 123 permit one update — marking a row reviewed. There
    // is nothing to review here, so no update is legitimate: a mistake is
    // corrected by recording another revision.
    expect(source).toMatch(
      /create trigger block_season_result_revision_rewrite\s+before update or delete/,
    )
    expect(source).toMatch(/raise exception 'A season fixture result revision may not be %/)
  })

  it('numbers revisions per fixture so the history is ordered and complete', () => {
    expect(source).toMatch(/unique \(season_fixture_id, revision\)/)
    expect(source).toMatch(
      /select coalesce\(max\(existing\.revision\), 0\) \+ 1/,
    )
  })

  it('records what the result was before, not only what it became', () => {
    expect(source).toMatch(/previous_result jsonb not null/)
    expect(source).toMatch(/new_result jsonb not null/)
    expect(source).toMatch(/previous_result is distinct from new_result/)
  })
})
