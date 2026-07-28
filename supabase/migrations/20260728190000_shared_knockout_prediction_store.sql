-- Euro 2028 Predictor — shared knockout prediction store
--
-- Contract 51 (ADR-0010, stage B4). Raw per-match knockout scoreline
-- predictions are collected ONCE — per-kickoff locks — and later read by both
-- the KO Predictor and the Predictor Cup, each scoring them under its own
-- rules into its own score events (competition-structure §1, decided
-- 2026-07-22). Users never predict the same real match twice.
--
-- Shape per prediction (KO Predictor rules, decided 2026-07-22): a
-- regulation-time scoreline plus a "who goes through?" pick required ONLY
-- when a draw is predicted — a decisive scoreline implies the advancing team,
-- so a stored pick alongside one is refused rather than silently ignored.
--
-- Boundaries:
--   - deny-all RLS; the three RPCs below are the only browser paths;
--   - writes require entry in a competition that reads the store
--     (KO Predictor or Predictor Cup) for the match's tournament;
--   - the per-kickoff lock is enforced in the database, both in the RPCs and
--     in a table trigger, and an unscheduled kickoff fails closed;
--   - optimistic versions guard every save and delete (errcode PT409, as for
--     Original Predictor writes) — this store never touches entries,
--     match_predictions or any Original Predictor table.

begin;

create table public.bonus_knockout_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_score smallint not null check (home_score between 0 and 20),
  away_score smallint not null check (away_score between 0 and 20),
  -- Present exactly when a draw is predicted; implied by a decisive scoreline.
  advancing_team_id uuid references public.teams(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id),
  constraint bonus_knockout_predictions_through_shape check (
    (home_score = away_score) = (advancing_team_id is not null)
  )
);

create index bonus_knockout_predictions_match_idx
  on public.bonus_knockout_predictions (match_id);

-- Database-level depth behind the RPCs: knockout matches only, a scheduled
-- kickoff that has not passed, and an advancing pick that names one of the
-- match's two known teams.
create or replace function predictor_internal.assert_bonus_knockout_prediction_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round text;
  v_kickoff timestamptz;
  v_home_team uuid;
  v_away_team uuid;
begin
  select m.round, m.kickoff_at, m.home_team_id, m.away_team_id
    into v_round, v_kickoff, v_home_team, v_away_team
    from public.matches m
    where m.id = new.match_id;

  if v_round is null or v_round = 'group' then
    raise exception 'The shared prediction store holds knockout matches only'
      using errcode = 'check_violation';
  end if;

  if v_kickoff is null then
    raise exception 'This match has no scheduled kickoff yet'
      using errcode = 'check_violation';
  end if;

  if now() >= v_kickoff then
    raise exception 'This prediction is locked — the match has kicked off'
      using errcode = 'check_violation';
  end if;

  if new.advancing_team_id is not null then
    if v_home_team is null or v_away_team is null then
      raise exception 'An advancing pick needs both teams to be known'
        using errcode = 'check_violation';
    end if;
    if new.advancing_team_id not in (v_home_team, v_away_team) then
      raise exception 'The advancing pick must be one of the two teams in the match'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger assert_bonus_knockout_prediction_shape
before insert or update on public.bonus_knockout_predictions
for each row
execute function predictor_internal.assert_bonus_knockout_prediction_shape();

alter table public.bonus_knockout_predictions enable row level security;

