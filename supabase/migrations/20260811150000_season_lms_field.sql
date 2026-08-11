-- ---------------------------------------------------------------------------
-- Contract 164 — the Last Man Standing field, revealed when the round locks.
--
-- ---------------------------------------------------------------------------
-- WHAT EXISTS, AND WHAT DOES NOT
-- ---------------------------------------------------------------------------
--
-- Contract 116 gave a season Last Man Standing entrant their OWN round, and its
-- header says exactly what it withheld: "NOTHING ABOUT ANY OTHER ENTRANT. No
-- other player's pick, survival or count." That was right for what it was —
-- the surface it served is a picking screen.
--
-- It leaves the social half unbuilt, and Last Man Standing is a game whose
-- entire tension is social: how many are left, who went out, who took the club
-- you wanted. Measured against the migrations, nothing anywhere returns another
-- entrant's selection, the size of the surviving field, or an elimination.
--
-- ---------------------------------------------------------------------------
-- THE REVEAL BOUNDARY, AND WHY IT IS THE ROUND'S OWN LOCK
-- ---------------------------------------------------------------------------
--
-- A selection is secret until the round locks, and then it is public to the
-- field. That is the same boundary contract 149 established for a league
-- matchweek and contract 129 for a head-to-head: **the round's own lock**, not
-- one competition-wide instant, and resolved SERVER-SIDE from
-- `bonus_competition_windows.locks_at` compared against `now()`.
--
-- **No client-supplied time appears anywhere in this contract.** A boundary a
-- caller can pass an argument to is not a boundary, and asserting that is part
-- of the migration rather than part of a comment.
--
-- BEFORE THE LOCK IT HIDES RATHER THAN REFUSES, for contract 149's reason: a
-- refusal is indistinguishable from "you may not see this competition", and the
-- player is entitled to know the difference. It hides COMPLETELY — no team, and
-- no `has_picked` flag either, because who has already picked is itself
-- information in a game where the clubs are a depleting resource.
--
-- ---------------------------------------------------------------------------
-- WHAT IS VISIBLE BEFORE THE LOCK, AND WHY THAT IS NOT A LEAK
-- ---------------------------------------------------------------------------
--
-- The FIELD is visible always: who is still in, who is out, and how many of
-- each. Those are settled facts from ROUNDS THAT HAVE ALREADY FINISHED — a
-- player eliminated in round four is eliminated whatever happens in round five
-- — so withholding them would hide history rather than protect a secret.
--
-- LIVES AND SAVES take the round lock, not the always-visible treatment, and
-- the choice is deliberate rather than cautious-by-default. A save is SPENT
-- during a round; how many an opponent holds going into the round they are
-- currently picking in is live strategic information, not settled history. Using
-- the round lock reuses the one boundary this contract already has rather than
-- inventing a second one, which is what ADR 0013 would have to decide. The
-- caller's own counts are always visible, because those are their own.
--
-- ---------------------------------------------------------------------------
-- WHO MAY SEE IT
-- ---------------------------------------------------------------------------
--
-- An ENTRANT of that competition, in any outcome. A player knocked out in round
-- two still sees the field they were knocked out of — being eliminated is not
-- being expelled. A player who has not entered sees nothing about anyone, which
-- is why this is a separate read from contract 116's: that one deliberately
-- answers a non-entrant so they can decide whether to join, and it can, because
-- it discloses nobody.
--
-- Additive: one internal reveal resolver and one read. No relation, policy,
-- trigger, grant or existing function is altered.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Has this round locked?
-- ===========================================================================
--
-- One function, so the boundary has one definition and one place to be wrong.
-- It takes no instant: `now()` is read inside, which is what makes a
-- client-supplied time impossible rather than merely discouraged.

