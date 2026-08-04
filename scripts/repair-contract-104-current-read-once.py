from __future__ import annotations

import re
from pathlib import Path

MIGRATION = Path('supabase/migrations/20260805001000_live_competition_callers.sql')
PGTAP = Path('supabase/tests/155_live_competition_callers.sql')
SOURCE_TEST = Path('tests/database-parity/liveCompetitionCallerBoundary.test.ts')

OPERATIONAL = [
    ('predictor_internal.enforce_season_matchweek_lock()', 'matchweek lock'),
    ('predictor_internal.prepare_competition_season_scope()', 'season-scope trigger'),
    ('predictor_internal.recompute_ko_predictor_for_match(uuid)', 'KO rederive'),
    ('predictor_internal.recompute_lms_for_tournament(uuid)', 'LMS rederive'),
    ('public.create_league(uuid,text)', 'league compatibility RPC'),
]
READS = [
    ('public.get_bonus_games(uuid)', 'Bonus Games hub'),
    ('public.get_competition_games(uuid)', 'competition game catalogue'),
    ('public.get_ko_predictor_standings(uuid,integer,text)', 'KO standings'),
    ('public.get_my_cup(uuid)', 'Cup read'),
    ('public.get_my_lms(uuid)', 'LMS read'),
]


def replace_once(text: str, before: str, after: str, label: str) -> str:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(before, after)


def rewrite_function(sql: str, function_name: str, transform) -> str:
    pattern = re.compile(
        rf'(create\s+or\s+replace\s+function\s+{re.escape(function_name)}\s*\([^;]*?\).*?\bas\s+(?P<tag>\$[A-Za-z0-9_]*\$))',
        re.IGNORECASE | re.DOTALL,
    )
    match = pattern.search(sql)
    if match is None:
        raise SystemExit(f'function not found: {function_name}')
    tag = match.group('tag')
    body_end = sql.find(tag, match.end())
    if body_end < 0:
        raise SystemExit(f'unclosed body: {function_name}')
    statement_end = sql.find(';', body_end + len(tag))
    if statement_end < 0:
        raise SystemExit(f'unterminated function: {function_name}')
    before = sql[match.start():statement_end + 1]
    after = transform(before)
    if before == after:
        raise SystemExit(f'no change made to {function_name}')
    return sql[:match.start()] + after + sql[statement_end + 1:]