revoke all on table public.bonus_knockout_predictions
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.assert_bonus_knockout_prediction_shape()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.save_knockout_prediction(
  p_match_id uuid,
  p_home smallint,
  p_away smallint,
  p_advancing_team_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_match_tournament uuid;
  v_round text;
  v_kickoff timestamptz;
  v_row_id uuid;
  v_stored_version integer;
  v_new_version integer;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select m.tournament_id, m.round, m.kickoff_at
    into v_match_tournament, v_round, v_kickoff
    from public.matches m
    where m.id = p_match_id;

  if v_match_tournament is null then
    raise exception 'Match not found'
      using errcode = 'no_data_found';
  end if;

  if v_round = 'group' then
    raise exception 'The shared prediction store holds knockout matches only'
      using errcode = 'check_violation';
  end if;

  if v_kickoff is null then
    raise exception 'This match has no scheduled kickoff yet'
      using errcode = 'check_violation';
  end if;

  if now() >= v_kickoff then
    raise exception 'This prediction is locked — the match has kicked off'
      using errcode = 'check_violation';
  end if;

  -- Only entrants of a store-reading game may write (voluntary entry stays
  -- the boundary; spectators can browse the hub but not predict).
  if not exists (
    select 1
    from public.bonus_competition_entrants entrant
    join public.bonus_competitions competition
      on competition.id = entrant.competition_id
    where entrant.user_id = v_uid
      and competition.tournament_id = v_match_tournament
      and competition.game_key in ('ko_predictor', 'predictor_cup')
  ) then
    raise exception 'Enter the KO Predictor or Predictor Cup to make knockout predictions'
      using errcode = 'insufficient_privilege';
  end if;

  if p_home is null or p_away is null then
    raise exception 'A complete scoreline is required'
      using errcode = 'check_violation';
  end if;

  if p_home <> p_away and p_advancing_team_id is not null then
    raise exception 'A decisive scoreline implies the advancing team — no pick is stored'
      using errcode = 'check_violation';
  end if;

  if p_home = p_away and p_advancing_team_id is null then
    raise exception 'A predicted draw needs a "who goes through?" pick'
      using errcode = 'check_violation';
  end if;

  select prediction.id, prediction.version
    into v_row_id, v_stored_version
    from public.bonus_knockout_predictions prediction
    where prediction.user_id = v_uid
      and prediction.match_id = p_match_id
    for update;

  if v_row_id is null then
    if p_expected_version is not null and p_expected_version <> 0 then
      raise exception 'knockout prediction version conflict (expected %, stored none)',
        p_expected_version
        using errcode = 'PT409';
    end if;

    insert into public.bonus_knockout_predictions (
      user_id, match_id, home_score, away_score, advancing_team_id
    ) values (
      v_uid, p_match_id, p_home, p_away, p_advancing_team_id
    );
    v_new_version := 0;
  else
    if p_expected_version is null
      or p_expected_version is distinct from v_stored_version then
      raise exception 'knockout prediction version conflict (expected %, stored %)',
        p_expected_version, v_stored_version
        using errcode = 'PT409';
    end if;

    update public.bonus_knockout_predictions prediction
      set home_score = p_home,
          away_score = p_away,
          advancing_team_id = p_advancing_team_id,
          version = v_stored_version + 1,
          updated_at = now()
      where prediction.id = v_row_id;
    v_new_version := v_stored_version + 1;
  end if;

  return jsonb_build_object(
    'match_id', p_match_id,
    'version', v_new_version
  );
end;
$$;

create or replace function public.delete_knockout_prediction(
  p_match_id uuid,
  p_expected_version integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_kickoff timestamptz;
  v_row_id uuid;
  v_stored_version integer;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select m.kickoff_at
    into v_kickoff
    from public.matches m
    where m.id = p_match_id;

  if not found then
    raise exception 'Match not found'
      using errcode = 'no_data_found';
  end if;

  if v_kickoff is not null and now() >= v_kickoff then
    raise exception 'This prediction is locked — the match has kicked off'
      using errcode = 'check_violation';
  end if;

  select prediction.id, prediction.version
    into v_row_id, v_stored_version
    from public.bonus_knockout_predictions prediction
    where prediction.user_id = v_uid
      and prediction.match_id = p_match_id
    for update;

  -- Clearing is idempotent when the row is already absent.
  if v_row_id is null then
    return false;
  end if;

  if p_expected_version is null
    or p_expected_version is distinct from v_stored_version then
    raise exception 'knockout prediction version conflict (expected %, stored %)',
      p_expected_version, v_stored_version
      using errcode = 'PT409';
  end if;

  delete from public.bonus_knockout_predictions prediction
  where prediction.id = v_row_id;

  return true;
end;
$$;

create or replace function public.get_my_knockout_predictions(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.tournaments tournament
    where tournament.id = p_tournament_id
  ) then
    raise exception 'Tournament not found'
      using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'store_entrant', exists (
      select 1
      from public.bonus_competition_entrants entrant
      join public.bonus_competitions competition
        on competition.id = entrant.competition_id
      where entrant.user_id = v_uid
        and competition.tournament_id = p_tournament_id
        and competition.game_key in ('ko_predictor', 'predictor_cup')
    ),
    'predictions', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'match_id', bounded.match_id,
            'home_score', bounded.home_score,
            'away_score', bounded.away_score,
            'advancing_team_id', bounded.advancing_team_id,
            'version', bounded.version
          )
          order by bounded.match_ref, bounded.match_id
        )
        from (
          select
            prediction.match_id,
            prediction.home_score,
            prediction.away_score,
            prediction.advancing_team_id,
            prediction.version,
            match.match_ref
          from public.bonus_knockout_predictions prediction
          join public.matches match on match.id = prediction.match_id
          where prediction.user_id = v_uid
            and match.tournament_id = p_tournament_id
          order by match.match_ref, prediction.match_id
          limit 20
        ) bounded
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.save_knockout_prediction(uuid, smallint, smallint, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_knockout_prediction(uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.get_my_knockout_predictions(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.save_knockout_prediction(uuid, smallint, smallint, uuid, integer)
  to authenticated, service_role;
grant execute on function public.delete_knockout_prediction(uuid, integer)
  to authenticated, service_role;
grant execute on function public.get_my_knockout_predictions(uuid)
  to authenticated, service_role;

commit;
