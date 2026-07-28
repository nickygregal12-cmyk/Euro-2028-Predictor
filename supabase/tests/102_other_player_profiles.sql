begin;

select plan(22);

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

select public.set_operating_limits(250, 20);

select set_config(
  'test.player_profile_tournament',
  (select id::text from public.tournaments order by created_at, id limit 1),
  true
);

delete from public.leagues
where tournament_id = current_setting('test.player_profile_tournament')::uuid;

delete from public.entries
where tournament_id = current_setting('test.player_profile_tournament')::uuid;

update public.tournaments
set lock_at = now() + interval '1 day'
where id = current_setting('test.player_profile_tournament')::uuid;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    md5('player-profile-caller')::uuid,
    'player-profile-caller@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    md5('player-profile-rival')::uuid,
    'player-profile-rival@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    md5('player-profile-no-entry')::uuid,
    'player-profile-no-entry@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    md5('player-profile-outsider')::uuid,
    'player-profile-outsider@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

update public.profiles
set display_name = case id
  when md5('player-profile-caller')::uuid then 'Profile Caller'
  when md5('player-profile-rival')::uuid then 'Profile Rival'
  when md5('player-profile-no-entry')::uuid then 'Profile No Entry'
  else 'Profile Outsider'
end,
welcomed_at = now()
where id in (
  md5('player-profile-caller')::uuid,
  md5('player-profile-rival')::uuid,
  md5('player-profile-no-entry')::uuid,
  md5('player-profile-outsider')::uuid
);

insert into public.leagues (
  id, tournament_id, owner_id, name, invite_code, created_at
) values (
  md5('player-profile-league')::uuid,
  current_setting('test.player_profile_tournament')::uuid,
  md5('player-profile-caller')::uuid,
  'Secure Profile Fixture',
  'PROF47',
  now()
);

insert into public.league_members (league_id, user_id, role, joined_at) values
  (
    md5('player-profile-league')::uuid,
    md5('player-profile-caller')::uuid,
    'owner',
    now()
  ),
  (
    md5('player-profile-league')::uuid,
    md5('player-profile-rival')::uuid,
    'member',
    now() + interval '1 second'
  ),
  (
    md5('player-profile-league')::uuid,
    md5('player-profile-no-entry')::uuid,
    'member',
    now() + interval '2 seconds'
  );

insert into public.entries (id, user_id, tournament_id, submitted_at) values
  (
    md5('player-profile-caller-entry')::uuid,
    md5('player-profile-caller')::uuid,
    current_setting('test.player_profile_tournament')::uuid,
    now()
  ),
  (
    md5('player-profile-rival-entry')::uuid,
    md5('player-profile-rival')::uuid,
    current_setting('test.player_profile_tournament')::uuid,
    now()
  );

insert into public.score_events (entry_id, category, points, explanation) values
  (
    md5('player-profile-caller-entry')::uuid,
    'group_matches',
    10000,
    'Profile caller ranking fixture'
  );

insert into public.score_events (entry_id, category, points, explanation)
select
  md5('player-profile-rival-entry')::uuid,
  'group_matches',
  1,
  format('Bounded profile event %s', fixture.number)
from generate_series(1, 105) fixture(number);

insert into public.match_predictions (
  entry_id, match_id, home_score, away_score, joker
)
select
  md5('player-profile-rival-entry')::uuid,
  match.id,
  2,
  1,
  false
from public.matches match
where match.tournament_id = current_setting('test.player_profile_tournament')::uuid
  and match.round = 'group'
order by match.match_ref, match.id
limit 36;

insert into public.predicted_progression (entry_id, team_id, stage)
select
  md5('player-profile-rival-entry')::uuid,
  ranked.team_id,
  case
    when ranked.ordinal = 1 then 'champion'
    when ranked.ordinal = 2 then 'final'
    when ranked.ordinal <= 4 then 'sf'
    when ranked.ordinal <= 8 then 'qf'
    else 'r16'
  end
from (
  select
    team.id as team_id,
    row_number() over (order by team.name, team.id) as ordinal
  from public.teams team
  where team.tournament_id = current_setting('test.player_profile_tournament')::uuid
  order by team.name, team.id
  limit 24
) ranked;

create temporary table player_profile_payloads (
  label text primary key,
  payload jsonb not null
) on commit drop;

select set_config(
  'request.jwt.claim.sub',
  md5('player-profile-caller')::uuid::text,
  true
);

insert into player_profile_payloads (label, payload) values (
  'pre-lock',
  public.get_player_profile(
    md5('player-profile-rival')::uuid,
    current_setting('test.player_profile_tournament')::uuid
  )
);

