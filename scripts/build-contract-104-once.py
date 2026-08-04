from __future__ import annotations

import json
import re
from pathlib import Path

SOURCE = Path('docs/quality/contract-104-latest-function-definitions.sql')
MIGRATION = Path('supabase/migrations/20260805001000_live_competition_callers.sql')
PGTAP = Path('supabase/tests/155_live_competition_callers.sql')
SOURCE_TEST = Path('tests/database-parity/liveCompetitionCallerBoundary.test.ts')

TARGETS = [
    'predictor_internal.enforce_season_matchweek_lock',
    'predictor_internal.prepare_competition_season_scope',
    'predictor_internal.recompute_ko_predictor_for_match',
    'predictor_internal.recompute_lms_for_tournament',
    'public.create_league',
    'public.get_bonus_games',
    'public.get_competition_games',
    'public.get_ko_predictor_standings',
    'public.get_my_cup',
    'public.get_my_lms',
]

HEADER = re.compile(
    r'create\s+(?:or\s+replace\s+)?function\s+'
    r'(?P<name>[a-zA-Z_][\w$]*(?:\.[a-zA-Z_][\w$]*)?)\s*'
    r'(?P<args>\([^;]*?\))'
    r'(?P<between>.*?)\bas\s+(?P<tag>\$[A-Za-z0-9_]*\$)',
    re.IGNORECASE | re.DOTALL,
)


def replace_once(text: str, before: str, after: str, label: str) -> str:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(before, after)


def definitions(sql: str) -> dict[str, str]:
    found: dict[str, str] = {}
    for match in HEADER.finditer(sql):
        tag = match.group('tag')
        body_end = sql.find(tag, match.end())
        if body_end < 0:
            raise SystemExit(f'unclosed body: {match.group("name")}')
        statement_end = sql.find(';', body_end + len(tag))
        if statement_end < 0:
            raise SystemExit(f'unterminated definition: {match.group("name")}')
        found[match.group('name').lower()] = sql[match.start():statement_end + 1].strip()
    return found


