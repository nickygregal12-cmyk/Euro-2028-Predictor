begin;

select plan(17);

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

select set_config(
  'test.bounded_tournament_id',
  (
    select tournament.id::text
    from public.tournaments tournament
    where tournament.name = 'UEFA Euro 2028'
  ),
  true
);

select set_config(
  'test.bounded_group_match_id',
  (
    select match.id::text
    from public.matches match
    where match.tournament_id = current_setting('test.bounded_tournament_id')::uuid
      and match.round = 'group'
    order by match.match_ref
    limit 1
  ),
  true
);

update public.tournaments tournament
set lock_at = now() + interval '1 day'
where tournament.id = current_setting('test.bounded_tournament_id')::uuid;

insert into auth.users (
  id,
  email,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  md5('bounded-user-' || fixture.number)::uuid,
  format('bounded-%s@example.test', lpad(fixture.number::text, 3, '0')),
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from generate_series(1, 251) as fixture(number);

insert into auth.users (
  id,
  email,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  md5('bounded-outsider')::uuid,
  'bounded-outsider@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

update public.profiles profile
set
  display_name = format('Bounded Player %s', lpad(fixture.number::text, 3, '0')),
  welcomed_at = now()
from generate_series(1, 251) as fixture(number)
where profile.id = md5('bounded-user-' || fixture.number)::uuid;

update public.profiles profile
set display_name = 'Bounded Outsider', welcomed_at = now()
where profile.id = md5('bounded-outsider')::uuid;

insert into public.entries (
  id,
  user_id,
  tournament_id,
  submitted_at
)
select
  md5('bounded-entry-' || fixture.number)::uuid,
  md5('bounded-user-' || fixture.number)::uuid,
  current_setting('test.bounded_tournament_id')::uuid,
  now()
from generate_series(1, 251) as fixture(number);

insert into public.score_events (
  entry_id,
  category,
  points,
  explanation
)
select
  md5('bounded-entry-' || fixture.number)::uuid,
  'group_matches',
  1000 - fixture.number,
  'Bounded read model fixture'
from generate_series(1, 251) as fixture(number);

insert into public.leagues (
  id,
  tournament_id,
  owner_id,
  name,
  invite_code,
  created_at
)
select
  md5('bounded-league-' || fixture.number)::uuid,
  current_setting('test.bounded_tournament_id')::uuid,
  md5('bounded-user-1')::uuid,
  format('Bounded League %s', lpad(fixture.number::text, 3, '0')),
  format('B%s', lpad(fixture.number::text, 5, '0')),
  now() + make_interval(secs => fixture.number)
from generate_series(1, 21) as fixture(number);

insert into public.league_members (
  league_id,
  user_id,
  role,
  joined_at
)
select
  md5('bounded-league-' || fixture.number)::uuid,
  md5('bounded-user-1')::uuid,
  'owner',
  now() + make_interval(secs => fixture.number)
from generate_series(1, 21) as fixture(number);

insert into public.league_members (
  league_id,
  user_id,
  role,
  joined_at
)
select
  md5('bounded-league-1')::uuid,
  md5('bounded-user-' || fixture.number)::uuid,
  'member',
  now() + make_interval(secs => fixture.number)
from generate_series(2, 251) as fixture(number);

insert into public.match_predictions (
  entry_id,
  match_id,
  home_score,
  away_score,
  joker,
  version
)
select
  md5('bounded-entry-' || fixture.number)::uuid,
  current_setting('test.bounded_group_match_id')::uuid,
  (fixture.number % 4)::smallint,
  ((fixture.number + 1) % 3)::smallint,
  false,
  0
from generate_series(1, 251) as fixture(number);

insert into public.match_predictions (
  entry_id,
  match_id,
  home_score,
  away_score,
  joker,
  version
)
select
  md5('bounded-entry-2')::uuid,
  match.id,
  1,
  0,
  false,
  0
from public.matches match
where match.tournament_id = current_setting('test.bounded_tournament_id')::uuid
  and match.id <> current_setting('test.bounded_group_match_id')::uuid;

insert into public.predicted_progression (
  entry_id,
  team_id,
  stage,
  version
)
select
  md5('bounded-entry-2')::uuid,
  team.id,
  'r16',
  0
from public.teams team
where team.tournament_id = current_setting('test.bounded_tournament_id')::uuid;

update public.tournaments tournament
set lock_at = now() - interval '1 minute'
where tournament.id = current_setting('test.bounded_tournament_id')::uuid;

select set_config(
  'request.jwt.claim.sub',
  md5('bounded-user-1')::uuid::text,
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.get_leaderboard(
      current_setting('test.bounded_tournament_id')::uuid
    )
  ),
  250::bigint,
  'overall standings return at most 250 submitted entries'
);

select is(
  (
    select max(total_points)
    from public.get_leaderboard(
      current_setting('test.bounded_tournament_id')::uuid
    )
  ),
  999,
  'overall standings retain the highest-scoring entry'
);

select is(
  (
    select min(total_points)
    from public.get_leaderboard(
      current_setting('test.bounded_tournament_id')::uuid
    )
  ),
  750,
  'overall standings order before limiting and exclude the 251st score'
);

select is(
  (
    select count(*)
    from public.get_my_leagues(
      current_setting('test.bounded_tournament_id')::uuid
    )
  ),
  20::bigint,
  'a user league list returns at most 20 leagues'
);

select is(
  (
    select max(name)
    from public.get_my_leagues(
      current_setting('test.bounded_tournament_id')::uuid
    )
  ),
  'Bounded League 020',
  'the user league list preserves deterministic creation order before limiting'
);

select is(
  (
    select count(*)
    from public.get_league_members(md5('bounded-league-1')::uuid)
  ),
  250::bigint,
  'league standings return at most 250 members'
);

select is(
  (
    select min(total_points)
    from public.get_league_members(md5('bounded-league-1')::uuid)
  ),
  750,
  'league standings keep the top 250 scores when excess data exists'
);

select is(
  jsonb_array_length(
    public.get_league_match_picks(
      md5('bounded-league-1')::uuid,
      current_setting('test.bounded_group_match_id')::uuid
    ) -> 'picks'
  ),
  250,
  'league match-pick detail returns at most 250 picks'
);

select is(
  (
    public.get_league_match_picks(
      md5('bounded-league-1')::uuid,
      current_setting('test.bounded_group_match_id')::uuid
    ) ->> 'total_members'
  )::integer,
  251,
  'bounded pick detail keeps the truthful submitted-member count'
);

select is(
  (
    public.get_league_match_picks(
      md5('bounded-league-1')::uuid,
      current_setting('test.bounded_group_match_id')::uuid
    ) ->> 'predicted_count'
  )::integer,
  251,
  'bounded pick detail keeps the truthful prediction count'
);

select is(
  jsonb_array_length(
    public.get_rival_entry(
      md5('bounded-user-2')::uuid,
      current_setting('test.bounded_tournament_id')::uuid
    ) -> 'group_matches'
  ),
  36,
  'rival entry exposes only the fixed 36 group predictions'
);

select is(
  jsonb_array_length(
    public.get_rival_entry(
      md5('bounded-user-2')::uuid,
      current_setting('test.bounded_tournament_id')::uuid
    ) -> 'progression'
  ),
  24,
  'rival entry exposes at most the 24 tournament teams'
);

select is(
  public.get_rival_entry(
    md5('bounded-user-2')::uuid,
    current_setting('test.bounded_tournament_id')::uuid
  ) ->> 'display_name',
  'Bounded Player 002',
  'rival entry retains the expected owner-visible identity'
);

select is(
  (
    select count(*)
    from pg_proc function_row
    join pg_namespace namespace
      on namespace.oid = function_row.pronamespace
    where namespace.nspname = 'public'
      and function_row.proname in (
        'get_leaderboard',
        'get_my_leagues',
        'get_league_members',
        'get_league_match_picks',
        'get_rival_entry'
      )
      and function_row.proconfig::text = '{"search_path=\"\""}'
  ),
  5::bigint,
  'all bounded security-definer reads use an immutable empty search path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_leaderboard(uuid)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.get_leaderboard(uuid)',
    'execute'
  ),
  'authenticated and service roles retain the established read access'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_leaderboard(uuid)',
    'execute'
  ),
  'anonymous callers do not gain leaderboard access'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  md5('bounded-outsider')::uuid::text,
  true
);
set local role authenticated;

select is(
  pg_temp.capture_sqlstate(
    format(
      'select * from public.get_league_members(%L::uuid)',
      md5('bounded-league-1')::uuid
    )
  ),
  '42501',
  'a non-member still cannot read bounded league standings'
);

select * from finish();
rollback;
