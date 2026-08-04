-- Publish the three Euro 2028 Bonus Games and their canonical round/fixture plan.
--
-- This is operational reference-data publication, not a schema migration. It is
-- safe to rerun: competition/window rows are upserted and fixture links use the
-- existing primary key. No entrant, prediction, score, draw or result row is
-- created. Registration opening instants remain null in a newly configured
-- environment until the project owner deliberately opens each competition.

begin;

do $$
begin
  if not exists (
    select 1
    from public.tournaments tournament
    where tournament.name = 'UEFA Euro 2028'
  ) then
    raise exception 'UEFA Euro 2028 tournament row is required before publishing Bonus Games';
  end if;
end;
$$;

with target_tournament as (
  select tournament.id
  from public.tournaments tournament
  where tournament.name = 'UEFA Euro 2028'
  order by tournament.year desc, tournament.id
  limit 1
), definitions(game_key, registration_closes_at, draw_required) as (
  values
    ('ko_predictor'::text, null::timestamptz, false),
    ('last_man_standing'::text, '2028-06-09 13:00:00+00'::timestamptz, false),
    ('predictor_cup'::text, '2028-06-08 12:00:00+00'::timestamptz, true)
)
insert into public.bonus_competitions (
  tournament_id,
  game_key,
  published,
  registration_opens_at,
  registration_closes_at,
  draw_required
)
select
  tournament.id,
  definition.game_key,
  true,
  null,
  definition.registration_closes_at,
  definition.draw_required
from target_tournament tournament
cross join definitions definition
on conflict (tournament_id, game_key)
  where visibility_kind = 'public' and completed_at is null
do update
set published = true,
    updated_at = now();

with definitions(
  game_key,
  sequence,
  label,
  opens_at,
  locks_at,
  requires_tie_break_input
) as (
  values
    ('last_man_standing', 1, 'Round 1 — Matchday 1', '2028-05-30 13:00:00+00'::timestamptz, '2028-06-09 13:00:00+00'::timestamptz, false),
    ('last_man_standing', 2, 'Round 2 — Matchday 2', '2028-06-04 13:00:00+00'::timestamptz, '2028-06-14 13:00:00+00'::timestamptz, false),
    ('last_man_standing', 3, 'Round 3 — Matchday 3', '2028-06-08 13:00:00+00'::timestamptz, '2028-06-18 13:00:00+00'::timestamptz, false),
    ('last_man_standing', 4, 'Round 4 — Round of 16', '2028-06-14 13:00:00+00'::timestamptz, '2028-06-24 13:00:00+00'::timestamptz, false),
    ('last_man_standing', 5, 'Round 5 — Quarter-finals', '2028-06-20 13:00:00+00'::timestamptz, '2028-06-30 13:00:00+00'::timestamptz, false),
    ('last_man_standing', 6, 'Round 6 — Semi-finals', '2028-06-24 13:00:00+00'::timestamptz, '2028-07-04 13:00:00+00'::timestamptz, false),
    ('last_man_standing', 7, 'Round 7 — Final', '2028-06-29 13:00:00+00'::timestamptz, '2028-07-09 13:00:00+00'::timestamptz, false),
    ('predictor_cup', 1, 'Cup Matchday 1', '2028-05-30 13:00:00+00'::timestamptz, '2028-06-09 13:00:00+00'::timestamptz, false),
    ('predictor_cup', 2, 'Cup Matchday 2', '2028-06-04 13:00:00+00'::timestamptz, '2028-06-14 13:00:00+00'::timestamptz, false),
    ('predictor_cup', 3, 'Cup Matchday 3', '2028-06-08 13:00:00+00'::timestamptz, '2028-06-18 13:00:00+00'::timestamptz, false),
    ('predictor_cup', 4, 'Cup knockout — Round of 16 window', '2028-06-14 13:00:00+00'::timestamptz, '2028-06-24 13:00:00+00'::timestamptz, false),
    ('predictor_cup', 5, 'Cup knockout — Quarter-final window', '2028-06-20 13:00:00+00'::timestamptz, '2028-06-30 13:00:00+00'::timestamptz, false),
    ('predictor_cup', 6, 'Cup knockout — Semi-final window', '2028-06-24 13:00:00+00'::timestamptz, '2028-07-04 13:00:00+00'::timestamptz, false),
    ('predictor_cup', 7, 'Cup knockout — Final window', '2028-06-29 13:00:00+00'::timestamptz, '2028-07-09 13:00:00+00'::timestamptz, false)
)
insert into public.bonus_competition_windows (
  competition_id,
  sequence,
  label,
  opens_at,
  locks_at,
  settles_at,
  requires_tie_break_input
)
select
  competition.id,
  definition.sequence,
  definition.label,
  definition.opens_at,
  definition.locks_at,
  null,
  definition.requires_tie_break_input
