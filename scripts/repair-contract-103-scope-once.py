from pathlib import Path


def replace_once(text: str, before: str, after: str, label: str) -> str:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(before, after)


migration_path = Path("supabase/migrations/20260804333000_competition_instance_lineage.sql")
migration = migration_path.read_text()
if "bonus_competitions_live_public_game_key" in migration:
    print("Contract 103 scope repair already present.")
    raise SystemExit(0)

migration = replace_once(
    migration,
    "and becomes unique across the *live* instance only. Availability then reads\n-- as \"this season offers this game, and here is the instance currently\n-- running\", which is what every existing caller already assumes it means.",
    "and becomes unique across the *live public* instance only. Private\n-- competitions are independent series that may coexist with that public row.\n-- Availability then reads as \"this season offers this public game, and here is\n-- the instance currently running\", which is what existing catalogue callers\n-- already assume it means.",
    "migration availability explanation",
)
migration = replace_once(
    migration,
    "constraint makes that assumption false — but only once a second instance\n-- exists, and **nothing in this contract can create one**. The restart",
    "constraint makes that assumption false — but only once a second public\n-- instance exists, and **no application path in this contract creates one**. The restart",
    "migration safe-alone explanation",
)
migration = replace_once(
    migration,
    "alter table public.bonus_competitions\n  add column if not exists series_id uuid,",
    "alter table public.bonus_competitions\n  add column if not exists visibility_kind text not null default 'public',\n  add column if not exists series_id uuid,",
    "visibility column",
)
migration = replace_once(
    migration,
    "alter table public.bonus_competitions\n  alter column series_id set not null;",
    "alter table public.bonus_competitions\n  alter column series_id set not null;\n\nalter table public.bonus_competitions\n  add constraint bonus_competitions_visibility_kind_allowed\n  check (visibility_kind in ('public', 'private'));\n\ncomment on column public.bonus_competitions.visibility_kind is\n  'Public is the one canonical season game instance; private instances belong to independent invitation-scoped series.';",
    "visibility constraint",
)
migration = replace_once(
    migration,
    "alter table public.bonus_competitions\n  add constraint bonus_competitions_series_member_key\n  unique (series_id, id);\n\n-- A predecessor must be a real competition. The composite reference also pins\n-- it to the SAME series, so a chain cannot wander between series or games.\nalter table public.bonus_competitions\n  add constraint bonus_competitions_predecessor_fkey\n  foreign key (series_id, predecessor_competition_id)\n  references public.bonus_competitions (series_id, id)\n  on delete restrict;",
    "alter table public.bonus_competitions\n  add constraint bonus_competitions_series_member_key\n  unique (series_id, id, tournament_id, game_key, visibility_kind);\n\n-- A predecessor must be a real competition. The composite reference pins the\n-- chain to the same series, season, game and public/private scope.\nalter table public.bonus_competitions\n  add constraint bonus_competitions_predecessor_fkey\n  foreign key (\n    series_id, predecessor_competition_id, tournament_id, game_key, visibility_kind\n  )\n  references public.bonus_competitions (\n    series_id, id, tournament_id, game_key, visibility_kind\n  )\n  on delete restrict;",
    "scoped predecessor key",
)
migration = replace_once(
    migration,
    "-- Expressed generally rather than for Last Man Standing alone: at most one\n-- LIVE instance per (tournament, game). A completed predecessor no longer\n-- occupies the slot, which is the whole point; two live instances of one game\n-- in one season remain impossible, which is what every caller relies on.\nalter table public.bonus_competitions\n  drop constraint bonus_competitions_tournament_id_game_key_key;\n\ncreate unique index bonus_competitions_live_instance_key\n  on public.bonus_competitions (tournament_id, game_key)\n  where completed_at is null;",
    "-- Expressed generally rather than for Last Man Standing alone: one live\n-- PUBLIC instance per (tournament, game), and one live row inside each series.\n-- A completed predecessor no longer occupies either slot. Independent private\n-- series coexist without making the public catalogue ambiguous.\nalter table public.bonus_competitions\n  drop constraint bonus_competitions_tournament_id_game_key_key;\n\ncreate unique index bonus_competitions_live_series_key\n  on public.bonus_competitions (series_id)\n  where completed_at is null;\n\ncreate unique index bonus_competitions_live_public_game_key\n  on public.bonus_competitions (tournament_id, game_key)\n  where visibility_kind = 'public' and completed_at is null;",
    "lifecycle indexes",
)
migration = replace_once(
    migration,
    "   where competition.tournament_id = p_tournament_id\n     and competition.game_key = p_game_key\n     and competition.completed_at is null",
    "   where competition.tournament_id = p_tournament_id\n     and competition.game_key = p_game_key\n     and competition.visibility_kind = 'public'\n     and competition.completed_at is null",
    "public resolver scope",
)
migration = replace_once(
    migration,
    "on conflict (tournament_id, game_key) where completed_at is null do update",
    "on conflict (tournament_id, game_key)\n      where visibility_kind = 'public' and completed_at is null\n    do update",
    "function partial conflict target",
)
migration = replace_once(
    migration,
    "      where public.bonus_competitions.game_key = 'original_predictor'\n        and not public.bonus_competitions.published;",
    "      where public.bonus_competitions.game_key = 'original_predictor'\n        and public.bonus_competitions.visibility_kind = 'public'\n        and public.bonus_competitions.completed_at is null\n        and not public.bonus_competitions.published;",
    "function update scope",
)
migration_path.write_text(migration)


