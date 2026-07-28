begin;

select plan(20);

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
-- Fixtures: one scheduled R16 tie, a KO Predictor field of four entrants and
-- one Cup-only entrant sharing the prediction store.
--   alpha: joined early, predicts 2-1              → exact 5 + through 2
--   late:  joined after kickoff, predicts 2-1      → unbanked, nothing
--   duo:   joined early, predicts 1-1, alpha pick  → through alone 2
--   echo:  joined early, predicts 0-1              → nothing
--   cup:   Predictor Cup only                      → predicts, never KO-scored
-- ---------------------------------------------------------------------------

select set_config(
  'test.ko_tournament_id',
  (
    select tournament.id::text from public.tournaments tournament
    where tournament.name = 'UEFA Euro 2028'
  ),
  true
);

select set_config(
  'test.ko_match',
  (
    select match.id::text from public.matches match
    where match.tournament_id = current_setting('test.ko_tournament_id')::uuid
      and match.round = 'r16'
    order by match.match_ref
    limit 1
  ),
  true
);

select set_config(
  'test.ko_team_home',
  (
    select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.ko_tournament_id')::uuid
    order by team.name limit 1
  ),
  true
);

select set_config(
  'test.ko_team_away',
  (
    select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.ko_tournament_id')::uuid
    order by team.name offset 1 limit 1
  ),
  true
);

set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  md5('ko-user-' || fixture.name)::uuid,
  format('ko-%s@example.test', fixture.name),
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from (values ('alpha'), ('late'), ('duo'), ('echo'), ('cup')) as fixture(name);

update public.matches
set kickoff_at = now() + interval '1 hour',
    home_team_id = current_setting('test.ko_team_home')::uuid,
    away_team_id = current_setting('test.ko_team_away')::uuid
where id = current_setting('test.ko_match')::uuid;

set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select
  md5('ko-user-' || fixture.name)::uuid,
  format('Ko %s', initcap(fixture.name)),
  now()
from (values ('alpha'), ('late'), ('duo'), ('echo'), ('cup')) as fixture(name);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at
) values
  (
    md5('ko-comp')::uuid,
    current_setting('test.ko_tournament_id')::uuid,
    'ko_predictor', true, now() - interval '3 hours'
  ),
  (
    md5('ko-cup-comp')::uuid,
    current_setting('test.ko_tournament_id')::uuid,
    'predictor_cup', true, now() - interval '3 hours'
  );

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at) values
  (md5('ko-comp')::uuid, md5('ko-user-alpha')::uuid, now() - interval '2 hours'),
  (md5('ko-comp')::uuid, md5('ko-user-late')::uuid, now()),
  (md5('ko-comp')::uuid, md5('ko-user-duo')::uuid, now() - interval '2 hours'),
  (md5('ko-comp')::uuid, md5('ko-user-echo')::uuid, now() - interval '2 hours'),
  (md5('ko-cup-comp')::uuid, md5('ko-user-cup')::uuid, now() - interval '2 hours');

insert into public.bonus_knockout_predictions (
  user_id, match_id, home_score, away_score, advancing_team_id
) values
  (md5('ko-user-alpha')::uuid, current_setting('test.ko_match')::uuid, 2, 1, null),
  (md5('ko-user-late')::uuid, current_setting('test.ko_match')::uuid, 2, 1, null),
  (md5('ko-user-duo')::uuid, current_setting('test.ko_match')::uuid, 1, 1,
    current_setting('test.ko_team_home')::uuid),
  (md5('ko-user-echo')::uuid, current_setting('test.ko_match')::uuid, 0, 1, null),
  (md5('ko-user-cup')::uuid, current_setting('test.ko_match')::uuid, 2, 1, null);