def rewrite_functions() -> list[str]:
    defs = definitions(SOURCE.read_text())
    missing = [name for name in TARGETS if name not in defs]
    if missing:
        raise SystemExit(f'missing extracted definitions: {missing}')

    defs['predictor_internal.enforce_season_matchweek_lock'] = replace_once(
        defs['predictor_internal.enforce_season_matchweek_lock'],
        "   where availability.tournament_id = v_tournament\n     and availability.game_key = 'main_predictor';",
        "   where availability.tournament_id = v_tournament\n     and availability.game_key = 'main_predictor'\n     and availability.id = predictor_internal.live_competition_id(\n       v_tournament, 'main_predictor'\n     );",
        'matchweek lock caller',
    )

    defs['predictor_internal.prepare_competition_season_scope'] = replace_once(
        defs['predictor_internal.prepare_competition_season_scope'],
        "        where tournament_id = v_tournament\n          and game_key = 'ko_predictor';",
        "        where tournament_id = v_tournament\n          and game_key = 'ko_predictor'\n          and id = predictor_internal.live_competition_id(\n            v_tournament, 'ko_predictor'\n          );",
        'season-scope KO caller',
    )

    defs['predictor_internal.recompute_ko_predictor_for_match'] = replace_once(
        defs['predictor_internal.recompute_ko_predictor_for_match'],
        "  select competition.id\n    into v_competition_id\n    from public.bonus_competitions competition\n    where competition.tournament_id = v_match.tournament_id\n      and competition.game_key = 'ko_predictor';",
        "  v_competition_id := predictor_internal.live_competition_id(\n    v_match.tournament_id, 'ko_predictor'\n  );",
        'KO rederive caller',
    )

    defs['predictor_internal.recompute_lms_for_tournament'] = replace_once(
        defs['predictor_internal.recompute_lms_for_tournament'],
        "  select competition.id\n    into v_competition_id\n    from public.bonus_competitions competition\n    where competition.tournament_id = p_tournament_id\n      and competition.game_key = 'last_man_standing';",
        "  v_competition_id := predictor_internal.live_competition_id(\n    p_tournament_id, 'last_man_standing'\n  );",
        'LMS rederive caller',
    )

    defs['public.create_league'] = replace_once(
        defs['public.create_league'],
        "    where availability.tournament_id = p_tournament_id\n      and definition.requires_prediction_entry",
        "    where availability.tournament_id = p_tournament_id\n      and availability.id = predictor_internal.live_competition_id(\n        p_tournament_id, availability.game_key\n      )\n      and definition.requires_prediction_entry",
        'create league caller',
    )

    defs['public.get_bonus_games'] = replace_once(
        defs['public.get_bonus_games'],
        "          where candidate.tournament_id = p_tournament_id\n            and candidate.published",
        "          where candidate.tournament_id = p_tournament_id\n            and candidate.id = predictor_internal.live_competition_id(\n              p_tournament_id, candidate.game_key\n            )\n            and candidate.published",
        'bonus games listing caller',
    )

    defs['public.get_competition_games'] = replace_once(
        defs['public.get_competition_games'],
        "      where availability.tournament_id = p_tournament_id",
        "      where availability.tournament_id = p_tournament_id\n        and availability.id = predictor_internal.live_competition_id(\n          p_tournament_id, availability.game_key\n        )",
        'competition games listing caller',
    )

    defs['public.get_ko_predictor_standings'] = replace_once(
        defs['public.get_ko_predictor_standings'],
        "    where competition.tournament_id = p_tournament_id\n      and competition.game_key = 'ko_predictor'\n      and competition.published;",
        "    where competition.tournament_id = p_tournament_id\n      and competition.game_key = 'ko_predictor'\n      and competition.id = predictor_internal.live_competition_id(\n        p_tournament_id, 'ko_predictor'\n      )\n      and competition.published;",
        'KO standings caller',
    )

    defs['public.get_my_cup'] = replace_once(
        defs['public.get_my_cup'],
        "    where competition.tournament_id = p_tournament_id\n      and competition.game_key = 'predictor_cup'\n      and competition.published;",
        "    where competition.tournament_id = p_tournament_id\n      and competition.game_key = 'predictor_cup'\n      and competition.id = predictor_internal.live_competition_id(\n        p_tournament_id, 'predictor_cup'\n      )\n      and competition.published;",
        'Cup read caller',
    )

    defs['public.get_my_lms'] = replace_once(
        defs['public.get_my_lms'],
        "    where competition.tournament_id = p_tournament_id\n      and competition.game_key = 'last_man_standing'\n      and competition.published;",
        "    where competition.tournament_id = p_tournament_id\n      and competition.game_key = 'last_man_standing'\n      and competition.id = predictor_internal.live_competition_id(\n        p_tournament_id, 'last_man_standing'\n      )\n      and competition.published;",
        'LMS read caller',
    )

    rewritten = [defs[name] for name in TARGETS]
    for name, statement in zip(TARGETS, rewritten, strict=True):
        count = statement.lower().count('predictor_internal.live_competition_id(')
        if count != 1:
            raise SystemExit(f'{name}: expected one resolver call, found {count}')
    return rewritten


def write_migration(rewritten: list[str]) -> None:
    sections = [
        '-- Contract 104: every tournament+game caller resolves the live public instance.',
        '--',
        '-- Contract 103 made completed predecessors and private series representable,',
        '-- but deliberately created no successor. This contract moves the measured ten',
        '-- callers before Contract 105 creates the first restart. Direct-ID callers stay',
        '-- direct: a stored competition_id must continue to mean that exact historical run.',
        '',
        'begin;',
        '',
    ]
    for name, statement in zip(TARGETS, rewritten, strict=True):
        sections.extend([f'-- {name}', statement, ''])
    sections.extend(['commit;', ''])
    MIGRATION.write_text('\n'.join(sections))