catalogue_path = Path("scripts/bonus-games/publish-catalogue.sql")
catalogue = catalogue_path.read_text()
catalogue = replace_once(
    catalogue,
    "on conflict (tournament_id, game_key) where completed_at is null do update",
    "on conflict (tournament_id, game_key)\n  where visibility_kind = 'public' and completed_at is null\ndo update",
    "catalogue conflict target",
)
catalogue = replace_once(
    catalogue,
    " and competition.game_key = definition.game_key\non conflict (competition_id, sequence)",
    " and competition.game_key = definition.game_key\n and competition.visibility_kind = 'public'\n and competition.completed_at is null\non conflict (competition_id, sequence)",
    "catalogue window lookup",
)
catalogue = replace_once(
    catalogue,
    "   and competition.game_key in ('last_man_standing', 'predictor_cup')\n  join public.matches match",
    "   and competition.game_key in ('last_man_standing', 'predictor_cup')\n   and competition.visibility_kind = 'public'\n   and competition.completed_at is null\n  join public.matches match",
    "catalogue mapped competition lookup",
)
catalogue = replace_once(
    catalogue,
    "join public.bonus_competitions competition\n  on competition.tournament_id = tournament.id\nwhere tournament.name = 'UEFA Euro 2028'\n  and competition.game_key in ('ko_predictor', 'last_man_standing', 'predictor_cup')",
    "join public.bonus_competitions competition\n  on competition.tournament_id = tournament.id\n and competition.visibility_kind = 'public'\n and competition.completed_at is null\nwhere tournament.name = 'UEFA Euro 2028'\n  and competition.game_key in ('ko_predictor', 'last_man_standing', 'predictor_cup')",
    "catalogue audit lookup",
)
catalogue = replace_once(
    catalogue,
    "      and competition.game_key in ('ko_predictor', 'last_man_standing', 'predictor_cup')\n      and competition.published;",
    "      and competition.game_key in ('ko_predictor', 'last_man_standing', 'predictor_cup')\n      and competition.visibility_kind = 'public'\n      and competition.completed_at is null\n      and competition.published;",
    "catalogue competition count",
)
count_pattern = "      and competition.game_key in ('last_man_standing', 'predictor_cup');"
if catalogue.count(count_pattern) != 2:
    raise SystemExit(
        f"catalogue count filters: expected two matches, found {catalogue.count(count_pattern)}"
    )
catalogue = catalogue.replace(
    count_pattern,
    "      and competition.game_key in ('last_man_standing', 'predictor_cup')\n      and competition.visibility_kind = 'public'\n      and competition.completed_at is null;",
)
catalogue_path.write_text(catalogue)


suite112_path = Path("supabase/tests/112_clear_predictions_race_safety.sql")
suite112 = suite112_path.read_text()
suite112 = replace_once(
    suite112,
    "on conflict (tournament_id, game_key) where completed_at is null do nothing;",
    "on conflict (tournament_id, game_key)\n  where visibility_kind = 'public' and completed_at is null\ndo nothing;",
    "suite 112 conflict target",
)
suite112_path.write_text(suite112)


