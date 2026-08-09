-- Contract 141: recent form and head-to-head, derived from football we already
-- hold.
--
-- ---------------------------------------------------------------------------
-- WHY NOW, AND WHY NOT FROM A PROVIDER
-- ---------------------------------------------------------------------------
--
-- `provider-enrichment-plan.md` § E is explicit about this class: recent form,
-- head-to-head history and goals-for/against trends should be DERIVED from our
-- own canonical results rather than requested, because "this reduces provider
-- coupling and makes historical displays reproducible".
--
-- It could not be built until today. Measured a few hours ago, every one of the
-- 578 `season_fixtures` rows was `status = 'scheduled'` and not one had a score,
-- because nothing in the repository could write one. Contract 135 changed that:
-- a provider final status now writes the official result, and Development
-- already holds results written that way. So the input to this derivation exists
-- for the first time.
--
-- It costs no provider request, needs no subscription, raises no licensing
-- question, and cannot go stale relative to the platform's own truth — because
-- it IS the platform's own truth, read back.
--
-- ---------------------------------------------------------------------------
-- WHAT IT IS NOT
-- ---------------------------------------------------------------------------
--
-- It is football about CLUBS, not about players. `get_season_head_to_head`
-- (contract 129) compares two entrants' predictions and has a reveal boundary
-- built on the matchweek lock. This has neither: a played match is public
-- football, the same for everybody, and nothing here reads a prediction, an
-- entry or a score event.
--
-- It is also not a league table. A league table carries competition rules —
-- deductions, tie-break order, promotion boundaries — that belong to the
-- competition and not to a derivation. This answers "how has this club been
-- doing" and "what happened last time these two met", which are facts.
--
-- Only `status = 'played'` counts. A postponed or abandoned fixture contributes
-- nothing rather than a nil-nil.

begin;

-- ---------------------------------------------------------------------------
-- One club's completed matches, most recent first.
--
-- Internal, and shared by both public reads below so the two cannot disagree
-- about what a result was. Returns the club's own perspective — `for` and
-- `against` rather than home and away — because that is what form means.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_club_results(
  p_tournament_id uuid,
  p_team_id uuid
)
returns table (
  season_fixture_id uuid,
  kickoff_at timestamptz,
  competition_round_id uuid,
  opponent_id uuid,
  at_home boolean,
  goals_for smallint,
  goals_against smallint,
  outcome text
)
language sql
stable
security definer
set search_path = ''
as $results$
  select
    fixture.id,
    fixture.kickoff_at,
    fixture.competition_round_id,
    case when fixture.home_team_id = p_team_id
         then fixture.away_team_id else fixture.home_team_id end,
    fixture.home_team_id = p_team_id,
    case when fixture.home_team_id = p_team_id
         then fixture.home_score else fixture.away_score end,
    case when fixture.home_team_id = p_team_id
         then fixture.away_score else fixture.home_score end,
    case
      when (case when fixture.home_team_id = p_team_id
                 then fixture.home_score else fixture.away_score end)
         > (case when fixture.home_team_id = p_team_id
                 then fixture.away_score else fixture.home_score end) then 'W'
      when (case when fixture.home_team_id = p_team_id
                 then fixture.home_score else fixture.away_score end)
         < (case when fixture.home_team_id = p_team_id
                 then fixture.away_score else fixture.home_score end) then 'L'
      else 'D'
    end
  from public.season_fixtures fixture
  where fixture.tournament_id = p_tournament_id
    and fixture.status = 'played'
    and fixture.home_score is not null
    and fixture.away_score is not null
    and (fixture.home_team_id = p_team_id or fixture.away_team_id = p_team_id)
  order by fixture.kickoff_at desc nulls last, fixture.id desc;
$results$;

