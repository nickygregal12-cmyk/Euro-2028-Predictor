-- Contract 109: the successor gets a calendar, and the endgame closes.
--
-- Two leagues are set up rather than one, because contract 103 permits only one
-- live public Last Man Standing competition per season. The Premier League
-- fixture exercises the scheduler directly; the Scottish one exercises the job
-- that drives it. Giving them separate seasons is not tidiness — sharing one
-- would have meant testing the job against a competition the direct assertions
-- had already restarted, and a pass would then have proved nothing about
-- whether the job could find its own work.
--
-- Matchweek 1 kicks off in the PAST and matchweeks 2 and 3 in the future, so a
-- restart at `now()` lands mid-season. That is the only arrangement where
-- "beginning with the next eligible round" says anything: with every round
-- ahead, starting at round 1 and starting at the next eligible round are the
-- same answer, and a scheduler that ignored the boundary entirely would pass.

begin;

select plan(22);

select set_config('test.sw_pl',
  (select t.id::text from public.tournaments t where t.name = 'Premier League 2026/27'), true);

select set_config('test.sw_sp',
  (select t.id::text from public.tournaments t where t.name = 'Scottish Premiership 2026/27'), true);

-- Two clubs and three matchweeks in each league.

insert into public.teams (tournament_id, name)
select tournament.id, club.name
from (values
  (current_setting('test.sw_pl')::uuid),
  (current_setting('test.sw_sp')::uuid)
) as tournament(id)
cross join (values ('Scheduler Rovers'), ('Scheduler United')) as club(name);

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select tournament.id,
       format('sw-mw%s', week.n),
       week.n,
       'league_matchweek',
       format('Matchweek %s', week.n)
from (values
  (current_setting('test.sw_pl')::uuid),
  (current_setting('test.sw_sp')::uuid)
) as tournament(id)
cross join generate_series(1, 3) as week(n);

-- Matchweek 1 is behind us; 2 and 3 are ahead.
insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status
)
select
  round.tournament_id,
  round.id,
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'Scheduler Rovers'),
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'Scheduler United'),
  case round.ordinal
    when 1 then now() - interval '2 days'
    when 2 then now() + interval '3 days'
    else now() + interval '6 days'
  end,
  'scheduled'
from public.competition_rounds round
where round.tournament_id in (
  current_setting('test.sw_pl')::uuid, current_setting('test.sw_sp')::uuid
) and round.kind = 'league_matchweek';

-- ---------------------------------------------------------------------------
-- The resolver
-- ---------------------------------------------------------------------------

select is(
  (select round.label from public.competition_rounds round
    where round.id = predictor_internal.next_eligible_league_round(
      current_setting('test.sw_pl')::uuid, 'last_man_standing', now())),
  'Matchweek 2',
  'the next eligible round is the earliest that still locks after the boundary, not the first of the season'
);

select is(
  predictor_internal.next_eligible_league_round(
    current_setting('test.sw_pl')::uuid, 'last_man_standing', now() + interval '30 days'),
  null::uuid,
  'and a boundary past every remaining round yields none rather than the last one'
);

select is(
  predictor_internal.next_eligible_league_round(
    current_setting('test.sw_pl')::uuid, 'last_man_standing', now() - interval '30 days'),
  (select round.id from public.competition_rounds round
    where round.tournament_id = current_setting('test.sw_pl')::uuid
      and round.label = 'Matchweek 1'),
  'a boundary before the season starts yields matchweek 1, so the boundary is genuinely being applied'
);

-- Contract 83's "not derivable is not due" becomes "not eligible" here. A round
-- whose fixture list carries no kickoff cannot be scheduled against.

-- Matchweek 4 exists but has no fixtures, so it has no derivable instant. It
-- stays in place for the scheduling assertions below, where it must not become
-- a third window.
insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.sw_pl')::uuid, 'sw-mw4', 4, 'league_matchweek', 'Matchweek 4');

select is(
  predictor_internal.next_eligible_league_round(
    current_setting('test.sw_pl')::uuid, 'last_man_standing', now() + interval '30 days'),
  null::uuid,
  'a round that exists beyond the boundary but carries no fixtures is not eligible — contract 83''s "not derivable" reads here as "not schedulable"'
);

