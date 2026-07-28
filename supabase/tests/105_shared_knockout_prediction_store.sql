begin;

select plan(21);

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
  'test.kp_tournament_id',
  (
    select tournament.id::text
    from public.tournaments tournament
    where tournament.name = 'UEFA Euro 2028'
  ),
  true
);

select set_config(
  'test.kp_match_a',
  (
    select match.id::text
    from public.matches match
    where match.tournament_id = current_setting('test.kp_tournament_id')::uuid
      and match.round = 'r16'
    order by match.match_ref
    limit 1
  ),
  true
);

select set_config(
  'test.kp_match_b',
  (
    select match.id::text
    from public.matches match
    where match.tournament_id = current_setting('test.kp_tournament_id')::uuid
      and match.round = 'r16'
    order by match.match_ref
    offset 1 limit 1
  ),
  true
);

select set_config(
  'test.kp_group_match',
  (
    select match.id::text
    from public.matches match
    where match.tournament_id = current_setting('test.kp_tournament_id')::uuid
      and match.round = 'group'
    order by match.match_ref
    limit 1
  ),
  true
);

select set_config(
  'test.kp_team_a',
  (
    select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.kp_tournament_id')::uuid
    order by team.name limit 1
  ),
  true
);

select set_config(
  'test.kp_team_b',
  (
    select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.kp_tournament_id')::uuid
    order by team.name offset 1 limit 1
  ),
  true
);

select set_config(
  'test.kp_team_c',
  (
    select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.kp_tournament_id')::uuid
    order by team.name offset 2 limit 1
  ),
  true
);

set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  md5('kp-user')::uuid,
  'kp-user@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

set local session_replication_role = origin;

-- Match A: scheduled knockout tie with both teams known.
update public.matches
set kickoff_at = now() + interval '2 hours',
    home_team_id = current_setting('test.kp_team_a')::uuid,
    away_team_id = current_setting('test.kp_team_b')::uuid
where id = current_setting('test.kp_match_a')::uuid;

-- Match B keeps a null kickoff: the unscheduled fail-closed case.
update public.matches
set kickoff_at = null
where id = current_setting('test.kp_match_b')::uuid;

-- ---------------------------------------------------------------------------
-- Structure and closed execution
-- ---------------------------------------------------------------------------

select has_function(
  'public', 'save_knockout_prediction',
  array['uuid', 'smallint', 'smallint', 'uuid', 'integer'],
  'the shared store save RPC exists'
);
select has_function(
  'public', 'delete_knockout_prediction', array['uuid', 'integer'],
  'the shared store delete RPC exists'
);
select has_function(
  'public', 'get_my_knockout_predictions', array['uuid'],
  'the shared store read RPC exists'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_routine_grants
    where routine_schema = 'public'
      and routine_name in (
        'save_knockout_prediction',
        'delete_knockout_prediction',
        'get_my_knockout_predictions'
      )
      and grantee in ('PUBLIC', 'anon')
  ),
  0,
  'anonymous callers hold no shared-store execution'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        select public.save_knockout_prediction(%L::uuid, 2::smallint, 1::smallint, null, null)
      $sql$,
      current_setting('test.kp_match_a')
    )
  ),
  '42501',
  'saving requires an authenticated user'
);

-- ---------------------------------------------------------------------------
-- Entry gating
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', md5('kp-user'), true);
set local role authenticated;

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        select public.save_knockout_prediction(%L::uuid, 2::smallint, 1::smallint, null, null)
      $sql$,
      current_setting('test.kp_match_a')
    )
  ),
  '42501',
  'a user who has entered no store-reading game cannot predict'
);

reset role;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at
) values (
  md5('kp-comp-ko')::uuid,
  current_setting('test.kp_tournament_id')::uuid,
  'ko_predictor',
  true,
  now() - interval '1 hour'
);

insert into public.bonus_competition_entrants (competition_id, user_id)
values (md5('kp-comp-ko')::uuid, md5('kp-user')::uuid);

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Shape boundaries
-- ---------------------------------------------------------------------------

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        select public.save_knockout_prediction(%L::uuid, 2::smallint, 1::smallint, null, null)
      $sql$,
      current_setting('test.kp_group_match')
    )
  ),
  '23514',
  'group matches never enter the shared knockout store'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        select public.save_knockout_prediction(%L::uuid, 2::smallint, 1::smallint, null, null)
      $sql$,
      current_setting('test.kp_match_b')
    )
  ),
  '23514',
  'an unscheduled kickoff fails closed rather than accepting an unlockable prediction'
);

