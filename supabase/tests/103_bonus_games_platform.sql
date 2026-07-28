begin;

select plan(32);

create or replace function pg_temp.capture_sqlstate(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

select set_config(
  'test.bonus_tournament_id',
  (
    select tournament.id::text
    from public.tournaments tournament
    where tournament.name = 'UEFA Euro 2028'
  ),
  true
);

select set_config(
  'test.bonus_match_a',
  (
    select match.id::text
    from public.matches match
    where match.tournament_id = current_setting('test.bonus_tournament_id')::uuid
      and match.round = 'r16'
    order by match.match_ref
    limit 1
  ),
  true
);

-- Supabase owns auth.users triggers, so transaction-local replica mode is the
-- established safe way to add a rollback-only test user (see 098).
set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  md5('bonus-entrant-user')::uuid,
  'bonus-entrant@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

set local session_replication_role = origin;

-- A second tournament proves the fixture/tournament shape guard.
insert into public.tournaments (id, name, year)
values (md5('bonus-other-tournament')::uuid, 'Bonus Shape Test Tournament', 2030);

insert into public.matches (
  id, tournament_id, match_ref, round, home_source, away_source, match_date, venue
) values (
  md5('bonus-other-match')::uuid,
  md5('bonus-other-tournament')::uuid,
  'R16-1',
  'r16',
  'W1',
  'W2',
  date '2030-06-29',
  'Shape Test Arena'
);

-- ---------------------------------------------------------------------------
-- Structure and deny-all posture
-- ---------------------------------------------------------------------------

select has_table('public', 'bonus_competitions', 'bonus_competitions exists');
select has_table('public', 'bonus_competition_windows', 'bonus_competition_windows exists');
select has_table('public', 'bonus_window_fixtures', 'bonus_window_fixtures exists');
select has_table('public', 'bonus_competition_entrants', 'bonus_competition_entrants exists');
select has_table('public', 'bonus_score_events', 'bonus_score_events exists');
select has_table('public', 'bonus_competition_audit', 'bonus_competition_audit exists');

select is(
  (
    select count(*)::integer
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in (
        'bonus_competitions',
        'bonus_competition_windows',
        'bonus_window_fixtures',
        'bonus_competition_entrants',
        'bonus_score_events',
        'bonus_competition_audit'
      )
      and relrowsecurity
  ),
  6,
  'row level security is enabled on every bonus platform table'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'bonus_competitions',
        'bonus_competition_windows',
        'bonus_window_fixtures',
        'bonus_competition_entrants',
        'bonus_score_events',
        'bonus_competition_audit'
      )
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ),
  0,
  'no client or service role holds any bonus platform table privilege'
);

-- ---------------------------------------------------------------------------
-- Competitions
-- ---------------------------------------------------------------------------

select lives_ok(
  format(
    $sql$
      insert into public.bonus_competitions (id, tournament_id, game_key, published)
      values (%L::uuid, %L::uuid, 'ko_predictor', false)
    $sql$,
    md5('bonus-comp-ko'),
    current_setting('test.bonus_tournament_id')
  ),
  'a KO Predictor competition instance can be stored'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        insert into public.bonus_competitions (tournament_id, game_key)
        values (%L::uuid, 'ko_predictor')
      $sql$,
      current_setting('test.bonus_tournament_id')
    )
  ),
  '23505',
  'one game runs at most once per tournament'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        insert into public.bonus_competitions (
          tournament_id, game_key, registration_opens_at, registration_closes_at
        )
        values (
          %L::uuid, 'last_man_standing',
          '2028-06-26T00:00:00Z', '2028-06-25T00:00:00Z'
        )
      $sql$,
      current_setting('test.bonus_tournament_id')
    )
  ),
  '23514',
  'registration cannot close before it opens'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        insert into public.bonus_competitions (
          tournament_id, game_key, draw_required, draw_completed_at
        )
        values (%L::uuid, 'last_man_standing', false, now())
      $sql$,
      current_setting('test.bonus_tournament_id')
    )
  ),
  '23514',
  'a draw completion cannot be recorded for a game without a draw'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        insert into public.bonus_competitions (tournament_id, game_key)
        values (%L::uuid, 'original_predictor')
      $sql$,
      current_setting('test.bonus_tournament_id')
    )
  ),
  '23514',
  'the Original Predictor can never be stored as a bonus competition'
);

-- ---------------------------------------------------------------------------
-- Windows
-- ---------------------------------------------------------------------------

select lives_ok(
  format(
    $sql$
      insert into public.bonus_competition_windows (
        id, competition_id, sequence, label, opens_at, locks_at, settles_at
      )
      values (
        %L::uuid, %L::uuid, 1, 'Round of 16',
        '2028-06-26T12:00:00Z', '2028-06-28T17:00:00Z', '2028-06-30T23:00:00Z'
      )
    $sql$,
    md5('bonus-window-r16'),
    md5('bonus-comp-ko')
  ),
  'a scheduled window can be stored as data'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        insert into public.bonus_competition_windows (competition_id, sequence, label)
        values (%L::uuid, 1, 'Duplicate sequence')
      $sql$,
      md5('bonus-comp-ko')
    )
  ),
  '23505',
  'a competition cannot hold two windows with the same sequence'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        insert into public.bonus_competition_windows (
          competition_id, sequence, label, opens_at, locks_at
        )
        values (
          %L::uuid, 2, 'Backwards window',
          '2028-06-28T17:00:00Z', '2028-06-26T12:00:00Z'
        )
      $sql$,
      md5('bonus-comp-ko')
    )
  ),
  '23514',
  'a window cannot lock before it opens'
);

