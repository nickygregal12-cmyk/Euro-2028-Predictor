from __future__ import annotations

import json
from pathlib import Path

MIGRATION = Path('supabase/migrations/20260805010000_cup_split_group_tables.sql')
PGTAP = Path('supabase/tests/156_cup_split_group_tables.sql')
SOURCE_TEST = Path('tests/database-parity/cupSplitGroupTablesBoundary.test.ts')


def replace_once(text: str, before: str, after: str, label: str) -> str:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(before, after)


def update_migration() -> None:
    text = MIGRATION.read_text()
    text = replace_once(
        text,
        '-- Contract 104: the Predictor Championship split table, derived across both\n-- phases.',
        '-- Contract 105: split ancestry integrity and the Predictor Championship\n-- continuing table, derived across both phases.',
        'migration contract header',
    )
    marker = 'create or replace function predictor_internal.cup_split_group_tables(p_competition_id uuid)'
    integrity = r'''begin;

-- Contract 102 made parentage representable but did not yet prove that each
-- split member actually came from the child group's parent. The read below
-- relies on that ancestry, so close the integrity gap before exposing it.
create or replace function predictor_internal.assert_bonus_cup_group_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $parent$
declare
  v_parent_competition uuid;
  v_parent_phase text;
begin
  if tg_op = 'UPDATE' then
    -- A parent with children remains fixed in the same competition and phase.
    if (new.competition_id is distinct from old.competition_id
        or new.phase_kind is distinct from old.phase_kind)
       and exists (
         select 1
         from public.bonus_cup_groups child
         where child.parent_group_id = old.id
       ) then
      raise exception 'A Cup group with split children cannot change competition or phase'
        using errcode = '23514';
    end if;

    -- Once members occupy a split group, its claimed source group is immutable.
    if old.phase_kind = 'split'
       and new.parent_group_id is distinct from old.parent_group_id
       and exists (
         select 1
         from public.bonus_cup_members member
         where member.competition_id = old.competition_id
           and member.group_id = old.id
           and member.phase_kind = 'split'
       ) then
      raise exception 'A populated split Cup group cannot change parent'
        using errcode = '23514';
    end if;
  end if;

  if new.phase_kind = 'split' then
    select parent.competition_id, parent.phase_kind
      into v_parent_competition, v_parent_phase
      from public.bonus_cup_groups parent
      where parent.id = new.parent_group_id;

    if not found then
      raise exception 'A split Cup group requires an existing parent group'
        using errcode = '23503';
    end if;
    if v_parent_competition is distinct from new.competition_id then
      raise exception 'A split Cup group and its parent must belong to the same competition'
        using errcode = '23514';
    end if;
    if v_parent_phase <> 'initial' then
      raise exception 'A split Cup group must point directly to an initial-phase group'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$parent$;

revoke all on function predictor_internal.assert_bonus_cup_group_parent()
  from public, anon, authenticated, service_role;

create or replace function predictor_internal.assert_bonus_cup_member_split_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $member$
declare
  v_parent_group_id uuid;
begin
  if tg_op = 'DELETE' then
    if old.phase_kind = 'initial'
       and exists (
         select 1
         from public.bonus_cup_members split_member
         where split_member.competition_id = old.competition_id
           and split_member.user_id = old.user_id
           and split_member.phase_kind = 'split'
       ) then
      raise exception 'Initial Cup membership is permanent after a split membership exists'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.phase_kind is distinct from old.phase_kind then
      raise exception 'Cup membership phase is immutable'
        using errcode = '23514';
    end if;

    if old.phase_kind = 'initial'
       and (new.competition_id is distinct from old.competition_id
         or new.user_id is distinct from old.user_id
         or new.group_id is distinct from old.group_id)
       and exists (
         select 1
         from public.bonus_cup_members split_member
         where split_member.competition_id = old.competition_id
           and split_member.user_id = old.user_id
           and split_member.phase_kind = 'split'
       ) then
      raise exception 'Initial Cup membership cannot move after the split'
        using errcode = '23514';
    end if;
  end if;

  if new.phase_kind = 'split' then
    select grp.parent_group_id
      into v_parent_group_id
      from public.bonus_cup_groups grp
      where grp.competition_id = new.competition_id
        and grp.id = new.group_id
        and grp.phase_kind = 'split';

    if not found then
      raise exception 'Split Cup membership requires a split-phase group'
        using errcode = '23503';
    end if;

    if not exists (
      select 1
      from public.bonus_cup_members initial_member
      where initial_member.competition_id = new.competition_id
        and initial_member.user_id = new.user_id
        and initial_member.phase_kind = 'initial'
        and initial_member.group_id = v_parent_group_id
    ) then
      raise exception 'A split Cup member must come from the split group parent'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$member$;

revoke all on function predictor_internal.assert_bonus_cup_member_split_parent()
  from public, anon, authenticated, service_role;

create trigger assert_bonus_cup_member_split_parent
before insert or update or delete
on public.bonus_cup_members
for each row
execute function predictor_internal.assert_bonus_cup_member_split_parent();

'''
    text = replace_once(text, marker, integrity + marker, 'integrity insertion')
    text = text.rstrip() + '\n\ncommit;\n'
    MIGRATION.write_text(text)


