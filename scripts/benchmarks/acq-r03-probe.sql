-- ===========================================================================
-- ACQ-R03 probe — smallest possible run: 5 entries, ONE confirmed result.
-- ===========================================================================
--
-- Purpose: find any remaining invariant in one cheap round trip, before
-- spending a 36 x 3 walk on it. This is not the benchmark.
--
-- What changed from the previous attempt, and why:
--   recompute_tournament_scores() calls capture_rank_history(), which inserts
--   into rank_history keyed on user_id with a live foreign key to auth.users.
--   Seeding under session_replication_role = replica skips the FK on entries
--   and profiles, but the recompute runs under 'origin' and writes a NEW
--   user-keyed row — so it is checked, and synthetic user ids fail.
--   Therefore this creates real auth.users rows. There is no way around it for
--   the result-write path.
--
-- RUN ON A DISPOSABLE LOCAL SUPABASE ONLY.
--     supabase start && supabase db reset --local
-- Rolls back. Send back both result sets (or the error, if it still fails).
-- ===========================================================================

begin;

do $$
begin
  if (select count(*) from auth.users) > 25 then
    raise exception 'Refusing to run: % auth.users rows present.',
      (select count(*) from auth.users);
  end if;
end $$;

create temporary table probe_log (step text, detail text) on commit drop;

do $$
declare
  v_tournament uuid;
  v_match uuid;
  v_started timestamptz;
  v_ms numeric;
  n integer;
begin
  select id into v_tournament from public.tournaments
  where name = 'UEFA Euro 2028' order by created_at limit 1;
  if v_tournament is null then
    select id into v_tournament from public.tournaments order by created_at limit 1;
  end if;
  insert into probe_log values ('tournament', v_tournament::text);

  -- 1. Real auth users. Minimal GoTrue column set; everything else defaults.
  for n in 1..5 loop
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      ('acb3acb3-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid,
      'authenticated', 'authenticated',
      'r03-probe-' || n || '@example.local',
      '', now(), now(), now()
    );
  end loop;
  insert into probe_log values ('auth.users created', '5');

  -- 2. Profiles, entries, predictions. FK checks are real now, so no replica
  --    mode is needed for these — only the lock trigger is in the way.
  set local session_replication_role = replica;

  insert into public.profiles (id, display_name)
  select ('acb3acb3-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid,
         'R03 Probe ' || n
  from generate_series(1, 5) as n;

  insert into public.entries (id, user_id, tournament_id, submitted_at)
  select ('acb3acb3-0000-0000-0002-' || lpad(n::text, 12, '0'))::uuid,
         ('acb3acb3-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid,
         v_tournament, now() - interval '2 hours'
  from generate_series(1, 5) as n;

  insert into public.match_predictions (entry_id, match_id, home_score, away_score)
  select ('acb3acb3-0000-0000-0002-' || lpad(n::text, 12, '0'))::uuid,
         m.id, (n + m.matchday) % 4, (n * 2 + m.matchday) % 3
  from generate_series(1, 5) as n
  cross join (
    select id, matchday from public.matches
    where tournament_id = v_tournament and round = 'group'
  ) m;

  insert into probe_log values (
    'predictions seeded',
    (select count(*)::text from public.match_predictions mp
     join public.entries e on e.id = mp.entry_id
     where e.user_id::text like 'acb3acb3-0000-0000-0001-%'));

  -- 3. Reset every match to 'scheduled' and clear revisions, so revision
  --    numbering and result_version stay consistent.
  update public.matches
  set result_state='scheduled', result_method=null,
      home_score=null, away_score=null,
      home_score_90=null, away_score_90=null,
      home_score_120=null, away_score_120=null,
      home_penalties=null, away_penalties=null,
      winner_team_id=null, confirmed_at=null, corrected_at=null,
      result_version=0
  where tournament_id = v_tournament;

  delete from public.match_result_revisions where tournament_id = v_tournament;
  delete from public.score_events se using public.entries e
  where e.id = se.entry_id and e.tournament_id = v_tournament;
  delete from public.rank_history where tournament_id = v_tournament;

  insert into probe_log values ('matches reset to scheduled',
    (select count(*)::text from public.matches
     where tournament_id = v_tournament and result_state = 'scheduled'));

  -- 4. Triggers live. One confirm.
  set local session_replication_role = origin;
  analyze public.entries;
  analyze public.match_predictions;

  select id into v_match from public.matches
  where tournament_id = v_tournament and round = 'group'
  order by match_date, match_ref limit 1;

  v_started := clock_timestamp();
  perform public.confirm_match_result(v_match, 'regulation', 2::smallint, 1::smallint);
  v_ms := round(extract(epoch from clock_timestamp() - v_started)::numeric * 1000, 1);

  insert into probe_log values ('ONE confirm (ms)', v_ms::text);
  insert into probe_log values ('score_events written',
    (select count(*)::text from public.score_events se
     join public.entries e on e.id = se.entry_id
     where e.tournament_id = v_tournament));
  insert into probe_log values ('rank_history written',
    (select count(*)::text from public.rank_history where tournament_id = v_tournament));
  insert into probe_log values ('revisions written',
    (select count(*)::text from public.match_result_revisions where tournament_id = v_tournament));
end $$;

select * from probe_log;

rollback;