def write_pgtap() -> None:
    signatures = [
        ('predictor_internal.enforce_season_matchweek_lock()' , 'matchweek lock'),
        ('predictor_internal.prepare_competition_season_scope()' , 'season-scope trigger'),
        ('predictor_internal.recompute_ko_predictor_for_match(uuid)' , 'KO rederive'),
        ('predictor_internal.recompute_lms_for_tournament(uuid)' , 'LMS rederive'),
        ('public.create_league(uuid,text)' , 'league compatibility RPC'),
        ('public.get_bonus_games(uuid)' , 'Bonus Games hub'),
        ('public.get_competition_games(uuid)' , 'competition game catalogue'),
        ('public.get_ko_predictor_standings(uuid,integer,text)' , 'KO standings'),
        ('public.get_my_cup(uuid)' , 'Cup read'),
        ('public.get_my_lms(uuid)' , 'LMS read'),
    ]
    lines = [
        '-- Contract 104: completed predecessors must never re-enter current-game reads.',
        '',
        'begin;',
        'select plan(31);',
        '',
    ]
    for signature, label in signatures:
        lines.extend([
            'select matches(',
            f"  pg_get_functiondef('{signature}'::regprocedure),",
            "  'predictor_internal\\.live_competition_id\\(',",
            f"  '{label} resolves through the one live-public-instance authority'",
            ');',
            '',
            'select is(',
            f"  regexp_count(pg_get_functiondef('{signature}'::regprocedure),",
            "    'predictor_internal\\.live_competition_id\\('),",
            '  1,',
            f"  '{label} contains exactly one live-instance resolution rather than parallel filters'",
            ');',
            '',
        ])

    lines.extend([
        'select ok(',
        "  regexp_count(pg_get_functiondef('predictor_internal.prepare_competition_season_scope()'::regprocedure),",
        "    'where id = new\\.competition_id') >= 8,",
        "  'the season-scope trigger keeps its direct-ID branches direct; only the KO fallback resolves current state'",
        ');',
        '',
        'select unlike(',
        "  pg_get_functiondef('predictor_internal.recompute_ko_predictor_for_match(uuid)'::regprocedure),",
        "  'from public\\.bonus_competitions',",
        "  'the KO rederive no longer performs an independent tournament+game lookup'",
        ');',
        '',
        'select unlike(',
        "  pg_get_functiondef('predictor_internal.recompute_lms_for_tournament(uuid)'::regprocedure),",
        "  'from public\\.bonus_competitions',",
        "  'the LMS rederive no longer performs an independent tournament+game lookup'",
        ');',
        '',
        'select matches(',
        "  pg_get_functiondef('public.create_league(uuid,text)'::regprocedure),",
        "  'live_competition_id\\(p_tournament_id, availability\\.game_key\\)',",
        "  'league compatibility chooses only a live public prediction-entry game'",
        ');',
        '',
        'select matches(',
        "  pg_get_functiondef('public.get_bonus_games(uuid)'::regprocedure),",
        "  'live_competition_id\\(p_tournament_id, candidate\\.game_key\\)',",
        "  'the legacy Bonus Games listing filters every game key through the resolver'",
        ');',
        '',
        'select matches(',
        "  pg_get_functiondef('public.get_competition_games(uuid)'::regprocedure),",
        "  'live_competition_id\\(p_tournament_id, availability\\.game_key\\)',",
        "  'the current game catalogue filters every game key through the resolver'",
        ');',
        '',
        'select matches(',
        "  pg_get_functiondef('public.get_my_cup(uuid)'::regprocedure),",
        "  'competition\\.published',",
        "  'the Cup read keeps its publication boundary while changing instance resolution'",
        ');',
        '',
        '-- Real predecessor/successor proof for both catalogue RPCs.',
        'create temporary table c104_probe (label text primary key, id uuid not null) on commit drop;',
        '',
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
        '',
        '  if v_old.id is null then',
        "    raise exception 'Contract 104 proof needs one published public competition';",
        '  end if;',
        '',
        '  select id into v_user from public.profiles order by id limit 1;',
        '  if v_user is null then',
        "    raise exception 'Contract 104 proof needs one seeded profile';",
        '  end if;',
        '',
        '  update public.bonus_competitions',
        "  set completed_at = now(), completion_reason = 'abandoned'",
        '  where id = v_old.id;',
        '',
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
        '',
        "  insert into c104_probe values ('tournament', v_old.tournament_id),",
        "    ('old', v_old.id), ('new', v_new), ('user', v_user);",
        "  perform set_config('request.jwt.claim.sub', v_user::text, true);",
        "  perform set_config('request.jwt.claim.role', 'authenticated', true);",
        'end',
        '$seed$;',
        '',
        'select is(',
        '  (select count(*)::integer',
        '   from jsonb_array_elements(public.get_bonus_games(',
        "     (select id from c104_probe where label = 'tournament')",
        "   )->'competitions') item",
        "   where (item->>'id')::uuid = (select id from c104_probe where label = 'new')),",
        '  1,',
        "  'the Bonus Games hub returns the live successor'",
        ');',
        '',
        'select is(',
        '  (select count(*)::integer',
        '   from jsonb_array_elements(public.get_bonus_games(',
        "     (select id from c104_probe where label = 'tournament')",
        "   )->'competitions') item",
        "   where (item->>'id')::uuid = (select id from c104_probe where label = 'old')),",
        '  0,',
        "  'the Bonus Games hub never leaks the completed predecessor'",
        ');',
        '',
        'select is(',
        '  (select count(*)::integer',
        '   from jsonb_array_elements(public.get_competition_games(',
        "     (select id from c104_probe where label = 'tournament')",
        "   )->'games') item",
        "   where (item->>'id')::uuid = (select id from c104_probe where label = 'new')),",
        '  1,',
        "  'the competition catalogue returns the live successor'",
        ');',
        '',
        'select is(',
        '  (select count(*)::integer',
        '   from jsonb_array_elements(public.get_competition_games(',
        "     (select id from c104_probe where label = 'tournament')",
        "   )->'games') item",
        "   where (item->>'id')::uuid = (select id from c104_probe where label = 'old')),",
        '  0,',
        "  'the competition catalogue never leaks the completed predecessor'",
        ');',
        '',
        'select * from finish();',
        'rollback;',
        '',
    ])
    PGTAP.write_text('\n'.join(lines))


