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

select set_config(
  'test.c59_tournament',
  (select tournament.id::text from public.tournaments tournament
    where tournament.name = 'UEFA Euro 2028'),
  true
);
select set_config(
  'test.c59_group',
  (select grp.id::text from public.groups grp
    where grp.tournament_id = current_setting('test.c59_tournament')::uuid
    order by grp.group_key
    limit 1),
  true
);
select set_config(
  'test.c59_team1',
  (select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.c59_tournament')::uuid
    order by team.name, team.id
    offset 0 limit 1),
  true
);
select set_config(
  'test.c59_team2',
  (select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.c59_tournament')::uuid
    order by team.name, team.id
    offset 1 limit 1),
  true
);
select set_config(
  'test.c59_team3',
  (select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.c59_tournament')::uuid
    order by team.name, team.id
    offset 2 limit 1),
  true
);
select set_config(
  'test.c59_team4',
  (select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.c59_tournament')::uuid
    order by team.name, team.id
    offset 3 limit 1),
  true
);

update public.tournaments
set lock_at = now() + interval '1 day'
where id = current_setting('test.c59_tournament')::uuid;

insert into public.matches (
  id, tournament_id, match_ref, round, group_id, matchday,
  home_source, away_source, home_team_id, away_team_id,
  match_date, kickoff_at, venue
) values
  (
    md5('c59-match-1')::uuid,
    current_setting('test.c59_tournament')::uuid,
    'C59-1', 'group', current_setting('test.c59_group')::uuid, 1,
    'team', 'team', current_setting('test.c59_team1')::uuid,
    current_setting('test.c59_team2')::uuid,
    current_date + 1, now() + interval '1 day', 'Consensus Test One'
  ),
  (
    md5('c59-match-2')::uuid,
    current_setting('test.c59_tournament')::uuid,
    'C59-2', 'group', current_setting('test.c59_group')::uuid, 1,
    'team', 'team', current_setting('test.c59_team3')::uuid,
    current_setting('test.c59_team4')::uuid,
    current_date + 1, now() + interval '1 day 1 hour', 'Consensus Test Two'
  ),
  (
    md5('c59-match-3')::uuid,
    current_setting('test.c59_tournament')::uuid,
    'C59-3', 'group', current_setting('test.c59_group')::uuid, 1,
    'team', 'team', current_setting('test.c59_team1')::uuid,
    current_setting('test.c59_team3')::uuid,
    current_date + 1, now() + interval '1 day 2 hours', 'Consensus Test Three'
  );

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  md5('c59-user-' || letter)::uuid,
  format('c59-%s@example.test', letter),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from unnest(array['a','b','c','d']) as letter;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select
  md5('c59-user-' || letter)::uuid,
  format('Consensus Player %s', upper(letter)),
  now()
from unnest(array['a','b','c','d']) as letter;

insert into public.entries (id, user_id, tournament_id, submitted_at) values
  (md5('c59-entry-a')::uuid, md5('c59-user-a')::uuid,
    current_setting('test.c59_tournament')::uuid, now()),
  (md5('c59-entry-b')::uuid, md5('c59-user-b')::uuid,
    current_setting('test.c59_tournament')::uuid, now()),
  (md5('c59-entry-c')::uuid, md5('c59-user-c')::uuid,
    current_setting('test.c59_tournament')::uuid, now()),
  (md5('c59-entry-d')::uuid, md5('c59-user-d')::uuid,
    current_setting('test.c59_tournament')::uuid, null);

set local session_replication_role = replica;

insert into public.match_predictions (
  entry_id, match_id, home_score, away_score
) values
  -- Submitted A: home / draw / home, totals 2 + 2 + 4 = 8.
  (md5('c59-entry-a')::uuid, md5('c59-match-1')::uuid, 2, 0),
  (md5('c59-entry-a')::uuid, md5('c59-match-2')::uuid, 1, 1),
  (md5('c59-entry-a')::uuid, md5('c59-match-3')::uuid, 4, 0),
  -- Submitted B: home / home / home, totals 2 + 3 + 1 = 6.
  (md5('c59-entry-b')::uuid, md5('c59-match-1')::uuid, 2, 0),
  (md5('c59-entry-b')::uuid, md5('c59-match-2')::uuid, 2, 1),
  (md5('c59-entry-b')::uuid, md5('c59-match-3')::uuid, 1, 0),
  -- Submitted C: away / away / draw, totals 1 + 1 + 2 = 4.
  (md5('c59-entry-c')::uuid, md5('c59-match-1')::uuid, 0, 1),
  (md5('c59-entry-c')::uuid, md5('c59-match-2')::uuid, 0, 1),
  (md5('c59-entry-c')::uuid, md5('c59-match-3')::uuid, 1, 1),
  -- Mutable D must never contribute after lock.
  (md5('c59-entry-d')::uuid, md5('c59-match-1')::uuid, 9, 9);

