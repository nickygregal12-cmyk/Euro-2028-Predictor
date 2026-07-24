-- Temporary CI-only production-shaped payload for the 24 July 2026 rollout rehearsal.
-- Contains no production account identifiers, email addresses, password hashes or profile names.
-- The prediction/tie/progression values reproduce the current rollout-guard fingerprints.

begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'rehearsal-user@example.invalid',
  '',
  '2026-07-21 21:40:00+00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Rehearsal User"}'::jsonb,
  '2026-07-21 21:40:00+00',
  '2026-07-21 21:40:00+00'
);

update public.profiles
set display_name = 'Rehearsal User',
    created_at = '2026-07-21 21:40:00+00'
where id = '11111111-1111-4111-8111-111111111111';

insert into public.entries (id, user_id, tournament_id, submitted_at, created_at)
select
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  t.id,
  null,
  '2026-07-21 21:41:00+00'
from public.tournaments t
where t.name = 'UEFA Euro 2028';

with prediction_values(match_ref, home_score, away_score, joker) as (
  values
    ('GA-1', 2, 2, true),
    ('GA-2', 2, 2, false),
    ('GA-3', 2, 2, true),
    ('GA-4', 2, 2, true),
    ('GA-5', 2, 2, true),
    ('GA-6', 2, 2, false),
    ('GB-1', 3, 0, false),
    ('GB-2', 2, 0, false),
    ('GB-3', 3, 1, false),
    ('GB-4', 4, 0, false),
    ('GB-5', 5, 1, false),
    ('GB-6', 1, 3, false),
    ('GC-1', 3, 1, false),
    ('GC-2', 2, 2, false),
    ('GC-3', 3, 2, false),
    ('GC-4', 2, 0, false),
    ('GC-5', 1, 1, false),
    ('GC-6', 2, 1, false),
    ('GD-1', 3, 1, false),
    ('GD-2', 2, 1, false),
    ('GD-3', 2, 5, false),
    ('GD-4', 1, 2, false),
    ('GD-5', 3, 1, false),
    ('GD-6', 0, 2, false),
    ('GE-1', 1, 1, false),
    ('GE-2', 2, 5, false),
    ('GE-3', 2, 1, false),
    ('GE-4', 1, 5, false),
    ('GE-5', 1, 2, false),
    ('GE-6', 4, 2, false),
    ('GF-1', 2, 1, false),
    ('GF-2', 1, 0, false),
    ('GF-3', 0, 2, false),
    ('GF-4', 3, 1, false),
    ('GF-5', 6, 3, false),
    ('GF-6', 1, 6, false)
)
insert into public.match_predictions (
  entry_id,
  match_id,
  home_score,
  away_score,
  joker,
  created_at,
  updated_at
)
select
  '22222222-2222-4222-8222-222222222222',
  m.id,
  v.home_score,
  v.away_score,
  v.joker,
  '2026-07-21 21:45:00+00',
  '2026-07-21 21:45:00+00'
from prediction_values v
join public.matches m on m.match_ref = v.match_ref;

with progression_values(team_name, stage) as (
  values
    ('Team A2', 'qf'),
    ('Team B1', 'qf'),
    ('Team C1', 'final'),
    ('Team C2', 'champion'),
    ('Team E1', 'qf'),
    ('Team E4', 'qf'),
    ('Team F3', 'sf'),
    ('Team F4', 'sf')
)
insert into public.predicted_progression (
  entry_id,
  team_id,
  stage,
  updated_at
)
select
  '22222222-2222-4222-8222-222222222222',
  tm.id,
  v.stage,
  '2026-07-21 21:49:00+00'
from progression_values v
join public.teams tm on tm.name = v.team_name;

with ordered as (
  select array_agg(tm.id order by v.ord) as team_ids
  from (values
    (1, 'Team A1'),
    (2, 'Team A2'),
    (3, 'Team A3'),
    (4, 'Team A4')
  ) as v(ord, team_name)
  join public.teams tm on tm.name = v.team_name
)
insert into public.predicted_tie_resolutions (
  entry_id,
  scope,
  tie_key,
  ordered_team_ids,
  created_at,
  updated_at
)
select
  '22222222-2222-4222-8222-222222222222',
  'group',
  (select string_agg(x::text, '|' order by x::text) from unnest(ordered.team_ids) x),
  ordered.team_ids,
  '2026-07-21 21:50:00+00',
  '2026-07-21 21:50:00+00'
from ordered;

with ordered as (
  select array_agg(tm.id order by v.ord) as team_ids
  from (values
    (1, 'Team F2'),
    (2, 'Team D1')
  ) as v(ord, team_name)
  join public.teams tm on tm.name = v.team_name
)
insert into public.predicted_tie_resolutions (
  entry_id,
  scope,
  tie_key,
  ordered_team_ids,
  created_at,
  updated_at
)
select
  '22222222-2222-4222-8222-222222222222',
  'third',
  (select string_agg(x::text, '|' order by x::text) from unnest(ordered.team_ids) x),
  ordered.team_ids,
  '2026-07-21 21:50:30+00',
  '2026-07-21 21:50:30+00'
from ordered;

update public.entries
set submitted_at = '2026-07-21 21:51:49.639442+00'
where id = '22222222-2222-4222-8222-222222222222';

commit;

-- Fail closed if the payload was not created exactly as intended.
do $$
begin
  if (select count(*) from public.entries where submitted_at is not null) <> 1 then
    raise exception 'Expected exactly one submitted rehearsal entry';
  end if;
  if (select count(*) from public.match_predictions) <> 36 then
    raise exception 'Expected 36 rehearsal predictions';
  end if;
  if (select count(*) from public.predicted_progression) <> 8 then
    raise exception 'Expected 8 rehearsal progression rows';
  end if;
  if (select count(*) from public.predicted_tie_resolutions) <> 2 then
    raise exception 'Expected 2 rehearsal tie rows';
  end if;
end $$;
