-- ---------------------------------------------------------------------------
-- Contract 165 — what a private Last Man Standing organiser can see.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED
-- ---------------------------------------------------------------------------
--
-- Contract 153 gave a private Last Man Standing an owner, a name, an invite
-- code and a join. `bonus_competitions.owner_id` is set, `create_private_season_lms`
-- returns the code, and `join_private_competition` admits a holder of it.
--
-- Measured against every migration: **no read anywhere is owner-scoped.** An
-- organiser cannot see who has joined the competition they created, cannot see
-- whether an invitation has been taken up, and cannot see how close they are to
-- any limit. Contract 164 gives an ENTRANT the field, but an organiser who has
-- not entered their own competition is not an entrant — and an organiser who
-- has entered sees the field under the round-lock reveal, which is a player's
-- view of a competition rather than an organiser's view of it.
--
-- The two are genuinely different questions. A player asks "who am I playing
-- against and what did they pick"; an organiser asks "has everyone I invited
-- actually joined, and is anyone about to miss the round".
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DELIBERATELY DOES NOT ADD
-- ---------------------------------------------------------------------------
--
-- **No organiser COMMAND of any kind, and specifically nothing that acts for a
-- managed entrant.** The authorising task asks for audited organiser commands
-- *if the product permits it*, and adds: "Do not invent organiser powers that
-- have not been accepted by the existing product authority documents."
--
-- Measured rather than assumed. ADR 0013 governs Last Man Standing and gives
-- the organiser the SETUP — lives, saves, the draws rule, the endgame scope —
-- fixed at creation by `create_private_season_lms`. Neither it, nor ADR 0020,
-- nor `docs/quality/accepted-requirements.md`, nor the UI finalisation
-- direction contains any accepted requirement for an organiser to act on
-- another player's behalf: to make, change or clear their pick, to remove them,
-- or to hold a "managed entrant" who is not a real account. `MIG-UI-05`, the
-- row that produced contract 153, asks for "create, invite and join" and
-- nothing further.
--
-- An organiser command that alters another player's competitive position is a
-- product decision with real consequences — it is the power to eliminate
-- somebody — and a migration is the wrong place to take it. So this contract
-- adds reads only, and the gap is recorded in the register rather than filled
-- by inference.
--
-- **It also discloses no pick.** An organiser is not thereby entitled to see
-- what an entrant chose before the round locks: owning the competition is not a
-- reveal exemption, and one built in here would be the exemption everything
-- else in this repository is written to avoid. Contract 164's boundary stands
-- for the organiser exactly as it stands for everyone, and this read simply
-- does not answer that question at all.
--
-- Additive: two new reads and nothing else.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Is the caller the organiser?
-- ===========================================================================
--
-- Internal, so ownership has one definition. Ownership rather than
-- administration: this is the person who created the competition, not a
-- platform administrator, and `require_competition_admin` is deliberately not
-- consulted — an organiser's reach is their own container and no further.