insert into public.predicted_progression (entry_id, team_id, stage) values
  (md5('c59-entry-a')::uuid, current_setting('test.c59_team1')::uuid, 'champion'),
  (md5('c59-entry-a')::uuid, current_setting('test.c59_team2')::uuid, 'final'),
  (md5('c59-entry-b')::uuid, current_setting('test.c59_team1')::uuid, 'champion'),
  (md5('c59-entry-b')::uuid, current_setting('test.c59_team2')::uuid, 'final'),
  (md5('c59-entry-c')::uuid, current_setting('test.c59_team3')::uuid, 'champion'),
  (md5('c59-entry-c')::uuid, current_setting('test.c59_team2')::uuid, 'final'),
  (md5('c59-entry-d')::uuid, current_setting('test.c59_team4')::uuid, 'champion'),
  (md5('c59-entry-d')::uuid, current_setting('test.c59_team2')::uuid, 'final');

insert into public.players (id, tournament_id, name, team_id) values
  (md5('c59-player-1')::uuid, current_setting('test.c59_tournament')::uuid,
    'Consensus Boot One', current_setting('test.c59_team1')::uuid),
  (md5('c59-player-2')::uuid, current_setting('test.c59_tournament')::uuid,
    'Consensus Boot Two', current_setting('test.c59_team3')::uuid);

insert into public.bonus_predictions (entry_id, golden_boot_player_id) values
  (md5('c59-entry-a')::uuid, md5('c59-player-1')::uuid),
  (md5('c59-entry-b')::uuid, md5('c59-player-1')::uuid),
  (md5('c59-entry-c')::uuid, md5('c59-player-2')::uuid),
  (md5('c59-entry-d')::uuid, md5('c59-player-2')::uuid);

set local session_replication_role = origin;

select has_function(
  'public', 'get_prediction_consensus', array['uuid'],
  'the bounded prediction-consensus RPC exists'
);

select is(
  pg_temp.capture_sqlstate(format(
    'select public.get_prediction_consensus(%L::uuid)',
    current_setting('test.c59_tournament')
  )),
  '42501',
  'an unauthenticated caller cannot read consensus'
);

select set_config('request.jwt.claim.sub', md5('c59-user-a'), true);
set local role authenticated;
select is(
  pg_temp.capture_sqlstate(format(
    'select public.get_prediction_consensus(%L::uuid)',
    current_setting('test.c59_tournament')
  )),
  '23514',
  'consensus remains hidden before tournament lock'
);
reset role;

update public.tournaments
set lock_at = now() - interval '1 minute'
where id = current_setting('test.c59_tournament')::uuid;

select set_config('request.jwt.claim.sub', md5('c59-user-a'), true);
set local role authenticated;
select set_config(
  'test.c59_result_a',
  public.get_prediction_consensus(
    current_setting('test.c59_tournament')::uuid
  )::text,
  true
);
reset role;

select is(
  (current_setting('test.c59_result_a')::jsonb ->> 'submitted_entries')::integer,
  3,
  'only the three submitted entries contribute'
);

