begin;

select plan(24);

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
  'test.hub_tournament_id',
  (
    select tournament.id::text
    from public.tournaments tournament
    where tournament.name = 'UEFA Euro 2028'
  ),
  true
);

set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  md5('bonus-hub-user')::uuid,
  'bonus-hub@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

set local session_replication_role = origin;

insert into public.tournaments (id, name, year)
values (md5('bonus-hub-other-tournament')::uuid, 'Bonus Hub Hidden Tournament', 2030);

-- Rolling-entry KO Predictor, open one hour ago.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at, registration_closes_at
) values (
  md5('hub-comp-open')::uuid,
  current_setting('test.hub_tournament_id')::uuid,
  'ko_predictor',
  true,
  now() - interval '1 hour',
  null
);

-- Published but not yet open.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at
) values (
  md5('hub-comp-early')::uuid,
  current_setting('test.hub_tournament_id')::uuid,
  'last_man_standing',
  true,
  now() + interval '1 day'
);

-- Published with a closed registration window.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at, registration_closes_at, draw_required
) values (
  md5('hub-comp-closed')::uuid,
  current_setting('test.hub_tournament_id')::uuid,
  'predictor_cup',
  true,
  now() - interval '2 days',
  now() - interval '1 day',
  true
);

-- Unpublished competition in the second tournament: must be invisible.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at
) values (
  md5('hub-comp-hidden')::uuid,
  md5('bonus-hub-other-tournament')::uuid,
  'ko_predictor',
  false,
  now() - interval '1 hour'
);

insert into public.bonus_competition_windows (id, competition_id, sequence, label)
values (md5('hub-window-r16')::uuid, md5('hub-comp-open')::uuid, 1, 'Round of 16');

insert into public.bonus_window_fixtures (window_id, match_id)
select md5('hub-window-r16')::uuid, match.id
from public.matches match
where match.tournament_id = current_setting('test.hub_tournament_id')::uuid
  and match.round = 'r16'
order by match.match_ref
limit 2;

-- ---------------------------------------------------------------------------
-- Structure and closed execution
-- ---------------------------------------------------------------------------

select has_function('public', 'get_bonus_games', array['uuid'], 'hub read model exists');
select has_function('public', 'register_bonus_competition', array['uuid'], 'registration RPC exists');
select has_function('public', 'withdraw_bonus_competition', array['uuid'], 'withdrawal RPC exists');

select is(
  (
    select count(*)::integer
    from information_schema.role_routine_grants
    where routine_schema = 'public'
      and routine_name in (
        'get_bonus_games', 'register_bonus_competition', 'withdraw_bonus_competition'
      )
      and grantee in ('PUBLIC', 'anon')
  ),
  0,
  'anonymous callers hold no bonus hub execution'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.get_bonus_games(%L::uuid) $sql$,
      current_setting('test.hub_tournament_id')
    )
  ),
  '42501',
  'the hub read requires an authenticated user'
);

-- ---------------------------------------------------------------------------
-- Authenticated hub read and registration lifecycle
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', md5('bonus-hub-user'), true);
set local role authenticated;

select is(
  jsonb_array_length(
    public.get_bonus_games(current_setting('test.hub_tournament_id')::uuid)
      -> 'competitions'
  ),
  3,
  'the hub lists every published competition once'
);

select is(
  (
    select jsonb_agg(competition ->> 'game_key')
    from jsonb_array_elements(
      public.get_bonus_games(current_setting('test.hub_tournament_id')::uuid)
        -> 'competitions'
    ) competition
  ),
  '["ko_predictor", "last_man_standing", "predictor_cup"]'::jsonb,
  'competitions arrive in stable game order'
);

select is(
  (
    select competition -> 'entrant'
    from jsonb_array_elements(
      public.get_bonus_games(current_setting('test.hub_tournament_id')::uuid)
        -> 'competitions'
    ) competition
    where competition ->> 'game_key' = 'ko_predictor'
  ),
  'null'::jsonb,
  'a non-entrant sees a null entrant row'
);