from definitions definition
join public.tournaments tournament
  on tournament.name = 'UEFA Euro 2028'
join public.bonus_competitions competition
  on competition.tournament_id = tournament.id
 and competition.game_key = definition.game_key
 and competition.visibility_kind = 'public'
 and competition.completed_at is null
on conflict (competition_id, sequence) do update
set label = excluded.label,
    opens_at = excluded.opens_at,
    locks_at = excluded.locks_at,
    requires_tie_break_input = excluded.requires_tie_break_input,
    updated_at = now();

with mapped_matches as (
  select
    competition.id as competition_id,
    match.id as match_id,
    case
      when match.round = 'group' then match.matchday
      when match.round = 'r16' then 4
      when match.round = 'qf' then 5
      when match.round = 'sf' then 6
      when match.round = 'final' then 7
      else null
    end as window_sequence
  from public.tournaments tournament
  join public.bonus_competitions competition
    on competition.tournament_id = tournament.id
   and competition.game_key in ('last_man_standing', 'predictor_cup')
   and competition.visibility_kind = 'public'
   and competition.completed_at is null
  join public.matches match
    on match.tournament_id = tournament.id
  where tournament.name = 'UEFA Euro 2028'
)
insert into public.bonus_window_fixtures (window_id, match_id)
select competition_window.id, mapped.match_id
from mapped_matches mapped
join public.bonus_competition_windows competition_window
  on competition_window.competition_id = mapped.competition_id
 and competition_window.sequence = mapped.window_sequence
where mapped.window_sequence is not null
on conflict (window_id, match_id) do nothing;

insert into public.bonus_competition_audit (competition_id, action, detail)
select
  competition.id,
  'catalogue_published',
  jsonb_build_object(
    'source', 'scripts/bonus-games/publish-catalogue.sql',
    'registration_open', false
  )
from public.tournaments tournament
join public.bonus_competitions competition
  on competition.tournament_id = tournament.id
 and competition.visibility_kind = 'public'
 and competition.completed_at is null
where tournament.name = 'UEFA Euro 2028'
  and competition.game_key in ('ko_predictor', 'last_man_standing', 'predictor_cup')
  and not exists (
    select 1
    from public.bonus_competition_audit audit
    where audit.competition_id = competition.id
      and audit.action = 'catalogue_published'
  );

do $$
declare
  v_competitions integer;
  v_windows integer;
  v_fixtures integer;
begin
  select count(*)
    into v_competitions
    from public.bonus_competitions competition
    join public.tournaments tournament on tournament.id = competition.tournament_id
    where tournament.name = 'UEFA Euro 2028'
      and competition.game_key in ('ko_predictor', 'last_man_standing', 'predictor_cup')
      and competition.visibility_kind = 'public'
      and competition.completed_at is null
      and competition.published;

  select count(*)
    into v_windows
    from public.bonus_competition_windows competition_window
    join public.bonus_competitions competition
      on competition.id = competition_window.competition_id
    join public.tournaments tournament
      on tournament.id = competition.tournament_id
    where tournament.name = 'UEFA Euro 2028'
      and competition.game_key in ('last_man_standing', 'predictor_cup')
      and competition.visibility_kind = 'public'
      and competition.completed_at is null;

  select count(*)
    into v_fixtures
    from public.bonus_window_fixtures fixture
    join public.bonus_competition_windows competition_window
      on competition_window.id = fixture.window_id
    join public.bonus_competitions competition
      on competition.id = competition_window.competition_id
    join public.tournaments tournament
      on tournament.id = competition.tournament_id
    where tournament.name = 'UEFA Euro 2028'
      and competition.game_key in ('last_man_standing', 'predictor_cup')
      and competition.visibility_kind = 'public'
      and competition.completed_at is null;

  if v_competitions <> 3 or v_windows <> 14 or v_fixtures <> 102 then
    raise exception 'Unexpected Bonus Games catalogue shape: competitions %, windows %, fixtures %',
      v_competitions, v_windows, v_fixtures;
  end if;
end;
$$;

commit;
