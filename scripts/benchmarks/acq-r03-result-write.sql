-- ===========================================================================
-- ACQ-R03 / DEC-009 — what does confirming one result cost, at full volume?
-- ===========================================================================
--
-- THE CLAIM UNDER TEST
--   "A result write synchronously recomputes the whole tournament."
--   recompute_scores_on_result fires on every home_score/away_score write and
--   calls recompute_tournament_scores(), which deletes and rederives every
--   score_event for the tournament — and rewrites rank history.
--
--   So each result write pays for all entries AND all results entered so far.
--   The register holds one data point: 250 entries with 12 results, ~354 ms.
--   Twelve results is exactly one group matchday. The open question in DEC-009
--   is what this costs across a full tournament.
--
-- WHAT IT MEASURES
--   The latency an administrator actually waits on: one call to
--   public.confirm_match_result(), which takes the advisory lock, writes the
--   revision row and the lifecycle columns, and fires the recompute trigger.
--   Walked across all 36 group results in fixture order, at three field sizes.
--
--   Two things matter, and they are different:
--     * per-write latency at the last result (does confirming get slower as
--       the tournament progresses?)
--     * the total across all 36 (the operational cost of running a tournament)
--
-- RUN ON A DISPOSABLE LOCAL SUPABASE ONLY.
--     supabase start && supabase db reset --local
-- It aborts above 25 auth.users rows, removes its own rows, and rolls back.
-- It also clears the matchday-1 results that seed.sql ships, so every scale
-- starts from an unscored tournament.
-- Paste the whole file as ONE execution; it returns one result set at the end.
--
-- Knockout results are NOT measured. Scoring them additionally derives the
-- predicted bracket, which needs predicted_progression per entry; faking that
-- would measure a fixture rather than the product. Group results are the
-- comparable basis for the register's existing 12-result figure.
-- ===========================================================================

begin;

do $$
begin
  if (select count(*) from auth.users) > 25 then
    raise exception
      'Refusing to run: % auth.users rows present. Disposable local stack only.',
      (select count(*) from auth.users);
  end if;
  if not exists (select 1 from public.matches where round = 'group') then
    raise exception
      'No group matches found. Run supabase db reset --local so seed.sql loads the fixture list.';
  end if;
end $$;

create temporary table bench_writes (
  field_size    integer,
  result_index  integer,
  ms            numeric
) on commit drop;

-- Seed N entries, each predicting every group match. -----------------------
create or replace function pg_temp.r03_seed(p_add integer)
returns void language plpgsql as $$
declare
  v_tournament uuid;
  v_from integer;
begin
  select id into v_tournament from public.tournaments
  where name = 'UEFA Euro 2028'
  order by created_at limit 1;
  if v_tournament is null then
    select id into v_tournament from public.tournaments order by created_at limit 1;
  end if;

  select count(*)::integer into v_from from public.entries
  where tournament_id = v_tournament;

  insert into public.profiles (id, display_name)
  select ('acb3acb3-0000-0000-0001-' || lpad((v_from + n)::text, 12, '0'))::uuid,
         'R03 Player ' || (v_from + n)
  from generate_series(1, p_add) as n;

  insert into public.entries (id, user_id, tournament_id, submitted_at)
  select ('acb3acb3-0000-0000-0002-' || lpad((v_from + n)::text, 12, '0'))::uuid,
         ('acb3acb3-0000-0000-0001-' || lpad((v_from + n)::text, 12, '0'))::uuid,
         v_tournament,
         now() - interval '2 hours'
  from generate_series(1, p_add) as n;

  -- One prediction per entry per group match: 36 rows each.
  insert into public.match_predictions (entry_id, match_id, home_score, away_score)
  select ('acb3acb3-0000-0000-0002-' || lpad((v_from + n)::text, 12, '0'))::uuid,
         m.id,
         (n + m.matchday) % 4,
         (n * 2 + m.matchday) % 3
  from generate_series(1, p_add) as n
  cross join (
    select id, matchday from public.matches
    where tournament_id = v_tournament and round = 'group'
  ) m;
end $$;

-- Walk every group result in fixture order, timing each write. -------------
create or replace function pg_temp.r03_walk()
returns void language plpgsql as $$
declare
  v_tournament uuid;
  v_entries integer;
  v_match record;
  v_started timestamptz;
  i integer := 0;
begin
  select id into v_tournament from public.tournaments
  where name = 'UEFA Euro 2028' order by created_at limit 1;
  if v_tournament is null then
    select id into v_tournament from public.tournaments order by created_at limit 1;
  end if;

  select count(*) into v_entries from public.entries where tournament_id = v_tournament;

  for v_match in
    select id from public.matches
    where tournament_id = v_tournament and round = 'group'
    order by match_date, match_ref
  loop
    i := i + 1;
    v_started := clock_timestamp();

    -- The real administrator path: advisory lock, revision row, lifecycle
    -- columns and the recompute trigger. A raw UPDATE would measure less than
    -- what confirming a result actually costs.
    perform public.confirm_match_result(
      v_match.id,
      'regulation',
      (i % 4)::smallint,
      ((i + 1) % 3)::smallint
    );

    insert into bench_writes values (
      v_entries, i,
      round(extract(epoch from clock_timestamp() - v_started)::numeric * 1000, 1));
  end loop;