guard_path = Path("tests/database-parity/liveCompetitionConflictTargets.test.ts")
guard = guard_path.read_text()
guard = guard.replace(
    "partial unique index over live\n * instances (`where completed_at is null`).",
    "partial unique index over live public\n * instances (`where visibility_kind = 'public' and completed_at is null`).",
)
guard = replace_once(
    guard,
    "const CONFLICT_TARGET = /on\\s+conflict\\s*\\(\\s*tournament_id\\s*,\\s*game_key\\s*\\)(\\s*where\\s+completed_at\\s+is\\s+null)?/gi",
    "const CONFLICT_TARGET = /on\\s+conflict\\s*\\(\\s*tournament_id\\s*,\\s*game_key\\s*\\)(\\s*where\\s+visibility_kind\\s*=\\s*'public'\\s+and\\s+completed_at\\s+is\\s+null)?/gi",
    "guard conflict regex",
)
guard = replace_once(
    guard,
    "    if (source[index] === \"'\") {\n      const end = source.indexOf(\"'\", index + 1)\n      const stop = end === -1 ? source.length : end + 1\n      out += source.slice(index, stop).replace(/[^\\n]/g, ' ')\n      index = stop\n      continue\n    }",
    "    if (source[index] === \"'\") {\n      const end = source.indexOf(\"'\", index + 1)\n      const stop = end === -1 ? source.length : end + 1\n      const literal = source.slice(index, stop)\n      out += literal.toLowerCase() === \"'public'\"\n        ? literal\n        : literal.replace(/[^\\n]/g, ' ')\n      index = stop\n      continue\n    }",
    "guard public literal preservation",
)
guard = guard.replace(
    "competition upserts name the partial live-instance index",
    "competition upserts name the partial live-public-instance index",
)
guard = guard.replace(
    "a bare column-list conflict target cannot infer the partial live-instance index and fails at runtime with 42P10; add `where completed_at is null`",
    "a bare or incomplete conflict target cannot infer the partial live-public-instance index and fails at runtime with 42P10; add `where visibility_kind = 'public' and completed_at is null`",
)
guard_path.write_text(guard)


