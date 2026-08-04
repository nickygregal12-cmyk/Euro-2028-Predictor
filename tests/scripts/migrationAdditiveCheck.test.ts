import { describe, expect, it } from 'vitest'
import {
  destructiveStatements,
  structuralStatements,
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

describe('removing a guarantee is a third category, not an oversight', () => {
  it('does not call a constraint drop destructive — it loses no row', () => {
    expect(destructiveStatements('alter table t drop constraint t_key;')).toEqual([])
  })

  it('but does report it, so the rollout record names what went', () => {
    // The failure this replaces: the destructive pattern never named
    // `constraint`, so the lane carried these in silence and the record read as
    // though nothing structural had happened.
    expect(structuralStatements('alter table t drop constraint t_key;')).toEqual(['drop constraint'])
  })

  it('recognises the idiomatic if-exists form', () => {
    expect(structuralStatements('alter table t drop constraint if exists t_key;')).toEqual([
      'drop constraint if exists',
    ])
  })

  it('reports an index drop for the same reason', () => {
    expect(structuralStatements('drop index public.t_idx;')).toEqual(['drop index'])
  })

  it('says nothing about a migration that only adds a constraint', () => {
    expect(structuralStatements('alter table t add constraint t_key unique (a, b);')).toEqual([])
  })

  it('ignores a constraint drop inside a routine body, like every other category', () => {
    expect(structuralStatements(routine('alter table t drop constraint c;'))).toEqual([])
  })

  it('still sees a constraint drop that a comment merely describes as absent', () => {
    expect(structuralStatements('-- this migration drops no constraint\n')).toEqual([])
  })

  it('does not let dropping a table hide behind the softer category', () => {
    // A table drop takes its constraints with it. It must stay destructive.
    const sql = 'drop table public.entries;'
    expect(destructiveStatements(sql)).toEqual(['drop table'])
    expect(structuralStatements(sql)).toEqual([])
  })
})

describe('a trigger that is immediately re-created was never removed', () => {
  // The house form for defining a trigger, used by sixteen migrations. Contract
  // 103 was the first carrying it to reach the fast lane, which refused it —
  // correct by the letter, wrong by the intent, and with no general guarded lane
  // to fall back to.
  const recreation = `drop trigger if exists prepare_lineage on public.bonus_competitions;
create trigger prepare_lineage
before insert on public.bonus_competitions
for each row
execute function predictor_internal.prepare_lineage();`

  it('is not destructive — the trigger is back on the next line', () => {
    expect(destructiveStatements(recreation)).toEqual([])
  })

  it('is still reported, so the rollout record never carries it in silence', () => {
    expect(structuralStatements(recreation)).toEqual([
      'drop trigger prepare_lineage on bonus_competitions (re-created immediately)',
    ])
  })

  it('accepts the drop and the create qualifying the table differently', () => {
    // Both spellings appear in this repository, sometimes across one pairing.
    const mixed = `drop trigger if exists recompute_scores on matches;
create trigger recompute_scores after update on public.matches
for each row execute function public.recompute();`
    expect(destructiveStatements(mixed)).toEqual([])
  })

  it('does not require `if exists` — the pairing is what makes it safe', () => {
    const bare = `drop trigger t on public.m;
create trigger t after insert on public.m for each row execute function f();`
    expect(destructiveStatements(bare)).toEqual([])
  })

  // The mutations. Each is a way the pairing could be faked, and each must
  // remain destructive — this is the loose-direction failure the lane exists to
  // prevent.
  it('refuses a drop that is never re-created', () => {
    expect(destructiveStatements('drop trigger if exists gone on public.m;')).toEqual([
      'drop trigger',
    ])
  })

  it('refuses a drop whose create names a DIFFERENT trigger', () => {
    const swapped = `drop trigger if exists enforce_lock on public.m;
create trigger something_else after insert on public.m for each row execute function f();`
    expect(destructiveStatements(swapped)).toEqual(['drop trigger'])
  })

  it('refuses a drop whose create binds a DIFFERENT table', () => {
    // A trigger name is scoped to its table, so same-name-different-table is two
    // triggers and one of them is genuinely gone.
    const moved = `drop trigger if exists audit on public.entries;
create trigger audit after insert on public.matches for each row execute function f();`
    expect(destructiveStatements(moved)).toEqual(['drop trigger'])
  })

  it('refuses a drop with another statement between it and the create', () => {
    // The trigger is absent while that statement runs, so the enforcement gap
    // is real rather than notional.
    const separated = `drop trigger if exists t on public.m;
update public.m set flag = true;
create trigger t after insert on public.m for each row execute function f();`
    expect(destructiveStatements(separated)).toEqual(['drop trigger'])
  })

  it('refuses a quoted identifier it cannot parse confidently', () => {
    const quoted = `drop trigger if exists "MixedCase" on public.m;
create trigger "MixedCase" after insert on public.m for each row execute function f();`
    expect(destructiveStatements(quoted)).toEqual(['drop trigger'])
  })

  it('keeps a second, unpaired drop visible alongside a paired one', () => {
    // Blanking the paired drop must not blind the scan to the one beside it.
    const mixed = `drop trigger if exists kept on public.m;
create trigger kept after insert on public.m for each row execute function f();
drop trigger if exists removed on public.other;`
    expect(destructiveStatements(mixed)).toEqual(['drop trigger'])
  })

  it('does not let a table drop hide behind a trigger re-creation', () => {
    const sql = `drop trigger if exists t on public.m;
create trigger t after insert on public.m for each row execute function f();
drop table public.entries;`
    expect(destructiveStatements(sql)).toEqual(['drop table'])
  })

  it('ignores the pairing inside a routine body, like every other category', () => {
    expect(
      structuralStatements(
        routine('drop trigger if exists t on public.m; create trigger t after insert on public.m;'),
      ),
    ).toEqual([])
  })
})

describe('the real contract-103 migration', () => {
  it('is carried by the fast lane, with its trigger re-creation named', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    const sql = readFileSync(
      'supabase/migrations/20260804333000_competition_instance_lineage.sql',
      'utf8',
    )
    expect(destructiveStatements(sql)).toEqual([])
    expect(structuralStatements(sql)).toContain(
      'drop trigger prepare_competition_lineage on bonus_competitions (re-created immediately)',
    )
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