-- The tie kicks off: the late joiner's entry now postdates the kickoff.
set local session_replication_role = replica;
update public.matches
set kickoff_at = now() - interval '30 minutes'
where id = current_setting('test.ko_match')::uuid;
set local session_replication_role = origin;

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_function(
  'predictor_internal', 'recompute_ko_predictor_for_match', array['uuid'],
  'the KO recompute leg of the single result operation exists'
);
select has_function(
  'public', 'get_ko_predictor_standings', array['uuid', 'integer', 'text'],
  'the bounded KO standings read exists'
);
select is(
  (
    select count(*)::integer
    from information_schema.role_routine_grants
    where routine_schema = 'public'
      and routine_name = 'get_ko_predictor_standings'
      and grantee in ('PUBLIC', 'anon')
  ),
  0,
  'anonymous callers hold no KO standings execution'
);

-- ---------------------------------------------------------------------------
-- Confirm fans out into KO scoring inside the same operation
-- ---------------------------------------------------------------------------

select public.confirm_match_result(
  current_setting('test.ko_match')::uuid, 'regulation', 2::smallint, 1::smallint
);

select is(
  (
    select jsonb_build_object('rows', count(*)::integer, 'points', coalesce(sum(event.points), 0)::integer)
    from public.bonus_score_events event
    where event.competition_id = md5('ko-comp')::uuid
      and event.user_id = md5('ko-user-alpha')::uuid
  ),
  '{"rows": 2, "points": 7}'::jsonb,
  'an exact scoreline banks 5 plus the stacking through 2'
);

select is(
  (
    select coalesce(jsonb_agg(event.category order by event.category), '[]'::jsonb)
    from public.bonus_score_events event
    where event.competition_id = md5('ko-comp')::uuid
      and event.user_id = md5('ko-user-alpha')::uuid
  ),
  '["advancing_team", "exact_score"]'::jsonb,
  'exact and result never stack — the exact event replaces the result event'
);

select is(
  (
    select count(*)::integer from public.bonus_score_events event
    where event.user_id = md5('ko-user-late')::uuid
  ),
  0,
  'rolling entry: a round that kicked off before joining stays unbanked'
);

select is(
  (
    select count(*)::integer from public.bonus_score_events event
    where event.user_id = md5('ko-user-cup')::uuid
  ),
  0,
  'a Cup-only entrant shares the store but earns no KO Predictor points'
);

select is(
  (
    select jsonb_build_object('rows', count(*)::integer, 'points', coalesce(sum(event.points), 0)::integer)
    from public.bonus_score_events event
    where event.competition_id = md5('ko-comp')::uuid
      and event.user_id = md5('ko-user-duo')::uuid
  ),
  '{"rows": 1, "points": 2}'::jsonb,
  'the through pick pays alone on a wrong scoreline with the right advancing team'
);

select is(
  (
    select count(*)::integer from public.bonus_score_events event
    where event.user_id = md5('ko-user-echo')::uuid
  ),
  0,
  'a wrong result with the wrong advancing team earns nothing'
);

select is(
  (
    select count(*)::integer from public.bonus_score_events event
    where event.match_id = current_setting('test.ko_match')::uuid
  ),
  3,
  'the confirmed tie produced exactly the expected KO events'
);

-- ---------------------------------------------------------------------------
-- Standings
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', md5('ko-user-alpha'), true);
set local role authenticated;

select is(
  (
    select jsonb_build_object(
      'first_user', payload -> 'standings' -> 0 ->> 'user_id',
      'first_rank', payload -> 'standings' -> 0 -> 'rank',
      'first_points', payload -> 'standings' -> 0 -> 'total_points',
      'rows', jsonb_array_length(payload -> 'standings')
    )
    from public.get_ko_predictor_standings(
      current_setting('test.ko_tournament_id')::uuid
    ) payload
  ),
  jsonb_build_object(
    'first_user', md5('ko-user-alpha'),
    'first_rank', 1,
    'first_points', 7,
    'rows', 4
  ),
  'standings rank every KO entrant, zero-point rows included'
);

