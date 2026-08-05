from pathlib import Path


def replace_once(text: str, before: str, after: str, label: str) -> str:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(before, after)


# Preserve ordinary permanence while allowing the parent competition's own
# reviewed cascade to remove the complete lifecycle atomically.
migration_path = Path('supabase/migrations/20260805010000_cup_split_group_tables.sql')
migration = migration_path.read_text()
migration = replace_once(
    migration,
    "    if old.phase_kind = 'initial'\n       and exists (\n         select 1\n         from public.bonus_cup_members split_member",
    "    if old.phase_kind = 'initial'\n       and exists (\n         select 1\n         from public.bonus_competitions competition\n         where competition.id = old.competition_id\n       )\n       and exists (\n         select 1\n         from public.bonus_cup_members split_member",
    'competition cascade allowance',
)
migration_path.write_text(migration)


pgtap_path = Path('supabase/tests/156_cup_split_group_tables.sql')
pgtap = pgtap_path.read_text()
pgtap = replace_once(pgtap, 'select plan(22);', 'select plan(23);', 'pgTAP plan')
pgtap = replace_once(
    pgtap,
    "insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)\nselect md5('c5-comp')::uuid, md5('c5-user-' || n)::uuid, now() - interval '2 hours'\nfrom generate_series(1, 6) as n;",
    "insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)\nselect md5('c5-comp')::uuid, md5('c5-user-' || n)::uuid, now() - interval '2 hours'\nfrom generate_series(1, 7) as n;",
    'seventh entrant fixture',
)
pgtap = replace_once(
    pgtap,
    "  registration_closes_at, draw_required\n) values (\n  md5('c5-comp')::uuid,\n  current_setting('test.c5_tournament_id')::uuid,\n  'predictor_cup', true,\n  now() - interval '3 hours', now() - interval '1 hour', true\n);",
    "  registration_closes_at, draw_required, visibility_kind\n) values (\n  md5('c5-comp')::uuid,\n  current_setting('test.c5_tournament_id')::uuid,\n  'predictor_cup', true,\n  now() - interval '3 hours', now() - interval '1 hour', true, 'private'\n);",
    'private test competition',
)
pgtap = pgtap.replace('Contract 104 test: league-phase correction after the split began',
                        'Contract 105 test: league-phase correction after the split began')
pgtap = replace_once(
    pgtap,
    "select finish();\n\nrollback;",
    "select lives_ok(\n  $$delete from public.bonus_competitions where id = md5('c5-comp')::uuid$$,\n  'deleting the whole competition may cascade both phase memberships without the permanence guard blocking its parent lifecycle'\n);\n\nselect finish();\n\nrollback;",
    'cascade proof',
)
pgtap_path.write_text(pgtap)


source_path = Path('tests/database-parity/cupSplitGroupTablesBoundary.test.ts')
source = source_path.read_text()
source = replace_once(
    source,
    "    expect(migration).not.toMatch(/starting[_ ]points|carried[_ ]points/i)\n    expect(migration).not.toMatch(/alter table[^;]+add column[^;]+points/is)",
    "    expect(migration).not.toMatch(\n      /alter table[^;]+add column[^;]+(?:starting|carried)[^;]*points/is,\n    )\n    expect(migration).not.toMatch(\n      /insert into[^;]+(?:starting|carried)[^;]*points/is,\n    )",
    'derived-not-copied source guard',
)
source = replace_once(
    source,
    "    expect(proof).not.toContain('cuts ACROSS the initial groups')\n  })",
    "    expect(proof).not.toContain('cuts ACROSS the initial groups')\n    expect(proof).toContain(\"'private'\")\n  })",
    'private fixture guard',
)
source = replace_once(
    source,
    "  it('pins the correction-after-split evidence that distinguishes derived from copied', () => {",
    "  it('keeps full-competition cascade deletion compatible with membership permanence', () => {\n    expect(migration).toContain('from public.bonus_competitions competition')\n    expect(proof).toContain('deleting the whole competition may cascade both phase memberships')\n  })\n\n  it('pins the correction-after-split evidence that distinguishes derived from copied', () => {",
    'cascade source guard',
)
source_path.write_text(source)


inventory_path = Path('docs/architecture/stage-c-trigger-bindings.md')
inventory = inventory_path.read_text()
inventory = inventory.replace('**Status:** Repository contract 102 after-state;',
                              '**Status:** Repository contract 105 after-state;')
inventory = inventory.replace('effective trigger set through contract 102.',
                              'effective trigger set through contract 105.')
inventory = replace_once(
    inventory,
    'result, scoring, audit, rate-limit and ownership authorities. Contract 102 adds two\nCup split-persistence authorities: one validates split-group parentage and the other\nkeeps a group-shaped fixture aligned with the phase named by its stage. The executable',
    'result, scoring, audit, rate-limit and ownership authorities. Contract 102 adds two\nCup split-persistence authorities: one validates split-group parentage and the other\nkeeps a group-shaped fixture aligned with the phase named by its stage. Contract 105\nadds the member-side ancestry binding: every split member comes from the child group\'s one initial parent, and source membership remains fixed. The executable',
    'inventory introduction',
)
inventory = replace_once(
    inventory,
    '| `bonus_cup_members.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate Cup member scope |',
    '| `bonus_cup_members.a_prepare_competition_season_scope` | `predictor_internal.prepare_competition_season_scope` | derive and validate Cup member scope |\n| `bonus_cup_members.assert_bonus_cup_member_split_parent` | `predictor_internal.assert_bonus_cup_member_split_parent` | contract 105; require a split member to come from the child group\'s single initial parent and keep that source membership permanent while the split row exists |',
    'trigger inventory row',
)
inventory_path.write_text(inventory)


coverage_path = Path('docs/architecture/stage-c-schema-coverage.md')
coverage = coverage_path.read_text()
coverage = replace_once(
    coverage,
    '- `assert_bonus_knockout_prediction_shape`\n',
    '- `assert_bonus_knockout_prediction_shape`\n- `assert_bonus_cup_group_parent`\n- `assert_bonus_cup_fixture_group_phase`\n- `assert_bonus_cup_member_split_parent`\n',
    'schema coverage authorities',
)
coverage_path.write_text(coverage)


test_path = Path('tests/database-parity/stageCTriggerBindingCoverage.test.ts')
test = test_path.read_text()
test = replace_once(
    test,
    "    // 86 → 87 at contract 103, which adds the lineage default trigger.\n    expect(effectiveBindings).toHaveLength(87)",
    "    // 86 → 87 at contract 103, which adds the lineage default trigger.\n    // 87 → 88 at contract 105, which binds split-member ancestry.\n    expect(effectiveBindings).toHaveLength(88)",
    'trigger count',
)
test = replace_once(
    test,
    "    expect(\n      effectiveBindings.filter((binding) =>\n        binding.endsWith(' -> predictor_internal.assert_bonus_cup_fixture_group_phase'),\n      ),\n    ).toHaveLength(1)\n",
    "    expect(\n      effectiveBindings.filter((binding) =>\n        binding.endsWith(' -> predictor_internal.assert_bonus_cup_fixture_group_phase'),\n      ),\n    ).toHaveLength(1)\n    expect(\n      effectiveBindings.filter((binding) =>\n        binding.endsWith(' -> predictor_internal.assert_bonus_cup_member_split_parent'),\n      ),\n    ).toHaveLength(1)\n",
    'new trigger positive control',
)
test_path.write_text(test)

print('repaired Contract 105 fixture, cascade and trigger inventory')