def write_source_test() -> None:
    SOURCE_TEST.write_text("""import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260805001000_live_competition_callers.sql'),
  'utf8',
)

const targets = [
  'predictor_internal.enforce_season_matchweek_lock',
  'predictor_internal.prepare_competition_season_scope',
  'predictor_internal.recompute_ko_predictor_for_match',
  'predictor_internal.recompute_lms_for_tournament',
  'public.create_league',
  'public.get_bonus_games',
  'public.get_competition_games',
  'public.get_ko_predictor_standings',
  'public.get_my_cup',
  'public.get_my_lms',
] as const

describe('contract 104 live competition caller boundary', () => {
  it('redefines exactly the ten measured callers', () => {
    expect(migration.match(/create\s+or\s+replace\s+function/gi)).toHaveLength(10)
    for (const target of targets) expect(migration).toContain(`function ${target}`)
  })

  it('uses the one contract-103 resolver once in every caller', () => {
    expect(migration.match(/predictor_internal\.live_competition_id\(/g)).toHaveLength(10)
  })

  it('does not add a lifecycle driver or rewrite direct competition-id ownership', () => {
    expect(migration).not.toContain('restart_all_reentered')
    expect(migration).not.toContain('predecessor_competition_id')
    expect(migration).toContain('from public.bonus_competitions where id = new.competition_id')
  })

  it('keeps publication gates on public read surfaces', () => {
    expect(migration.match(/competition\.published/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
""")


