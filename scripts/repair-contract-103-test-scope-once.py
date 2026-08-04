from pathlib import Path


def replace_once(text: str, before: str, after: str, label: str) -> str:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(before, after)


path = Path("supabase/tests/154_competition_instance_lineage.sql")
test = path.read_text()

test = test.replace("'predictor_cup_probe'", "'lineage_probe'")

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

path.write_text(test)
