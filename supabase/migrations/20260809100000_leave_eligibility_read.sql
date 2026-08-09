-- Contract 140: a Leave control that can predict itself.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT
-- ---------------------------------------------------------------------------
--
-- `MASTER-TODO.md` Stage F has carried this since the registration surface
-- landed: "Leaving is offered but cannot be predicted — `leave_competition_game`
-- refuses once a `bonus_score_events` row exists for the caller and no browser
-- read exposes that fact, so an honest 'can I leave?' control still needs a
-- read."
--
-- Measured on this commit, that is still exactly true. `get_competition_games`
-- returns the registration window, `completed_at`, the draw state and the
-- caller's own entrant row — everything the JOIN decision needs, and nothing the
-- LEAVE decision needs beyond `completed_at`. So the dashboard has two bad
-- options: render a control the server will refuse, or hide one that would have
-- worked.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A SECOND READ, HAVING FIRST TRIED TO WIDEN THE EXISTING ONE
-- ---------------------------------------------------------------------------
--
-- Widening `get_competition_games` is the better shape on paper. It is the same
-- competition rows, for the same caller, answering a question the same consumer
-- already asks two thirds of — `decideGameMembership` resolves join, rejoin and
-- leave together — and a second read means two round trips that must agree
-- about one competition.
--
-- It was written that way first and then withdrawn, for a reason worth
-- recording rather than hiding. `get_competition_games` is a large function
-- whose body nests fixtures inside windows inside competitions, and
-- `create or replace` requires restating the WHOLE body. The first draft of this
-- contract restated it from a partial reading and silently dropped the nested
-- fixtures array — a regression that no guard here would have caught, because
-- every one of them checks the signature, the grant and the gate rather than the
-- payload.
--
-- The general lesson is the one this repository already applies to migrations:
-- do not rewrite what you have not read in full. The specific consequence is
-- this function, which adds a fact and cannot remove one.

begin;

-- ---------------------------------------------------------------------------
-- Why the write would refuse.
--
-- Every branch is the same condition `leave_competition_game` raises on, in the
-- same order, reading the same relations. That duplication is real and is the
-- lesser cost: the alternative is a client that guesses. What makes it safe is
-- that the WRITE remains the authority — this can only be wrong about a refusal
-- the server would still enforce, never permissive about one it would not.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.leave_game_refusal(
  p_game_competition_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $refusal$
declare
  v_availability record;
  v_requires_entry boolean;
  v_membership record;
begin
  select availability.id, availability.game_key, availability.completed_at
    into v_availability
    from public.bonus_competitions availability
   where availability.id = p_game_competition_id;

  if not found then
    return 'not_found';
  end if;

  select definition.requires_prediction_entry
    into v_requires_entry
    from public.game_definitions definition
   where definition.game_key = v_availability.game_key;

  select membership.id, membership.status
    into v_membership
    from public.game_memberships membership
   where membership.game_competition_id = p_game_competition_id
     and membership.user_id = p_user_id;

  if not found or v_membership.status <> 'active' then
    return 'not_entered';
  end if;

  if v_availability.completed_at is not null then
    return 'game_finished';
  end if;

  -- A game that requires a prediction entry has no further guard: leaving it is
  -- ordinary, and the write branches the same way.
  if not coalesce(v_requires_entry, false) then
    if exists (
      select 1 from public.bonus_score_events event
       where event.competition_id = p_game_competition_id
         and event.user_id = p_user_id
    ) then
      return 'scoring_started';
    end if;

    if v_availability.game_key = 'predictor_cup'
       and exists (
         select 1 from public.bonus_cup_members member
          where member.competition_id = p_game_competition_id
            and member.user_id = p_user_id
       ) then
      return 'draw_completed';
    end if;
  end if;

  return null;
end;
$refusal$;

revoke all on function predictor_internal.leave_game_refusal(uuid, uuid)
  from public, anon, authenticated, service_role;

comment on function predictor_internal.leave_game_refusal(uuid, uuid) is
  'Contract 140. Why leave_competition_game would refuse this caller, or null '
  'if it would not. Mirrors the write; the write remains the authority.';

-- ---------------------------------------------------------------------------
-- The caller's own answer, for every live game in one competition season.
--
-- Keyed by the same `id` `get_competition_games` returns, so a consumer joins
-- the two by competition id without inventing a key. It discloses nothing about
-- anyone else: every branch is scoped to `auth.uid()`.
-- ---------------------------------------------------------------------------

create or replace function public.get_game_leave_eligibility(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $eligibility$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.tournaments season where season.id = p_tournament_id
  ) then
    raise exception 'Tournament not found' using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'games', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', competition.id,
          'game_key', competition.game_key,
          -- `reason` is null exactly when `allowed` is true, so a surface needs
          -- one vocabulary rather than two.
          'allowed', predictor_internal.leave_game_refusal(competition.id, v_uid) is null,
          'reason', predictor_internal.leave_game_refusal(competition.id, v_uid)
        )
        order by competition.game_key)
        from public.bonus_competitions competition
       where competition.tournament_id = p_tournament_id
         and competition.id = predictor_internal.live_competition_id(
               p_tournament_id, competition.game_key)),
      '[]'::jsonb));
end;
$eligibility$;

revoke all on function public.get_game_leave_eligibility(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_game_leave_eligibility(uuid) to authenticated;

do $$
begin
  if predictor_internal.leave_game_refusal(
       '00000000-0000-0000-0000-000000000000'::uuid,
       '00000000-0000-0000-0000-000000000000'::uuid) is distinct from 'not_found'
  then
    raise exception 'the refusal reader must report a missing competition rather than raise';
  end if;
end;
$$;

commit;
