begin;

select plan(10);

-- Two tournament editions provide valid parents plus hostile foreign references.
-- These are the before-state same-tournament rules that Stage C must widen to
-- same-competition-season without weakening or silently detaching the triggers.
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
  '00000000-0000-0000-0000-00000000c001',
  'stage-c-scope-owner@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.tournaments (
  id,
  name,
  year,
  starts_on,
  ends_on,
  lock_at
) values
  (
    '00000000-0000-0000-0000-00000000c101',
    'Stage C Scope One',
    2028,
    '2028-06-09',
    '2028-07-09',
    now() + interval '1 day'
  ),
  (
    '00000000-0000-0000-0000-00000000c102',
    'Stage C Scope Two',
    2032,
    '2032-06-09',
    '2032-07-09',
    now() + interval '5 years'
  );

insert into public.groups (id, tournament_id, letter) values
  (
    '00000000-0000-0000-0000-00000000c201',
    '00000000-0000-0000-0000-00000000c101',
    'A'
  ),
  (
    '00000000-0000-0000-0000-00000000c202',
    '00000000-0000-0000-0000-00000000c102',
    'B'
  );

insert into public.teams (id, tournament_id, name) values
  ('00000000-0000-0000-0000-00000000c301', '00000000-0000-0000-0000-00000000c101', 'Scope A1'),
  ('00000000-0000-0000-0000-00000000c302', '00000000-0000-0000-0000-00000000c101', 'Scope A2'),
  ('00000000-0000-0000-0000-00000000c311', '00000000-0000-0000-0000-00000000c102', 'Scope B1'),
  ('00000000-0000-0000-0000-00000000c312', '00000000-0000-0000-0000-00000000c102', 'Scope B2'),
  ('00000000-0000-0000-0000-00000000c313', '00000000-0000-0000-0000-00000000c102', 'Scope B3');

insert into public.group_teams (group_id, team_id, slot) values
  ('00000000-0000-0000-0000-00000000c201', '00000000-0000-0000-0000-00000000c301', 1),
  ('00000000-0000-0000-0000-00000000c201', '00000000-0000-0000-0000-00000000c302', 2),
  ('00000000-0000-0000-0000-00000000c202', '00000000-0000-0000-0000-00000000c311', 1),
  ('00000000-0000-0000-0000-00000000c202', '00000000-0000-0000-0000-00000000c312', 2);

insert into public.matches (
  id,
  tournament_id,
  match_ref,
  round,
  group_id,
  matchday,
  home_source,
  away_source,
  home_team_id,
  away_team_id,
  match_date,
  kickoff_at,
  venue
) values
  (
    '00000000-0000-0000-0000-00000000c401',
    '00000000-0000-0000-0000-00000000c101',
    'GA-1',
    'group',
    '00000000-0000-0000-0000-00000000c201',
    1,
    'A1',
    'A2',
    '00000000-0000-0000-0000-00000000c301',
    '00000000-0000-0000-0000-00000000c302',
    '2028-06-09',
    '2028-06-09 17:00:00+00',
    'Scope Stadium One'
  ),
  (
    '00000000-0000-0000-0000-00000000c402',
    '00000000-0000-0000-0000-00000000c102',
    'GB-1',
    'group',
    '00000000-0000-0000-0000-00000000c202',
    1,
    'B1',
    'B2',
    '00000000-0000-0000-0000-00000000c311',
    '00000000-0000-0000-0000-00000000c312',
    '2032-06-09',
    '2032-06-09 17:00:00+00',
    'Scope Stadium Two'
  );

insert into public.players (id, tournament_id, name, team_id) values
  (
    '00000000-0000-0000-0000-00000000c501',
    '00000000-0000-0000-0000-00000000c101',
    'Scope Player One',
    '00000000-0000-0000-0000-00000000c301'
  ),
  (
    '00000000-0000-0000-0000-00000000c502',
    '00000000-0000-0000-0000-00000000c102',
    'Scope Player Two',
    '00000000-0000-0000-0000-00000000c311'
  );

insert into public.entries (id, user_id, tournament_id) values (
  '00000000-0000-0000-0000-00000000c601',
  '00000000-0000-0000-0000-00000000c001',
  '00000000-0000-0000-0000-00000000c101'
);

select throws_ok(
  $sql$
    insert into public.group_teams (group_id, team_id, slot) values (
      '00000000-0000-0000-0000-00000000c201',
      '00000000-0000-0000-0000-00000000c313',
      3
    )
  $sql$,
  '23514',
  'Group and team must belong to the same tournament',
  'a group-team assignment cannot cross tournaments'
);