def update_pgtap() -> None:
    text = PGTAP.read_text()
    text = text.replace('-- Contract 104:', '-- Contract 105:', 1)
    text = replace_once(text, 'select plan(16);', 'select plan(22);', 'pgTAP plan')
    text = text.replace(
        '-- Six entrants, two initial groups of three, drawn by the real admin path.\n'
        '-- Matchday 1 is played in the league phase. The split then cuts ACROSS the\n'
        '-- initial groups — split group A takes two entrants who already met each other\n'
        '-- and one who did not — so the carry-forward has something to bite on.',
        '-- Seven entrants: six in the one valid source group that is divided into\n'
        '-- top and bottom halves, plus one entrant in another initial group used only\n'
        '-- to prove cross-parent split membership is refused. Matchday 1 is played in\n'
        '-- the league phase before the valid source group divides.',
    )
    text = text.replace('from generate_series(1, 6) as n;', 'from generate_series(1, 7) as n;', 3)

    start = text.index("select public.admin_draw_predictor_cup(md5('c5-comp')::uuid, 'EURO2028-C5-SEED');")
    end_marker = "create or replace function pg_temp.entry_of(p_user text)"
    end = text.index(end_marker, start)
    manual = r'''insert into public.bonus_cup_groups (
  id, competition_id, tournament_id, ordinal, size, phase_kind
) values
  (md5('c5-initial')::uuid, md5('c5-comp')::uuid,
   current_setting('test.c5_tournament_id')::uuid, 1, 6, 'initial'),
  (md5('c5-other-initial')::uuid, md5('c5-comp')::uuid,
   current_setting('test.c5_tournament_id')::uuid, 2, 3, 'initial');

insert into public.bonus_cup_members (
  competition_id, user_id, group_id, phase_kind, draw_number
)
select
  md5('c5-comp')::uuid,
  md5('c5-user-' || n)::uuid,
  md5('c5-initial')::uuid,
  'initial',
  n
from generate_series(1, 6) as n;

insert into public.bonus_cup_members (
  competition_id, user_id, group_id, phase_kind, draw_number
) values (
  md5('c5-comp')::uuid, md5('c5-user-7')::uuid,
  md5('c5-other-initial')::uuid, 'initial', 7
);

select set_config('test.c5_x', md5('c5-user-1')::text, true);
select set_config('test.c5_y', md5('c5-user-2')::text, true);
select set_config('test.c5_p', md5('c5-user-3')::text, true);
select set_config('test.c5_q', md5('c5-user-4')::text, true);
select set_config('test.c5_z', md5('c5-user-5')::text, true);
select set_config('test.c5_r', md5('c5-user-6')::text, true);

insert into public.bonus_cup_fixtures (
  competition_id, tournament_id, stage, group_id, window_id, matchday,
  home_user_id, away_user_id
) values
  (md5('c5-comp')::uuid, current_setting('test.c5_tournament_id')::uuid,
   'group', md5('c5-initial')::uuid, md5('c5-w1')::uuid, 1,
   current_setting('test.c5_x')::uuid, current_setting('test.c5_y')::uuid),
  (md5('c5-comp')::uuid, current_setting('test.c5_tournament_id')::uuid,
   'group', md5('c5-initial')::uuid, md5('c5-w1')::uuid, 1,
   current_setting('test.c5_p')::uuid, current_setting('test.c5_q')::uuid);

insert into public.bonus_window_fixtures (window_id, match_id) values
  (md5('c5-w1')::uuid, current_setting('test.c5_m1')::uuid);

'''
    text = text[:start] + manual + text[end:]

    text = text.replace(
        '-- The split. Group A cuts across the initial draw: X and Y already met in the\n'
        '-- league phase, P did not meet either.',
        '-- The valid split. Both child groups point to the same six-player initial\n'
        '-- group; X and Y already met there, while P met Q.',
    )
    text = text.replace(
        "(md5('c5-split-a')::uuid, md5('c5-comp')::uuid, current_setting('test.c5_tournament_id')::uuid, 3, 3, 'split',\n    (select g.id from public.bonus_cup_groups g where g.competition_id = md5('c5-comp')::uuid and g.ordinal = 1)),\n  (md5('c5-split-b')::uuid, md5('c5-comp')::uuid, current_setting('test.c5_tournament_id')::uuid, 4, 3, 'split',\n    (select g.id from public.bonus_cup_groups g where g.competition_id = md5('c5-comp')::uuid and g.ordinal = 2));",
        "(md5('c5-split-a')::uuid, md5('c5-comp')::uuid, current_setting('test.c5_tournament_id')::uuid, 3, 3, 'split', md5('c5-initial')::uuid),\n  (md5('c5-split-b')::uuid, md5('c5-comp')::uuid, current_setting('test.c5_tournament_id')::uuid, 4, 3, 'split', md5('c5-initial')::uuid);",
    )

    membership_marker = "insert into public.bonus_cup_members (competition_id, user_id, group_id, phase_kind, draw_number) values\n"
    integrity_tests = r'''select has_function(
  'predictor_internal', 'assert_bonus_cup_member_split_parent', array[]::text[],
  'split membership ancestry has an internal integrity authority'
);

select ok(
  exists (
    select 1 from pg_trigger trigger
    where trigger.tgrelid = 'public.bonus_cup_members'::regclass
      and trigger.tgname = 'assert_bonus_cup_member_split_parent'
      and not trigger.tgisinternal
  ),
  'the ancestry authority is bound to every Cup membership write'
);

select throws_ok(
  $$insert into public.bonus_cup_members
      (competition_id, user_id, group_id, phase_kind, draw_number)
    values (
      md5('c5-comp')::uuid, md5('c5-user-7')::uuid,
      md5('c5-split-a')::uuid, 'split', 7
    )$$,
  '23514',
  null,
  'a split group refuses an entrant whose initial membership belongs to another parent'
);

'''
    text = replace_once(text, membership_marker, integrity_tests + membership_marker, 'integrity test insertion')

    after_members = """  (md5('c5-comp')::uuid, current_setting('test.c5_r')::uuid, md5('c5-split-b')::uuid, 'split', 6);\n"""
    mutation_tests = r'''

select throws_ok(
  $$update public.bonus_cup_groups
       set parent_group_id = md5('c5-other-initial')::uuid
     where id = md5('c5-split-a')::uuid$$,
  '23514',
  null,
  'a populated split group cannot rewrite the source table it claims to divide'
);

select throws_ok(
  $$update public.bonus_cup_members
       set group_id = md5('c5-other-initial')::uuid
     where competition_id = md5('c5-comp')::uuid
       and user_id = md5('c5-user-1')::uuid
       and phase_kind = 'initial'$$,
  '23514',
  null,
  'an initial membership cannot move after its split membership exists'
);

select throws_ok(
  $$delete from public.bonus_cup_members
     where competition_id = md5('c5-comp')::uuid
       and user_id = md5('c5-user-1')::uuid
       and phase_kind = 'initial'$$,
  '23514',
  null,
  'an initial membership remains permanent after the split'
);
'''
    text = replace_once(text, after_members, after_members + mutation_tests, 'post-membership integrity tests')
    text = text.replace("and g.ordinal = 1),", "and g.id = md5('c5-initial')::uuid),", 1)
    text = text.replace(
        "  6,\n  'the league table still returns the initial roster only, so qualification and knockout seeding are unaffected by split membership'",
        "  7,\n  'the league table still returns the complete initial roster only, so qualification and knockout seeding are unaffected by split membership'",
    )
    PGTAP.write_text(text)