create or replace function predictor_internal.lms_round_revealed(p_window_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $revealed$
  select coalesce(
    (select window_row.locks_at is not null and window_row.locks_at <= now()
       from public.bonus_competition_windows window_row
      where window_row.id = p_window_id),
    -- An unknown window is not revealed. Failing closed is the only safe
    -- direction for a function whose false answer hides and whose true answer
    -- discloses every entrant's pick.
    false);
$revealed$;

revoke all on function predictor_internal.lms_round_revealed(uuid)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 2. The field
-- ===========================================================================

create or replace function public.get_season_lms_field(
  p_tournament_id uuid,
  p_window_sequence integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $field$
declare
  v_uid uuid := (select auth.uid());
  v_competition_id uuid;
  v_window record;
  v_revealed boolean;
  v_my_outcome text;
  v_setup record;
  v_entrants jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_tournament_id is null then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  -- The same resolver contract 116 uses, routed through contract 104's single
  -- live-competition authority so `155_live_competition_callers` stays
  -- satisfied rather than gaining a second resolution path.
  select competition.id
    into v_competition_id
    from public.bonus_competitions competition
   where competition.tournament_id = p_tournament_id
     and competition.game_key = 'last_man_standing'
     and competition.id = predictor_internal.current_public_competition_id(
           p_tournament_id, 'last_man_standing')
     and competition.published;

  if v_competition_id is null then
    return jsonb_build_object('available', false, 'entered', false, 'round', null,
                              'field', null, 'entrants', '[]'::jsonb);
  end if;

  -- ENTRANCY IS THE BOUNDARY. Checked before anything about anyone is read, so
  -- a non-entrant cannot learn the field size from a timing difference.
  select entrant.outcome into v_my_outcome
    from public.bonus_competition_entrants entrant
   where entrant.competition_id = v_competition_id
     and entrant.user_id = v_uid;

  if v_my_outcome is null then
    -- Hides rather than refuses, and says why in a form a surface can render:
    -- "join to see the field" is a different message from "you may not".
    return jsonb_build_object('available', true, 'entered', false, 'round', null,
                              'field', null, 'entrants', '[]'::jsonb);
  end if;

  -- Which round. An explicit sequence lets a player look back at a settled
  -- round; the default is the one currently in play.
  if p_window_sequence is null then
    select window_row.id, window_row.sequence, window_row.label,
           window_row.opens_at, window_row.locks_at, window_row.settles_at
      into v_window
      from public.bonus_competition_windows window_row
     where window_row.id = predictor_internal.season_lms_current_window(
             v_competition_id, now());
  else
    select window_row.id, window_row.sequence, window_row.label,
           window_row.opens_at, window_row.locks_at, window_row.settles_at
      into v_window
      from public.bonus_competition_windows window_row
     where window_row.competition_id = v_competition_id
       and window_row.sequence = p_window_sequence;
  end if;

  select setup.lives, setup.saves, setup.draws_rule, setup.endgame_scope
    into v_setup
    from public.season_lms_setups setup
   where setup.competition_id = v_competition_id;

  -- THE BOUNDARY, resolved from stored data and the database's own clock.
  v_revealed := v_window.id is not null
                and predictor_internal.lms_round_revealed(v_window.id);

  select coalesce(jsonb_agg(entry order by entry ->> 'display_name'), '[]'::jsonb)
    into v_entrants
    from (
      select jsonb_build_object(
               'user_id', entrant.user_id,
               'display_name', coalesce(player.display_name, 'Player'),
               'is_me', entrant.user_id = v_uid,
               -- Settled history, always visible: being out is not a secret.
               'outcome', entrant.outcome,
               'still_in', entrant.outcome not in ('eliminated'),

               -- LIVES AND SAVES take the round lock for anyone but the caller.
               -- See the header: a save is spent DURING a round, so an
               -- opponent's remaining count is live strategic information
               -- rather than settled history.
               'lives_remaining', case
                 when entrant.user_id = v_uid or v_revealed then state.lives_remaining
                 else null end,
               'saves_remaining', case
                 when entrant.user_id = v_uid or v_revealed then state.saves_remaining
                 else null end,

               -- THE SELECTION, and the whole reveal rule in one expression.
               -- Before the lock this is null for everyone but the caller, and
               -- `has_picked` is null too — who has already picked is itself
               -- information when the clubs are a depleting resource.
               'pick', case
                 when entrant.user_id = v_uid or v_revealed then
                   case when pick.team_id is null then null
                        else jsonb_build_object(
                          'team_id', pick.team_id,
                          'team_name', club.name,
                          -- The settlement authority's verdict, never a browser
                          -- reading raw scores. Null until the fixture is
                          -- played, which is what makes an in-flight round
                          -- honest rather than optimistic.
                          'outcome', predictor_internal.season_lms_pick_outcome(
                                       p_tournament_id, v_window.id, pick.team_id))
                   end
                 else null end,
               'has_picked', case
                 when entrant.user_id = v_uid or v_revealed then pick.team_id is not null
                 else null end
             ) as entry
        from public.bonus_competition_entrants entrant
        left join public.profiles player on player.id = entrant.user_id
        left join public.season_lms_entrant_state state
               on state.competition_id = entrant.competition_id
              and state.user_id = entrant.user_id
        left join public.bonus_lms_selections pick
               on pick.competition_id = entrant.competition_id
              and pick.user_id = entrant.user_id
              and pick.window_id = v_window.id
        left join public.teams club on club.id = pick.team_id
       where entrant.competition_id = v_competition_id
    ) rows;

  return jsonb_build_object(
    'available', true,
    'entered', true,
    'my_outcome', v_my_outcome,
    'round', case when v_window.id is null then null else jsonb_build_object(
      'window_id', v_window.id,
      'sequence', v_window.sequence,
      'label', v_window.label,
      'opens_at', v_window.opens_at,
      'locks_at', v_window.locks_at,
      'settles_at', v_window.settles_at,
      -- The decision itself, so the surface renders the server's answer rather
      -- than comparing a clock of its own.
      'revealed', v_revealed,
      'settled', v_window.settles_at is not null and v_window.settles_at <= now())
    end,
    'rules', case when v_setup.lives is null then null else jsonb_build_object(
      'lives', v_setup.lives,
      'saves', v_setup.saves,
      'draws_rule', v_setup.draws_rule,
      'endgame_scope', v_setup.endgame_scope)
    end,
    -- COUNTS. Settled history, so always visible — and computed here rather
    -- than left to the browser to count the array, because the array is
    -- redacted before the lock and a count taken from it would be wrong.
    'field', jsonb_build_object(
      'entrants', (select count(*)::integer from public.bonus_competition_entrants e
                    where e.competition_id = v_competition_id),
      'remaining', (select count(*)::integer from public.bonus_competition_entrants e
                     where e.competition_id = v_competition_id
                       and e.outcome <> 'eliminated'),
      'eliminated', (select count(*)::integer from public.bonus_competition_entrants e
                      where e.competition_id = v_competition_id
                        and e.outcome = 'eliminated'),
      -- How many have picked in the round currently in play is withheld until
      -- the lock, for the same reason `has_picked` is.
      'picked', case when v_revealed then (
        select count(*)::integer from public.bonus_lms_selections s
         where s.competition_id = v_competition_id and s.window_id = v_window.id)
        else null end),
    'entrants', v_entrants);
end;
$field$;

revoke all on function public.get_season_lms_field(uuid, integer) from public, anon;
grant execute on function public.get_season_lms_field(uuid, integer) to authenticated;

-- ===========================================================================
-- 3. Prove the boundary, in the same transaction
-- ===========================================================================

do $$
declare
  v_read text := pg_get_functiondef('public.get_season_lms_field(uuid,integer)'::regprocedure);
  v_reveal text := pg_get_functiondef(
    'predictor_internal.lms_round_revealed(uuid)'::regprocedure);
begin
  -- NO CLIENT-SUPPLIED TIME. The read takes a season and a round number and
  -- nothing else; a `timestamptz` argument would make the reveal boundary a
  -- parameter, which is not a boundary.
  if (select pg_get_function_arguments(
        'public.get_season_lms_field(uuid,integer)'::regprocedure)) ~* 'timestamp' then
    raise exception 'The field read must accept no caller-supplied instant';
  end if;

  if (select pg_get_function_arguments(
        'predictor_internal.lms_round_revealed(uuid)'::regprocedure)) ~* 'timestamp' then
    raise exception 'The reveal resolver must accept no caller-supplied instant';
  end if;

  -- The resolver reads the database's own clock and the stored lock.
  if v_reveal !~ 'now\(\)' or v_reveal !~ 'locks_at' then
    raise exception 'The reveal must be resolved from the stored lock and the server clock';
  end if;

  -- It fails closed on an unknown window, which is the direction that hides.
  if v_reveal !~ 'false\)' then
    raise exception 'The reveal resolver must fail closed on an unknown round';
  end if;

  -- ENTRANCY IS CHECKED. A read that returned the field to a non-entrant would
  -- make the roster of a private competition readable by anyone signed in.
  if v_read !~ 'bonus_competition_entrants' or v_read !~ 'auth\.uid\(\)' then
    raise exception 'The field read must check the caller''s own entry';
  end if;

  -- SURVIVAL IS NOT DECIDED HERE. The verdict comes from the settlement
  -- authority; a read that compared scores itself would be a second one.
  if v_read ~* 'home_score|away_score' then
    raise exception 'The field read must not judge a fixture itself';
  end if;

  if v_read !~ 'season_lms_pick_outcome' then
    raise exception 'The field read must take its verdict from the settlement authority';
  end if;

  -- It reads and never writes.
  if v_read ~* 'insert[[:space:]]+into|update[[:space:]]+public\.|delete[[:space:]]+from' then
    raise exception 'The field read must write nothing';
  end if;

  if has_function_privilege('anon', 'public.get_season_lms_field(uuid,integer)', 'execute') then
    raise exception 'The field read must not be reachable anonymously';
  end if;

  if has_function_privilege('authenticated',
       'predictor_internal.lms_round_revealed(uuid)', 'execute') then
    raise exception 'The reveal resolver must have exactly one caller';
  end if;
end;
$$;