select is(
  (
    select public.save_knockout_prediction(
      current_setting('test.kp_match_a')::uuid, 2::smallint, 1::smallint, null, null
    ) ->> 'version'
  ),
  '0',
  'a decisive scoreline saves without an advancing pick at version 0'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        select public.save_knockout_prediction(%L::uuid, 2::smallint, 1::smallint, %L::uuid, 0)
      $sql$,
      current_setting('test.kp_match_a'),
      current_setting('test.kp_team_a')
    )
  ),
  '23514',
  'a decisive scoreline refuses a stored advancing pick'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        select public.save_knockout_prediction(%L::uuid, 1::smallint, 1::smallint, null, 0)
      $sql$,
      current_setting('test.kp_match_a')
    )
  ),
  '23514',
  'a predicted draw requires a who-goes-through pick'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        select public.save_knockout_prediction(%L::uuid, 1::smallint, 1::smallint, %L::uuid, 0)
      $sql$,
      current_setting('test.kp_match_a'),
      current_setting('test.kp_team_c')
    )
  ),
  '23514',
  'the advancing pick must be one of the two teams in the match'
);

select is(
  (
    select public.save_knockout_prediction(
      current_setting('test.kp_match_a')::uuid,
      1::smallint, 1::smallint,
      current_setting('test.kp_team_a')::uuid,
      0
    ) ->> 'version'
  ),
  '1',
  'a valid draw-with-pick update bumps the version'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        select public.save_knockout_prediction(%L::uuid, 3::smallint, 0::smallint, null, 0)
      $sql$,
      current_setting('test.kp_match_a')
    )
  ),
  'PT409',
  'a stale version is refused instead of overwriting unseen work'
);

select is(
  (
    select jsonb_build_object(
      'store_entrant', payload -> 'store_entrant',
      'count', jsonb_array_length(payload -> 'predictions'),
      'version', payload -> 'predictions' -> 0 -> 'version',
      'advancing', payload -> 'predictions' -> 0 ->> 'advancing_team_id'
    )
    from public.get_my_knockout_predictions(
      current_setting('test.kp_tournament_id')::uuid
    ) payload
  ),
  jsonb_build_object(
    'store_entrant', true,
    'count', 1,
    'version', 1,
    'advancing', current_setting('test.kp_team_a')
  ),
  'the bounded read returns the caller''s own predictions and entrant state'
);

-- ---------------------------------------------------------------------------
-- Deletion and the per-kickoff lock
-- ---------------------------------------------------------------------------

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.delete_knockout_prediction(%L::uuid, 0) $sql$,
      current_setting('test.kp_match_a')
    )
  ),
  'PT409',
  'deletion also honours the optimistic version'
);

select is(
  (select public.delete_knockout_prediction(current_setting('test.kp_match_a')::uuid, 1)),
  true,
  'a correctly versioned deletion clears the prediction before kickoff'
);

select is(
  (select public.delete_knockout_prediction(current_setting('test.kp_match_a')::uuid, null)),
  false,
  'clearing an absent prediction is idempotent'
);

select is(
  (
    select jsonb_array_length(
      public.get_my_knockout_predictions(
        current_setting('test.kp_tournament_id')::uuid
      ) -> 'predictions'
    )
  ),
  0,
  'the read reflects the cleared store'
);

reset role;

update public.matches
set kickoff_at = now() - interval '1 minute'
where id = current_setting('test.kp_match_a')::uuid;

set local role authenticated;

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$
        select public.save_knockout_prediction(%L::uuid, 2::smallint, 1::smallint, null, null)
      $sql$,
      current_setting('test.kp_match_a')
    )
  ),
  '23514',
  'the per-kickoff lock refuses a save once the match has kicked off'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.delete_knockout_prediction(%L::uuid, 0) $sql$,
      current_setting('test.kp_match_a')
    )
  ),
  '23514',
  'the per-kickoff lock refuses a deletion once the match has kicked off'
);

reset role;

select * from finish();
rollback;
