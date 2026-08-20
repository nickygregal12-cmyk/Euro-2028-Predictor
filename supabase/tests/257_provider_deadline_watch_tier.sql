-- Contract 211: a deadline watch that is cheap enough to leave on.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that the three tiers pick the right
-- cadence at the right moment, and that the cheap one is the one doing the long
-- reach. Contract 210 covered the deadline correctly and paid 381 polls a
-- matchweek for it, against contract 146's published budget of about 58. A fix
-- that has to be watched for cost is a fix that gets turned off.
--
-- SO COST IS ASSERTED HERE, NOT JUST CORRECTNESS. The suite builds a matchweek
-- with the shape that actually causes the problem -- fixtures spread across
-- days, so a long LIVE lead chains the windows into one continuous block -- and
-- counts the minutes each configuration would leave the window open. A cheaper
-- configuration that stopped covering the deadline would fail the correctness
-- assertions; a covering one that quietly cost more would fail these.
--
-- WHAT IS DELIBERATELY NOT ASSERTED HERE. That a postponement is detected or
-- applied (`255`), or what a deadline IS (`256` derives it from
-- `season_prediction_lock_at`). This file asserts only which cadence the
-- dispatcher would choose, and what that choice costs.

begin;

select plan(13);

create temporary table c211 (
  label text primary key,
  fixture_id uuid not null,
  kickoff_at timestamptz not null
) on commit drop;

create temporary table c211_target (
  tournament_id uuid not null
) on commit drop;

do $$
declare
  v_t uuid; v_r uuid;
  v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_e uuid; v_f uuid;
  -- Friday evening to Sunday afternoon: the spread that turns a twelve-hour
  -- LIVE lead into one continuous window.
  v_fri timestamptz := '2026-09-11 19:00:00+00';
  v_sat timestamptz := '2026-09-12 14:00:00+00';
  v_sun timestamptz := '2026-09-13 15:00:00+00';