select is(
  (current_setting('test.c59_result_a')::jsonb #>> '{champion_race,0,picks}')::integer,
  2,
  'the champion race ranks the shared champion first'
);

select is(
  (current_setting('test.c59_result_a')::jsonb #>> '{peoples_final,0,picks}')::integer,
  2,
  'the most common predicted final pair has two picks'
);

select is(
  (current_setting('test.c59_result_a')::jsonb #>> '{golden_boot,0,picks}')::integer,
  2,
  'the Golden Boot consensus excludes the unsubmitted entry'
);

select is(
  current_setting('test.c59_result_a')::jsonb #>> '{most_agreed_match,match_ref}',
  'C59-1',
  'deterministic tie ordering selects C59-1 as the most agreed match'
);

select is(
  current_setting('test.c59_result_a')::jsonb #>> '{most_agreed_match,dominant_outcome}',
  'home',
  'the most agreed outcome is the home win'
);

select is(
  current_setting('test.c59_result_a')::jsonb #>> '{most_divided_match,match_ref}',
  'C59-2',
  'the three-way split is the most divided match'
);

select is(
  (current_setting('test.c59_result_a')::jsonb #>> '{most_divided_match,top_two_gap}')::integer,
  0,
  'the most divided match reports a zero top-two gap'
);

select is(
  (current_setting('test.c59_result_a')::jsonb #>> '{most_trusted_team,team_id}')::uuid,
  current_setting('test.c59_team1')::uuid,
  'team one is the most trusted predicted winner'
);

select is(
  (current_setting('test.c59_result_a')::jsonb #>> '{most_trusted_team,predicted_wins}')::integer,
  4,
  'the trusted-team count is derived from submitted predicted wins'
);

select is(
  current_setting('test.c59_result_a')::jsonb -> 'goals_spread'
    - 'distribution',
  jsonb_build_object(
    'minimum', 4,
    'median', 6,
    'maximum', 8,
    'average', 6.0,
    'distinct_totals', 3
  ),
  'the goals spread reports bounded summary statistics'
);

select is(
  jsonb_array_length(
    current_setting('test.c59_result_a')::jsonb #> '{goals_spread,distribution}'
  ),
  3,
  'the goals distribution has one row per observed total'
);

select is(
  jsonb_array_length(
    current_setting('test.c59_result_a')::jsonb -> 'only_you'
  ),
  2,
  'caller A receives only the two genuinely unique exact scores'
);

select is(
  (
    select array_agg(item ->> 'kind' order by ordinal)
    from jsonb_array_elements(
      current_setting('test.c59_result_a')::jsonb -> 'only_you'
    ) with ordinality as unique_pick(item, ordinal)
  ),
  array['exact_score', 'exact_score'],
  'caller A unique cards expose no other player identity'
);

select ok(
  jsonb_array_length(
    current_setting('test.c59_result_a')::jsonb -> 'champion_race'
  ) <= 10
  and jsonb_array_length(
    current_setting('test.c59_result_a')::jsonb -> 'peoples_final'
  ) <= 10
  and jsonb_array_length(
    current_setting('test.c59_result_a')::jsonb -> 'golden_boot'
  ) <= 10
  and jsonb_array_length(
    current_setting('test.c59_result_a')::jsonb #> '{goals_spread,distribution}'
  ) <= 40
  and jsonb_array_length(
    current_setting('test.c59_result_a')::jsonb -> 'only_you'
  ) <= 6,
  'every ranked list and distribution respects its hard bound'
);

select set_config('request.jwt.claim.sub', md5('c59-user-c'), true);
set local role authenticated;
select set_config(
  'test.c59_result_c',
  public.get_prediction_consensus(
    current_setting('test.c59_tournament')::uuid
  )::text,
  true
);
reset role;

select is(
  jsonb_array_length(
    current_setting('test.c59_result_c')::jsonb -> 'only_you'
  ),
  5,
  'caller C sees unique champion, final, Golden Boot and two exact scores'
);

select set_config('request.jwt.claim.sub', md5('c59-user-d'), true);
set local role authenticated;
select set_config(
  'test.c59_result_d',
  public.get_prediction_consensus(
    current_setting('test.c59_tournament')::uuid
  )::text,
  true
);
reset role;

select is(
  (current_setting('test.c59_result_d')::jsonb ->> 'submitted_entries')::integer,
  3,
  'a signed-in spectator receives the same aggregate pool'
);

select is(
  jsonb_array_length(
    current_setting('test.c59_result_d')::jsonb -> 'only_you'
  ),
  0,
  'an unsubmitted spectator receives no caller-only cards'
);

update public.matches
set home_score = 7,
    away_score = 6,
    result_state = 'corrected'
where id = md5('c59-match-1')::uuid;

select set_config('request.jwt.claim.sub', md5('c59-user-a'), true);
set local role authenticated;
select set_config(
  'test.c59_result_after_correction',
  public.get_prediction_consensus(
    current_setting('test.c59_tournament')::uuid
  )::text,
  true
);
reset role;

select is(
  current_setting('test.c59_result_after_correction')::jsonb
    - 'server_now',
  current_setting('test.c59_result_a')::jsonb
    - 'server_now',
  'confirmed-result corrections do not change frozen prediction consensus'
);

select is(
  (
    select proconfig::text
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.oid::regprocedure::text = 'get_prediction_consensus(uuid)'
  ),
  '{"search_path="""}',
  'the consensus RPC has an immutable empty search path'
);

select ok(
  not has_function_privilege(
    'anon', 'public.get_prediction_consensus(uuid)', 'execute'
  )
  and has_function_privilege(
    'authenticated', 'public.get_prediction_consensus(uuid)', 'execute'
  ),
  'only authenticated browser callers can execute the consensus RPC'
);

select * from finish();
rollback;