test_path = Path("supabase/tests/154_competition_instance_lineage.sql")
test = test_path.read_text()
test = replace_once(test, "select plan(20);", "select plan(31);", "pgTAP plan")
test = test.replace(
    "-- What is asserted here is the replacement invariant — at most one LIVE\n-- instance per (tournament, game) — the lineage that makes a chain of instances\n-- readable, and the equivalence that makes this safe to land before its\n-- callers move.",
    "-- What is asserted here is the replacement invariant — one live public\n-- instance per season game, one live row per series, independent private-series\n-- coexistence — plus lineage that cannot cross season, game or visibility scope.",
)
test = replace_once(
    test,
    "declare\n  v_t uuid; v_comp uuid;\nbegin\n  select id into v_t from public.tournaments where kind = 'league_season' order by name limit 1;\n  select id into v_comp from public.bonus_competitions\n   where tournament_id = v_t and game_key = 'last_man_standing';\n  insert into lineage values ('season', v_t), ('first', v_comp);",
    "declare\n  v_t uuid; v_comp uuid; v_other uuid; v_euro uuid;\nbegin\n  select id into v_t from public.tournaments where kind = 'league_season' order by name limit 1;\n  select id into v_other from public.tournaments\n   where kind = 'league_season' and id <> v_t order by name limit 1;\n  select id into v_comp from public.bonus_competitions\n   where tournament_id = v_t and game_key = 'last_man_standing'\n     and visibility_kind = 'public' and completed_at is null;\n  select id into v_euro from public.tournaments where kind = 'tournament' order by name limit 1;\n  insert into lineage values\n    ('season', v_t), ('other_season', v_other), ('first', v_comp), ('tournament', v_euro);\n  insert into public.game_definitions (\n    game_key, display_name, requires_prediction_entry, lock_scope, buffer_minutes, allow_rejoin\n  ) values ('lineage_probe', 'Lineage probe', false, 'round', 0, false);",
    "pgTAP seed scope",
)
completed_assertion = """select is(
  (select count(*)::integer from public.bonus_competitions where completed_at is not null),
  0,
  'and none is completed, which is what makes the partial index below equivalent to the constraint it replaces'
);
"""
visibility_assertion = """
select is(
  (select count(*)::integer from public.bonus_competitions where visibility_kind <> 'public'),
  0,
  'all pre-existing availability rows backfill as public rather than becoming private by accident'
);
"""
test = replace_once(
    test,
    completed_assertion,
    completed_assertion + visibility_assertion,
    "visibility backfill assertion",
)
test = test.replace(
    "-- THE INVARIANT. At most one live instance per (tournament, game).",
    "-- THE INVARIANT. One live public instance per game, one live row per series.",
)
test = test.replace(
    "'a second LIVE instance of one game in one season is still impossible — this is the assumption twenty single-row readers rely on, and it is not weakened'",
    "'a second live PUBLIC instance of one game in one season is impossible'",
)
third_live = """select throws_ok(
  $$insert into public.bonus_competitions
      (tournament_id, game_key, availability_status, series_id, series_sequence,
       predecessor_competition_id)
    select (select id from lineage where label = 'season'),
           'last_man_standing', 'active',
           (select series_id from public.bonus_competitions
             where id = (select id from lineage where label = 'first')),
           3,
           (select id from public.bonus_competitions
             where tournament_id = (select id from lineage where label = 'season')
               and game_key = 'last_man_standing' and completed_at is null)$$,
  '23505',
  null,
  'a THIRD live instance is refused while the second is still running — completing is what frees the slot, not merely existing'
);
"""
third_live_scoped = third_live.replace(
    "               and game_key = 'last_man_standing' and completed_at is null)$$,",
    "               and game_key = 'last_man_standing'\n               and visibility_kind = 'public' and completed_at is null)$$,",
)
private_block = """
-- Private competitions are separate series. Two may run beside the public one.
select lives_ok(
  $$insert into public.bonus_competitions
      (id, tournament_id, game_key, published, availability_status,
       visibility_kind, series_id)
    values
      (md5('c103-private-a')::uuid,
       (select id from lineage where label = 'season'),
       'last_man_standing', false, 'active', 'private', md5('c103-private-a')::uuid),
      (md5('c103-private-b')::uuid,
       (select id from lineage where label = 'season'),
       'last_man_standing', false, 'active', 'private', md5('c103-private-b')::uuid)$$,
  'two independent private LMS series may coexist with the one live public instance'
);

select lives_ok(
  $$update public.bonus_competitions
       set completed_at = now(), completion_reason = 'no_winner_restarted'
     where id = md5('c103-private-a')::uuid$$,
  'a private series predecessor may complete without affecting the public slot'
);

select lives_ok(
  $$insert into public.bonus_competitions
      (id, tournament_id, game_key, published, availability_status,
       visibility_kind, series_id, series_sequence, predecessor_competition_id)
    values (
      md5('c103-private-a-2')::uuid,
      (select id from lineage where label = 'season'),
      'last_man_standing', false, 'active', 'private',
      md5('c103-private-a')::uuid, 2, md5('c103-private-a')::uuid
    )$$,
  'a private successor reuses its own series while another private series remains live'
);

select is(
  (select count(*)::integer from public.bonus_competitions
    where tournament_id = (select id from lineage where label = 'season')
      and game_key = 'last_man_standing'
      and visibility_kind = 'private'
      and completed_at is null),
  2,
  'private competitions coexist freely across independent live series'
);

select throws_ok(
  $$insert into public.bonus_competitions
      (tournament_id, game_key, published, availability_status,
       visibility_kind, series_id, series_sequence, predecessor_competition_id)
    values (
      (select id from lineage where label = 'season'),
      'last_man_standing', false, 'active', 'private',
      md5('c103-private-a')::uuid, 3, md5('c103-private-a-2')::uuid
    )$$,
  '23505',
  null,
  'one private series cannot have two live instances even though other private series may coexist'
);
"""
test = replace_once(
    test,
    third_live,
    third_live_scoped + private_block,
    "private-series proof block",
)
test = replace_once(
    test,
    "    where tournament_id = (select id from lineage where label = 'season')\n      and game_key = 'last_man_standing'),\n  2,\n  'both instances coexist",
    "    where tournament_id = (select id from lineage where label = 'season')\n      and game_key = 'last_man_standing'\n      and visibility_kind = 'public'),\n  2,\n  'both instances coexist",
    "public history count",
)
test = test.replace("'predictor_cup_probe'", "'lineage_probe'")
series_change = """select throws_ok(
  $$update public.bonus_competitions set series_id = gen_random_uuid()
     where tournament_id = (select id from lineage where label = 'season')
       and game_key = 'last_man_standing' and completed_at is null$$,
  '23503',
  null,
  'a successor cannot be moved into a DIFFERENT series while keeping its predecessor — the composite key pins a chain to one series rather than letting it wander'
);
"""
series_change_scoped = series_change.replace(
    "       and game_key = 'last_man_standing' and completed_at is null$$,",
    "       and game_key = 'last_man_standing'\n       and visibility_kind = 'public' and completed_at is null$$,",
)
scope_block = """
select throws_ok(
  $$update public.bonus_competitions
       set tournament_id = (select id from lineage where label = 'other_season')
     where id = md5('c103-private-a-2')::uuid$$,
  '23503',
  null,
  'a successor cannot move to another season while retaining its predecessor'
);

select throws_ok(
  $$update public.bonus_competitions
       set game_key = 'lineage_probe'
     where id = md5('c103-private-a-2')::uuid$$,
  '23503',
  null,
  'a successor cannot change game while retaining its predecessor'
);

select throws_ok(
  $$update public.bonus_competitions
       set visibility_kind = 'public'
     where id = md5('c103-private-a')::uuid$$,
  '23503',
  null,
  'a completed predecessor cannot change public/private scope under its successor'
);
"""
test = replace_once(
    test,
    series_change,
    series_change_scoped + scope_block,
    "scoped lineage assertions",
)
test = replace_once(
    test,
    "  $$update public.bonus_competitions set completion_reason = 'won'\n     where tournament_id = (select id from lineage where label = 'season')\n       and game_key = 'last_man_standing' and completed_at is null$$,",
    "  $$update public.bonus_competitions set completion_reason = 'won'\n     where tournament_id = (select id from lineage where label = 'season')\n       and game_key = 'last_man_standing'\n       and visibility_kind = 'public' and completed_at is null$$,",
    "public completion reason probe",
)
resolver_marker = """select is(
  predictor_internal.live_competition_id(
    (select id from lineage where label = 'season'), 'last_man_standing'),
"""
writer_block = """select lives_ok(
  $$update public.tournaments
       set lock_at = lock_at
     where id = (select id from lineage where label = 'tournament')$$,
  'the Original Predictor availability trigger still upserts after the total key becomes partial'
);

select matches(
  pg_get_functiondef(
    'predictor_internal.ensure_original_predictor_availability()'::regprocedure
  ),
  'ON CONFLICT \\(tournament_id, game_key\\)[[:space:]]+WHERE \\(\\(visibility_kind = ''public''::text\\) AND \\(completed_at IS NULL\\)\\)',
  'the live writer names the partial public-instance conflict target explicitly'
);

"""
test = replace_once(
    test,
    resolver_marker,
    writer_block + resolver_marker,
    "writer compatibility assertions",
)
test = replace_once(
    test,
    "  (select id from public.bonus_competitions\n    where tournament_id = (select id from lineage where label = 'season')\n      and game_key = 'last_man_standing' and completed_at is null),",
    "  (select id from public.bonus_competitions\n    where tournament_id = (select id from lineage where label = 'season')\n      and game_key = 'last_man_standing'\n      and visibility_kind = 'public' and completed_at is null),",
    "resolver expected public row",
)
test = test.replace(
    "'the resolver returns the live successor, not the completed predecessor'",
    "'the resolver returns the live PUBLIC successor, ignoring two live private competitions'",
)
test = test.replace(
    "before twenty callers\n-- each invent their own filter in contract 103.",
    "before the measured callers\n-- move onto it in contract 104.",
)
test_path.write_text(test)