begin
  insert into public.tournaments
    (competition_id, name, year, season_key, kind, display_timezone, status)
  select source.competition_id, 'Contract 211 Watch Season', source.year,
         'contract-211-watch', source.kind, source.display_timezone, source.status
    from public.tournaments source
   where source.kind = 'league_season'
   order by source.name
   limit 1
  returning id into v_t;

  insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
  values (v_t, 'c211-mw1', 973, 'league_matchweek', 'Contract 211 Matchweek 1')
  returning id into v_r;

  -- Six clubs: a club plays at most once per matchweek.
  insert into public.teams (tournament_id, name) values (v_t, 'C211 Alpha') returning id into v_a;
  insert into public.teams (tournament_id, name) values (v_t, 'C211 Bravo') returning id into v_b;
  insert into public.teams (tournament_id, name) values (v_t, 'C211 Charlie') returning id into v_c;
  insert into public.teams (tournament_id, name) values (v_t, 'C211 Delta') returning id into v_d;
  insert into public.teams (tournament_id, name) values (v_t, 'C211 Echo') returning id into v_e;
  insert into public.teams (tournament_id, name) values (v_t, 'C211 Foxtrot') returning id into v_f;

  insert into public.season_fixtures
    (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
  values (v_t, v_r, v_a, v_b, v_fri, 'scheduled');
  insert into c211 select 'friday', id, v_fri from public.season_fixtures
   where tournament_id = v_t and kickoff_at = v_fri;

  insert into public.season_fixtures
    (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
  values (v_t, v_r, v_c, v_d, v_sat, 'scheduled');
  insert into c211 select 'saturday', id, v_sat from public.season_fixtures
   where tournament_id = v_t and kickoff_at = v_sat;

  insert into public.season_fixtures
    (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
  values (v_t, v_r, v_e, v_f, v_sun, 'scheduled');
  insert into c211 select 'sunday', id, v_sun from public.season_fixtures
   where tournament_id = v_t and kickoff_at = v_sun;

  insert into public.provider_poll_targets (provider, path, tournament_id, enabled)
  values ('sportmonks', '/contract-211/{{date:+0}}/{{date:+8}}', v_t, true);

  insert into c211_target values (v_t);
end;
$$;

-- ---------------------------------------------------------------------------
-- The committed dials, and the ordering between them.
-- ---------------------------------------------------------------------------

select is(
  (select deadline_lead_minutes from public.provider_poll_targets
    where path = '/contract-211/{{date:+0}}/{{date:+8}}'),
  720,
  'a new target inherits a deadline watch that reaches back twelve hours'
);

select is(
  (select deadline_cadence_minutes from public.provider_poll_targets
    where path = '/contract-211/{{date:+0}}/{{date:+8}}'),
  60,
  'and watches at hourly resolution, which is what a schedule change needs'
);

select is(
  (select live_lead_minutes from public.provider_poll_targets
    where path = '/contract-211/{{date:+0}}/{{date:+8}}'),
  15,
  'the LIVE lead is back to 15: contract 210 borrowed it for a job it does not do'
);

select is(
  (select count(*)::integer from public.provider_poll_targets
    where enabled and live_lead_minutes <> 15),
  0,
  'and no enabled target is left carrying contract 210''s expensive live lead'
);

select is(
  (select count(*)::integer from public.provider_poll_targets
    where enabled and deadline_lead_minutes < 720),
  0,
  'every enabled target takes the deadline watch, including ones predating it'
);

select is(
  (select count(*)::integer from public.provider_poll_targets
    where live_cadence_minutes > deadline_cadence_minutes
       or deadline_cadence_minutes > cadence_minutes),
  0,
  'the three cadences stay ordered finest to coarsest'
);

-- ---------------------------------------------------------------------------
-- Which tier answers, and when. The matchweek lock is the Friday kickoff.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.season_prediction_lock_at(
    (select fixture_id from c211 where label = 'sunday'), 0
  ),
  (select kickoff_at from c211 where label = 'friday'),
  'the Sunday fixture locks at the FRIDAY kickoff, so that is the instant to cover'
);

select ok(
  predictor_internal.provider_target_awaits_deadline(
    (select tournament_id from c211_target),
    (select kickoff_at - interval '11 hours' from c211 where label = 'friday'),
    720
  ),
  'eleven hours before the lock the deadline watch is open'
);

select ok(
  not predictor_internal.provider_target_is_live(
    (select tournament_id from c211_target),
    (select kickoff_at - interval '11 hours' from c211 where label = 'friday'),
    15, 120
  ),
  'and the LIVE window is shut there, so the hourly tier is what answers'
);

select ok(
  predictor_internal.provider_target_is_live(
    (select tournament_id from c211_target),
    (select kickoff_at + interval '30 minutes' from c211 where label = 'saturday'),
    15, 120
  ),
  'thirty minutes into a match the LIVE window is open, so ten-minute polling wins'
);

select ok(
  not predictor_internal.provider_target_awaits_deadline(
    (select tournament_id from c211_target),
    (select kickoff_at + interval '30 minutes' from c211 where label = 'sunday'),
    720
  ),
  'the deadline watch closes AT kickoff; after it there is no prediction to protect'
);

-- ---------------------------------------------------------------------------
-- Cost. The reason this contract exists, asserted rather than argued.
-- ---------------------------------------------------------------------------

-- Minutes the window would stand open across the whole matchweek, as the union
-- of the per-fixture windows -- which is what the tournament-level predicate
-- actually produces, and why a long lead is so much more expensive than it
-- looks fixture by fixture.
create temporary view c211_cost as
select label,
       sum(extract(epoch from upper(span) - lower(span)) / 60.0) as minutes_open,
       max(cadence) as cadence
  from (
    select shape.label, shape.cadence,
           unnest(range_agg(tstzrange(
             c211.kickoff_at - pg_catalog.make_interval(mins => shape.lead),
             c211.kickoff_at + pg_catalog.make_interval(mins => shape.tail)
           ))) as span
      from c211
      cross join (values ('contract 210 live lead', 720, 120, 10),
                         ('contract 211 live', 15, 120, 10),
                         ('contract 211 deadline watch', 720, 0, 60))
                 as shape(label, lead, tail, cadence)
     group by shape.label, shape.cadence
  ) merged
 group by label;

select ok(
  (select ceil(minutes_open / cadence) from c211_cost where label = 'contract 211 deadline watch')
  < (select ceil(minutes_open / cadence) from c211_cost where label = 'contract 210 live lead') / 4,
  'THE DEADLINE WATCH COSTS UNDER A QUARTER of what contract 210 spent'
);

select ok(
  (select minutes_open from c211_cost where label = 'contract 211 deadline watch')
  > (select minutes_open from c211_cost where label = 'contract 211 live'),
  'and it still stands open far longer, so the saving is resolution, not reach'
);

select * from finish();

rollback;