def update_authorities() -> None:
    contract_path = Path('config/deployment-contract.json')
    contract = json.loads(contract_path.read_text())
    if contract['contractVersion'] != 103 or contract['requiredMigrationCount'] != 103:
        raise SystemExit('deployment contract moved while Contract 104 was building')
    contract['contractVersion'] = 104
    contract['requiredMigrationCount'] = 104
    contract['notes'] = contract['notes'].replace(
        'Contract 103 reconciles game availability with repeatable competition instances: one live public row per season game, one live row per independent series, public/private coexistence, scoped predecessor lineage and bounded completion reasons.',
        'Contract 103 reconciles game availability with repeatable competition instances: one live public row per season game, one live row per independent series, public/private coexistence, scoped predecessor lineage and bounded completion reasons. Contract 104 moves the ten measured tournament+game callers onto the one live-public-instance resolver before any restart driver exists.',
    )
    contract_path.write_text(json.dumps(contract, indent=2) + '\n')

    seed_path = Path('e2e/seed-contract.ts')
    seed = seed_path.read_text()
    seed = replace_once(
        seed,
        ' * series through an internal-only trigger helper. Contract 104 migrates the\n * measured readers, and contract 105 supplies the restart driver.\n */\nexport const SEED_REVIEWED_AT_CONTRACT = 103',
        ' * series through an internal-only trigger helper. Contract 104 now moves the\n * ten measured tournament+game callers onto the single live-public resolver;\n * with no successor driver yet, every seeded response remains byte-for-byte on\n * the same row. Contract 105 supplies the restart driver.\n */\nexport const SEED_REVIEWED_AT_CONTRACT = 104',
        'seed contract 104 note',
    )
    seed_path.write_text(seed)

    ops_path = Path('docs/ops/ops-pending-migrations.md')
    ops = ops_path.read_text()
    replacements = [
        ('The repository is at **contract 103**; development is at **97** and trails by six until the next fast-lane run.',
         'The repository is at **contract 104**; development is at **97** and trails by seven until the next fast-lane run.'),
        ('| Repository `main` | **103** | Contract 102 persists the Predictor Championship split stage through `20260804323000_cup_split_stage_persistence.sql`; contract 103 makes a competition instance repeatable — lifecycle-aware uniqueness and instance lineage — through `20260804333000_competition_instance_lineage.sql` | MERGED, AWAITING DEVELOPMENT ROLLOUT |',
         '| Repository `main` | **104** | Contract 103 makes competition instances repeatable through `20260804333000_competition_instance_lineage.sql`; contract 104 moves the ten measured tournament+game callers onto the live-public resolver through `20260805001000_live_competition_callers.sql` | MERGED, AWAITING DEVELOPMENT ROLLOUT |'),
        ('VERIFIED; SIX CONTRACTS BEHIND THE REPOSITORY', 'VERIFIED; SEVEN CONTRACTS BEHIND THE REPOSITORY'),
        ('NOW SIX BEHIND THE REPOSITORY', 'NOW SEVEN BEHIND THE REPOSITORY'),
        ('## Contracts 64–103', '## Contracts 64–104'),
        ('Contracts 64–97 are all applied to development; contracts 98–103 are not yet.',
         'Contracts 64–97 are all applied to development; contracts 98–104 are not yet.'),
        ('**Contracts 98–103 have not been applied to development and no fast-lane run has been dispatched for them.**',
         '**Contracts 98–104 have not been applied to development and no fast-lane run has been dispatched for them.**'),
        ('They now trail the repository at contract 103', 'They now trail the repository at contract 104'),
    ]
    for before, after in replacements:
        ops = replace_once(ops, before, after, f'ops: {before[:40]}')
    bullet = "- **103:** A competition can happen more than once (ADR 0025 decision 1, prerequisite). `unique (tournament_id, game_key)` was an *availability* key doing an *instance* row's job, which is why a restart was unrepresentable rather than merely unimplemented. It becomes one partial key over the live **public** instance plus one live-row-per-series key, so independent private series coexist; `bonus_competitions` gains explicit public/private scope, season/game-pinned lineage and a `completion_reason`. Nothing in it can create a second instance — that is contract 105, after contract 104 moves the tournament+game readers onto the live-instance resolver."
    ops = replace_once(
        ops,
        bullet,
        bullet + "\n- **104:** Every measured tournament+game caller now resolves the one live public competition through `predictor_internal.live_competition_id`. Ten latest function definitions move together: lock enforcement, KO/LMS rederive, compatibility league creation, both game catalogues, KO standings, Cup read and LMS read. Completed predecessors remain available only to direct-ID history; no restart is created until contract 105.",
        'ops contract 104 bullet',
    )
    ops_path.write_text(ops)

    status_path = Path('docs/quality/current-status.md')
    status = status_path.read_text()
    status = replace_once(
        status,
        '**103** — 103 canonical migrations through `20260804333000_competition_instance_lineage.sql`. Development Supabase is hosted at **97**',
        '**104** — 104 canonical migrations through `20260805001000_live_competition_callers.sql`. Contract 104 moves the ten measured tournament+game callers onto the live-public-instance resolver before the restart driver can create a successor. Development Supabase is hosted at **97**',
        'current-status repository contract',
    )
    status = status.replace('Development trails the repository by six contracts until 98–103 are rolled out.',
                            'Development trails the repository by seven contracts until 98–104 are rolled out.')
    status = status.replace('until 98–103 are rolled out and the declaration follows',
                            'until 98–104 are rolled out and the declaration follows')
    status_path.write_text(status)


def main() -> None:
    rewritten = rewrite_functions()
    write_migration(rewritten)
    write_pgtap()
    write_source_test()
    update_authorities()
    print('built Contract 104 migration, proofs and authorities')


if __name__ == '__main__':
    main()