-- ---------------------------------------------------------------------------
-- Refusals
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.routine_privileges
   where routine_schema = 'predictor_internal'
     and routine_name in ('next_eligible_league_round', 'generate_lms_successor_windows')
     and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'neither new internal function is reachable by a browser or service role'
);

select is(
  (select count(*)::integer from information_schema.routine_privileges
   where routine_schema = 'public'
     and routine_name = 'process_due_lms_restarts'
     and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'and the job is driven by the scheduler alone, not by any caller with a session'
);

select throws_ok(
  format('select predictor_internal.generate_lms_successor_windows(%L::uuid)',
         md5('sw-missing')::uuid),
  '23503',
  null,
  'an unknown competition is refused rather than silently scheduling nothing'
);

-- ---------------------------------------------------------------------------
-- A wiped-out Premier League competition, restarted
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('sw-user-' || n)::uuid, format('sw-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 4) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('sw-user-' || n)::uuid, format('Sw Player %s', n), now()
from generate_series(1, 4) as n;

-- The catalogue already publishes one live public Last Man Standing competition
-- per season, and contract 103 permits only one. Using the seeded rows rather
-- than inventing parallel ones keeps the test on the same objects the platform
-- actually restarts.

select set_config('test.sw_pl_old',
  (select competition.id::text from public.bonus_competitions competition
    where competition.tournament_id = current_setting('test.sw_pl')::uuid
      and competition.game_key = 'last_man_standing'
      and competition.visibility_kind = 'public'
      and competition.completed_at is null), true);

select set_config('test.sw_sp_old',
  (select competition.id::text from public.bonus_competitions competition
    where competition.tournament_id = current_setting('test.sw_sp')::uuid
      and competition.game_key = 'last_man_standing'
      and competition.visibility_kind = 'public'
      and competition.completed_at is null), true);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select current_setting('test.sw_pl_old')::uuid, md5('sw-user-' || n)::uuid, now() - interval '19 days'
from generate_series(1, 4) as n;

-- The MESSAGE is asserted, not only the code. Deleting the first-instance check
-- leaves the function falling through to "the predecessor has not finished",
-- which raises the same 23514 for a competition that has no predecessor at all
-- — so a code-only assertion passes against the mutant and proves nothing.
select throws_ok(
  format('select predictor_internal.generate_lms_successor_windows(%L::uuid)',
         current_setting('test.sw_pl_old')),
  '23514',
  format('Competition %s is a first instance and has no restart to schedule from',
         current_setting('test.sw_pl_old')),
  'a first instance is refused for being one — its calendar comes from the catalogue, and a second source for the same rounds is worse than none'
);

select set_config('test.sw_pl_new',
  (select predictor_internal.restart_lms_competition(
     current_setting('test.sw_pl_old')::uuid)::text), true);

select set_config('test.sw_completed',
  (select completed_at::text from public.bonus_competitions
    where id = current_setting('test.sw_pl_old')::uuid), true);

select is(
  predictor_internal.generate_lms_successor_windows(current_setting('test.sw_pl_new')::uuid),
  2,
  'the successor is scheduled over the two rounds that remain, not the three the season has'
);

select is(
  (select jsonb_agg(jsonb_build_object('sequence', w.sequence, 'label', w.label) order by w.sequence)
   from public.bonus_competition_windows w
   where w.competition_id = current_setting('test.sw_pl_new')::uuid),
  '[{"label": "Matchweek 2", "sequence": 1}, {"label": "Matchweek 3", "sequence": 2}]'::jsonb,
  'numbered from one for the new competition while keeping the league''s own round names'
);

select is(
  (select w.opens_at from public.bonus_competition_windows w
    where w.competition_id = current_setting('test.sw_pl_new')::uuid and w.sequence = 1),
  current_setting('test.sw_completed')::timestamptz,
  'the first round opens the moment the predecessor ended, so no time is unaccounted for'
);

select is(
  (select w.opens_at from public.bonus_competition_windows w
    where w.competition_id = current_setting('test.sw_pl_new')::uuid and w.sequence = 2),
  (select w.locks_at from public.bonus_competition_windows w
    where w.competition_id = current_setting('test.sw_pl_new')::uuid and w.sequence = 1),
  'and each later round opens when the one before it locked'
);

select is(
  (select count(*)::integer from public.bonus_competition_windows w
    where w.competition_id = current_setting('test.sw_pl_new')::uuid
      and (w.locks_at <= current_setting('test.sw_completed')::timestamptz
        or w.opens_at < current_setting('test.sw_completed')::timestamptz)),
  0,
  'every scheduled round sits after the restart, which is contract 108''s rule reached from the other side'
);

-- The fixtures. Correlation is the part worth checking: each window must carry
-- ITS round's fixtures, which a label match would have got wrong.

select is(
  (select count(*)::integer from public.season_cup_window_fixtures link
    join public.bonus_competition_windows w on w.id = link.window_id
   where w.competition_id = current_setting('test.sw_pl_new')::uuid),
  2,
  'each scheduled round carries its fixtures through the season link'
);

select is(
  (select count(*)::integer
   from public.season_cup_window_fixtures link
   join public.bonus_competition_windows w on w.id = link.window_id
   join public.season_fixtures fixture on fixture.id = link.season_fixture_id
   join public.competition_rounds round on round.id = fixture.competition_round_id
   where w.competition_id = current_setting('test.sw_pl_new')::uuid
     and round.label <> w.label),
  0,
  'and every link joins a window to a fixture of the round that window names'
);

select is(
  (select detail->>'windowsCreated' from public.bonus_competition_audit
    where competition_id = current_setting('test.sw_pl_new')::uuid
      and action = 'successor_calendar_scheduled'),
  '2',
  'the scheduling is recorded on the successor''s own trail'
);

-- Idempotency.

select is(
  predictor_internal.generate_lms_successor_windows(current_setting('test.sw_pl_new')::uuid),
  0,
  'a second run schedules nothing rather than duplicating or moving the calendar'
);

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = current_setting('test.sw_pl_new')::uuid),
  2,
  'so a retrying job leaves two rounds, not four'
);