select is(
  (
    select jsonb_build_object(
      'label', competition -> 'windows' -> 0 ->> 'label',
      'fixtures', jsonb_array_length(competition -> 'windows' -> 0 -> 'fixtures')
    )
    from jsonb_array_elements(
      public.get_bonus_games(current_setting('test.hub_tournament_id')::uuid)
        -> 'competitions'
    ) competition
    where competition ->> 'game_key' = 'ko_predictor'
  ),
  '{"label": "Round of 16", "fixtures": 2}'::jsonb,
  'windows carry their stored label and real-fixture rows'
);

select is(
  jsonb_array_length(
    public.get_bonus_games(md5('bonus-hub-other-tournament')::uuid)
      -> 'competitions'
  ),
  0,
  'unpublished competitions are invisible to the hub'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.get_bonus_games(%L::uuid) $sql$,
      md5('no-such-tournament')
    )
  ),
  'P0002',
  'an unknown tournament reads as not found'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.register_bonus_competition(%L::uuid) $sql$,
      md5('hub-comp-hidden')
    )
  ),
  'P0002',
  'an unpublished competition is unregistrable and reads as not found'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.register_bonus_competition(%L::uuid) $sql$,
      md5('hub-comp-early')
    )
  ),
  '55000',
  'registration is refused before it opens'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.register_bonus_competition(%L::uuid) $sql$,
      md5('hub-comp-closed')
    )
  ),
  '55000',
  'registration is refused after it closes'
);

select is(
  (
    select public.register_bonus_competition(md5('hub-comp-open')::uuid) ->> 'outcome'
  ),
  'active',
  'an open rolling-entry competition accepts a voluntary entry'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.register_bonus_competition(%L::uuid) $sql$,
      md5('hub-comp-open')
    )
  ),
  '23505',
  'a second registration for the same competition is refused'
);

select is(
  (
    select competition -> 'entrant' ->> 'outcome'
    from jsonb_array_elements(
      public.get_bonus_games(current_setting('test.hub_tournament_id')::uuid)
        -> 'competitions'
    ) competition
    where competition ->> 'game_key' = 'ko_predictor'
  ),
  'active',
  'the hub shows the caller their own entrant state'
);

select is(
  (
    select public.withdraw_bonus_competition(md5('hub-comp-open')::uuid) ->> 'withdrawn'
  ),
  'true',
  'an unscored entrant may withdraw'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.withdraw_bonus_competition(%L::uuid) $sql$,
      md5('hub-comp-open')
    )
  ),
  'P0002',
  'withdrawing twice reads as not entered'
);

select lives_ok(
  format(
    $sql$ select public.register_bonus_competition(%L::uuid) $sql$,
    md5('hub-comp-open')
  ),
  're-entry after withdrawal is allowed while registration is open'
);

reset role;

-- ---------------------------------------------------------------------------
-- Audit trail and scored-history protection
-- ---------------------------------------------------------------------------

select is(
  (
    select count(*)::integer
    from public.bonus_competition_audit audit
    where audit.competition_id = md5('hub-comp-open')::uuid
      and audit.action = 'entrant_registered'
      and audit.actor_id = md5('bonus-hub-user')::uuid
  ),
  2,
  'each registration appends an audit entry'
);

select is(
  (
    select count(*)::integer
    from public.bonus_competition_audit audit
    where audit.competition_id = md5('hub-comp-open')::uuid
      and audit.action = 'entrant_withdrawn'
      and audit.actor_id = md5('bonus-hub-user')::uuid
  ),
  1,
  'each withdrawal appends an audit entry'
);

insert into public.bonus_score_events (
  competition_id, user_id, category, points, explanation
) values (
  md5('hub-comp-open')::uuid,
  md5('bonus-hub-user')::uuid,
  'exact_score',
  5,
  'Hub withdrawal-protection fixture'
);

set local role authenticated;

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.withdraw_bonus_competition(%L::uuid) $sql$,
      md5('hub-comp-open')
    )
  ),
  '55000',
  'withdrawal is refused once the entrant holds scored history'
);

reset role;

update public.bonus_competitions
set registration_opens_at = null
where id = md5('hub-comp-early')::uuid;

set local role authenticated;

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.register_bonus_competition(%L::uuid) $sql$,
      md5('hub-comp-early')
    )
  ),
  '55000',
  'a provisional (unscheduled) opening instant never reads as open'
);

reset role;

select * from finish();
rollback;
