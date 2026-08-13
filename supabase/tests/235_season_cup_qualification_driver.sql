-- Contract 187 / CUP-002: a season Predictor Championship qualifies, seeds and
-- brackets.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the refusal. A season Championship whose
-- group stage runs to fourteen matchdays must not qualify anybody when three of
-- them have settled — which is exactly what the delivered driver did, because
-- `win.sequence between 1 and 3` is the TOURNAMENT's group stage and had been
-- since contract 47. The competition below is settled to three windows first and
-- the gate is required to refuse, naming fourteen; only then is the rest settled.
--
-- Without that step the suite would pass against the unpatched function and
-- prove nothing.
--
-- The other two are neutrality: the tournament's span is still three, and the
-- tournament's own qualification path is untouched.

begin;

select plan(25);

-- ---------------------------------------------------------------------------
-- Neutrality first, before anything is created
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.cup_group_stage_span(
    (select competition.id from public.bonus_competitions competition
       join public.tournaments season on season.id = competition.tournament_id
      where competition.game_key = 'predictor_cup' and season.kind <> 'league_season'
      limit 1)),
  3,
  'the tournament Championship''s group stage is still three windows, so the four patched expressions evaluate to the constants they held'
);

select is(
  predictor_internal.ensure_season_cup_knockout_windows(
    (select competition.id from public.bonus_competitions competition
       join public.tournaments season on season.id = competition.tournament_id
      where competition.game_key = 'predictor_cup' and season.kind <> 'league_season'
      limit 1), 4),
  0,
  'and no knockout window is generated for it: a tournament publishes its own'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure)
    not like '%cup_final_group_tables%',
  'the driver reads contract 169''s dispatcher rather than the tournament table directly, so one gate cannot qualify off one table and seed off another'
);

-- ---------------------------------------------------------------------------
-- A season Championship with a fourteen-matchday group stage
-- ---------------------------------------------------------------------------
--
-- Eight entrants over twenty matchweeks. `select_season_cup_format` answers
-- `single_group`, two meetings, fourteen league rounds, and a
-- `seeded_playoff_window` tail of six — so the group stage is fourteen windows
-- and six matchweeks remain for the knockout the gate will need three of.

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C186 Qualification Season', 2060, t.competition_id, 'cup-qualification',
       'league_season', 'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.q_season',
  (select id::text from public.tournaments where season_key = 'cup-qualification'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('q186-t1')::uuid, current_setting('test.q_season')::uuid, 'Qualification Rovers'),
  (md5('q186-t2')::uuid, current_setting('test.q_season')::uuid, 'Qualification United');