-- ---------------------------------------------------------------------------
-- THE JOB, on the Scottish season
-- ---------------------------------------------------------------------------

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select current_setting('test.sw_sp_old')::uuid, md5('sw-user-' || n)::uuid, now() - interval '19 days'
from generate_series(1, 4) as n;

-- Settlement leaves a competition awaiting restart LIVE — its else branch
-- un-completes it — so what the job has to find is the report, not a state.

-- Two hourly settlement runs, an hour apart, as the scheduled job produces
-- them. Distinct instants are what make "the latest report" well defined.
insert into public.bonus_competition_audit (competition_id, action, detail, recorded_at)
select
  current_setting('test.sw_sp_old')::uuid,
  'season_lms_settled',
  jsonb_build_object('conclusion', jsonb_build_object('kind', 'winner')),
  now() - interval '2 hours';

select is(
  public.process_due_lms_restarts(now()),
  '{"attempted": 0, "restarted": 0, "scheduled": 0, "inert": 0, "failed": 0}'::jsonb,
  'a competition whose last settlement found a winner is left alone'
);

insert into public.bonus_competition_audit (competition_id, action, detail, recorded_at)
select
  current_setting('test.sw_sp_old')::uuid,
  'season_lms_settled',
  jsonb_build_object('conclusion', jsonb_build_object('kind', 'restart_all_reentered')),
  now() - interval '1 hour';

select is(
  public.process_due_lms_restarts(now()),
  '{"attempted": 1, "restarted": 1, "scheduled": 1, "inert": 0, "failed": 0}'::jsonb,
  'and the later report is what counts: the competition is restarted and its successor scheduled in one pass'
);

select is(
  (select count(*)::integer from public.bonus_competition_windows w
    join public.bonus_competitions successor on successor.id = w.competition_id
   where successor.predecessor_competition_id = current_setting('test.sw_sp_old')::uuid),
  2,
  'the successor the job created has the same two remaining rounds'
);

select is(
  public.process_due_lms_restarts(now()),
  '{"attempted": 0, "restarted": 0, "scheduled": 0, "inert": 0, "failed": 0}'::jsonb,
  'and the second run finds nothing — the audit row is immutable and would trigger for ever, so the successor is what spends it'
);

select finish();

rollback;
