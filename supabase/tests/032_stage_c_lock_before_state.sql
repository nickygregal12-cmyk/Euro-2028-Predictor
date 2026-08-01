begin;

select plan(16);

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
  'Stage C Lock After State',
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
  ('00000000-0000-0000-0000-00000000d201', '00000000-0000-0000-0000-00000000d301', 1),
  ('00000000-0000-0000-0000-00000000d201', '00000000-0000-0000-0000-00000000d302', 2);

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
      id, entry_id, match_id, home_score, away_score
    ) values (
      '00000000-0000-0000-0000-00000000d601',
      '00000000-0000-0000-0000-00000000d501',
      '00000000-0000-0000-0000-00000000d401',
      1,
      0
    )
  $sql$,
  'a score prediction is writable before the entry and fixture locks'
);

select lives_ok(
  $sql$
    insert into public.predicted_progression (
      id, entry_id, team_id, stage
    ) values (
      '00000000-0000-0000-0000-00000000d701',
      '00000000-0000-0000-0000-00000000d501',
      '00000000-0000-0000-0000-00000000d301',
      'qf'
    )
  $sql$,
  'a progression prediction is writable before the entry lock'
);

update public.tournaments
set lock_at = now()
where id = '00000000-0000-0000-0000-00000000d101';

select is(
  (
    select count(*)::integer
    from public.competition_lock_events
    where tournament_id = '00000000-0000-0000-0000-00000000d101'
      and scope_type = 'entry'
      and scope_key = 'entry'
  ),
  1,
  'crossing the entry deadline records one append-only lock event'
);

select throws_ok(
  $sql$
    update public.match_predictions
    set home_score = 2
    where id = '00000000-0000-0000-0000-00000000d601'
  $sql$,
  '23514',
  'Predictions are locked — the tournament has started',
  'the score lock is inclusive at the exact entry deadline'
);

select throws_ok(
  $sql$
    delete from public.predicted_progression
    where id = '00000000-0000-0000-0000-00000000d701'
  $sql$,
  '23514',
  'Predictions are locked — the tournament has started',
  'the generic entry lock is inclusive at the exact deadline'
);

update public.tournaments
set lock_at = now() + interval '1 day'
where id = '00000000-0000-0000-0000-00000000d101';

-- ADR 0020 keeps `lock_at` the sole entry-lock authority, so correcting a
-- mistakenly early deadline reopens the entry. The lock event below is still
-- recorded, and is evidence of the observed transition rather than an
-- enforcement input — see the entry-lock decision in `docs/quality/current-status.md`.
select lives_ok(
  $sql$
    update public.match_predictions
    set away_score = 1
    where id = '00000000-0000-0000-0000-00000000d601'
  $sql$,
  'moving lock_at into the future reopens the entry, and the observed lock event does not override it'
);

select throws_ok(
  $sql$
    update public.competition_lock_events
    set locked_at = now() + interval '1 hour'
    where tournament_id = '00000000-0000-0000-0000-00000000d101'
      and scope_type = 'entry'
      and scope_key = 'entry'
  $sql$,
  '42501',
  'Competition lock events are append-only',
  'recorded lock evidence cannot be edited'
);

-- A second season proves fail-closed missing entry timing separately from the
-- monotonic event above, then exercises the per-fixture boundary.
insert into public.tournaments (
  id,
  name,
  year,
  starts_on,
  ends_on,
  lock_at
) values (
  '00000000-0000-0000-0000-00000000d102',
  'Stage C Fixture Lock After State',
  2029,
  null,
  null,
  null
);

insert into public.groups (id, tournament_id, letter) values (
  '00000000-0000-0000-0000-00000000d202',
  '00000000-0000-0000-0000-00000000d102',
  'E'
);

insert into public.teams (id, tournament_id, name) values
  ('00000000-0000-0000-0000-00000000d303', '00000000-0000-0000-0000-00000000d102', 'Fixture Team One'),
  ('00000000-0000-0000-0000-00000000d304', '00000000-0000-0000-0000-00000000d102', 'Fixture Team Two');

insert into public.group_teams (group_id, team_id, slot) values
  ('00000000-0000-0000-0000-00000000d202', '00000000-0000-0000-0000-00000000d303', 1),
  ('00000000-0000-0000-0000-00000000d202', '00000000-0000-0000-0000-00000000d304', 2);