def write_source_test() -> None:
    SOURCE_TEST.write_text("""import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260805010000_cup_split_group_tables.sql'),
  'utf8',
)
const proof = readFileSync(
  resolve(process.cwd(), 'supabase/tests/156_cup_split_group_tables.sql'),
  'utf8',
)

describe('contract 105 Cup split boundary', () => {
  it('keeps the migration atomic and internal-only', () => {
    expect(migration.match(/^begin;$/gm)).toHaveLength(1)
    expect(migration.match(/^commit;$/gm)).toHaveLength(1)
    expect(migration).toContain('predictor_internal.cup_split_group_tables')
    expect(migration).toContain('predictor_internal.assert_bonus_cup_member_split_parent')
    expect(migration).toContain(
      'revoke all on function predictor_internal.cup_split_group_tables(uuid)',
    )
  })

  it('derives carry-forward rather than storing a starting total', () => {
    expect(migration).toContain("fixture.stage in ('group', 'split')")
    expect(migration).not.toMatch(/starting[_ ]points|carried[_ ]points/i)
    expect(migration).not.toMatch(/alter table[^;]+add column[^;]+points/is)
  })

  it('enforces one-parent split ancestry at the member boundary', () => {
    expect(migration).toContain(
      'A split Cup member must come from the split group parent',
    )
    expect(migration).toContain('A populated split Cup group cannot change parent')
    expect(migration).toContain('Initial Cup membership cannot move after the split')
    expect(migration).toContain('Initial Cup membership is permanent')
    expect(migration).toContain('create trigger assert_bonus_cup_member_split_parent')
  })

  it('proves a valid single-parent split and refuses cross-parent membership', () => {
    expect(proof.match(/md5\('c5-initial'\)::uuid/g)?.length).toBeGreaterThan(5)
    expect(proof).toContain("md5('c5-other-initial')::uuid")
    expect(proof).toContain(
      'a split group refuses an entrant whose initial membership belongs to another parent',
    )
    expect(proof).not.toContain('cuts ACROSS the initial groups')
  })

  it('pins the correction-after-split evidence that distinguishes derived from copied', () => {
    expect(proof).toContain('correct_match_result')
    expect(proof).toContain('AFTER the split')
    expect(proof).toContain('which a stored starting total could not have done')
  })
})
""")


