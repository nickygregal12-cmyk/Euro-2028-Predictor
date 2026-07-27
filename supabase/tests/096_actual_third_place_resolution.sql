begin;

select plan(31);

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

create or replace function pg_temp.boundary_score(
  p_home_name text,
  p_away_name text
)
returns smallint[]
language plpgsql
immutable
as $$
declare
  v_group_index integer := ascii(substring(p_home_name from 6 for 1)) - ascii('A');
  v_home_slot integer := right(p_home_name, 1)::integer;
  v_away_slot integer := right(p_away_name, 1)::integer;
  v_low_slot integer := least(v_home_slot, v_away_slot);
  v_high_slot integer := greatest(v_home_slot, v_away_slot);
  v_winning_goals integer;
begin
  v_winning_goals := case
    -- Groups B and C now produce identical third-place records. Three teams
    -- rank above them, so this two-team block crosses fourth place.
    when v_low_slot = 3 and v_high_slot = 4 and v_group_index in (1, 2) then 2
    when v_low_slot = 3 and v_high_slot = 4 then v_group_index + 1
    when v_low_slot = 1 and v_high_slot = 3 then 3
    else 2
  end;

  if v_home_slot < v_away_slot then
    return array[v_winning_goals::smallint, 0::smallint];
  end if;

  return array[0::smallint, v_winning_goals::smallint];
end;
$$;

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
  '22000000-0000-0000-0000-000000000001',
  'actual-third-admin@example.test',
  'authenticated',
  'authenticated',
  '{"admin_role":"super_admin"}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

select lives_ok(
  $test$
  do $body$
  declare
    fixture record;
    score smallint[];
  begin
    for fixture in
      select
        match.id,
        home_team.name as home_name,
        away_team.name as away_name
      from public.matches match
      join public.teams home_team on home_team.id = match.home_team_id
      join public.teams away_team on away_team.id = match.away_team_id
      where match.round = 'group'
        and match.tournament_id = (
          select id from public.tournaments where name = 'UEFA Euro 2028'
        )
      order by match.matchday, match.match_ref
    loop
      score := pg_temp.boundary_score(fixture.home_name, fixture.away_name);
      perform public.confirm_match_result(
        fixture.id,
        'regulation',
        score[1],
        score[2],
        null,
        null,
        null,
        null,
        'Boundary-tie lifecycle fixture'
      );
    end loop;
  end;
  $body$;
  $test$,
  'all 36 group results complete with a deterministic qualification-boundary tie'
);

select is(
  (
    select count(*)
    from (
      select home_team_id as team_id from public.matches where round = 'r16'
      union all
      select away_team_id from public.matches where round = 'r16'
    ) participants
    where team_id is null
  ),
  16::bigint,
  'the actual Round of 16 remains unresolved before an admin decision'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22000000-0000-0000-0000-000000000001","app_metadata":{}}',
  true
);
select is(
  pg_temp.capture_sqlstate(
    format(
      'select public.admin_actual_third_place_tie_status(%L::uuid)',
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    )
  ),
  '42501',
  'an authenticated user without result capability cannot read the workflow'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22000000-0000-0000-0000-000000000001","app_metadata":{"admin_role":"super_admin"}}',
  true
);

select is(
  (
    public.admin_actual_third_place_tie_status(
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    ) ->> 'state'
  ),
  'requires_resolution',
  'an authorised admin sees that a resolution is required'
);

select is(
  (
    select array_agg(team ->> 'teamName' order by team ->> 'teamName')
    from jsonb_array_elements(
      public.admin_actual_third_place_tie_status(
        (select id from public.tournaments where name = 'UEFA Euro 2028')
      ) -> 'teams'
    ) team
  ),
  array['Team B3', 'Team C3']::text[],
  'the workflow exposes the exact tied team set'
);