insert into public.matches (
  id, tournament_id, match_ref, round, group_id, matchday,
  home_source, away_source, home_team_id, away_team_id,
  match_date, kickoff_at, venue
) values
  (
    '00000000-0000-0000-0000-00000000d402',
    '00000000-0000-0000-0000-00000000d102',
    'GE-LOCK-1',
    'group',
    '00000000-0000-0000-0000-00000000d202',
    1,
    'E1',
    'E2',
    '00000000-0000-0000-0000-00000000d303',
    '00000000-0000-0000-0000-00000000d304',
    '2029-06-09',
    now() + interval '2 hours',
    'Fixture Lock Stadium'
  ),
  (
    '00000000-0000-0000-0000-00000000d403',
    '00000000-0000-0000-0000-00000000d102',
    'GE-LOCK-2',
    'group',
    '00000000-0000-0000-0000-00000000d202',
    1,
    'E1',
    'E2',
    '00000000-0000-0000-0000-00000000d303',
    '00000000-0000-0000-0000-00000000d304',
    '2029-06-10',
    null,
    'Unscheduled Stadium'
  );

insert into public.entries (id, user_id, tournament_id) values (
  '00000000-0000-0000-0000-00000000d502',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000d102'
);

select throws_ok(
  $sql$
    insert into public.match_predictions (
      id, entry_id, match_id, home_score, away_score
    ) values (
      '00000000-0000-0000-0000-00000000d602',
      '00000000-0000-0000-0000-00000000d502',
      '00000000-0000-0000-0000-00000000d402',
      0,
      0
    )
  $sql$,
  '23514',
  'Predictions are unavailable — the tournament lock is not configured',
  'a missing entry deadline fails closed before an event exists'
);

update public.tournaments
set lock_at = now() + interval '1 day'
where id = '00000000-0000-0000-0000-00000000d102';

select lives_ok(
  $sql$
    insert into public.match_predictions (
      id, entry_id, match_id, home_score, away_score
    ) values
      (
        '00000000-0000-0000-0000-00000000d602',
        '00000000-0000-0000-0000-00000000d502',
        '00000000-0000-0000-0000-00000000d402',
        0,
        0
      ),
      (
        '00000000-0000-0000-0000-00000000d603',
        '00000000-0000-0000-0000-00000000d502',
        '00000000-0000-0000-0000-00000000d403',
        1,
        1
      )
  $sql$,
  'legacy tournament score predictions remain writable before the entry lock even when a kickoff is not yet known'
);

update public.matches
set kickoff_at = now()
where id = '00000000-0000-0000-0000-00000000d402';

select is(
  (
    select count(*)::integer
    from public.competition_lock_events
    where tournament_id = '00000000-0000-0000-0000-00000000d102'
      and scope_type = 'match'
      and scope_key = '00000000-0000-0000-0000-00000000d402'
  ),
  1,
  'crossing fixture kickoff records one match lock event'
);

select throws_ok(
  $sql$
    update public.match_predictions
    set home_score = 2
    where id = '00000000-0000-0000-0000-00000000d602'
  $sql$,
  '23514',
  'This prediction is locked — the match has kicked off',
  'a pure score edit is rejected at the exact fixture kickoff'
);

update public.matches
set kickoff_at = now() + interval '1 day'
where id = '00000000-0000-0000-0000-00000000d402';

-- The per-match guard is likewise derived from the current `kickoff_at`. A
-- fixture genuinely moved to a later date is predictable again; the recorded
-- lock event does not hold it shut.
select lives_ok(
  $sql$
    update public.match_predictions
    set away_score = 2
    where id = '00000000-0000-0000-0000-00000000d602'
  $sql$,
  'moving kickoff into the future reopens the fixture, and the observed lock event does not override it'
);

select throws_ok(
  $sql$
    update public.match_predictions
    set joker = true
    where id = '00000000-0000-0000-0000-00000000d603'
  $sql$,
  '23514',
  'Joker on match 00000000-0000-0000-0000-00000000d403 is unavailable until kickoff is scheduled',
  'a joker remains unavailable until authoritative kickoff is known'
);

update public.matches
set kickoff_at = now() + interval '2 hours'
where id = '00000000-0000-0000-0000-00000000d403';

select lives_ok(
  $sql$
    update public.match_predictions
    set joker = true
    where id = '00000000-0000-0000-0000-00000000d603'
  $sql$,
  'a joker can be committed before its known fixture kickoff'
);

update public.matches
set kickoff_at = now()
where id = '00000000-0000-0000-0000-00000000d403';

select throws_ok(
  $sql$
    update public.match_predictions
    set joker = false
    where id = '00000000-0000-0000-0000-00000000d603'
  $sql$,
  '23514',
  'Joker on match 00000000-0000-0000-0000-00000000d403 is locked at kickoff and cannot be changed',
  'a committed joker cannot be cleared at the exact fixture kickoff'
);

-- Re-lock the entry, because the deadline correction above deliberately
-- reopened it. The point of this assertion is the ordering — the lock is
-- evaluated before optimistic versioning, so a stale write is refused as
-- locked rather than as a version conflict.
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
  'the entry lock rejects a stale score write before optimistic versioning can mask it'
);

select * from finish();
rollback;