-- ---------------------------------------------------------------------------
-- Window fixtures
-- ---------------------------------------------------------------------------

select lives_ok(
  format(
    $sql$
      insert into public.bonus_window_fixtures (window_id, match_id)
      values (%L::uuid, %L::uuid)
    $sql$,
    md5('bonus-window-r16'),
    current_setting('test.bonus_match_a')
  ),
  'a real fixture can be attached to a window'
);

select lives_ok(
  format(
    $sql$
      insert into public.bonus_competition_windows (id, competition_id, sequence, label)
      values (%L::uuid, %L::uuid, 3, 'Quarter-finals')
    $sql$,
    md5('bonus-window-qf'),
    md5('bonus-comp-ko')
  ),
  'a later window of the same competition can be stored'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        insert into public.bonus_window_fixtures (window_id, match_id)
        values (%L::uuid, %L::uuid)
      $sql$,
      md5('bonus-window-qf'),
      current_setting('test.bonus_match_a')
    )
  ),
  '23505',
  'a real fixture appears in only one window per competition'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        insert into public.bonus_window_fixtures (window_id, match_id)
        values (%L::uuid, %L::uuid)
      $sql$,
      md5('bonus-window-r16'),
      md5('bonus-other-match')
    )
  ),
  '23514',
  'a window only accepts fixtures from its own tournament'
);

select lives_ok(
  format(
    $sql$
      insert into public.bonus_competitions (
        id, tournament_id, game_key, draw_required
      )
      values (%L::uuid, %L::uuid, 'predictor_cup', true)
    $sql$,
    md5('bonus-comp-cup'),
    current_setting('test.bonus_tournament_id')
  ),
  'a second competition can run in the same tournament'
);

select lives_ok(
  format(
    $sql$
      insert into public.bonus_competition_windows (id, competition_id, sequence, label)
      values (%L::uuid, %L::uuid, 1, 'Cup knockout')
    $sql$,
    md5('bonus-window-cup'),
    md5('bonus-comp-cup')
  ),
  'the second competition schedules its own window'
);

select lives_ok(
  format(
    $sql$
      insert into public.bonus_window_fixtures (window_id, match_id)
      values (%L::uuid, %L::uuid)
    $sql$,
    md5('bonus-window-cup'),
    current_setting('test.bonus_match_a')
  ),
  'a different competition may reuse the same real fixture'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ delete from public.matches where id = %L::uuid $sql$,
      current_setting('test.bonus_match_a')
    )
  ),
  '23503',
  'a real fixture referenced by a window cannot be deleted from under it'
);

-- ---------------------------------------------------------------------------
-- Entrants and score events
-- ---------------------------------------------------------------------------

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        insert into public.bonus_competition_entrants (competition_id, user_id, outcome)
        values (%L::uuid, %L::uuid, 'winner')
      $sql$,
      md5('bonus-comp-ko'),
      md5('bonus-entrant-user')
    )
  ),
  '23514',
  'entrant outcomes are limited to the canonical set'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        insert into public.bonus_score_events (
          competition_id, user_id, category, points, explanation
        )
        values (%L::uuid, %L::uuid, 'exact_score', 5, 'Score without entry')
      $sql$,
      md5('bonus-comp-ko'),
      md5('bonus-entrant-user')
    )
  ),
  '23503',
  'a score event can never exist for a user who has not entered'
);

select lives_ok(
  format(
    $sql$
      insert into public.bonus_competition_entrants (competition_id, user_id)
      values (%L::uuid, %L::uuid)
    $sql$,
    md5('bonus-comp-ko'),
    md5('bonus-entrant-user')
  ),
  'a voluntary per-competition entry can be stored'
);

select lives_ok(
  format(
    $sql$
      insert into public.bonus_score_events (
        competition_id, user_id, window_id, match_id, category, points, explanation
      )
      values (
        %L::uuid, %L::uuid, %L::uuid, %L::uuid,
        'exact_score', 5, 'KO Predictor exact scoreline'
      )
    $sql$,
    md5('bonus-comp-ko'),
    md5('bonus-entrant-user'),
    md5('bonus-window-r16'),
    current_setting('test.bonus_match_a')
  ),
  'an entrant score event can be stored against a window and fixture'
);

-- ---------------------------------------------------------------------------
-- Audit immutability
-- ---------------------------------------------------------------------------

select lives_ok(
  format(
    $sql$
      insert into public.bonus_competition_audit (id, competition_id, action, detail)
      values (%L::uuid, %L::uuid, 'competition_published', '{"published": true}')
    $sql$,
    md5('bonus-audit-row'),
    md5('bonus-comp-ko')
  ),
  'platform actions can be recorded in the bonus audit'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        update public.bonus_competition_audit
        set action = 'rewritten_history'
        where id = %L::uuid
      $sql$,
      md5('bonus-audit-row')
    )
  ),
  '42501',
  'bonus audit entries cannot be rewritten'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ delete from public.bonus_competition_audit where id = %L::uuid $sql$,
      md5('bonus-audit-row')
    )
  ),
  '42501',
  'bonus audit entries cannot be deleted'
);

-- ---------------------------------------------------------------------------
-- The separation law as a schema fact
-- ---------------------------------------------------------------------------

select is(
  (
    select count(*)::integer
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
      and ccu.constraint_schema = tc.constraint_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and tc.table_name like 'bonus\_%'
      and ccu.table_name in ('entries', 'leagues', 'league_members', 'score_events', 'rank_history')
  ),
  0,
  'no bonus platform table references an Original Predictor table'
);

select * from finish();
rollback;