create or replace function predictor_internal.owns_private_competition(
  p_competition_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $owns$
  select exists (
    select 1 from public.bonus_competitions competition
     where competition.id = p_competition_id
       and competition.owner_id = p_user_id
       -- Private only. A public competition has no organiser in this sense: it
       -- belongs to the platform, and its entrant list is not one person's to
       -- read.
       and competition.visibility_kind = 'private');
$owns$;

revoke all on function predictor_internal.owns_private_competition(uuid, uuid)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 2. The organiser's competition
-- ===========================================================================
--
-- One competition, addressed by its own id, answering only for its owner.
-- Refuses identically for a competition that is not yours and one that does not
-- exist — contract 158's idiom, and for its reason: distinguishing them turns
-- the function into a probe for which competition ids are real.

create or replace function public.get_my_organised_competition(p_competition_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $organised$
declare
  v_uid uuid := (select auth.uid());
  v_competition record;
  v_setup record;
  v_current record;
  v_entrants jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if not predictor_internal.owns_private_competition(p_competition_id, v_uid) then
    -- Identical for "not yours" and "does not exist".
    raise exception 'No such competition' using errcode = 'no_data_found';
  end if;

  select competition.id, competition.name, competition.game_key,
         competition.tournament_id, competition.invite_code,
         competition.published, competition.availability_status,
         competition.registration_opens_at, competition.registration_closes_at,
         competition.completed_at, competition.created_at,
         season.name as season_name, season.season_key
    into v_competition
    from public.bonus_competitions competition
    join public.tournaments season on season.id = competition.tournament_id
   where competition.id = p_competition_id;

  select setup.lives, setup.saves, setup.draws_rule,
         setup.endgame_scope, setup.endgame_on_wipeout
    into v_setup
    from public.season_lms_setups setup
   where setup.competition_id = p_competition_id;

  -- The round in play, for the one organiser question that is time-sensitive:
  -- how many have not yet picked. That is a COUNT and never a list of who,
  -- because who has not picked is the complement of who has, and contract 164
  -- withholds the second before the lock for a reason that does not stop
  -- applying because the reader owns the competition.
  select window_row.id, window_row.sequence, window_row.label,
         window_row.opens_at, window_row.locks_at,
         window_row.locks_at is not null and window_row.locks_at <= now() as locked
    into v_current
    from public.bonus_competition_windows window_row
   where window_row.id = predictor_internal.season_lms_current_window(
           p_competition_id, now());

  select coalesce(jsonb_agg(entry order by entry ->> 'display_name'), '[]'::jsonb)
    into v_entrants
    from (
      select jsonb_build_object(
               'user_id', entrant.user_id,
               'display_name', coalesce(player.display_name, 'Player'),
               'is_me', entrant.user_id = v_uid,
               'joined_at', entrant.joined_at,
               -- The settlement authority's own word.
               'outcome', entrant.outcome,
               'still_in', entrant.outcome <> 'eliminated',
               'lives_remaining', state.lives_remaining,
               'saves_remaining', state.saves_remaining,
               -- Membership state, so an organiser can tell someone who LEFT
               -- from someone who was never there.
               'membership_status', membership.status,
               'left_at', membership.left_at,
               -- WHETHER they have picked in the round in play, and never WHAT.
               -- This is the one fact an organiser needs that a player does
               -- not, because chasing an entrant who has not picked is the
               -- organiser's job; the club they chose is still nobody's
               -- business until the round locks.
               'has_picked_current_round',
                 case when v_current.id is null then null
                      else exists (
                        select 1 from public.bonus_lms_selections pick
                         where pick.competition_id = p_competition_id
                           and pick.user_id = entrant.user_id
                           and pick.window_id = v_current.id)
                 end
             ) as entry
        from public.bonus_competition_entrants entrant
        left join public.profiles player on player.id = entrant.user_id
        left join public.season_lms_entrant_state state
               on state.competition_id = entrant.competition_id
              and state.user_id = entrant.user_id
        left join public.game_memberships membership
               on membership.game_competition_id = entrant.competition_id
              and membership.user_id = entrant.user_id
       where entrant.competition_id = p_competition_id
    ) rows;

  return jsonb_build_object(
    'competition', jsonb_build_object(
      'id', v_competition.id,
      'name', v_competition.name,
      'game_key', v_competition.game_key,
      'season_name', v_competition.season_name,
      'season_key', v_competition.season_key,
      -- The organiser's OWN invite code, which is theirs to re-share. Contract
      -- 158 narrowed what a code discloses to a guesser; it never restricted
      -- what an owner may see about their own container.
      'invite_code', v_competition.invite_code,
      'published', v_competition.published,
      'availability_status', v_competition.availability_status,
      'registration_opens_at', v_competition.registration_opens_at,
      'registration_closes_at', v_competition.registration_closes_at,
      'completed_at', v_competition.completed_at,
      'created_at', v_competition.created_at),
    'setup', case when v_setup.lives is null then null else jsonb_build_object(
      'lives', v_setup.lives,
      'saves', v_setup.saves,
      'draws_rule', v_setup.draws_rule,
      'endgame_scope', v_setup.endgame_scope,
      'endgame_on_wipeout', v_setup.endgame_on_wipeout)
    end,
    'current_round', case when v_current.id is null then null else jsonb_build_object(
      'window_id', v_current.id,
      'sequence', v_current.sequence,
      'label', v_current.label,
      'opens_at', v_current.opens_at,
      'locks_at', v_current.locks_at,
      'locked', v_current.locked)
    end,
    'counts', jsonb_build_object(
      'entrants', (select count(*)::integer from public.bonus_competition_entrants e
                    where e.competition_id = p_competition_id),
      'remaining', (select count(*)::integer from public.bonus_competition_entrants e
                     where e.competition_id = p_competition_id and e.outcome <> 'eliminated'),
      'eliminated', (select count(*)::integer from public.bonus_competition_entrants e
                      where e.competition_id = p_competition_id and e.outcome = 'eliminated'),
      'left', (select count(*)::integer from public.game_memberships m
                where m.game_competition_id = p_competition_id and m.status = 'left'),
      -- The chase list's SIZE. Named `awaiting_pick` rather than `not_picked`
      -- because it is only meaningful while the round is open.
      'awaiting_pick', case when v_current.id is null then null else (
        select count(*)::integer
          from public.bonus_competition_entrants e
         where e.competition_id = p_competition_id
           and e.outcome <> 'eliminated'
           and not exists (
             select 1 from public.bonus_lms_selections s
              where s.competition_id = p_competition_id
                and s.user_id = e.user_id
                and s.window_id = v_current.id))
        end),
    'entrants', v_entrants,
    -- STATED IN THE PAYLOAD, because a surface that renders an organiser panel
    -- needs to know the difference between "no control here yet" and "the
    -- control failed". No accepted authority grants an organiser power over
    -- another entrant's pick, so no such command exists to call.
    'organiser_commands_available', '[]'::jsonb);
end;
$organised$;

revoke all on function public.get_my_organised_competition(uuid) from public, anon;
grant execute on function public.get_my_organised_competition(uuid) to authenticated;

-- ===========================================================================
-- 3. Everything the caller organises
-- ===========================================================================
--
-- The list a "your competitions" surface needs, so an organiser does not have
-- to already know the id of the thing they created. Bounded and totally
-- ordered, for issue #129's reason.

create or replace function public.get_my_organised_competitions(
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $mine$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer;
  v_offset integer;
  v_total integer;
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*)::integer into v_total
    from public.bonus_competitions competition
   where competition.owner_id = v_uid
     and competition.visibility_kind = 'private';

  select coalesce(jsonb_agg(page.entry order by page.ordinal), '[]'::jsonb)
    into v_rows
    from (
      select row_number() over (
               order by competition.created_at desc, competition.id desc
             ) as ordinal,
             jsonb_build_object(
               'competition_id', competition.id,
               'name', competition.name,
               'game_key', competition.game_key,
               'game_name', definition.display_name,
               'tournament_id', competition.tournament_id,
               'season_name', season.name,
               'season_key', season.season_key,
               'created_at', competition.created_at,
               'completed_at', competition.completed_at,
               'registration_closes_at', competition.registration_closes_at,
               'entrants', (select count(*)::integer
                              from public.bonus_competition_entrants e
                             where e.competition_id = competition.id)
             ) as entry
        from public.bonus_competitions competition
        join public.tournaments season on season.id = competition.tournament_id
        left join public.game_definitions definition
               on definition.game_key = competition.game_key
       where competition.owner_id = v_uid
         and competition.visibility_kind = 'private'
       order by competition.created_at desc, competition.id desc
       limit v_limit offset v_offset
    ) page;

  return jsonb_build_object(
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'has_more', v_offset + v_limit < v_total,
    'competitions', v_rows);
end;
$mine$;

revoke all on function public.get_my_organised_competitions(integer, integer) from public, anon;
grant execute on function public.get_my_organised_competitions(integer, integer) to authenticated;

-- ===========================================================================
-- 4. Prove the boundaries, in the same transaction
-- ===========================================================================

do $$
declare
  v_one text := pg_get_functiondef('public.get_my_organised_competition(uuid)'::regprocedure);
  v_many text := pg_get_functiondef(
    'public.get_my_organised_competitions(integer,integer)'::regprocedure);
begin
  -- THE BOUNDARY THIS CONTRACT RESTS ON. An organiser sees THAT an entrant has
  -- picked and never WHAT. Owning a competition is not a reveal exemption, and
  -- one built in here would be the exemption every other contract avoids.
  --
  -- Asserted on what the function REFERENCES rather than on what its prose
  -- mentions. An earlier spelling matched the bare word `club` and refused its
  -- own migration on a comment — the same mistake contract 159's `display_name`
  -- assertion made, and the reason both are recorded rather than quietly fixed.
  -- A selection can only be disclosed by reading the column or joining the club
  -- table, so those are what is forbidden.
  if v_one ~* '\.team_id|public\.teams' then
    raise exception 'An organiser read must disclose no selection';
  end if;

  -- It reads and writes nothing at all.
  if (v_one || v_many) ~* 'insert[[:space:]]+into|update[[:space:]]+public\.|delete[[:space:]]+from' then
    raise exception 'These are reads; an organiser command needs its own accepted authority';
  end if;

  -- Ownership, not administration. An organiser's reach is their own container.
  if v_one !~ 'owns_private_competition' or v_one ~ 'require_competition_admin' then
    raise exception 'The organiser read must gate on ownership rather than administration';
  end if;

  if v_many !~ 'owner_id' or v_many !~ 'visibility_kind' then
    raise exception 'The organiser list must be scoped to the caller''s own private containers';
  end if;

  -- Both are the caller's, and neither takes a player argument.
  if (v_one || v_many) ~* 'p_user_id|p_owner_id' then
    raise exception 'An organiser read must take no player argument';
  end if;

  if v_one !~ 'auth\.uid\(\)' or v_many !~ 'auth\.uid\(\)' then
    raise exception 'Both reads must resolve the caller from auth.uid()';
  end if;

  -- The list is bounded, for issue #129's reason.
  if v_many !~ 'least\(greatest\(' then
    raise exception 'The organiser list must clamp its page size server-side';
  end if;

  if has_function_privilege('anon', 'public.get_my_organised_competition(uuid)', 'execute')
     or has_function_privilege('anon',
          'public.get_my_organised_competitions(integer,integer)', 'execute')
  then
    raise exception 'An organiser read must not be reachable anonymously';
  end if;

  if has_function_privilege('authenticated',
       'predictor_internal.owns_private_competition(uuid,uuid)', 'execute') then
    raise exception 'The ownership test must have exactly one definition and no browser caller';
  end if;
end;
$$;
