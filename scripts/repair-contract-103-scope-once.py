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
    "-- Roughly twenty functions do a single-row lookup on\n-- `(tournament_id, game_key)` and expect exactly one row. Relaxing the\n-- constraint makes that assumption false — but only once a second public\n-- instance exists, and **no application path in this contract creates one**. The restart",
    "-- The measured caller inventory is ten functions across 36 references that\n-- resolve by `(tournament_id, game_key)`. Relaxing the key makes those reads\n-- ambiguous only once a second public instance exists, and **no application\n-- path in this contract creates one**. The restart",
    "measured caller inventory",
)

migration = replace_once(
    migration,
    "-- Until then the partial index is strictly equivalent to the constraint it\n-- replaces: with no completed competitions there is nothing for it to permit\n-- that the old one forbade. That equivalence is asserted rather than assumed in\n-- `154_competition_instance_lineage.sql`.",
    "-- Until then every existing row remains public and live, and no application\n-- path can create a successor or private series. Existing callers therefore\n-- still resolve the same row even though the corrected storage shape can now\n-- represent the complete ADR after-state. That boundary is asserted rather\n-- than assumed in `154_competition_instance_lineage.sql`.",
    "safe-alone boundary",
)

migration = replace_once(
    migration,
    "end;\n$lineage$;\n\ndrop trigger if exists prepare_competition_lineage",
    "end;\n$lineage$;\n\nrevoke all on function predictor_internal.prepare_competition_lineage()\n  from public, anon, authenticated, service_role;\n\ndrop trigger if exists prepare_competition_lineage",
    "lineage trigger function revoke",
)

migration_path.write_text(migration)


test_path = Path("supabase/tests/154_competition_instance_lineage.sql")
test = test_path.read_text()
test = replace_once(test, "select plan(31);", "select plan(32);", "pgTAP plan")
test = test.replace(
    "'and none is completed, which is what makes the partial index below equivalent to the constraint it replaces'",
    "'all pre-existing rows are live, so current public-reader results remain unchanged before a lifecycle driver exists'",
)

resolver_privilege = """select is(
  (select count(*)::integer
     from unnest(array['anon', 'authenticated', 'service_role']) as role_name
    where pg_catalog.has_function_privilege(
      role_name, 'predictor_internal.live_competition_id(uuid, text)', 'EXECUTE')),
  0,
  'and no browser or service role may call it'
);
"""
lineage_privilege = """select is(
  (select count(*)::integer
     from unnest(array['anon', 'authenticated', 'service_role']) as role_name
    where pg_catalog.has_function_privilege(
      role_name, 'predictor_internal.prepare_competition_lineage()', 'EXECUTE')),
  0,
  'the lineage trigger helper is internal-only rather than a callable service-role path'
);

"""
test = replace_once(
    test,
    resolver_privilege,
    lineage_privilege + resolver_privilege,
    "lineage function privilege assertion",
)
test_path.write_text(test)


status_path = Path("docs/quality/current-status.md")
status = status_path.read_text().replace(
    "Evidence: `supabase/tests/154_competition_instance_lineage.sql`, 31 assertions covering public uniqueness, private-series coexistence, scoped lineage, writer compatibility and the server-only resolver",
    "Evidence: `supabase/tests/154_competition_instance_lineage.sql`, 32 assertions covering public uniqueness, private-series coexistence, scoped lineage, writer compatibility and internal-only helpers",
)
status_path.write_text(status)
