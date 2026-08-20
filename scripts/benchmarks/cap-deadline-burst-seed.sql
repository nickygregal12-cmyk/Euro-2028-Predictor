-- ===========================================================================
-- CAP — the deadline burst: seeding the field it is measured against.
-- ===========================================================================
--
-- RUN THIS ON A DISPOSABLE LOCAL DATABASE ONLY. It **COMMITS**, which the other
-- benchmarks here deliberately do not, and the reason is the measurement: a
-- concurrency test needs many sessions to see the same rows, and rows inside
-- one open transaction are visible to exactly one session. `acq-r03-bloat.sh`
-- is the existing precedent for the same reason.
--
-- It refuses to run where `auth.users` looks real, it namespaces every row it
-- creates under a fixed UUID prefix, and `cap-deadline-burst-teardown.sql`
-- removes exactly those rows.
--
-- ── WHAT IT BUILDS, AND WHY THAT SHAPE ─────────────────────────────────────
--
-- One matchweek, ten fixtures, all kicking off TEN MINUTES FROM NOW. That is
-- the whole point: the fixtures are inside the window where a player can still
-- write, and the last ten minutes before a lock is when every player in the
-- competition writes at once. A benchmark seeded with a kickoff next week
-- measures an empty stadium.
--
-- `:players` entries against the Premier League season the migrations already
-- create, plus one private league with all of them in it — because the reads
-- that contend with the burst are league standings and the action feed, not
-- the writes alone.
--
-- The clubs are named `Capacity FC …` so nothing here can be mistaken for real
-- football in a database somebody later looks at.
--
--   psql -d <db> -v players=250 -f scripts/benchmarks/cap-deadline-burst-seed.sql
-- ===========================================================================

\set ON_ERROR_STOP on
\if :{?players}
\else
\set players 250
\endif

begin;

-- Refuse to run anywhere that looks real.
--
-- COUNTED EXCLUDING THIS BENCHMARK'S OWN ACCOUNTS, so a second run of a 250
-- player field is not blocked by the first one. Anything OUTSIDE the namespace
-- is somebody else's data and twenty-five of it is enough to stop.
do $$
declare v_foreign integer;
begin
  select count(*) into v_foreign
    from auth.users
   where id::text not like 'cab00000-0000-0000-0003-%';
  if v_foreign > 25 then
    raise exception
      'Refusing to run: % auth.users rows that are not this benchmark''s. Disposable local database only.',
      v_foreign;
  end if;
end $$;

-- The season this measures. The migrations create both league seasons; the
-- Premier League one is picked by name rather than by id so the script keeps
-- working when the id changes.
create table if not exists public.cap_burst_fixture (
  season_id uuid not null,
  round_id uuid not null,
  league_id uuid not null,
  matchweek integer not null,
  players integer not null,
  seeded_at timestamptz not null default now()
);
truncate public.cap_burst_fixture;

-- The player count, carried in a row rather than interpolated. psql does not
-- substitute `:variables` inside dollar-quoted bodies, so a `DO` block cannot
-- read one directly — and discovering that at the seventh line of a seed is
-- exactly the kind of thing worth writing down.
create table if not exists public.cap_burst_config (players integer not null);
truncate public.cap_burst_config;
insert into public.cap_burst_config (players) values (:players);

do $seed$
declare
  v_season uuid;
  v_round uuid;
  v_league uuid;
  v_matchweek constant integer := 38;
  v_players integer;
  v_leagues integer;
  v_league_size integer;
