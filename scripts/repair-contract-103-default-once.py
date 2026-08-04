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

# The original candidate used a game key that the canonical catalogue rejects,
# so those shape probes would have passed for the wrong foreign-key reason.
test = test.replace("'predictor_cup_probe'", "'lineage_probe'")

# Once private series are present, every assertion about the canonical current
# instance must state public scope explicitly rather than returning an arbitrary
# row or a multi-row scalar-subquery failure.
test = replace_once(
    test,
    "  select id into v_comp from public.bonus_competitions\n   where tournament_id = v_t and game_key = 'last_man_standing';",
    "  select id into v_comp from public.bonus_competitions\n   where tournament_id = v_t and game_key = 'last_man_standing'\n     and visibility_kind = 'public' and completed_at is null;",
    "seed public instance",
)
test = replace_once(
    test,
    "    where tournament_id = (select id from lineage where label = 'season')\n      and game_key = 'last_man_standing'),\n  2,\n  'both instances coexist",
    "    where tournament_id = (select id from lineage where label = 'season')\n      and game_key = 'last_man_standing'\n      and visibility_kind = 'public'),\n  2,\n  'both instances coexist",
    "public history count",
)
test = replace_once(
    test,
    "           (select id from public.bonus_competitions\n             where tournament_id = (select id from lineage where label = 'season')\n               and game_key = 'last_man_standing' and completed_at is null)$$,",
    "           (select id from public.bonus_competitions\n             where tournament_id = (select id from lineage where label = 'season')\n               and game_key = 'last_man_standing'\n               and visibility_kind = 'public' and completed_at is null)$$,",
    "third public predecessor lookup",
)
test = replace_once(
    test,
    "  $$update public.bonus_competitions set series_id = gen_random_uuid()\n     where tournament_id = (select id from lineage where label = 'season')\n       and game_key = 'last_man_standing' and completed_at is null$$,",
    "  $$update public.bonus_competitions set series_id = gen_random_uuid()\n     where tournament_id = (select id from lineage where label = 'season')\n       and game_key = 'last_man_standing'\n       and visibility_kind = 'public' and completed_at is null$$,",
    "public series mutation probe",
)
test = replace_once(
    test,
    "  $$update public.bonus_competitions set completion_reason = 'won'\n     where tournament_id = (select id from lineage where label = 'season')\n       and game_key = 'last_man_standing' and completed_at is null$$,",
    "  $$update public.bonus_competitions set completion_reason = 'won'\n     where tournament_id = (select id from lineage where label = 'season')\n       and game_key = 'last_man_standing'\n       and visibility_kind = 'public' and completed_at is null$$,",
    "public completion reason probe",
)
test = replace_once(
    test,
    "  (select id from public.bonus_competitions\n    where tournament_id = (select id from lineage where label = 'season')\n      and game_key = 'last_man_standing' and completed_at is null),",
    "  (select id from public.bonus_competitions\n    where tournament_id = (select id from lineage where label = 'season')\n      and game_key = 'last_man_standing'\n      and visibility_kind = 'public' and completed_at is null),",
    "resolver expected public row",
)

test = test.replace(
    "-- THE INVARIANT. At most one live instance per (tournament, game).",
    "-- THE INVARIANT. One live public instance per game, one live row per series.",
)
test = test.replace(
    "-- What is asserted here is the replacement invariant — at most one LIVE\n-- instance per (tournament, game) — the lineage that makes a chain of instances\n-- readable, and the equivalence that makes this safe to land before its\n-- callers move.",
    "-- What is asserted here is the replacement invariant — one live public\n-- instance per season game, one live row per series, independent private-series\n-- coexistence — plus lineage that cannot cross season, game or visibility scope.",
)
test_path.write_text(test)