revoke all on function predictor_internal.season_club_results(uuid, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Every club's recent form in one season.
--
-- A club with no completed matches appears with an empty sequence rather than
-- being absent, because "no form yet" is a true answer and a missing row would
-- read as a missing club.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_club_form(
  p_tournament_id uuid,
  p_matches integer default 6
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $form$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer := least(greatest(coalesce(p_matches, 6), 1), 20);
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.tournaments season
     where season.id = p_tournament_id and season.kind = 'league_season'
  ) then
    raise exception 'That competition is not a league season' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'matches', v_limit,
    'clubs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'team_id', team.id,
          'name', team.name,
          'short_code', identity.short_code,
          'club_colours', identity.club_colours,
          'played', coalesce(recent.played, 0),
          'won', coalesce(recent.won, 0),
          'drawn', coalesce(recent.drawn, 0),
          'lost', coalesce(recent.lost, 0),
          'goals_for', coalesce(recent.goals_for, 0),
          'goals_against', coalesce(recent.goals_against, 0),
          -- Most recent first, which is how a form string is read.
          'form', coalesce(recent.form, '[]'::jsonb))
        order by team.name)
        from public.teams team
        left join predictor_internal.club_identity_reference identity
          on identity.normalised_name
           = predictor_internal.normalised_club_name(team.name)
        left join lateral (
          select
            count(*)::integer as played,
            count(*) filter (where result.outcome = 'W')::integer as won,
            count(*) filter (where result.outcome = 'D')::integer as drawn,
            count(*) filter (where result.outcome = 'L')::integer as lost,
            coalesce(sum(result.goals_for), 0)::integer as goals_for,
            coalesce(sum(result.goals_against), 0)::integer as goals_against,
            jsonb_agg(result.outcome order by result.kickoff_at desc nulls last) as form
          from (
            select * from predictor_internal.season_club_results(p_tournament_id, team.id)
            limit v_limit
          ) result
        ) recent on true
       where team.tournament_id = p_tournament_id),
      '[]'::jsonb));
end;
$form$;

revoke all on function public.get_season_club_form(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_season_club_form(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- What happened when these two last met, in this season.
--
-- Scoped to the season on purpose. Carrying meetings from previous seasons
-- would need a competition-lineage decision this contract has no authority to
-- make, and the fixtures of an earlier season may not even be held.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_club_head_to_head(
  p_tournament_id uuid,
  p_team_id uuid,
  p_opponent_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $h2h$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_team_id is null or p_opponent_id is null or p_team_id = p_opponent_id then
    raise exception 'Two different clubs are required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.teams team
     where team.tournament_id = p_tournament_id and team.id = p_team_id
  ) or not exists (
    select 1 from public.teams team
     where team.tournament_id = p_tournament_id and team.id = p_opponent_id
  ) then
    raise exception 'Both clubs must belong to that competition season'
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'team', (select jsonb_build_object('team_id', team.id, 'name', team.name)
               from public.teams team where team.id = p_team_id),
    'opponent', (select jsonb_build_object('team_id', team.id, 'name', team.name)
                   from public.teams team where team.id = p_opponent_id),
    'summary', (
      select jsonb_build_object(
        'played', count(*)::integer,
        'won', count(*) filter (where result.outcome = 'W')::integer,
        'drawn', count(*) filter (where result.outcome = 'D')::integer,
        'lost', count(*) filter (where result.outcome = 'L')::integer,
        'goals_for', coalesce(sum(result.goals_for), 0)::integer,
        'goals_against', coalesce(sum(result.goals_against), 0)::integer)
      from predictor_internal.season_club_results(p_tournament_id, p_team_id) result
      where result.opponent_id = p_opponent_id),
    'meetings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'season_fixture_id', result.season_fixture_id,
          'kickoff_at', result.kickoff_at,
          'at_home', result.at_home,
          'goals_for', result.goals_for,
          'goals_against', result.goals_against,
          'outcome', result.outcome,
          'round', round.label)
        order by result.kickoff_at desc nulls last)
      from predictor_internal.season_club_results(p_tournament_id, p_team_id) result
      join public.competition_rounds round on round.id = result.competition_round_id
      where result.opponent_id = p_opponent_id),
      '[]'::jsonb));
end;
$h2h$;

revoke all on function public.get_season_club_head_to_head(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_season_club_head_to_head(uuid, uuid, uuid)
  to authenticated;

do $$
begin
  -- Neither read may reach a prediction, an entry or a score event: this is
  -- football about clubs, and the moment it reads a player it needs a reveal
  -- boundary it does not have.
  if exists (
    select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'predictor_internal')
       and p.proname in ('get_season_club_form', 'get_season_club_head_to_head',
                         'season_club_results')
       and pg_catalog.pg_get_functiondef(p.oid)
             ~* '(season_predictions|match_predictions|entry_totals|bonus_score_events|season_matchweek_scores)'
  ) then
    raise exception 'the club form reads must disclose nothing about any player';
  end if;
end;
$$;

commit;