select is(
  (
    select payload -> 'me'
    from public.get_ko_predictor_standings(
      current_setting('test.ko_tournament_id')::uuid
    ) payload
  ) -> 'total_points',
  '7'::jsonb,
  'the caller receives their own rank context'
);

select is(
  (
    select jsonb_build_object(
      'rows', jsonb_array_length(payload -> 'standings'),
      'has_cursor', payload ->> 'next_cursor' is not null
    )
    from public.get_ko_predictor_standings(
      current_setting('test.ko_tournament_id')::uuid, 2
    ) payload
  ),
  '{"rows": 2, "has_cursor": true}'::jsonb,
  'a bounded page returns its cursor'
);

select is(
  (
    select jsonb_build_object(
      'rows', jsonb_array_length(second_page.payload -> 'standings'),
      'exhausted', second_page.payload ->> 'next_cursor' is null
    )
    from public.get_ko_predictor_standings(
      current_setting('test.ko_tournament_id')::uuid,
      2,
      (
        select first_page.payload ->> 'next_cursor'
        from public.get_ko_predictor_standings(
          current_setting('test.ko_tournament_id')::uuid, 2
        ) first_page(payload)
      )
    ) second_page(payload)
  ),
  '{"rows": 2, "exhausted": true}'::jsonb,
  'the keyset cursor walks the remaining field without overlap'
);

reset role;
select set_config('request.jwt.claim.sub', md5('ko-user-cup'), true);
set local role authenticated;

select is(
  (
    select payload -> 'me'
    from public.get_ko_predictor_standings(
      current_setting('test.ko_tournament_id')::uuid
    ) payload
  ),
  'null'::jsonb,
  'a non-entrant may view the global standings without a personal row'
);

reset role;

-- ---------------------------------------------------------------------------
-- Correction and clear recompute independently
-- ---------------------------------------------------------------------------

select public.correct_match_result(
  current_setting('test.ko_match')::uuid, 'regulation', 1::smallint, 0::smallint,
  null, null, null, null, 'Regulation score recorded incorrectly'
);

select is(
  (
    select jsonb_build_object('rows', count(*)::integer, 'points', coalesce(sum(event.points), 0)::integer)
    from public.bonus_score_events event
    where event.competition_id = md5('ko-comp')::uuid
      and event.user_id = md5('ko-user-alpha')::uuid
  ),
  '{"rows": 2, "points": 5}'::jsonb,
  'a correction rederives: the exact 5 becomes result 3 plus through 2'
);

select is(
  (
    select jsonb_build_object('rows', count(*)::integer, 'points', coalesce(sum(event.points), 0)::integer)
    from public.bonus_score_events event
    where event.competition_id = md5('ko-comp')::uuid
      and event.user_id = md5('ko-user-duo')::uuid
  ),
  '{"rows": 1, "points": 2}'::jsonb,
  'the corrected result keeps the standalone through payment'
);

select public.clear_match_result(
  current_setting('test.ko_match')::uuid, 'Result entered for the wrong tie'
);

select is(
  (
    select count(*)::integer from public.bonus_score_events event
    where event.match_id = current_setting('test.ko_match')::uuid
  ),
  0,
  'clearing the result clears every KO event with it'
);

-- ---------------------------------------------------------------------------
-- Access boundaries
-- ---------------------------------------------------------------------------

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.get_ko_predictor_standings(%L::uuid) $sql$,
      current_setting('test.ko_tournament_id')
    )
  ),
  '42501',
  'the standings read requires an authenticated user'
);

select set_config('request.jwt.claim.sub', md5('ko-user-alpha'), true);
set local role authenticated;

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.get_ko_predictor_standings(%L::uuid) $sql$,
      md5('ko-no-such-tournament')
    )
  ),
  'P0002',
  'standings for an unknown tournament read as not found'
);

reset role;

select * from finish();
rollback;
