import { describe, expect, it } from 'vitest'
import {
  destructiveStatements,
  withoutComments,
  withoutRoutineBodies,
} from '../../scripts/check-migration-additive.mjs'

/**
 * The ADR 0024 fast lane admits additive migrations only. Deciding which are
 * additive is the whole safety property, and it can fail in both directions:
 *
 *   - too strict, and the lane refuses ordinary work until nobody uses it —
 *     which is how the ceremony ADR 0024 removed came back;
 *   - too loose, and a destructive migration skips the backup and restore
 *     rehearsal that exist for exactly that case.
 *
 * The first version was a whole-file `grep`. It refused contract 66 over a
 * `delete from` inside the body of the "leave a game" RPC — runtime behaviour
 * of a function the migration creates, not something the migration does. These
 * assertions pin the distinction that fixes it, and the direction of failure.
 */

const routine = (body: string) => `create or replace function f() returns void
language plpgsql as $$
begin
  ${body}
end;
$$;`

describe('a function body is not a migration statement', () => {
  it('ignores a delete inside a routine it merely defines', () => {
    // The exact shape that refused contract 66.
    expect(
      destructiveStatements(routine('delete from public.bonus_competition_entrants;')),
    ).toEqual([])
  })

  it('ignores drops inside a routine body', () => {
    expect(destructiveStatements(routine('drop table temp_scratch;'))).toEqual([])
  })

  it('handles an arbitrary dollar-quote tag, not just $$', () => {
    const tagged = `create function f() returns void language plpgsql as $fn$
begin delete from t; end;
$fn$;`
    expect(destructiveStatements(tagged)).toEqual([])
  })

  it('keeps the statements around the routine visible', () => {
    const sql = `${routine('delete from inner_table;')}
drop table public.real_casualty;`
    expect(destructiveStatements(sql)).toEqual(['drop table'])
  })

  it('handles several routines in one migration', () => {
    const sql = [routine('delete from a;'), routine('delete from b;'), 'truncate public.c;'].join(
      '\n',
    )
    expect(destructiveStatements(sql)).toEqual(['truncate'])
  })
})

describe('what executes at migration time is still judged', () => {
  it('flags a DO block, which runs during the migration', () => {
    // A DO block is not a definition — it executes. Excluding it alongside
    // function bodies would be the loose-direction failure.
    const sql = `do $$
begin
  delete from public.entries;
end;
$$;`
    expect(destructiveStatements(sql)).toEqual(['delete from'])
  })

  it('flags statement-level destruction', () => {
    expect(destructiveStatements('drop table public.entries;')).toEqual(['drop table'])
    expect(destructiveStatements('truncate public.entries;')).toEqual(['truncate'])
    expect(destructiveStatements('alter table t drop column c;')).toHaveLength(1)
  })
})

describe('comments cannot hide or invent a finding', () => {
  it('ignores a destructive statement that is only described', () => {
    expect(destructiveStatements('-- we deliberately never drop table entries here\n')).toEqual([])
  })

  it('still sees a statement following a comment', () => {
    expect(destructiveStatements('-- tidy up\ndrop table t;')).toEqual(['drop table'])
  })

  it('strips block comments too', () => {
    expect(withoutComments('/* drop table t; */ select 1;')).not.toMatch(/drop/)
  })
})

describe('the parser fails towards refusal', () => {
  it('keeps the text when a routine body is never closed', () => {
    // An unterminated body could otherwise swallow the rest of the file and
    // hide every statement after it.
    const truncated = `create function f() returns void language plpgsql as $$
begin
  select 1;
-- no closing tag
drop table public.entries;`
    expect(withoutRoutineBodies(truncated)).toContain('drop table public.entries')
    expect(destructiveStatements(truncated)).toEqual(['drop table'])
  })

  it('does not treat a bare create function without a body as an opening', () => {
    expect(destructiveStatements('create function f();\ndrop table t;')).toEqual(['drop table'])
  })
})

describe('the real contract-66 migration', () => {
  it('is additive, which is why the lane may carry it', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    const sql = readFileSync(
      'supabase/migrations/20260803070000_c1b_game_catalogue_memberships.sql',
      'utf8',
    )
    expect(destructiveStatements(sql)).toEqual([])
  })
})
