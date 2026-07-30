begin;

select plan(11);

-- This suite records the current lock/write boundary before Stage C adds
-- competition rounds and append-only lock-transition evidence. Assertions that
-- deliberately describe fail-open or reopening behaviour are before-state
-- contracts: the Stage C migration must reverse them rather than preserve them.
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
  '00000000-0000-0000-0000-00000000d001',
  'stage-c-lock-owner@example.test',
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
) values (
  '00000000-0000-0000-0000-00000000d101',
  'Stage C Lock Before State',
  2028,
  '2028-06-09',
  '2028-07-09',
  now() + interval '1 day'
);

insert into public.groups (id, tournament_id, letter) values (
  '00000000-0000-0000-0000-00000000d201',
  '00000000-0000-0000-0000-00000000d101',
  'D'
);

insert into public.teams (id, tournament_id, name) values
  (
    '00000000-0000-0000-0000-00000000d301',
    '00000000-0000-0000-0000-00000000d101',
    'Lock Team One'
  ),
  (
    '00000000-0000-0000-0000-00000000d302',
    '00000000-0000-0000-0000-00000000d101',
    'Lock Team Two'
  );

insert into public.group_teams (group_id, team_id, slot) values
  (
    '00000000-0000-0000-0000-00000000d201',
    '00000000-0000-0000-0000-00000000d301',
    1
  ),
  (
    '00000000-0000-0000-0000-00000000d201',
    '00000000-0000-0000-0000-00000000d302',
    2
  );

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
) values (
  '00000000-0000-0000-0000-00000000d401',
  '00000000-0000-0000-0000-00000000d101',
  'GD-LOCK-1',
  'group',
  '00000000-0000-0000-0000-00000000d201',
  1,
  'D1',
  'D2',
  '00000000-0000-0000-0000-00000000d301',
  '00000000-0000-0000-0000-00000000d302',
  '2028-06-09',
  now() + interval '2 hours',
  'Lock Test Stadium'
);

insert into public.entries (id, user_id, tournament_id) values (
  '00000000-0000-0000-0000-00000000d501',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000d101'
);

select lives_ok(
  $sql$
    insert into public.match_predictions (
      id,
      entry_id,
      match_id,
      home_score,
      away_score
    ) values (
      '00000000-0000-0000-0000-00000000d601',
      '00000000-0000-0000-0000-00000000d501',
      '00000000-0000-0000-0000-00000000d401',
      1,
      0
    )
  $sql$,
  'a score prediction is writable before the tournament lock'
);

select lives_ok(
  $sql$
    insert into public.predicted_progression (
      id,
      entry_id,
      team_id,
      stage
    ) values (
      '00000000-0000-0000-0000-00000000d701',
      '00000000-0000-0000-0000-00000000d501',
      '00000000-0000-0000-0000-00000000d301',
      'qf'
    )
  $sql$,
  'a progression prediction is writable before the tournament lock'
);

update public.tournaments
set lock_at = now()
where id = '00000000-0000-0000-0000-00000000d101';

select throws_ok(
  $sql$
    update public.match_predictions
    set home_score = 2
    where id = '00000000-0000-0000-0000-00000000d601'
  $sql$,
  '23514',
  'Predictions are locked — the tournament has started',
  'the score lock is inclusive at the exact tournament lock instant'
);

select throws_ok(
  $sql$
    delete from public.predicted_progression
    where id = '00000000-0000-0000-0000-00000000d701'
  $sql$,
  '23514',
  'Predictions are locked — the tournament has started',
  'the generic prediction lock is inclusive at the exact tournament lock instant'
);

-- Current defect: an absent lock is treated as editable rather than unavailable
-- or fail-closed. Stage C must reverse this expectation after backfill.
update public.tournaments
set lock_at = null
where id = '00000000-0000-0000-0000-00000000d101';

select lives_ok(
  $sql$
    update public.match_predictions
    set home_score = 2
    where id = '00000000-0000-0000-0000-00000000d601'
  $sql$,
  'a null tournament lock currently fails open for score writes'
);

-- Current defect: the stored deadline can be moved back into the future after
-- the boundary has already been observed, reopening the entry. Stage C lock
-- events must make this transition monotonic.
update public.tournaments
set lock_at = now() + interval '1 day'
where id = '00000000-0000-0000-0000-00000000d101';

select lives_ok(
  $sql$
    update public.match_predictions
    set away_score = 1
    where id = '00000000-0000-0000-0000-00000000d601'
  $sql$,
  'moving lock_at into the future currently reopens a previously locked entry'
);

-- Current defect: a pure score edit is governed only by the tournament-wide
-- entry lock, not by the selected fixture kickoff. Stage C must add a per-match
-- server guard while preserving the separate joker commitment rule.
update public.matches
set kickoff_at = now()
where id = '00000000-0000-0000-0000-00000000d401';

select lives_ok(
  $sql$
    update public.match_predictions
    set home_score = 3
    where id = '00000000-0000-0000-0000-00000000d601'
  $sql$,
  'a pure score edit currently remains writable at fixture kickoff while the entry lock is future'
);

select throws_ok(
  $sql$
    update public.match_predictions
    set joker = true
    where id = '00000000-0000-0000-0000-00000000d601'
  $sql$,
  '23514',
  'Joker on match 00000000-0000-0000-0000-00000000d401 is locked at kickoff and cannot be changed',
  'a joker cannot be set at the exact fixture kickoff instant'
);

update public.matches
set kickoff_at = null
where id = '00000000-0000-0000-0000-00000000d401';

select lives_ok(
  $sql$
    update public.match_predictions
    set joker = true
    where id = '00000000-0000-0000-0000-00000000d601'
  $sql$,
  'a null fixture kickoff currently leaves the joker editable before the draw is confirmed'
);

update public.matches
set kickoff_at = now()
where id = '00000000-0000-0000-0000-00000000d401';

select throws_ok(
  $sql$
    update public.match_predictions
    set joker = false
    where id = '00000000-0000-0000-0000-00000000d601'
  $sql$,
  '23514',
  'Joker on match 00000000-0000-0000-0000-00000000d401 is locked at kickoff and cannot be changed',
  'a committed joker cannot be cleared at the exact fixture kickoff instant'
);

update public.tournaments
set lock_at = now()
where id = '00000000-0000-0000-0000-00000000d101';

select throws_ok(
  $sql$
    update public.match_predictions
    set home_score = 4,
        version = -1
    where id = '00000000-0000-0000-0000-00000000d601'
  $sql$,
  '23514',
  'Predictions are locked — the tournament has started',
  'the entry lock rejects a stale score write before the optimistic-version trigger can mask it'
);

select * from finish();
rollback;