def update_authorities() -> None:
    contract_path = Path('config/deployment-contract.json')
    contract = json.loads(contract_path.read_text())
    if contract['contractVersion'] != 104 or contract['requiredMigrationCount'] != 104:
        raise SystemExit('deployment contract moved while Contract 105 was restacking')
    contract['contractVersion'] = 105
    contract['requiredMigrationCount'] = 105
    contract['notes'] = contract['notes'].replace(
        'No restart driver exists yet.',
        'Contract 105 enforces one-parent split ancestry and derives the continuing Championship table from settled initial and split fixtures without copying a starting total. No restart driver exists yet; that lifecycle moves to contract 106.',
    )
    contract_path.write_text(json.dumps(contract, indent=2) + '\n')

    agents = Path('AGENTS.md')
    text = agents.read_text()
    before = "The repository is at **contract 104** through `20260805001000_live_competition_callers.sql`. Development Supabase is hosted at **103**, applied 4 August 2026 by fast-lane run 30959460638; production remains at 63. Contract 101 corrects Euro post-lock reveal; contract 102 persists the Predictor Championship split as a distinct phase while preserving the tournament Cup path; contract 103 makes competition instances repeatable behind one live public row per season game, one live row per series and season/game-scoped lineage; contract 104 makes all measured tournament-and-game callers resolve an explicit public instance before the restart driver exists. The repository contract and the hosted contracts are distinct facts. Any hosted schema mutation requires the guarded rollout workflow, explicit owner approval and the applicable preflight."
    after = "The repository is at **contract 105** through `20260805010000_cup_split_group_tables.sql`. Development Supabase is hosted at **103**, applied 4 August 2026 by fast-lane run 30959460638; production remains at 63. Contract 102 persists the Predictor Championship split as a distinct phase; contract 103 makes competition instances repeatable; contract 104 makes every measured tournament-and-game caller resolve an explicit public instance; contract 105 enforces one-parent split ancestry and derives the continuing table from settled initial and split fixtures rather than copying carried points. The LMS restart driver follows at contract 106. The repository contract and the hosted contracts are distinct facts. Any hosted schema mutation requires the guarded rollout workflow, explicit owner approval and the applicable preflight."
    text = replace_once(text, before, after, 'AGENTS live baseline')
    agents.write_text(text)

    seed = Path('e2e/seed-contract.ts')
    text = seed.read_text()
    text = replace_once(
        text,
        ' * the same row. Contract 105 supplies the restart driver.\n */\nexport const SEED_REVIEWED_AT_CONTRACT = 104',
        " * the same row.\n *\n * Contract 105 adds two internal integrity functions, one membership trigger and\n * the derived split-table read. The trigger fires only on Cup membership writes;\n * deterministic global setup creates none, and every function remains revoked\n * from browser and service roles. Contract 106 supplies the restart driver.\n */\nexport const SEED_REVIEWED_AT_CONTRACT = 105",
        'seed Contract 105 note',
    )
    seed.write_text(text)

    ops = Path('docs/ops/ops-pending-migrations.md')
    text = ops.read_text()
    text = replace_once(
        text,
        'The repository is at **contract 104**. Development is verified at **103** after fast-lane run 30959460638 and trails by one pending Contract 104 rollout.',
        'The repository is at **contract 105**. Development is verified at **103** after fast-lane run 30959460638 and trails by the two pending contracts 104–105.',
        'ops current state',
    )
    text = replace_once(
        text,
        '| Repository `main` | **104** | Contract 103 makes competition instances repeatable through `20260804333000_competition_instance_lineage.sql`; contract 104 separates live-only operational callers from terminal-aware current reads through `20260805001000_live_competition_callers.sql` | MERGED, AWAITING DEVELOPMENT ROLLOUT |',
        '| Repository `main` | **105** | Contract 104 separates live-only operational callers from terminal-aware current reads through `20260805001000_live_competition_callers.sql`; contract 105 enforces split ancestry and derives the continuing Championship table through `20260805010000_cup_split_group_tables.sql` | MERGED, AWAITING DEVELOPMENT ROLLOUT |',
        'ops repository row',
    )
    text = text.replace('VERIFIED; ONE CONTRACT BEHIND THE REPOSITORY', 'VERIFIED; TWO CONTRACTS BEHIND THE REPOSITORY')
    text = text.replace('NOW SIX BEHIND DEVELOPMENT AND SEVEN BEHIND THE REPOSITORY', 'NOW SIX BEHIND DEVELOPMENT AND EIGHT BEHIND THE REPOSITORY')
    text = text.replace('## Contracts 64–104', '## Contracts 64–105')
    text = text.replace('that is contract 105, after contract 104 moves the tournament+game readers onto the live-instance resolver.', 'that is contract 106, after contracts 104–105 close the caller and Cup-split prerequisites.')
    text = text.replace('No restart is created until contract 105.', 'No restart is created until contract 106.')
    contract104 = '- **104:** The ten measured tournament+game callers now resolve instance identity explicitly. Locks, recomputation and compatibility league creation require the live public row. Read surfaces use one internal current-public resolver: live first, otherwise the latest terminal public result, so a successor hides its predecessor without making final Cup/LMS results disappear. Contract 102\'s initial-phase Cup membership filters remain intact. No restart is created until contract 106.'
    contract105 = '- **105:** Predictor Championship split ancestry and continuing standings. Every split member must have an initial membership in the child group\'s single parent, populated children cannot change parent, and source membership cannot move or disappear. `cup_split_group_tables` derives table and tiebreak totals from settled initial and split fixtures together, so later corrections move the continuing table and no copied starting total can drift.'
    text = replace_once(text, contract104, contract104 + '\n' + contract105, 'ops Contract 105 bullet')
    text = text.replace('Contracts 64–103 are applied to development; contract 104 is pending there.', 'Contracts 64–103 are applied to development; contracts 104–105 are pending there.')
    text = text.replace('Development is verified at 103; contract 104 is the only pending development migration.', 'Development is verified at 103; contracts 104–105 are the pending development migrations.')
    text = text.replace('the repository at 104 by seven', 'the repository at 105 by eight')
    ops.write_text(text)

    status = Path('docs/quality/current-status.md')
    text = status.read_text()
    before = '| Repository contract | **104** — 104 canonical migrations through `20260805001000_live_competition_callers.sql`. Contract 104 keeps five operational tournament+game callers on the live public instance and moves five read surfaces to a terminal-aware current-public resolver, preserving final results when no successor exists while hiding predecessors once one does. Development Supabase is hosted at **103**, applied 4 August 2026 by fast-lane run 30959460638; production remains at **63**. Non-production Netlify contexts remain owner-reported at **97**, six behind development and seven behind the repository, and may now move only to the verified development level 103. |'
    after = '| Repository contract | **105** — 105 canonical migrations through `20260805010000_cup_split_group_tables.sql`. Contract 104 separates live-only operational callers from terminal-aware current reads; contract 105 enforces one-parent split ancestry and derives the continuing Championship table from settled initial and split fixtures, so carried points are never copied. Development Supabase is hosted at **103**, applied 4 August 2026 by fast-lane run 30959460638; production remains at **63**. Non-production Netlify contexts remain owner-reported at **97**, six behind development and eight behind the repository, and may now move only to the verified development level 103. |'
    text = replace_once(text, before, after, 'current-status repository row')
    text = text.replace('predates contracts 94–104', 'predates contracts 94–105')
    status.write_text(text)


def main() -> None:
    update_migration()
    update_pgtap()
    write_source_test()
    update_authorities()
    print('restacked Contract 105 with valid split ancestry and authorities')


if __name__ == '__main__':
    main()