select is(
  (select payload ->> 'display_name' from player_profile_payloads where label = 'pre-lock'),
  'Profile Rival',
  'a co-member can read the player identity before lock'
);
select is(
  ((select payload from player_profile_payloads where label = 'pre-lock') ->> 'locked')::boolean,
  false,
  'the pre-lock profile reports that detail remains hidden'
);
select is(
  ((select payload from player_profile_payloads where label = 'pre-lock') ->> 'has_entry')::boolean,
  true,
  'the pre-lock profile exposes submitted-entry status'
);
select is(
  ((select payload from player_profile_payloads where label = 'pre-lock') ->> 'league_count')::integer,
  1,
  'the pre-lock profile exposes only the tournament league count'
);
select ok(
  not ((select payload from player_profile_payloads where label = 'pre-lock') ? 'total_points'),
  'authoritative points are absent before lock'
);
select ok(
  not ((select payload from player_profile_payloads where label = 'pre-lock') ? 'group_matches'),
  'predictions are absent before lock'
);

select set_config(
  'request.jwt.claim.sub',
  md5('player-profile-outsider')::uuid::text,
  true
);
set local role authenticated;
select is(
  pg_temp.capture_sqlstate(
    format(
      'select public.get_player_profile(%L::uuid, %L::uuid)',
      md5('player-profile-rival')::uuid,
      current_setting('test.player_profile_tournament')::uuid
    )
  ),
  '42501',
  'a non-co-member cannot read another player profile'
);
reset role;

select lives_ok(
  format(
    'select public.get_player_profile(%L::uuid, %L::uuid)',
    md5('player-profile-outsider')::uuid,
    current_setting('test.player_profile_tournament')::uuid
  ),
  'a player may read their own safe profile without league membership'
);

update public.tournaments
set lock_at = now() - interval '1 minute'
where id = current_setting('test.player_profile_tournament')::uuid;

select set_config(
  'request.jwt.claim.sub',
  md5('player-profile-caller')::uuid::text,
  true
);

insert into player_profile_payloads (label, payload) values (
  'post-lock',
  public.get_player_profile(
    md5('player-profile-rival')::uuid,
    current_setting('test.player_profile_tournament')::uuid
  )
), (
  'no-entry',
  public.get_player_profile(
    md5('player-profile-no-entry')::uuid,
    current_setting('test.player_profile_tournament')::uuid
  )
);

select is(
  ((select payload from player_profile_payloads where label = 'post-lock') ->> 'locked')::boolean,
  true,
  'the post-lock profile reports revealed detail'
);
select is(
  ((select payload from player_profile_payloads where label = 'post-lock') ->> 'total_points')::integer,
  105,
  'post-lock profile points are authoritative from score events'
);
select is(
  ((select payload from player_profile_payloads where label = 'post-lock') ->> 'rank')::integer,
  2,
  'post-lock profile rank uses standard competition ranking'
);
select is(
  jsonb_array_length(
    (select payload -> 'group_matches' from player_profile_payloads where label = 'post-lock')
  ),
  36,
  'post-lock group predictions are bounded at 36 rows'
);
select is(
  jsonb_array_length(
    (select payload -> 'progression' from player_profile_payloads where label = 'post-lock')
  ),
  24,
  'post-lock progression is bounded at 24 rows'
);
select is(
  jsonb_array_length(
    (select payload -> 'score_events' from player_profile_payloads where label = 'post-lock')
  ),
  100,
  'post-lock score-event history is bounded at 100 rows'
);
select is(
  (
    select sum((event ->> 'points')::integer)
    from jsonb_array_elements(
      (select payload -> 'score_events' from player_profile_payloads where label = 'post-lock')
    ) event
  ),
  100::bigint,
  'the bounded score-event payload contains valid event values'
);
select ok(
  octet_length(
    (select payload::text from player_profile_payloads where label = 'post-lock')
  ) < 50000,
  'the full profile response remains a bounded sub-50 kB payload'
);
select is(
  ((select payload from player_profile_payloads where label = 'no-entry') ->> 'locked')::boolean,
  true,
  'a no-entry co-member is still readable after lock'
);
select is(
  ((select payload from player_profile_payloads where label = 'no-entry') ->> 'has_entry')::boolean,
  false,
  'the post-lock no-entry state is explicit'
);
select ok(
  not ((select payload from player_profile_payloads where label = 'no-entry') ? 'total_points'),
  'a no-entry profile does not invent detail after lock'
);
select is(
  (
    select function_row.proconfig::text
    from pg_proc function_row
    join pg_namespace namespace on namespace.oid = function_row.pronamespace
    where namespace.nspname = 'public'
      and function_row.oid = 'public.get_player_profile(uuid,uuid)'::regprocedure
  ),
  '{"search_path=\"\""}',
  'the profile RPC has an immutable empty search path'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_player_profile(uuid,uuid)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.get_player_profile(uuid,uuid)',
    'execute'
  ),
  'authenticated and service roles retain the protected profile RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_player_profile(uuid,uuid)',
    'execute'
  ),
  'anonymous callers gain no profile access'
);

select * from finish();
rollback;
