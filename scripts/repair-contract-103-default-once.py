from pathlib import Path


def replace_once(text: str, before: str, after: str, label: str) -> str:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(before, after)


migration_path = Path("supabase/migrations/20260804333000_competition_instance_lineage.sql")
migration = migration_path.read_text()
migration = replace_once(
    migration,
    "alter table public.bonus_competitions\n  alter column series_id set not null;",
    "alter table public.bonus_competitions\n  alter column series_id set default gen_random_uuid(),\n  alter column series_id set not null;",
    "series id default",
)
migration = replace_once(
    migration,
    "-- Until then the partial index is strictly equivalent to the constraint it\n-- replaces: with no completed competitions there is nothing for it to permit\n-- that the old one forbade. That equivalence is asserted rather than assumed in\n-- `154_competition_instance_lineage.sql`.",
    "-- Until then every existing row is public and no application or database\n-- driver can create a successor or a private instance. Current caller behaviour\n-- therefore stays single-row even though the corrected storage shape can now\n-- represent both. That boundary is asserted rather than assumed in\n-- `154_competition_instance_lineage.sql`.",
    "safe-alone explanation",
)
migration = replace_once(
    migration,
    "-- Expressed generally rather than for Last Man Standing alone: at most one\n-- LIVE instance per (tournament, game). A completed predecessor no longer\n-- occupies the slot, which is the whole point; two live instances of one game\n-- in one season remain impossible, which is what every caller relies on.",
    "-- Expressed generally rather than for Last Man Standing alone: one live\n-- PUBLIC instance per (tournament, game), and one live row inside each series.\n-- A completed predecessor no longer occupies either slot. Independent private\n-- series coexist without making the public catalogue ambiguous.",
    "lifecycle invariant explanation",
)
migration_path.write_text(migration)


test_path = Path("supabase/tests/154_competition_instance_lineage.sql")
test = test_path.read_text()
test = replace_once(test, "select plan(28);", "select plan(31);", "pgTAP plan")
visibility_assertion = """select is(
  (select count(*)::integer from public.bonus_competitions where visibility_kind <> 'public'),
  0,
  'all pre-existing availability rows backfill as public rather than becoming private by accident'
);
"""
default_assertions = """
select lives_ok(
  $$insert into public.bonus_competitions
      (id, tournament_id, game_key, published, availability_status, visibility_kind)
    values (
      md5('c103-default-series')::uuid,
      (select id from lineage where label = 'season'),
      'lineage_probe', false, 'active', 'private'
    )$$,
  'a new first instance may omit series_id and receives a database-generated series'
);

select ok(
  (select series_id is not null and series_sequence = 1
     from public.bonus_competitions
    where id = md5('c103-default-series')::uuid),
  'the generated series starts at sequence one'
);

select isnt(
  (select series_id from public.bonus_competitions
    where id = md5('c103-default-series')::uuid),
  md5('c103-default-series')::uuid,
  'new series identity is independent of instance identity while the historical backfill remains stable'
);
"""
test = replace_once(
    test,
    visibility_assertion,
    visibility_assertion + default_assertions,
    "series default assertions",
)
test_path.write_text(test)