select is(
  (
    public.admin_actual_third_place_tie_status(
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    ) ->> 'qualifyingPlaces'
  )::integer,
  1,
  'the workflow explains that one place remains inside the tie block'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      'select public.admin_resolve_actual_third_place_tie(%L::uuid, array[%L::uuid,%L::uuid], %L)',
      (select id from public.tournaments where name = 'UEFA Euro 2028'),
      (select id from public.teams where name = 'Team B3'),
      (select id from public.teams where name = 'Team D3'),
      'Wrong team set must fail'
    )
  ),
  '23514',
  'the RPC rejects an order that is not the exact current tie set'
);

select lives_ok(
  format(
    'select public.admin_resolve_actual_third_place_tie(%L::uuid, array[%L::uuid,%L::uuid], %L)',
    (select id from public.tournaments where name = 'UEFA Euro 2028'),
    (select id from public.teams where name = 'Team B3'),
    (select id from public.teams where name = 'Team C3'),
    'Official fair-play order placed Team B3 first'
  ),
  'the authorised admin resolves the boundary tie'
);

select is(
  (
    public.admin_actual_third_place_tie_status(
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    ) ->> 'state'
  ),
  'resolved',
  'status becomes resolved after the decision'
);

select is(
  (
    select count(*)
    from public.matches match
    where match.round = 'r16'
      and 'Team B3' = any(array[
        (select name from public.teams where id = match.home_team_id),
        (select name from public.teams where id = match.away_team_id)
      ])
  ),
  1::bigint,
  'Team B3 qualifies when placed first in the boundary tie'
);

select is(
  (
    select count(*)
    from public.matches match
    where match.round = 'r16'
      and 'Team C3' = any(array[
        (select name from public.teams where id = match.home_team_id),
        (select name from public.teams where id = match.away_team_id)
      ])
  ),
  0::bigint,
  'Team C3 is excluded when placed second'
);

select is(
  (
    select count(*)
    from (
      select home_team_id as team_id from public.matches where round = 'r16'
      union all
      select away_team_id from public.matches where round = 'r16'
    ) participants
    where team_id is not null
  ),
  16::bigint,
  'resolving the tie populates all 16 R16 participant slots'
);

select is(
  (
    select count(*)
    from public.admin_actual_third_place_tie_revisions(
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    )
  ),
  1::bigint,
  'the first resolution creates one immutable revision'
);

select is(
  (
    select action
    from public.admin_actual_third_place_tie_revisions(
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    )
    limit 1
  ),
  'resolve',
  'the first revision is classified as resolve'
);

select lives_ok(
  format(
    'select public.admin_resolve_actual_third_place_tie(%L::uuid, array[%L::uuid,%L::uuid], %L)',
    (select id from public.tournaments where name = 'UEFA Euro 2028'),
    (select id from public.teams where name = 'Team C3'),
    (select id from public.teams where name = 'Team B3'),
    'Corrected official fair-play order placed Team C3 first'
  ),
  'the admin can correct the order before the R16 is played'
);

select is(
  (
    select count(*)
    from public.matches match
    where match.round = 'r16'
      and 'Team B3' = any(array[
        (select name from public.teams where id = match.home_team_id),
        (select name from public.teams where id = match.away_team_id)
      ])
  ),
  0::bigint,
  'the corrected bracket removes Team B3'
);

select is(
  (
    select count(*)
    from public.matches match
    where match.round = 'r16'
      and 'Team C3' = any(array[
        (select name from public.teams where id = match.home_team_id),
        (select name from public.teams where id = match.away_team_id)
      ])
  ),
  1::bigint,
  'the corrected bracket includes Team C3'
);

select is(
  (
    public.admin_actual_third_place_tie_status(
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    ) ->> 'version'
  )::integer,
  2,
  'the corrected resolution advances its version'
);

select is(
  (
    select action
    from public.admin_actual_third_place_tie_revisions(
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    )
    where revision = 2
  ),
  'correct',
  'the second revision is classified as correct'
);

select lives_ok(
  format(
    'select public.admin_clear_actual_third_place_tie(%L::uuid, %L)',
    (select id from public.tournaments where name = 'UEFA Euro 2028'),
    'Clear the provisional official ordering'
  ),
  'the admin can clear the resolution before the R16 is played'
);