end $$;

-- Reset every match to the 'scheduled' shape between scales. ---------------
-- matches_result_state_shape is a CHECK constraint, and CHECK constraints are
-- NOT suspended by session_replication_role = replica — only triggers and
-- foreign keys are. Nulling the scores alone leaves result_state = 'confirmed'
-- and violates the constraint, so the whole lifecycle column set moves together.
-- This matters here because `supabase db reset --local` ships matchday 1
-- already confirmed ("Development Matchday 1 checkpoint seed"), which is very
-- likely where the register's existing 12-result figure came from.
create or replace function pg_temp.r03_reset()
returns void language plpgsql as $$
declare v_tournament uuid;
begin
  select id into v_tournament from public.tournaments
  where name = 'UEFA Euro 2028' order by created_at limit 1;
  if v_tournament is null then
    select id into v_tournament from public.tournaments order by created_at limit 1;
  end if;

  update public.matches
  set result_state    = 'scheduled',
      result_method   = null,
      home_score      = null,
      away_score      = null,
      home_score_90   = null,
      away_score_90   = null,
      home_score_120  = null,
      away_score_120  = null,
      home_penalties  = null,
      away_penalties  = null,
      winner_team_id  = null,
      confirmed_at    = null,
      corrected_at    = null,
      result_version  = 0
  where tournament_id = v_tournament;

  -- write_match_result derives the revision as result_version + 1, so zeroing
  -- result_version without clearing the revision rows collides with revision 1
  -- on the very first confirm — both against the checkpoint seed's existing
  -- revisions and against the previous scale's. These rows are immutable audit
  -- in the product; deleting them is a benchmark-only act on a disposable
  -- database, inside a transaction that rolls back.
  delete from public.match_result_revisions where tournament_id = v_tournament;

  delete from public.score_events se using public.entries e
  where e.id = se.entry_id and e.tournament_id = v_tournament;
end $$;

do $$
declare
  v_steps integer[] := array[50, 200, 750];   -- cumulative 50, 250, 1000
  v_step integer;
  v_tournament uuid;
begin
  select id into v_tournament from public.tournaments
  where name = 'UEFA Euro 2028' order by created_at limit 1;
  if v_tournament is null then
    select id into v_tournament from public.tournaments order by created_at limit 1;
  end if;

  -- Post-lock state: entries are locked, which is when scoring runs.
  update public.tournaments set lock_at = now() - interval '1 day'
  where id = v_tournament;

  foreach v_step in array v_steps loop
    set local session_replication_role = replica;
    perform pg_temp.r03_seed(v_step);
    perform pg_temp.r03_reset();   -- also clears the shipped matchday-1 results

    -- Triggers live from here: the result write is the thing being measured.
    set local session_replication_role = origin;
    execute 'analyze public.entries';
    execute 'analyze public.match_predictions';
    execute 'analyze public.score_events';

    perform pg_temp.r03_walk();
  end loop;
end $$;

-- Cleanup, belt and braces alongside the rollback. -------------------------
-- Returns every match to 'scheduled' and removes the benchmark revisions. Note
-- this also clears the matchday-1 results seed.sql ships: if the rollback below
-- is honoured (it should be) none of this matters, but if your client
-- auto-commits, run `supabase db reset --local` afterwards to restore them.
select pg_temp.r03_reset();

delete from public.score_events se using public.entries e
where e.id = se.entry_id and e.user_id::text like 'acb3acb3-0000-0000-0001-%';
delete from public.match_predictions mp using public.entries e
where e.id = mp.entry_id and e.user_id::text like 'acb3acb3-0000-0000-0001-%';
delete from public.entries where user_id::text like 'acb3acb3-0000-0000-0001-%';
delete from public.profiles where id::text like 'acb3acb3-0000-0000-0001-%';

-- The single result set to send back. --------------------------------------
select
  field_size,
  count(*)                                            as results_written,
  max(ms) filter (where result_index = 1)             as result_1_ms,
  max(ms) filter (where result_index = 12)            as result_12_ms,
  max(ms) filter (where result_index = 24)            as result_24_ms,
  max(ms) filter (where result_index = 36)            as result_36_ms,
  round(avg(ms), 1)                                   as mean_ms,
  round(max(ms), 1)                                   as worst_ms,
  round(sum(ms), 1)                                   as all_36_total_ms
from bench_writes
group by field_size
order by field_size;

rollback;