def update_migration() -> None:
    sql = MIGRATION.read_text()
    helper = """-- Read surfaces need the current public run, not only a running one.
-- Prefer the live row; after a terminal finish with no successor, retain the
-- latest completed result so final standings, honours and entrant history do
-- not disappear. Once Contract 105 creates a successor, the live row wins.
create or replace function predictor_internal.current_public_competition_id(
  p_tournament_id uuid,
  p_game_key text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    predictor_internal.live_competition_id(p_tournament_id, p_game_key),
    (
      select competition.id
      from public.bonus_competitions competition
      where competition.tournament_id = p_tournament_id
        and competition.game_key = p_game_key
        and competition.visibility_kind = 'public'
        and competition.completed_at is not null
      order by competition.completed_at desc,
               competition.series_sequence desc,
               competition.id desc
      limit 1
    )
  )
$$;

revoke all on function predictor_internal.current_public_competition_id(uuid, text)
  from public, anon, authenticated, service_role;

"""
    sql = replace_once(sql, 'begin;\n\n', 'begin;\n\n' + helper, 'helper insertion')

    for function_name in [
        'public.get_bonus_games',
        'public.get_competition_games',
        'public.get_ko_predictor_standings',
        'public.get_my_cup',
        'public.get_my_lms',
    ]:
        def switch(statement: str, name=function_name) -> str:
            return replace_once(
                statement,
                'predictor_internal.live_competition_id(',
                'predictor_internal.current_public_competition_id(',
                f'{name} current resolver',
            )
        sql = rewrite_function(sql, function_name, switch)

    def restore_cup_split(statement: str) -> str:
        before = '      and member.user_id = v_uid;'
        count = statement.count(before)
        if count != 2:
            raise SystemExit(f'get_my_cup initial-membership predicates: expected two, found {count}')
        return statement.replace(
            before,
            "      and member.user_id = v_uid\n      and member.phase_kind = 'initial';",
        )

    sql = rewrite_function(sql, 'public.get_my_cup', restore_cup_split)

    sql = sql.replace(
        '-- Contract 104: every tournament+game caller resolves the live public instance.\n'
        '--\n'
        '-- Contract 103 made completed predecessors and private series representable,\n'
        '-- but deliberately created no successor. This contract moves the measured ten\n'
        '-- callers before Contract 105 creates the first restart. Direct-ID callers stay\n'
        '-- direct: a stored competition_id must continue to mean that exact historical run.',
        '-- Contract 104: every tournament+game caller resolves an explicit public instance.\n'
        '--\n'
        '-- Operational callers require the live public row. Read surfaces prefer that live\n'
        '-- row but retain the latest terminal result when no successor exists, so final\n'
        '-- standings and honours do not disappear. Direct-ID history remains direct.',
    )

    if sql.lower().count('create or replace function') != 11:
        raise SystemExit('Contract 104 must contain ten callers plus one current-read helper')
    if sql.count('predictor_internal.live_competition_id(') != 6:
        raise SystemExit('expected five operational live calls plus the helper live preference')
    if sql.count('predictor_internal.current_public_competition_id(') != 6:
        raise SystemExit('expected one helper definition plus five read calls')
    MIGRATION.write_text(sql)


def update_source_test() -> None:
    SOURCE_TEST.write_text("""import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260805001000_live_competition_callers.sql'),
  'utf8',
)
const normalizedMigration = migration.toLowerCase()

const operationalTargets = [
  'predictor_internal.enforce_season_matchweek_lock',
  'predictor_internal.prepare_competition_season_scope',
  'predictor_internal.recompute_ko_predictor_for_match',
  'predictor_internal.recompute_lms_for_tournament',
  'public.create_league',
] as const
const readTargets = [
  'public.get_bonus_games',
  'public.get_competition_games',
  'public.get_ko_predictor_standings',
  'public.get_my_cup',
  'public.get_my_lms',
] as const

describe('contract 104 competition-instance caller boundary', () => {
  it('moves the caller set atomically', () => {
    expect(normalizedMigration.match(/^begin;$/gm)).toHaveLength(1)
    expect(normalizedMigration.match(/^commit;$/gm)).toHaveLength(1)
    expect(normalizedMigration.indexOf('begin;')).toBeLessThan(
      normalizedMigration.indexOf('function predictor_internal.current_public_competition_id'),
    )
    expect(normalizedMigration.lastIndexOf('commit;')).toBeGreaterThan(
      normalizedMigration.lastIndexOf('function public.get_my_lms'),
    )
  })

  it('redefines ten callers and one internal current-read helper', () => {
    expect(migration.match(/create\s+or\s+replace\s+function/gi)).toHaveLength(11)
    expect(normalizedMigration).toContain(
      'function predictor_internal.current_public_competition_id',
    )
    for (const target of [...operationalTargets, ...readTargets]) {
      expect(normalizedMigration).toContain(`function ${target}`)
    }
  })

  it('keeps operational paths live-only and reads terminal-aware', () => {
    expect(migration.match(/predictor_internal\.live_competition_id\(/g)).toHaveLength(6)
    expect(
      migration.match(/predictor_internal\.current_public_competition_id\(/g),
    ).toHaveLength(6)
  })

  it('does not add a lifecycle driver or rewrite direct competition-id ownership', () => {
    expect(migration).not.toContain('restart_all_reentered')
    expect(migration).not.toContain('public_wipeout_restart')
    expect(migration).toContain('from public.bonus_competitions where id = new.competition_id')
  })

  it('retains Contract 102 initial-phase Cup membership', () => {
    const cupStart = normalizedMigration.indexOf('function public.get_my_cup')
    const cupEnd = normalizedMigration.indexOf('-- public.get_my_lms', cupStart)
    const cup = normalizedMigration.slice(cupStart, cupEnd)
    expect(cup.match(/member\.phase_kind = 'initial'/g)).toHaveLength(2)
  })

  it('keeps publication gates on public read surfaces', () => {
    expect(migration.match(/competition\.published/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
""")


