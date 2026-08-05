-- Contract 110: the season Championship gets rounds it can be played over.
--
-- The assertion that matters most here is the refusal. A calendar generator is
-- easy to write so that it returns whatever the season happens to have, and a
-- test that only ever asks for a number the season can supply will never
-- notice. A Championship played over four rounds of a five-round format is not
-- a shorter competition; it is one whose final table cannot be reconstructed
-- from its own rules. So the short-season case is asserted directly, and the
-- window count is asserted after it to prove nothing was created on the way.

begin;

select plan(16);

select set_config('test.cc_pl',
  (select t.id::text from public.tournaments t where t.name = 'Premier League 2026/27'), true);

select set_config('test.cc_euro',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'), true);

select set_config('test.cc_cup',
  (select competition.id::text from public.bonus_competitions competition
    where competition.tournament_id = current_setting('test.cc_pl')::uuid
      and competition.game_key = 'predictor_cup'
      and competition.visibility_kind = 'public'
      and competition.completed_at is null), true);

-- Four league matchweeks, all ahead of us, one fixture each.

insert into public.teams (tournament_id, name) values
  (current_setting('test.cc_pl')::uuid, 'Calendar Rovers'),
  (current_setting('test.cc_pl')::uuid, 'Calendar United');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select current_setting('test.cc_pl')::uuid, format('cc-mw%s', n), n,
       'league_matchweek', format('Matchweek %s', n)
from generate_series(1, 4) as n;

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status
)
select
  round.tournament_id,
  round.id,
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'Calendar Rovers'),
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'Calendar United'),
  now() + (round.ordinal * interval '7 days'),
  'scheduled'
from public.competition_rounds round
where round.tournament_id = current_setting('test.cc_pl')::uuid
  and round.kind = 'league_matchweek';

-- ---------------------------------------------------------------------------
-- Refusals
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.routine_privileges
   where routine_schema = 'predictor_internal'
     and routine_name = 'generate_season_cup_windows'
     and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'no browser or service role may schedule a Championship'
);

select throws_ok(
  format('select predictor_internal.generate_season_cup_windows(%L::uuid, now(), 3)',
         md5('cc-missing')::uuid),
  '23503',
  null,
  'an unknown competition is refused rather than silently scheduling nothing'
);

select throws_ok(
  format('select predictor_internal.generate_season_cup_windows(%L::uuid, now(), 3)',
         (select competition.id from public.bonus_competitions competition
           where competition.tournament_id = current_setting('test.cc_pl')::uuid
             and competition.game_key = 'last_man_standing'
             and competition.completed_at is null)),
  '23514',
  null,
  'and a competition that is not a Predictor Championship is refused'
);

-- A tournament Championship has a published calendar of its own and no league
-- matchweeks. It must be told that, not handed a zero it cannot interpret. The
-- seed publishes no Euro Bonus Games — `publish-catalogue.sql` does that — so
-- the row is created here rather than assumed.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('cc-euro-cup')::uuid, current_setting('test.cc_euro')::uuid,
  'predictor_cup', true, 'active', true, 'public', now() - interval '1 day'
);

select throws_ok(
  format('select predictor_internal.generate_season_cup_windows(%L::uuid, now(), 3)',
         md5('cc-euro-cup')::uuid),
  '23514',
  null,
  'a tournament Championship is refused explicitly rather than returning zero the caller cannot tell from a full season'
);

select throws_ok(
  format('select predictor_internal.generate_season_cup_windows(%L::uuid, null, 3)',
         current_setting('test.cc_cup')),
  '22023',
  null,
  'a missing boundary is refused — rounds are scheduled after something, and null is not an instant'
);

select throws_ok(
  format('select predictor_internal.generate_season_cup_windows(%L::uuid, now(), 0)',
         current_setting('test.cc_cup')),
  '22023',
  null,
  'and a zero-round format is refused rather than creating an empty competition'
);

-- ---------------------------------------------------------------------------
-- THE REFUSAL THAT MATTERS: a season that cannot supply the format
-- ---------------------------------------------------------------------------

select throws_ok(
  format('select predictor_internal.generate_season_cup_windows(%L::uuid, now(), 5)',
         current_setting('test.cc_cup')),
  '23514',
  format('The season supplies 4 schedulable round(s) after %s, and this Championship needs 5',
         now()),
  'a five-round format over four available rounds is refused, and the message says how many there were'
);

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = current_setting('test.cc_cup')::uuid),
  0,
  'and nothing was created on the way to that refusal'
);

-- ---------------------------------------------------------------------------
-- The league phase
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.generate_season_cup_windows(
    current_setting('test.cc_cup')::uuid, now(), 3),
  3,
  'three rounds of a three-round format are scheduled'
);

select is(
  (select jsonb_agg(jsonb_build_object('sequence', w.sequence, 'label', w.label) order by w.sequence)
   from public.bonus_competition_windows w
   where w.competition_id = current_setting('test.cc_cup')::uuid),
  '[{"label": "Matchweek 1", "sequence": 1}, {"label": "Matchweek 2", "sequence": 2}, {"label": "Matchweek 3", "sequence": 3}]'::jsonb,
  'taking the EARLIEST three and leaving matchweek 4 unscheduled, rather than taking whatever the season had'
);

select is(
  (select count(*)::integer
   from public.season_cup_window_fixtures link
   join public.bonus_competition_windows w on w.id = link.window_id
   join public.season_fixtures fixture on fixture.id = link.season_fixture_id
   join public.competition_rounds round on round.id = fixture.competition_round_id
   where w.competition_id = current_setting('test.cc_cup')::uuid
     and round.label = w.label),
  3,
  'each window carries its own round''s fixtures, correlated by sequence rather than by label'
);

select is(
  (select w.opens_at from public.bonus_competition_windows w
    where w.competition_id = current_setting('test.cc_cup')::uuid and w.sequence = 2),
  (select w.locks_at from public.bonus_competition_windows w
    where w.competition_id = current_setting('test.cc_cup')::uuid and w.sequence = 1),
  'and each round opens when the one before it locked'
);

select is(
  predictor_internal.generate_season_cup_windows(
    current_setting('test.cc_cup')::uuid, now(), 3),
  0,
  'a second run for the same boundary schedules nothing — rounds already exist past it'
);

-- ---------------------------------------------------------------------------
-- The split phase: the same competition, a later boundary, continuing sequence
-- ---------------------------------------------------------------------------

select set_config('test.cc_league_end',
  (select max(w.locks_at)::text from public.bonus_competition_windows w
    where w.competition_id = current_setting('test.cc_cup')::uuid), true);

select is(
  predictor_internal.generate_season_cup_windows(
    current_setting('test.cc_cup')::uuid,
    current_setting('test.cc_league_end')::timestamptz,
    1),
  1,
  'the split phase schedules over what remains, on the same competition'
);

select is(
  (select jsonb_build_object('sequence', w.sequence, 'label', w.label)
   from public.bonus_competition_windows w
   where w.competition_id = current_setting('test.cc_cup')::uuid and w.sequence = 4),
  jsonb_build_object('sequence', 4, 'label', 'Matchweek 4'),
  'continuing the sequence rather than restarting it, which is what keeps the Cup matchday number meaningful across the split'
);

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = current_setting('test.cc_cup')::uuid),
  4,
  'and the league phase''s three rounds are untouched by the split being scheduled'
);

select finish();

rollback;