begin
  select players into strict v_players from public.cap_burst_config;

  select id into strict v_season
    from public.tournaments
   where kind = 'league_season' and name like 'Premier League%'
   limit 1;

  -- The burst matchweek. Ordinal 38 is the last of a league season and is
  -- deliberately one nothing else in a fresh database uses.
  insert into public.competition_rounds
    (id, tournament_id, round_key, ordinal, kind, label)
  values (
    'cab00000-0000-0000-0000-000000000001'::uuid,
    v_season, 'MW' || v_matchweek, v_matchweek, 'league_matchweek',
    'Matchweek ' || v_matchweek
  )
  returning id into v_round;

  -- Twenty clubs, ten fixtures. A real matchweek's shape.
  insert into public.teams (id, tournament_id, name)
  select ('cab00000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid,
         v_season, 'Capacity FC ' || n
    from generate_series(1, 20) as n;

  insert into public.season_fixtures
    (id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at)
  select ('cab00000-0000-0000-0002-' || lpad(n::text, 12, '0'))::uuid,
         v_season, v_round,
         ('cab00000-0000-0000-0001-' || lpad(((n * 2) - 1)::text, 12, '0'))::uuid,
         ('cab00000-0000-0000-0001-' || lpad((n * 2)::text, 12, '0'))::uuid,
         -- TEN MINUTES OUT. Inside the write window, and about to leave it.
         now() + interval '10 minutes'
    from generate_series(1, 10) as n;

  -- The field. `session_replication_role` is what lets a script insert into
  -- `auth.users` without Supabase's own auth service; the same technique the
  -- pgTAP suites use.
  set local session_replication_role = replica;
  insert into auth.users
    (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select ('cab00000-0000-0000-0003-' || lpad(n::text, 12, '0'))::uuid,
         'capacity-' || n || '@example.test',
         'authenticated', 'authenticated', '{}', '{}', now(), now()
    from generate_series(1, v_players) as n;
  set local session_replication_role = origin;

  insert into public.profiles (id, display_name)
  select ('cab00000-0000-0000-0003-' || lpad(n::text, 12, '0'))::uuid,
         'Capacity Player ' || n
    from generate_series(1, v_players) as n
  on conflict (id) do nothing;

  -- One entry each. Creating it is what resolves the canonical Main Predictor
  -- membership, so nothing else has to be inserted for the card to exist.
  insert into public.entries (id, user_id, tournament_id)
  select ('cab00000-0000-0000-0004-' || lpad(n::text, 12, '0'))::uuid,
         ('cab00000-0000-0000-0003-' || lpad(n::text, 12, '0'))::uuid,
         v_season
    from generate_series(1, v_players) as n;

  -- THE LOCAL OPERATING LIMITS, RAISED HERE AND NOWHERE ELSE.
  --
  -- `predictor_internal.operating_limits` is the product's own circuit
  -- breaker, and it is the first thing this benchmark discovered: on a fresh
  -- database `public_user_limit` stands at 50, so a field of 250 is refused
  -- until it is raised. `CAP-006` approves 250 as the next controlled stage
  -- and the register is explicit that applying it is one `service_role` call
  -- on a hosted environment, authorised as an operations action rather than by
  -- any repository change. Raised here because a disposable local database is
  -- the only place a benchmark may raise it; nothing in this file reaches a
  -- hosted environment, and nothing in it should ever be copied into one.
  --
  -- `league_member_limit` is NOT raised, because it cannot be: its check
  -- constraint caps it at 100. That is a product rule rather than a benchmark
  -- obstacle, so the field is spread across as many leagues as the rule needs
  -- — which is also what 250 players would really look like.
  update predictor_internal.operating_limits
     set public_user_limit = greatest(public_user_limit, least(v_players, 250))
   where singleton;

  select league_member_limit into strict v_league_size
    from predictor_internal.operating_limits where singleton;
  v_leagues := greatest(1, ceil(v_players::numeric / v_league_size)::integer);

  -- Private leagues holding the whole field between them, so the standings
  -- read the burst contends with is a real one rather than a table of one row.
  insert into public.leagues (id, tournament_id, owner_id, name, invite_code)
  select ('cab00000-0000-0000-0005-' || lpad(g::text, 12, '0'))::uuid,
         v_season,
         ('cab00000-0000-0000-0003-' || lpad((((g - 1) * v_league_size) + 1)::text, 12, '0'))::uuid,
         'Capacity League ' || g,
         'CAPBR' || lpad(g::text, 2, '0')
    from generate_series(1, v_leagues) as g;

  insert into public.league_members (league_id, user_id, role)
  select ('cab00000-0000-0000-0005-' || lpad((((n - 1) / v_league_size) + 1)::text, 12, '0'))::uuid,
         ('cab00000-0000-0000-0003-' || lpad(n::text, 12, '0'))::uuid,
         case when (n - 1) % v_league_size = 0 then 'owner' else 'member' end
    from generate_series(1, v_players) as n;

  v_league := 'cab00000-0000-0000-0005-000000000001'::uuid;

  insert into public.cap_burst_fixture (season_id, round_id, league_id, matchweek, players)
  values (v_season, v_round, v_league, v_matchweek, v_players);
end
$seed$;

-- ── The outcome ledger ────────────────────────────────────────────────────
--
-- WHY THE HARNESS RECORDS ITS OWN OUTCOMES RATHER THAN TRUSTING THE RUNNER.
-- pgbench aborts a client on an SQL error, so a run in which every write was
-- refused would report a tidy failure rather than a measured refusal rate —
-- and "how honestly does it fail" is the question being asked. Every operation
-- below is wrapped so the exception is CAUGHT and RECORDED with its SQLSTATE,
-- which is the difference between a benchmark that measures failure and one
-- that merely survives it.
create table if not exists public.cap_burst_outcomes (
  id bigserial primary key,
  operation text not null,
  ok boolean not null,
  sqlstate text,
  duration_ms numeric not null,
  at timestamptz not null default clock_timestamp()
);
truncate public.cap_burst_outcomes;

create or replace function public.cap_burst_as(p_player integer)
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claim.sub',
    ('cab00000-0000-0000-0003-' || lpad(p_player::text, 12, '0')),
    false
  );
end $$;

/**
 * One measured attempt, recorded whatever happens to it.
 *
 * `duration_ms` is measured with `clock_timestamp()` on both sides, which
 * advances inside a transaction where `now()` does not.
 */
create or replace function public.cap_burst_record(
  p_operation text,
  p_started timestamptz,
  p_ok boolean,
  p_sqlstate text default null
) returns void language sql as $$
  insert into public.cap_burst_outcomes (operation, ok, sqlstate, duration_ms)
  values (
    p_operation, p_ok, p_sqlstate,
    extract(epoch from (clock_timestamp() - p_started)) * 1000
  );
$$;

-- ── The operations, as the application performs them ──────────────────────
--
-- Each calls the SAME RPC the browser calls. Nothing here reimplements a read
-- or a write in the benchmark's own SQL, because a benchmark against
-- hand-written queries measures the benchmark.

create or replace function public.cap_burst_card(p_player integer)
returns void language plpgsql as $$
declare v_started timestamptz := clock_timestamp(); v_season uuid; v_mw integer;
begin
  select season_id, matchweek into v_season, v_mw from public.cap_burst_fixture;
  perform public.cap_burst_as(p_player);
  begin
    perform public.get_season_matchweek_card(v_season, v_mw);
    perform public.cap_burst_record('card.read', v_started, true);
  exception when others then
    perform public.cap_burst_record('card.read', v_started, false, sqlstate);
  end;
end $$;

create or replace function public.cap_burst_save(p_player integer, p_fixture integer)
returns void language plpgsql as $$
declare
  v_started timestamptz := clock_timestamp();
  v_season uuid;
  v_fixture uuid;
  v_entry uuid;
  v_version integer;
begin
  select season_id into v_season from public.cap_burst_fixture;
  v_fixture := ('cab00000-0000-0000-0002-' || lpad(p_fixture::text, 12, '0'))::uuid;
  v_entry := ('cab00000-0000-0000-0004-' || lpad(p_player::text, 12, '0'))::uuid;
  perform public.cap_burst_as(p_player);

  -- The version the client would be echoing back from the card it loaded.
  select coalesce(sp.version, 0) into v_version
    from public.season_predictions sp
   where sp.entry_id = v_entry and sp.season_fixture_id = v_fixture;
  v_version := coalesce(v_version, 0);

  begin
    perform public.save_season_prediction(
      v_season, v_fixture,
      (p_fixture % 4)::smallint, (p_player % 4)::smallint,
      v_version
    );
    perform public.cap_burst_record('prediction.save', v_started, true);
  exception when others then
    perform public.cap_burst_record('prediction.save', v_started, false, sqlstate);
  end;
end $$;

create or replace function public.cap_burst_confirm(p_player integer)
returns void language plpgsql as $$
declare v_started timestamptz := clock_timestamp(); v_season uuid; v_mw integer;
begin
  select season_id, matchweek into v_season, v_mw from public.cap_burst_fixture;
  perform public.cap_burst_as(p_player);
  begin
    perform public.confirm_season_matchweek_card(v_season, v_mw);
    perform public.cap_burst_record('card.confirm', v_started, true);
  exception when others then
    perform public.cap_burst_record('card.confirm', v_started, false, sqlstate);
  end;
end $$;

create or replace function public.cap_burst_standings(p_player integer)
returns void language plpgsql as $$
declare v_started timestamptz := clock_timestamp(); v_league uuid;
begin
  -- THE PLAYER'S OWN LEAGUE, not the first one.
  --
  -- The first version of this asked every player for league 1's standings and
  -- measured a 40% success rate — which was not a capacity finding at all but
  -- `get_season_league_standings` correctly refusing a non-member with
  -- `42501`. Worth keeping the note: a load harness that reads across a
  -- permission boundary measures the boundary, and reports it as a failure
  -- rate that looks like an outage.
  select lm.league_id into v_league
    from public.league_members lm
   where lm.user_id = ('cab00000-0000-0000-0003-' || lpad(p_player::text, 12, '0'))::uuid
   limit 1;

  perform public.cap_burst_as(p_player);
  begin
    perform public.get_season_league_standings(v_league, 50, null);
    perform public.cap_burst_record('league.standings', v_started, true);
  exception when others then
    perform public.cap_burst_record('league.standings', v_started, false, sqlstate);
  end;
end $$;

create or replace function public.cap_burst_actions(p_player integer)
returns void language plpgsql as $$
declare v_started timestamptz := clock_timestamp();
begin
  perform public.cap_burst_as(p_player);
  begin
    perform public.get_my_actions(20, false);
    perform public.cap_burst_record('actions.feed', v_started, true);
  exception when others then
    perform public.cap_burst_record('actions.feed', v_started, false, sqlstate);
  end;
end $$;

commit;

-- STATISTICS BEFORE MEASUREMENT, AND THE REASON IS A SIX-FOLD ERROR.
--
-- The first run of this against a freshly migrated database reported the league
-- standings read at a p50 of 149 ms; the same code against a database that had
-- been used for a while reported 23 ms. Nothing about the query had changed —
-- the fresh cluster had never been analysed, so the planner had no row estimates
-- and chose accordingly. A benchmark on an unanalysed database measures the
-- planner's ignorance and reports it as the product's cost.
analyze;

select 'seeded' as state,
       players,
       matchweek,
       (select count(*) from public.season_fixtures where competition_round_id = round_id) as fixtures
  from public.cap_burst_fixture;