def update_pgtap() -> None:
    lines = [
        '-- Contract 104: operational callers use the live public row; read callers',
        '-- retain the latest terminal result only when no live successor exists.',
        '',
        'begin;',
        'select plan(42);',
        '',
        "select ok(to_regprocedure('predictor_internal.current_public_competition_id(uuid,text)') is not null,",
        "  'the terminal-aware current-public resolver exists');",
        "select is(regexp_count(pg_get_functiondef('predictor_internal.current_public_competition_id(uuid,text)'::regprocedure),",
        "  'predictor_internal\\.live_competition_id\\('), 1,",
        "  'the current-public resolver prefers the live authority exactly once');",
        "select matches(pg_get_functiondef('predictor_internal.current_public_competition_id(uuid,text)'::regprocedure),",
        "  'visibility_kind = ''public''',",
        "  'the terminal fallback cannot cross into a private series');",
        "select matches(pg_get_functiondef('predictor_internal.current_public_competition_id(uuid,text)'::regprocedure),",
        "  'completed_at is not null',",
        "  'the fallback is terminal-only rather than a second live-row definition');",
        '',
    ]
    for signature, label in OPERATIONAL:
        lines.extend([
            'select matches(',
            f"  pg_get_functiondef('{signature}'::regprocedure),",
            "  'predictor_internal\\.live_competition_id\\(',",
            f"  '{label} resolves the live public instance'",
            ');',
            'select is(',
            f"  regexp_count(pg_get_functiondef('{signature}'::regprocedure),",
            "    'predictor_internal\\.live_competition_id\\('),",
            '  1,',
            f"  '{label} contains one live-instance resolution'",
            ');',
            '',
        ])
    for signature, label in READS:
        lines.extend([
            'select matches(',
            f"  pg_get_functiondef('{signature}'::regprocedure),",
            "  'predictor_internal\\.current_public_competition_id\\(',",
            f"  '{label} resolves the current public instance'",
            ');',
            'select is(',
            f"  regexp_count(pg_get_functiondef('{signature}'::regprocedure),",
            "    'predictor_internal\\.current_public_competition_id\\('),",
            '  1,',
            f"  '{label} contains one current-instance resolution'",
            ');',
            '',
        ])
    lines.extend([
        'select ok(',
        "  regexp_count(pg_get_functiondef('predictor_internal.prepare_competition_season_scope()'::regprocedure),",
        "    'where id = new\\.competition_id') >= 8,",
        "  'the season-scope trigger keeps direct-ID branches direct'",
        ');',
        'select is(',
        "  regexp_count(pg_get_functiondef('predictor_internal.recompute_ko_predictor_for_match(uuid)'::regprocedure),",
        "    'from public\\.bonus_competitions'), 0,",
        "  'the KO rederive has no independent tournament+game query'",
        ');',
        'select is(',
        "  regexp_count(pg_get_functiondef('predictor_internal.recompute_lms_for_tournament(uuid)'::regprocedure),",
        "    'from public\\.bonus_competitions'), 0,",
        "  'the LMS rederive has no independent tournament+game query'",
        ');',
        'select matches(',
        "  pg_get_functiondef('public.create_league(uuid,text)'::regprocedure),",
        "  'live_competition_id\\([[:space:]]*p_tournament_id,[[:space:]]*availability\\.game_key[[:space:]]*\\)',",
        "  'league compatibility chooses a live public prediction-entry game'",
        ');',
        'select matches(',
        "  pg_get_functiondef('public.get_bonus_games(uuid)'::regprocedure),",
        "  'current_public_competition_id\\([[:space:]]*p_tournament_id,[[:space:]]*candidate\\.game_key[[:space:]]*\\)',",
        "  'the Bonus Games hub applies current-instance resolution per game key'",
        ');',
        'select matches(',
        "  pg_get_functiondef('public.get_competition_games(uuid)'::regprocedure),",
        "  'current_public_competition_id\\([[:space:]]*p_tournament_id,[[:space:]]*availability\\.game_key[[:space:]]*\\)',",
        "  'the competition catalogue applies current-instance resolution per game key'",
        ');',
        'select ok(',
        "  regexp_count(pg_get_functiondef('public.get_my_cup(uuid)'::regprocedure),",
        "    'member\\.phase_kind = ''initial''') >= 2,",
        "  'the Cup read preserves Contract 102 initial-phase membership semantics'",
        ');',
        'select matches(',
        "  pg_get_functiondef('public.get_my_cup(uuid)'::regprocedure),",
        "  'competition\\.published',",
        "  'the Cup read keeps its publication boundary'",
        ');',
        'select is(',
        "  (select count(*)::integer from information_schema.role_routine_grants",
        "   where routine_schema = 'predictor_internal'",
        "     and routine_name = 'current_public_competition_id'",
        "     and grantee in ('PUBLIC','anon','authenticated','service_role')),",
        '  0,',
        "  'the current-public resolver is internal-only'",
        ');',
        '',
        'create temporary table c104_probe (label text primary key, id uuid not null) on commit drop;',
        'do $seed$',
        'declare',
        '  v_old public.bonus_competitions%rowtype;',
        '  v_new uuid;',
        '  v_user uuid;',
        'begin',
        '  select * into v_old',
        '  from public.bonus_competitions competition',
        "  where competition.visibility_kind = 'public'",
        '    and competition.completed_at is null',
        '    and competition.published',
        '  order by competition.game_key, competition.id',
        '  limit 1;',
        "  if v_old.id is null then raise exception 'Contract 104 needs one published public competition'; end if;",
        '  select id into v_user from public.profiles order by id limit 1;',
        "  if v_user is null then raise exception 'Contract 104 needs one seeded profile'; end if;",
        '  update public.bonus_competitions',
        "  set completed_at = now(), completion_reason = 'abandoned' where id = v_old.id;",
        '  insert into public.bonus_competitions (',
        '    tournament_id, game_key, published, availability_status,',
        '    registration_opens_at, registration_closes_at, draw_required,',
        '    draw_completed_at, visibility_kind, series_id, series_sequence,',
        '    predecessor_competition_id',
        '  ) values (',
        '    v_old.tournament_id, v_old.game_key, v_old.published, v_old.availability_status,',
        '    v_old.registration_opens_at, v_old.registration_closes_at, v_old.draw_required,',
        "    null, 'public', v_old.series_id, v_old.series_sequence + 1, v_old.id",
        '  ) returning id into v_new;',
        "  insert into c104_probe values ('tournament', v_old.tournament_id),",
        "    ('old', v_old.id), ('new', v_new), ('user', v_user);",
        "  perform set_config('request.jwt.claim.sub', v_user::text, true);",
        "  perform set_config('request.jwt.claim.role', 'authenticated', true);",
        'end',
        '$seed$;',
        '',
        'select is(',
        '  predictor_internal.live_competition_id(',
        "    (select id from c104_probe where label='tournament'),",
        '    (select game_key from public.bonus_competitions where id=(select id from c104_probe where label=\'new\'))',
        '  ), (select id from c104_probe where label=\'new\'),',
        "  'the live resolver returns the successor'",
        ');',
        'select is(',
        '  predictor_internal.current_public_competition_id(',
        "    (select id from c104_probe where label='tournament'),",
        '    (select game_key from public.bonus_competitions where id=(select id from c104_probe where label=\'new\'))',
        '  ), (select id from c104_probe where label=\'new\'),',
        "  'the current resolver prefers the live successor'",
        ');',
        'select is((select count(*)::integer from jsonb_array_elements(public.get_bonus_games(',
        "  (select id from c104_probe where label='tournament'))->'competitions') item",
        "  where (item->>'id')::uuid=(select id from c104_probe where label='new')), 1,",
        "  'the Bonus Games hub returns the successor'",
        ');',
        'select is((select count(*)::integer from jsonb_array_elements(public.get_bonus_games(',
        "  (select id from c104_probe where label='tournament'))->'competitions') item",
        "  where (item->>'id')::uuid=(select id from c104_probe where label='old')), 0,",
        "  'the Bonus Games hub excludes the predecessor while a successor is live'",
        ');',
        'select is((select count(*)::integer from jsonb_array_elements(public.get_competition_games(',
        "  (select id from c104_probe where label='tournament'))->'games') item",
        "  where (item->>'id')::uuid=(select id from c104_probe where label='new')), 1,",
        "  'the competition catalogue returns the successor'",
        ');',
        'select is((select count(*)::integer from jsonb_array_elements(public.get_competition_games(',
        "  (select id from c104_probe where label='tournament'))->'games') item",
        "  where (item->>'id')::uuid=(select id from c104_probe where label='old')), 0,",
        "  'the competition catalogue excludes the predecessor while a successor is live'",
        ');',
        'update public.bonus_competitions',
        "set completed_at = now() + interval '1 second', completion_reason = 'abandoned'",
        "where id = (select id from c104_probe where label='new');",
        'select is(',
        '  predictor_internal.current_public_competition_id(',
        "    (select id from c104_probe where label='tournament'),",
        '    (select game_key from public.bonus_competitions where id=(select id from c104_probe where label=\'new\'))',
        '  ), (select id from c104_probe where label=\'new\'),',
        "  'without a live row, the current resolver retains the latest terminal result'",
        ');',
        'select is((select count(*)::integer from jsonb_array_elements(public.get_bonus_games(',
        "  (select id from c104_probe where label='tournament'))->'competitions') item",
        "  where (item->>'id')::uuid=(select id from c104_probe where label='new')), 1,",
        "  'the Bonus Games hub retains the latest terminal result'",
        ');',
        'select is((select count(*)::integer from jsonb_array_elements(public.get_competition_games(',
        "  (select id from c104_probe where label='tournament'))->'games') item",
        "  where (item->>'id')::uuid=(select id from c104_probe where label='new')), 1,",
        "  'the competition catalogue retains the latest terminal result'",
        ');',
        '',
        'select * from finish();',
        'rollback;',
        '',
    ])
    PGTAP.write_text('\n'.join(lines))