insert into public.competition_rounds (id, tournament_id, round_key, ordinal, kind, label)
select md5('q186-r' || n)::uuid, current_setting('test.q_season')::uuid,
       'q186-mw' || n, n, 'league_matchweek', 'Matchweek ' || n
  from generate_series(1, 20) as n;

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select md5('q186-f' || n)::uuid, current_setting('test.q_season')::uuid, md5('q186-r' || n)::uuid,
       md5('q186-t1')::uuid, md5('q186-t2')::uuid,
       now() + (n || ' days')::interval, 'scheduled'
  from generate_series(1, 20) as n;

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('q186-u' || n)::uuid, format('q186-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 8) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('q186-u' || n)::uuid, 'Q186 Player ' || n, now() from generate_series(1, 8) as n;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at, name, owner_id, invite_code)
values (md5('q186-cup')::uuid, current_setting('test.q_season')::uuid, 'predictor_cup',
        true, 'active', true, 'private', now() - interval '2 days',
        'Qualification Championship', md5('q186-u1')::uuid, 'Q186CUP');

insert into public.bonus_competition_entrants (competition_id, user_id)
select md5('q186-cup')::uuid, md5('q186-u' || n)::uuid from generate_series(1, 8) as n;

select set_config('test.q_launch',
  predictor_internal.launch_season_cup(md5('q186-cup')::uuid)::text, true);

select is(
  current_setting('test.q_launch')::jsonb ->> 'outcome', 'launched',
  'the eight-entrant Championship launches'
);

select is(
  predictor_internal.cup_group_stage_span(md5('q186-cup')::uuid),
  14,
  'and its group stage is FOURTEEN windows, not the tournament''s three'
);

-- Contract 187's other half, found by driving the gate rather than reading it.
select ok(
  (select draw_completed_at is not null from public.bonus_competitions
    where id = md5('q186-cup')::uuid),
  'the launcher records that it drew the competition — without this the gate refuses every season Championship on the grounds that it was never drawn'
);

-- ---------------------------------------------------------------------------
-- Settle the TOURNAMENT'S three windows, and require a refusal
-- ---------------------------------------------------------------------------

update public.season_fixtures
   set status = 'played', home_score = 1, away_score = 0
 where id in (
   select link.season_fixture_id
     from public.season_cup_window_fixtures link
     join public.bonus_competition_windows win on win.id = link.window_id
    where win.competition_id = md5('q186-cup')::uuid and win.sequence <= 3);

update public.bonus_competition_windows
   set opens_at = now() - interval '40 days' + (sequence || ' hours')::interval,
       locks_at = now() - interval '39 days' + (sequence || ' hours')::interval
 where competition_id = md5('q186-cup')::uuid and sequence <= 3;

select is(
  (select count(*)::integer from public.bonus_competition_windows win
    where win.competition_id = md5('q186-cup')::uuid
      and win.sequence between 1 and 3
      and not predictor_internal.cup_window_settled(win.id)),
  0,
  'the tournament''s three group windows are settled'
);

-- ---------------------------------------------------------------------------
-- The caller is actually reachable, and the gate is actually a gate
-- ---------------------------------------------------------------------------
--
-- Asserted rather than assumed, and it was assumed until it was not: the first
-- draft of this suite called the RPC without ever assuming the `authenticated`
-- role, so it proved the DRIVER worked and proved nothing about the door.
-- Generalising an authority whose only grant is `service_role` and leaving it
-- unreachable is the defect contracts 116 to 179 keep recording.

select is(
  has_function_privilege('authenticated',
    'public.admin_finalise_season_cup_groups(uuid)', 'execute'),
  true,
  'a signed-in caller may reach the season qualification entry point'
);

select is(
  has_function_privilege('anon',
    'public.admin_finalise_season_cup_groups(uuid)', 'execute'),
  false,
  'and an anonymous one may not'
);

select is(
  has_function_privilege('authenticated',
    'public.admin_finalise_predictor_cup_groups(uuid)', 'execute'),
  false,
  'while the driver itself stays off the browser: it is competition-neutral now, so a grant here would open the TOURNAMENT Championship''s qualification too'
);

select set_config('request.jwt.claims',
  json_build_object('sub', md5('q186-u2')::uuid, 'role', 'authenticated',
    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.admin_finalise_season_cup_groups(%L::uuid)$$, md5('q186-cup')::uuid),
  '42501',
  null,
  'an ordinary signed-in entrant is refused: the grant admits the caller and require_competition_admin decides'
);

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('q186-u1')::uuid, 'role', 'authenticated',
    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);
set local role authenticated;

-- THE ASSERTION THIS FILE EXISTS FOR.
select throws_ok(
  format($$select public.admin_finalise_season_cup_groups(%L::uuid)$$, md5('q186-cup')::uuid),
  '55000',
  'All 14 Cup group windows must settle before qualification (11 pending)',
  'and the gate REFUSES, naming fourteen: the delivered driver would have qualified this field off three matchdays of fourteen'
);

reset role;

select is(
  (select count(*)::integer from public.bonus_cup_members
    where competition_id = md5('q186-cup')::uuid and qualified_as is not null),
  0,
  'and nobody is qualified by the refused call'
);

-- ---------------------------------------------------------------------------
-- Settle the whole group stage
-- ---------------------------------------------------------------------------

update public.season_fixtures
   set status = 'played', home_score = 1, away_score = 0
 where id in (
   select link.season_fixture_id
     from public.season_cup_window_fixtures link
     join public.bonus_competition_windows win on win.id = link.window_id
    where win.competition_id = md5('q186-cup')::uuid);

