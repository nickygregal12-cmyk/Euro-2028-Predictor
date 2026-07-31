-- Stage C1 compatibility hardening discovered by the first disposable rebuild.
--
-- The foundation migration creates the new authorities. This companion keeps
-- those authorities private while preserving the established Euro tournament
-- prediction flow and making observed lock transitions monotonic.

-- The timezone helper participates in a tournaments CHECK constraint. Roles
-- that already have an authorised tournaments write path must be able to invoke
-- that harmless validator; predictor_internal remains outside the exposed API.
grant execute on function predictor_internal.is_valid_timezone(text)
  to anon, authenticated, service_role;

create or replace function public.enforce_entry_lock_generic()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry uuid;
  v_match uuid;
  v_tournament uuid;
  v_lock timestamptz;
  v_kickoff timestamptz;
  v_locked boolean;
  v_server_position_refresh boolean :=
    tg_table_schema = 'public'
    and tg_table_name = 'predicted_group_positions'
    and session_user = 'postgres'
    and coalesce(
      current_setting('predictor.auto_submission_refresh', true),
      ''
    ) = 'on';
begin
  if tg_op = 'DELETE' then
    v_entry := old.entry_id;
  else
    v_entry := new.entry_id;
  end if;

  select e.tournament_id, t.lock_at
    into v_tournament, v_lock
    from public.entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.id = v_entry;

  if v_tournament is null then
    raise exception 'Prediction references a missing entry'
      using errcode = 'foreign_key_violation';
  end if;

  select exists (
    select 1
    from public.competition_lock_events le
    where le.tournament_id = v_tournament
      and le.scope_type = 'entry'
      and le.scope_key = 'entry'
  )
  into v_locked;

  if v_lock is null and not v_locked and not v_server_position_refresh then
    raise exception 'Predictions are unavailable — the tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if (v_locked or (v_lock is not null and clock_timestamp() >= v_lock))
     and not v_server_position_refresh
  then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  if tg_table_name = 'match_predictions' then
    if tg_op = 'DELETE' then
      v_match := old.match_id;
    else
      v_match := new.match_id;
    end if;

    select m.kickoff_at
      into v_kickoff
      from public.matches m
      where m.id = v_match;

    select exists (
      select 1
      from public.competition_lock_events le
      where le.tournament_id = v_tournament
        and le.scope_type = 'match'
        and le.scope_key = v_match::text
    )
    into v_locked;

    -- Euro 2028's original game remains tournament-wide before official
    -- kickoffs are known. Once a kickoff is known or has ever been observed,
    -- the fixture boundary is inclusive and cannot reopen after rescheduling.
    if v_locked
       or (v_kickoff is not null and clock_timestamp() >= v_kickoff)
    then
      raise exception 'This prediction is locked — the match has kicked off'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_entry_lock_scores()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament uuid;
  v_lock timestamptz;
  v_kickoff timestamptz;
  v_locked boolean;
  v_score_changed boolean;
begin
  v_score_changed := tg_op = 'INSERT'
    or new.home_score is distinct from old.home_score
    or new.away_score is distinct from old.away_score;

  if not v_score_changed then
    return new;
  end if;

  select e.tournament_id, t.lock_at
    into v_tournament, v_lock
    from public.entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.id = new.entry_id;

  if v_tournament is null then
    raise exception 'Prediction references a missing entry'
      using errcode = 'foreign_key_violation';
  end if;

  select exists (
    select 1
    from public.competition_lock_events le
    where le.tournament_id = v_tournament
      and le.scope_type = 'entry'
      and le.scope_key = 'entry'
  )
  into v_locked;

  if v_lock is null and not v_locked then
    raise exception 'Predictions are unavailable — the tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if v_locked or (v_lock is not null and clock_timestamp() >= v_lock) then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  select m.kickoff_at
    into v_kickoff
    from public.matches m
    where m.id = new.match_id;

  select exists (
    select 1
    from public.competition_lock_events le
    where le.tournament_id = v_tournament
      and le.scope_type = 'match'
      and le.scope_key = new.match_id::text
  )
  into v_locked;

  if v_locked
     or (v_kickoff is not null and clock_timestamp() >= v_kickoff)
  then
    raise exception 'This prediction is locked — the match has kicked off'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_joker_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament uuid;
  v_kickoff timestamptz;
  v_locked boolean;
  joker_changed boolean;
begin
  joker_changed := (tg_op = 'INSERT' and new.joker)
                or (tg_op = 'UPDATE' and new.joker is distinct from old.joker);

  if not joker_changed then
    return new;
  end if;

  select m.tournament_id, m.kickoff_at
    into v_tournament, v_kickoff
    from public.matches m
    where m.id = new.match_id;

  if v_kickoff is null then
    raise exception 'Joker on match % is unavailable until kickoff is scheduled', new.match_id
      using errcode = 'check_violation';
  end if;

  select exists (
    select 1
    from public.competition_lock_events le
    where le.tournament_id = v_tournament
      and le.scope_type = 'match'
      and le.scope_key = new.match_id::text
  )
  into v_locked;

  if v_locked or clock_timestamp() >= v_kickoff then
    raise exception 'Joker on match % is locked at kickoff and cannot be changed', new.match_id
      using errcode = 'check_violation';
  end if;

  if new.joker and (
    select count(*)
    from public.match_predictions
    where entry_id = new.entry_id
      and joker = true
      and match_id <> new.match_id
  ) >= 5 then
    raise exception 'Entry % already has the maximum of 5 jokers', new.entry_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_entry_lock_generic()
  from public, anon, authenticated;
revoke all on function public.enforce_entry_lock_scores()
  from public, anon, authenticated;
revoke all on function public.enforce_joker_rules()
  from public, anon, authenticated;