ops_path = Path("docs/ops/ops-pending-migrations.md")
ops = ops_path.read_text()
ops = ops.replace(
    "It becomes a partial unique index over **live** instances, and `bonus_competitions` gains series lineage plus a `completion_reason`.",
    "It becomes one partial key over the live **public** instance plus one live-row-per-series key, so independent private series coexist; `bonus_competitions` gains explicit public/private scope, season/game-pinned lineage and a `completion_reason`.",
)
ops_path.write_text(ops)


status_path = Path("docs/quality/current-status.md")
status = status_path.read_text()
status = status.replace(
    "becomes unique across the **live** instance only.",
    "becomes unique across the live **public** instance only, while each independent series may hold one live row so private competitions coexist.",
)
status = status.replace(
    "A chain cannot wander between series — the predecessor reference is composite on `(series_id, id)`.",
    "A chain cannot wander between series, seasons, games or public/private scope — the predecessor reference carries all five identities.",
)
status = status.replace(
    "~20 functions do a single-row lookup on `(tournament_id, game_key)`.",
    "The measured caller inventory is 10 functions across 36 tournament+game references.",
)
status = status.replace(
    "Evidence: `supabase/tests/154_competition_instance_lineage.sql`, 18 assertions, five mutants killed at 6, 6, 2, 2 and 1",
    "Evidence: `supabase/tests/154_competition_instance_lineage.sql`, 31 assertions covering public uniqueness, private-series coexistence, scoped lineage, writer compatibility and the server-only resolver",
)
status_path.write_text(status)


agents_path = Path("AGENTS.md")
agents = agents_path.read_text().replace(
    "contract 103 makes a competition instance repeatable behind lifecycle-aware uniqueness.",
    "contract 103 makes a competition instance repeatable behind one live public row per season game, one live row per series and season/game-scoped lineage.",
)
agents_path.write_text(agents)