update public.bonus_competition_windows
   set opens_at = now() - interval '40 days' + (sequence || ' hours')::interval,
       locks_at = now() - interval '39 days' + (sequence || ' hours')::interval
 where competition_id = md5('q186-cup')::uuid;

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('q186-cup')::uuid),
  14,
  'the competition holds only its fourteen group windows: a season has no knockout calendar until the gate creates one'
);

set local role authenticated;

select set_config('test.q_final',
  public.admin_finalise_season_cup_groups(md5('q186-cup')::uuid)::text, true);

-- Every structural assertion below reads a browser-revoked relation, so the
-- role goes back. Reading them AS `authenticated` is `permission denied` -- the
-- revoke working, not a defect in the bracket.
reset role;

-- ADR 0014 § 6.1's target and contract 184's arithmetic, on a group of eight:
-- automatic places floor(8/2) = 4, qualifying limit ceil(16/3) = 6, target
-- round(8 x 2/3) = 5. So four qualify automatically and one wildcard is taken
-- from ranks five and six.
select is(
  (current_setting('test.q_final')::jsonb ->> 'target')::integer, 5,
  'the § 6.1 two-thirds target for a field of eight is five'
);

select is(
  (current_setting('test.q_final')::jsonb ->> 'automatic')::integer, 4,
  'contract 184''s floor(N/2) qualifies four automatically'
);

select is(
  (current_setting('test.q_final')::jsonb ->> 'wildcards')::integer, 1,
  'and one wildcard makes up the target'
);

select is(
  (select count(*)::integer from public.bonus_cup_members
    where competition_id = md5('q186-cup')::uuid and qualified_as is not null),
  5,
  'five entrants are qualified'
);

select is(
  (select count(*)::integer from public.bonus_cup_members
    where competition_id = md5('q186-cup')::uuid and seed is not null),
  5,
  'and every one of them is seeded — § 7.1''s bands run over the qualifiers and nobody else'
);

select is(
  (select count(distinct seed)::integer from public.bonus_cup_members
    where competition_id = md5('q186-cup')::uuid and seed is not null),
  5,
  'on distinct seeds, because two players sharing a seed would put one of them in no bracket slot'
);

-- § 7.2: five qualifiers take a bracket of four, so one playoff tie and three
-- byes.
select is(
  jsonb_build_object(
    'bracket', (current_setting('test.q_final')::jsonb ->> 'bracket')::integer,
    'ties', (current_setting('test.q_final')::jsonb ->> 'playoff_ties')::integer,
    'byes', (current_setting('test.q_final')::jsonb ->> 'byes')::integer),
  jsonb_build_object('bracket', 4, 'ties', 1, 'byes', 3),
  '§ 7.2''s arithmetic brackets five qualifiers as four with one playoff tie and three byes'
);

select is(
  (select count(*)::integer from public.bonus_cup_fixtures
    where competition_id = md5('q186-cup')::uuid and stage = 'playoff'),
  1,
  'and the playoff tie exists as a fixture'
);

-- THE SECOND ASSERTION THIS FILE EXISTS FOR: the knockout windows a season had
-- none of. Sequences 15, 16 and 17 — after the group stage, not at the
-- tournament's sequence 4.
select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('q186-cup')::uuid and sequence between 15 and 17),
  3,
  'three knockout windows are appended AFTER the group stage rather than expected at the tournament''s sequence four'
);

select is(
  (select win.sequence::integer from public.bonus_competition_windows win
    join public.bonus_cup_fixtures fixture on fixture.window_id = win.id
   where fixture.competition_id = md5('q186-cup')::uuid and fixture.stage = 'playoff'),
  15,
  'and the playoff is played in the window immediately after the group stage'
);

-- Idempotent: re-running the generator appends nothing.
select is(
  predictor_internal.ensure_season_cup_knockout_windows(md5('q186-cup')::uuid, 3),
  0,
  're-running the window generator appends nothing, so a repeated gate call cannot double the calendar'
);

reset role;

select finish();

rollback;