select is(
  (
    select count(*)
    from (
      select home_team_id as team_id from public.matches where round = 'r16'
      union all
      select away_team_id from public.matches where round = 'r16'
    ) participants
    where team_id is null
  ),
  16::bigint,
  'clearing the resolution returns the R16 to an unresolved state'
);

select is(
  (
    public.admin_actual_third_place_tie_status(
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    ) ->> 'state'
  ),
  'requires_resolution',
  'status returns to resolution required after clearing'
);

select is(
  (
    select count(*)
    from public.admin_actual_third_place_tie_revisions(
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    )
  ),
  3::bigint,
  'resolve, correct and clear remain in revision history'
);

select lives_ok(
  format(
    'select public.admin_resolve_actual_third_place_tie(%L::uuid, array[%L::uuid,%L::uuid], %L)',
    (select id from public.tournaments where name = 'UEFA Euro 2028'),
    (select id from public.teams where name = 'Team C3'),
    (select id from public.teams where name = 'Team B3'),
    'Final official order before knockout play'
  ),
  'the cleared boundary can be resolved again'
);

reset role;

select lives_ok(
  $test$
  do $body$
  declare
    v_match_id uuid;
  begin
    select match.id
      into v_match_id
      from public.matches match
      where match.round = 'r16'
        and (
          match.home_team_id = (select id from public.teams where name = 'Team C3')
          or match.away_team_id = (select id from public.teams where name = 'Team C3')
        );

    perform public.confirm_match_result(
      v_match_id,
      'regulation',
      2::smallint,
      0::smallint,
      null,
      null,
      null,
      null,
      'Play the affected R16 fixture'
    );
  end;
  $body$;
  $test$,
  'the affected R16 fixture is confirmed for rollback checks'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22000000-0000-0000-0000-000000000001","app_metadata":{"admin_role":"super_admin"}}',
  true
);

select is(
  pg_temp.capture_sqlstate(
    format(
      'select public.admin_resolve_actual_third_place_tie(%L::uuid, array[%L::uuid,%L::uuid], %L)',
      (select id from public.tournaments where name = 'UEFA Euro 2028'),
      (select id from public.teams where name = 'Team B3'),
      (select id from public.teams where name = 'Team C3'),
      'Attempt to reverse after knockout play'
    )
  ),
  '55000',
  'a played R16 fixture blocks a resolution that would rewrite participants'
);

select is(
  (
    public.admin_actual_third_place_tie_status(
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    ) -> 'orderedTeamIds' ->> 0
  ),
  (select id::text from public.teams where name = 'Team C3'),
  'the failed correction rolls back and preserves the stored order'
);

select is(
  (
    select count(*)
    from public.admin_actual_third_place_tie_revisions(
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    )
  ),
  4::bigint,
  'the failed correction creates no revision'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      'select public.admin_clear_actual_third_place_tie(%L::uuid, %L)',
      (select id from public.tournaments where name = 'UEFA Euro 2028'),
      'Attempt to clear after knockout play'
    )
  ),
  '55000',
  'a played R16 fixture also blocks clearing the active resolution'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      'insert into public.actual_third_place_resolutions (tournament_id,tie_key,basis_hash,ordered_team_ids,version,last_reason) values (%L::uuid,%L,%L,array[%L::uuid,%L::uuid],99,%L)',
      (select id from public.tournaments where name = 'UEFA Euro 2028'),
      'invalid',
      'invalid',
      (select id from public.teams where name = 'Team B3'),
      (select id from public.teams where name = 'Team C3'),
      'Direct write must fail'
    )
  ),
  '42501',
  'authenticated administrators cannot bypass the RPC with a direct table write'
);

reset role;

select is(
  pg_temp.capture_sqlstate(
    format(
      'update public.actual_third_place_resolution_revisions set reason = %L where tournament_id = %L::uuid',
      'Mutate history',
      (select id from public.tournaments where name = 'UEFA Euro 2028')
    )
  ),
  '42501',
  'resolution revision history is immutable even to direct database writes'
);

select * from finish();
rollback;