select throws_ok(
  $sql$
    insert into public.matches (
      tournament_id,
      match_ref,
      round,
      group_id,
      matchday,
      home_source,
      away_source,
      home_team_id,
      away_team_id,
      match_date,
      kickoff_at,
      venue
    ) values (
      '00000000-0000-0000-0000-00000000c101',
      'HOSTILE-GROUP',
      'group',
      '00000000-0000-0000-0000-00000000c202',
      1,
      'A1',
      'A2',
      '00000000-0000-0000-0000-00000000c301',
      '00000000-0000-0000-0000-00000000c302',
      '2028-06-10',
      '2028-06-10 17:00:00+00',
      'Hostile Stadium'
    )
  $sql$,
  '23514',
  'Match group must belong to the match tournament',
  'a match cannot reference another tournament group'
);

select throws_ok(
  $sql$
    insert into public.matches (
      tournament_id,
      match_ref,
      round,
      group_id,
      matchday,
      home_source,
      away_source,
      home_team_id,
      away_team_id,
      match_date,
      kickoff_at,
      venue
    ) values (
      '00000000-0000-0000-0000-00000000c101',
      'HOSTILE-HOME',
      'group',
      '00000000-0000-0000-0000-00000000c201',
      1,
      'A1',
      'A2',
      '00000000-0000-0000-0000-00000000c311',
      '00000000-0000-0000-0000-00000000c302',
      '2028-06-10',
      '2028-06-10 18:00:00+00',
      'Hostile Stadium'
    )
  $sql$,
  '23514',
  'Home team must belong to the match tournament',
  'a match cannot reference another tournament home team'
);

select throws_ok(
  $sql$
    insert into public.matches (
      tournament_id,
      match_ref,
      round,
      group_id,
      matchday,
      home_source,
      away_source,
      home_team_id,
      away_team_id,
      match_date,
      kickoff_at,
      venue
    ) values (
      '00000000-0000-0000-0000-00000000c101',
      'HOSTILE-AWAY',
      'group',
      '00000000-0000-0000-0000-00000000c201',
      1,
      'A1',
      'A2',
      '00000000-0000-0000-0000-00000000c301',
      '00000000-0000-0000-0000-00000000c312',
      '2028-06-10',
      '2028-06-10 19:00:00+00',
      'Hostile Stadium'
    )
  $sql$,
  '23514',
  'Away team must belong to the match tournament',
  'a match cannot reference another tournament away team'
);

select throws_ok(
  $sql$
    insert into public.players (tournament_id, name, team_id) values (
      '00000000-0000-0000-0000-00000000c101',
      'Hostile Player',
      '00000000-0000-0000-0000-00000000c311'
    )
  $sql$,
  '23514',
  'Player team must belong to the player tournament',
  'a player cannot reference another tournament team'
);

select throws_ok(
  $sql$
    insert into public.predicted_group_positions (
      entry_id,
      group_id,
      team_id,
      position
    ) values (
      '00000000-0000-0000-0000-00000000c601',
      '00000000-0000-0000-0000-00000000c201',
      '00000000-0000-0000-0000-00000000c311',
      1
    )
  $sql$,
  '23514',
  'Predicted group position must use an in-group team from the entry tournament',
  'a predicted group position cannot mix entry, group and team tournaments'
);

select throws_ok(
  $sql$
    insert into public.match_result_revisions (
      match_id,
      tournament_id,
      revision,
      action,
      previous_result,
      new_result,
      reason
    ) values (
      '00000000-0000-0000-0000-00000000c401',
      '00000000-0000-0000-0000-00000000c102',
      1,
      'confirm',
      '{}'::jsonb,
      '{}'::jsonb,
      'Hostile scope test'
    )
  $sql$,
  '23514',
  'Result revision tournament must match its match tournament',
  'a result revision cannot claim another tournament'
);

select throws_ok(
  $sql$
    insert into public.score_events (
      entry_id,
      category,
      match_id,
      points,
      explanation
    ) values (
      '00000000-0000-0000-0000-00000000c601',
      'group_matches',
      '00000000-0000-0000-0000-00000000c402',
      1,
      'Hostile match scope'
    )
  $sql$,
  '23514',
  'Score event match must belong to the entry tournament',
  'a score event cannot reference another tournament match'
);

select throws_ok(
  $sql$
    insert into public.score_events (
      entry_id,
      category,
      team_id,
      points,
      explanation
    ) values (
      '00000000-0000-0000-0000-00000000c601',
      'awards',
      '00000000-0000-0000-0000-00000000c311',
      1,
      'Hostile team scope'
    )
  $sql$,
  '23514',
  'Score event team must belong to the entry tournament',
  'a score event cannot reference another tournament team'
);

select throws_ok(
  $sql$
    update public.tournaments
      set golden_boot_player_id = '00000000-0000-0000-0000-00000000c502'
      where id = '00000000-0000-0000-0000-00000000c101'
  $sql$,
  '23514',
  'Golden Boot player must belong to the tournament',
  'a tournament award cannot reference another tournament player'
);

select * from finish();
rollback;