def update_docs() -> None:
    ops = Path('docs/ops/ops-pending-migrations.md')
    text = ops.read_text()
    text = replace_once(
        text,
        'The repository is at **contract 103** and development is now level with it, applied by fast-lane run 30959460638.',
        'The repository is at **contract 104**. Development is verified at **103** after fast-lane run 30959460638 and trails by one pending Contract 104 rollout.',
        'ops current state',
    )
    text = re.sub(
        r"\| Repository `main` \| \*\*103\*\* \|.*?\| MERGED, AWAITING DEVELOPMENT ROLLOUT \|",
        "| Repository `main` | **104** | Contract 103 makes competition instances repeatable through `20260804333000_competition_instance_lineage.sql`; contract 104 separates live-only operational callers from terminal-aware current reads through `20260805001000_live_competition_callers.sql` | MERGED, AWAITING DEVELOPMENT ROLLOUT |",
        text,
        count=1,
    )
    text = text.replace('VERIFIED; LEVEL WITH THE REPOSITORY', 'VERIFIED; ONE CONTRACT BEHIND THE REPOSITORY')
    text = text.replace('NOW SIX BEHIND BOTH DEVELOPMENT AND THE REPOSITORY', 'NOW SIX BEHIND DEVELOPMENT AND SEVEN BEHIND THE REPOSITORY')
    text = text.replace('## Contracts 64–103', '## Contracts 64–104')
    contract103 = "- **103:** A competition can happen more than once (ADR 0025 decision 1, prerequisite). `unique (tournament_id, game_key)` was an *availability* key doing an *instance* row's job, which is why a restart was unrepresentable rather than merely unimplemented. It becomes one partial key over the live **public** instance plus one live-row-per-series key, so independent private series coexist; `bonus_competitions` gains explicit public/private scope, season/game-pinned lineage and a `completion_reason`. Nothing in it can create a second instance — that is contract 105, after contract 104 moves the tournament+game readers onto the live-instance resolver."
    contract104 = "- **104:** The ten measured tournament+game callers now resolve instance identity explicitly. Locks, recomputation and compatibility league creation require the live public row. Read surfaces use one internal current-public resolver: live first, otherwise the latest terminal public result, so a successor hides its predecessor without making final Cup/LMS results disappear. Contract 102's initial-phase Cup membership filters remain intact. No restart is created until contract 105."
    text = replace_once(text, contract103, contract103 + '\n' + contract104, 'ops contract 104 bullet')
    text = text.replace('Contracts 64–103 are all applied to development. None is authorised',
                        'Contracts 64–103 are applied to development; contract 104 is pending there. None is authorised')
    text = text.replace('Development is level with the repository; nothing is pending.',
                        'Development is verified at 103; contract 104 is the only pending development migration.')
    text = text.replace('They now trail the repository at contract 103.',
                        'They trail development at 103 by six and the repository at 104 by seven.')
    ops.write_text(text)

    status = Path('docs/quality/current-status.md')
    text = status.read_text()
    replacement = "| Repository contract | **104** — 104 canonical migrations through `20260805001000_live_competition_callers.sql`. Contract 104 keeps five operational tournament+game callers on the live public instance and moves five read surfaces to a terminal-aware current-public resolver, preserving final results when no successor exists while hiding predecessors once one does. Development Supabase is verified at **103**, applied 4 August 2026 by fast-lane run 30959460638; production remains at **63**. Non-production Netlify contexts remain owner-reported at **97**, six behind development and seven behind the repository, and may now move only to the verified development level 103. |"
    text, count = re.subn(r'^\| Repository contract \|.*$', replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise SystemExit(f'current-status repository row: expected one, found {count}')
    text = text.replace('predates contracts 94–103', 'predates contracts 94–104')
    status.write_text(text)

    seed = Path('e2e/seed-contract.ts')
    text = seed.read_text()
    text = text.replace(
        ' * ten measured tournament+game callers onto the single live-public resolver;',
        ' * ten measured tournament+game callers onto explicit instance resolvers: live-only for operational paths and live-then-latest-terminal for read surfaces;',
    )
    seed.write_text(text)

    contract = Path('config/deployment-contract.json')
    text = contract.read_text()
    text = text.replace(
        'Contract 104 moves the ten measured tournament+game callers onto the one live-public-instance resolver before any restart driver exists.',
        'Contract 104 keeps five operational callers live-only and moves five read surfaces onto a current-public resolver that prefers live and otherwise retains the latest terminal result; Contract 102 Cup phase filters remain intact. No restart driver exists yet.',
    )
    contract.write_text(text)


def main() -> None:
    update_migration()
    update_source_test()
    update_pgtap()
    update_docs()
    print('repaired Contract 104 current-read semantics and authorities')


if __name__ == '__main__':
    main()
