-- Euro 2028 Predictor — DATA-002 authoritative result lifecycle
--
-- Adds one server-only path for confirming, correcting and clearing match
-- results. Regulation, extra-time and penalty-shootout scores are preserved
-- separately, the winner is derived rather than guessed by consumers, every
-- revision is audited, and score recomputation is serialised per tournament.
--
-- Existing scored rows are deliberately rejected by the preflight. A bare
-- home_score/away_score pair cannot prove whether a knockout match ended in
-- regulation, extra time or penalties, so a hosted rollout must explicitly
-- classify any legacy result instead of silently inventing a method.

begin;

-- ---------------------------------------------------------------------------
-- Fail closed on legacy results that cannot be classified authoritatively.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from public.matches m
    where m.home_score is not null
       or m.away_score is not null
  ) then
    raise exception
      'Result lifecycle preflight failed: existing match scores require explicit classification before migration'
      using errcode = 'check_violation';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Current authoritative result on the match row.
--
-- home_score / away_score remain the public football score excluding a penalty
-- shootout: 90-minute score for regulation finishes, 120-minute score for extra
-- time or penalties. The detailed fields preserve how that score was reached.
-- ---------------------------------------------------------------------------
alter table public.matches
  add column result_state text not null default 'scheduled',
  add column result_method text,
  add column home_score_90 smallint check (home_score_90 >= 0),
  add column away_score_90 smallint check (away_score_90 >= 0),
  add column home_score_120 smallint check (home_score_120 >= 0),
  add column away_score_120 smallint check (away_score_120 >= 0),
  add column home_penalties smallint check (home_penalties >= 0),
  add column away_penalties smallint check (away_penalties >= 0),
  add column winner_team_id uuid references public.teams (id) on delete set null,
  add column result_version integer not null default 0 check (result_version >= 0),
  add column confirmed_at timestamptz,
  add column corrected_at timestamptz,
  add column last_result_reason text;

alter table public.matches
  add constraint matches_result_state_allowed
    check (result_state in ('scheduled', 'confirmed', 'corrected')),
  add constraint matches_result_method_allowed
    check (
      result_method is null
      or result_method in ('regulation', 'extra_time', 'penalties')
    ),
  add constraint matches_result_90_pair
    check ((home_score_90 is null) = (away_score_90 is null)),
  add constraint matches_result_120_pair
    check ((home_score_120 is null) = (away_score_120 is null)),
  add constraint matches_result_penalty_pair
    check ((home_penalties is null) = (away_penalties is null)),
  add constraint matches_result_state_shape
    check (
      (
        result_state = 'scheduled'
        and result_method is null
        and home_score is null
        and away_score is null
        and home_score_90 is null
        and away_score_90 is null
        and home_score_120 is null
        and away_score_120 is null
        and home_penalties is null
        and away_penalties is null
        and winner_team_id is null
        and confirmed_at is null
        and corrected_at is null
      )
      or
      (
        result_state in ('confirmed', 'corrected')
        and result_method is not null
        and home_score is not null
        and away_score is not null
        and home_score_90 is not null
        and away_score_90 is not null
        and result_version > 0
        and confirmed_at is not null
        and (
          (result_state = 'confirmed' and corrected_at is null)
          or
          (result_state = 'corrected' and corrected_at is not null)
        )
      )
    ),
  add constraint matches_result_round_and_winner_shape
    check (
      result_state = 'scheduled'
      or
      (
        round = 'group'
        and result_method = 'regulation'
        and home_score = home_score_90
        and away_score = away_score_90
        and home_score_120 is null
        and away_score_120 is null
        and home_penalties is null
        and away_penalties is null
        and (
          (home_score = away_score and winner_team_id is null)
          or
          (home_score > away_score and winner_team_id = home_team_id)
          or
          (away_score > home_score and winner_team_id = away_team_id)
        )
      )
      or
      (
        round <> 'group'
        and home_team_id is not null
        and away_team_id is not null
        and home_team_id <> away_team_id
        and winner_team_id in (home_team_id, away_team_id)
        and (
          (
            result_method = 'regulation'
            and home_score = home_score_90
            and away_score = away_score_90
            and home_score_90 <> away_score_90
            and home_score_120 is null
            and away_score_120 is null
            and home_penalties is null
            and away_penalties is null
            and (
              (home_score_90 > away_score_90 and winner_team_id = home_team_id)
              or
              (away_score_90 > home_score_90 and winner_team_id = away_team_id)
            )
          )
          or
          (
            result_method = 'extra_time'
            and home_score_90 = away_score_90
            and home_score_120 is not null
            and away_score_120 is not null
            and home_score_120 <> away_score_120
            and home_score = home_score_120
            and away_score = away_score_120
            and home_penalties is null
            and away_penalties is null
            and (
              (home_score_120 > away_score_120 and winner_team_id = home_team_id)
              or
              (away_score_120 > home_score_120 and winner_team_id = away_team_id)
            )
          )
          or
          (
            result_method = 'penalties'
            and home_score_90 = away_score_90
            and home_score_120 is not null
            and away_score_120 is not null
            and home_score_120 = away_score_120
            and home_score = home_score_120
            and away_score = away_score_120
            and home_penalties is not null
            and away_penalties is not null
            and home_penalties <> away_penalties
            and (
              (home_penalties > away_penalties and winner_team_id = home_team_id)
              or
              (away_penalties > home_penalties and winner_team_id = away_team_id)
            )
          )
        )
      )
    );

create index matches_winner_idx on public.matches (winner_team_id)
  where winner_team_id is not null;
create index matches_result_state_idx on public.matches (tournament_id, result_state, round);

-- ---------------------------------------------------------------------------
-- Immutable result revision log. No client table access is granted.
-- ---------------------------------------------------------------------------
create table public.match_result_revisions (
  id              uuid primary key default gen_random_uuid(),
  match_id         uuid not null references public.matches (id) on delete cascade,
  tournament_id    uuid not null references public.tournaments (id) on delete cascade,
  revision         integer not null check (revision > 0),
  action           text not null check (action in ('confirm', 'correct', 'clear')),
  previous_result  jsonb not null,
  new_result       jsonb not null,
  reason           text,
  actor_id         uuid references auth.users (id) on delete set null,
  recorded_at      timestamptz not null default now(),
  unique (match_id, revision)
);

create index match_result_revisions_match_idx
  on public.match_result_revisions (match_id, revision desc);
create index match_result_revisions_tournament_idx
  on public.match_result_revisions (tournament_id, recorded_at desc);

alter table public.match_result_revisions enable row level security;
revoke all on table public.match_result_revisions from public, anon, authenticated;
grant select, insert on table public.match_result_revisions to service_role;

-- ---------------------------------------------------------------------------
-- Result writes are accepted only while the server lifecycle function has set
-- a transaction-local capability. Confirmed participants cannot be swapped out
-- underneath an authoritative result.
-- ---------------------------------------------------------------------------
create or replace function predictor_internal.enforce_match_result_boundary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result_changed boolean;
  v_participants_changed boolean;
  v_tournament uuid;
  v_team_count integer;
begin
  v_tournament := new.tournament_id;

  if tg_op = 'INSERT' then
    if new.result_state <> 'scheduled'
       or new.result_method is not null
       or new.home_score is not null
       or new.away_score is not null
       or new.winner_team_id is not null
    then
      if coalesce(current_setting('predictor.match_result_write', true), '') <> 'on' then
        raise exception 'Match results must be written through the protected result lifecycle'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
    return new;
  end if;

  v_result_changed :=
       new.result_state is distinct from old.result_state
    or new.result_method is distinct from old.result_method
    or new.home_score is distinct from old.home_score
    or new.away_score is distinct from old.away_score
    or new.home_score_90 is distinct from old.home_score_90
    or new.away_score_90 is distinct from old.away_score_90
    or new.home_score_120 is distinct from old.home_score_120
    or new.away_score_120 is distinct from old.away_score_120
    or new.home_penalties is distinct from old.home_penalties
    or new.away_penalties is distinct from old.away_penalties
    or new.winner_team_id is distinct from old.winner_team_id
    or new.result_version is distinct from old.result_version
    or new.confirmed_at is distinct from old.confirmed_at
    or new.corrected_at is distinct from old.corrected_at
    or new.last_result_reason is distinct from old.last_result_reason;

  v_participants_changed :=
       new.home_team_id is distinct from old.home_team_id
    or new.away_team_id is distinct from old.away_team_id;

  if v_result_changed
     and coalesce(current_setting('predictor.match_result_write', true), '') <> 'on'
  then
    raise exception 'Match results must be written through the protected result lifecycle'
      using errcode = 'insufficient_privilege';
  end if;

  if v_participants_changed and old.result_state <> 'scheduled' then
    raise exception 'Confirmed match participants cannot be changed; clear the result first'
      using errcode = 'check_violation';
  end if;

  if v_result_changed or v_participants_changed then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_tournament::text, 0)
    );
  end if;

  if new.result_state in ('confirmed', 'corrected') then
    if new.home_team_id is null
       or new.away_team_id is null
       or new.home_team_id = new.away_team_id
    then
      raise exception 'A confirmed result requires two distinct participants'
        using errcode = 'check_violation';
    end if;

    select count(*)
      into v_team_count
      from public.teams t
      where t.tournament_id = new.tournament_id
        and t.id in (new.home_team_id, new.away_team_id);

    if v_team_count <> 2 then
      raise exception 'Both result participants must belong to the match tournament'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.enforce_match_result_boundary()
  from public, anon, authenticated;

drop trigger if exists enforce_match_result_boundary_insert on public.matches;
create trigger enforce_match_result_boundary_insert
  before insert on public.matches
  for each row
  execute function predictor_internal.enforce_match_result_boundary();

drop trigger if exists enforce_match_result_boundary_update on public.matches;
create trigger enforce_match_result_boundary_update
  before update of
    home_team_id,
    away_team_id,
    home_score,
    away_score,
    result_state,
    result_method,
    home_score_90,
    away_score_90,
    home_score_120,
    away_score_120,
    home_penalties,
    away_penalties,
    winner_team_id,
    result_version,
    confirmed_at,
    corrected_at,
    last_result_reason
  on public.matches
  for each row
  execute function predictor_internal.enforce_match_result_boundary();

-- ---------------------------------------------------------------------------
-- One private implementation for confirm/correct/clear.
-- ---------------------------------------------------------------------------
create or replace function predictor_internal.write_match_result(
  p_match_id uuid,
  p_action text,
  p_method text,
  p_home_90 smallint,
  p_away_90 smallint,
  p_home_120 smallint default null,
  p_away_120 smallint default null,
  p_home_penalties smallint default null,
  p_away_penalties smallint default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.matches%rowtype;
  v_after public.matches%rowtype;
  v_previous jsonb;
  v_new jsonb;
  v_final_home smallint;
  v_final_away smallint;
  v_winner uuid;
  v_now timestamptz := now();
  v_revision integer;
begin
  select *
    into v_before
    from public.matches m
    where m.id = p_match_id
    for update;

  if not found then
    raise exception 'Match not found'
      using errcode = 'no_data_found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_before.tournament_id::text, 0)
  );

  if p_action not in ('confirm', 'correct', 'clear') then
    raise exception 'Unknown result action: %', p_action
      using errcode = 'invalid_parameter_value';
  end if;

  if p_action = 'confirm' and v_before.result_state <> 'scheduled' then
    raise exception 'Only a scheduled match can be confirmed'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  if p_action in ('correct', 'clear')
     and v_before.result_state not in ('confirmed', 'corrected')
  then
    raise exception 'Only a confirmed result can be corrected or cleared'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  if p_action in ('correct', 'clear') and nullif(btrim(p_reason), '') is null then
    raise exception 'A correction or clear requires a reason'
      using errcode = 'invalid_parameter_value';
  end if;

  v_previous := jsonb_build_object(
    'state', v_before.result_state,
    'method', v_before.result_method,
    'homeScore', v_before.home_score,
    'awayScore', v_before.away_score,
    'home90', v_before.home_score_90,
    'away90', v_before.away_score_90,
    'home120', v_before.home_score_120,
    'away120', v_before.away_score_120,
    'homePenalties', v_before.home_penalties,
    'awayPenalties', v_before.away_penalties,
    'winnerTeamId', v_before.winner_team_id,
    'version', v_before.result_version,
    'confirmedAt', v_before.confirmed_at,
    'correctedAt', v_before.corrected_at,
    'reason', v_before.last_result_reason
  );

  perform set_config('predictor.match_result_write', 'on', true);
  v_revision := v_before.result_version + 1;

  if p_action = 'clear' then
    update public.matches
      set result_state = 'scheduled',
          result_method = null,
          home_score = null,
          away_score = null,
          home_score_90 = null,
          away_score_90 = null,
          home_score_120 = null,
          away_score_120 = null,
          home_penalties = null,
          away_penalties = null,
          winner_team_id = null,
          result_version = v_revision,
          confirmed_at = null,
          corrected_at = null,
          last_result_reason = btrim(p_reason)
      where id = p_match_id
      returning * into v_after;
  else
    if v_before.home_team_id is null
       or v_before.away_team_id is null
       or v_before.home_team_id = v_before.away_team_id
    then
      raise exception 'A result requires two distinct participants'
        using errcode = 'check_violation';
    end if;

    if p_method not in ('regulation', 'extra_time', 'penalties') then
      raise exception 'Unknown result method: %', p_method
        using errcode = 'invalid_parameter_value';
    end if;

    if p_home_90 is null or p_away_90 is null then
      raise exception 'The 90-minute score is required'
        using errcode = 'check_violation';
    end if;

    if p_home_90 < 0
       or p_away_90 < 0
       or coalesce(p_home_120, 0) < 0
       or coalesce(p_away_120, 0) < 0
       or coalesce(p_home_penalties, 0) < 0
       or coalesce(p_away_penalties, 0) < 0
    then
      raise exception 'Result scores cannot be negative'
        using errcode = 'check_violation';
    end if;

    if v_before.round = 'group' and p_method <> 'regulation' then
      raise exception 'Group-stage results must finish in regulation'
        using errcode = 'check_violation';
    end if;

    if p_method = 'regulation' then
      if p_home_120 is not null
         or p_away_120 is not null
         or p_home_penalties is not null
         or p_away_penalties is not null
      then
        raise exception 'Regulation results cannot include extra-time or penalty scores'
          using errcode = 'check_violation';
      end if;

      if v_before.round <> 'group' and p_home_90 = p_away_90 then
        raise exception 'A knockout regulation result cannot be tied'
          using errcode = 'check_violation';
      end if;

      v_final_home := p_home_90;
      v_final_away := p_away_90;
    elsif p_method = 'extra_time' then
      if v_before.round = 'group' then
        raise exception 'Group-stage matches cannot use extra time'
          using errcode = 'check_violation';
      end if;
      if p_home_90 <> p_away_90 then
        raise exception 'Extra time requires a tied 90-minute score'
          using errcode = 'check_violation';
      end if;
      if p_home_120 is null or p_away_120 is null or p_home_120 = p_away_120 then
        raise exception 'Extra time requires a non-tied 120-minute score'
          using errcode = 'check_violation';
      end if;
      if p_home_penalties is not null or p_away_penalties is not null then
        raise exception 'An extra-time result cannot include a penalty shootout'
          using errcode = 'check_violation';
      end if;

      v_final_home := p_home_120;
      v_final_away := p_away_120;
    else
      if v_before.round = 'group' then
        raise exception 'Group-stage matches cannot use penalties'
          using errcode = 'check_violation';
      end if;
      if p_home_90 <> p_away_90 then
        raise exception 'A penalty shootout requires a tied 90-minute score'
          using errcode = 'check_violation';
      end if;
      if p_home_120 is null or p_away_120 is null or p_home_120 <> p_away_120 then
        raise exception 'A penalty shootout requires a tied 120-minute score'
          using errcode = 'check_violation';
      end if;
      if p_home_penalties is null
         or p_away_penalties is null
         or p_home_penalties = p_away_penalties
      then
        raise exception 'A penalty shootout requires a non-tied shootout score'
          using errcode = 'check_violation';
      end if;

      v_final_home := p_home_120;
      v_final_away := p_away_120;
    end if;

    if p_method = 'penalties' then
      v_winner := case
        when p_home_penalties > p_away_penalties then v_before.home_team_id
        else v_before.away_team_id
      end;
    elsif v_final_home = v_final_away then
      v_winner := null;
    else
      v_winner := case
        when v_final_home > v_final_away then v_before.home_team_id
        else v_before.away_team_id
      end;
    end if;

    update public.matches
      set result_state = case when p_action = 'confirm' then 'confirmed' else 'corrected' end,
          result_method = p_method,
          home_score = v_final_home,
          away_score = v_final_away,
          home_score_90 = p_home_90,
          away_score_90 = p_away_90,
          home_score_120 = p_home_120,
          away_score_120 = p_away_120,
          home_penalties = p_home_penalties,
          away_penalties = p_away_penalties,
          winner_team_id = v_winner,
          result_version = v_revision,
          confirmed_at = case
            when p_action = 'confirm' then v_now
            else v_before.confirmed_at
          end,
          corrected_at = case
            when p_action = 'correct' then v_now
            else null
          end,
          last_result_reason = nullif(btrim(p_reason), '')
      where id = p_match_id
      returning * into v_after;
  end if;

  v_new := jsonb_build_object(
    'state', v_after.result_state,
    'method', v_after.result_method,
    'homeScore', v_after.home_score,
    'awayScore', v_after.away_score,
    'home90', v_after.home_score_90,
    'away90', v_after.away_score_90,
    'home120', v_after.home_score_120,
    'away120', v_after.away_score_120,
    'homePenalties', v_after.home_penalties,
    'awayPenalties', v_after.away_penalties,
    'winnerTeamId', v_after.winner_team_id,
    'version', v_after.result_version,
    'confirmedAt', v_after.confirmed_at,
    'correctedAt', v_after.corrected_at,
    'reason', v_after.last_result_reason
  );

  insert into public.match_result_revisions (
    match_id,
    tournament_id,
    revision,
    action,
    previous_result,
    new_result,
    reason,
    actor_id
  ) values (
    p_match_id,
    v_before.tournament_id,
    v_revision,
    p_action,
    v_previous,
    v_new,
    nullif(btrim(p_reason), ''),
    auth.uid()
  );

  return v_new;
end;
$$;

revoke all on function predictor_internal.write_match_result(
  uuid, text, text, smallint, smallint, smallint, smallint, smallint, smallint, text
) from public, anon, authenticated;

-- Server-only RPC surface. These functions are exposed in public for a future
-- server-side admin adapter, but client roles cannot execute them.
create or replace function public.confirm_match_result(
  p_match_id uuid,
  p_method text,
  p_home_90 smallint,
  p_away_90 smallint,
  p_home_120 smallint default null,
  p_away_120 smallint default null,
  p_home_penalties smallint default null,
  p_away_penalties smallint default null,
  p_reason text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select predictor_internal.write_match_result(
    p_match_id,
    'confirm',
    p_method,
    p_home_90,
    p_away_90,
    p_home_120,
    p_away_120,
    p_home_penalties,
    p_away_penalties,
    p_reason
  );
$$;

create or replace function public.correct_match_result(
  p_match_id uuid,
  p_method text,
  p_home_90 smallint,
  p_away_90 smallint,
  p_home_120 smallint default null,
  p_away_120 smallint default null,
  p_home_penalties smallint default null,
  p_away_penalties smallint default null,
  p_reason text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select predictor_internal.write_match_result(
    p_match_id,
    'correct',
    p_method,
    p_home_90,
    p_away_90,
    p_home_120,
    p_away_120,
    p_home_penalties,
    p_away_penalties,
    p_reason
  );
$$;

create or replace function public.clear_match_result(
  p_match_id uuid,
  p_reason text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select predictor_internal.write_match_result(
    p_match_id,
    'clear',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    p_reason
  );
$$;

revoke all on function public.confirm_match_result(
  uuid, text, smallint, smallint, smallint, smallint, smallint, smallint, text
) from public, anon, authenticated;
revoke all on function public.correct_match_result(
  uuid, text, smallint, smallint, smallint, smallint, smallint, smallint, text
) from public, anon, authenticated;
revoke all on function public.clear_match_result(uuid, text)
  from public, anon, authenticated;

grant execute on function public.confirm_match_result(
  uuid, text, smallint, smallint, smallint, smallint, smallint, smallint, text
) to service_role;
grant execute on function public.correct_match_result(
  uuid, text, smallint, smallint, smallint, smallint, smallint, smallint, text
) to service_role;
grant execute on function public.clear_match_result(uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Scoring remains one delete-and-rederive transaction, now serialised per
-- tournament and using winner_team_id for the final champion. This is the
-- applied 20260721120000 definition with those two integrity changes.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_tournament_scores(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_complete boolean;
  v_actual_goals   int;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tournament_id::text, 0)
  );

  delete from score_events se
  using entries e
  where se.entry_id = e.id and e.tournament_id = p_tournament_id;

  insert into score_events
    (entry_id, category, match_id, team_id, points, joker, explanation, calculation_version)
  select
    scored.entry_id,
    'group_matches',
    scored.match_id,
    scored.home_team_id,
    scored.base * (case when scored.joker then 2 else 1 end),
    scored.joker,
    format(
      '%s %s–%s %s · %s',
      coalesce(scored.home_name, 'Home'),
      scored.act_home, scored.act_away,
      coalesce(scored.away_name, 'Away'),
      scored.kind_text
    ),
    1
  from (
    select
      mp.entry_id,
      m.id as match_id,
      m.home_team_id,
      m.home_score as act_home,
      m.away_score as act_away,
      mp.joker,
      ht.name as home_name,
      at.name as away_name,
      case
        when mp.home_score = m.home_score and mp.away_score = m.away_score then 5
        when sign(mp.home_score - mp.away_score) = sign(m.home_score - m.away_score) then 3
        else 0
      end as base,
      case
        when mp.home_score = m.home_score and mp.away_score = m.away_score then 'exact score'
        when sign(mp.home_score - mp.away_score) = sign(m.home_score - m.away_score) then 'correct result'
        else 'wrong'
      end as kind_text
    from match_predictions mp
    join entries e on e.id = mp.entry_id
    join matches m on m.id = mp.match_id
    left join teams ht on ht.id = m.home_team_id
    left join teams at on at.id = m.away_team_id
    where e.tournament_id = p_tournament_id
      and m.round = 'group'
      and m.result_state in ('confirmed', 'corrected')
  ) scored;

  insert into score_events
    (entry_id, category, match_id, team_id, points, joker, explanation, calculation_version)
  select
    gp.entry_id,
    'group_positions',
    null,
    null,
    gp.correct * 2 + (case when gp.correct = 4 then 5 else 0 end),
    false,
    format('Group %s · %s', gp.letter,
      case when gp.correct = 4 then 'full order correct'
           else gp.correct || ' in the right place' end),
    1
  from (
    select pgp.entry_id, g.letter,
           count(*) filter (where pgp.team_id = ao.ord[pgp.position]) as correct
    from groups g
    join lateral (select _actual_group_order(g.id) as ord) ao on true
    join predicted_group_positions pgp on pgp.group_id = g.id
    join entries e on e.id = pgp.entry_id and e.tournament_id = p_tournament_id
    where g.tournament_id = p_tournament_id and ao.ord is not null
    group by pgp.entry_id, g.id, g.letter, ao.ord
  ) gp
  where gp.correct > 0;

  insert into score_events
    (entry_id, category, match_id, team_id, points, joker, explanation, calculation_version)
  select
    ks.entry_id,
    'knockout',
    null,
    ks.team_id,
    case ks.k when 0 then 10 when 1 then 25 when 2 then 45 when 3 then 70 when 4 then 110 end,
    false,
    format('%s · %s', coalesce(tm.name, 'Team'),
      case ks.k
        when 0 then 'reached the last 16'
        when 1 then 'reached the quarter-finals'
        when 2 then 'reached the semi-finals'
        when 3 then 'reached the final'
        when 4 then 'won the tournament'
      end),
    1
  from (
    select pp.entry_id, pp.team_id,
           least(
             case pp.stage
               when 'r16' then 0 when 'qf' then 1 when 'sf' then 2
               when 'final' then 3 when 'champion' then 4 end,
             act.act_ord
           ) as k
    from predicted_progression pp
    join entries e on e.id = pp.entry_id and e.tournament_id = p_tournament_id
    join (
      select reached.team_id,
             case when champ.team_id is not null then 4 else reached.max_ord end as act_ord
      from (
        select team_id, max(rnd_ord) as max_ord
        from (
          select m.home_team_id as team_id,
                 case m.round when 'r16' then 0 when 'qf' then 1 when 'sf' then 2 when 'final' then 3 end as rnd_ord
          from matches m
          where m.tournament_id = p_tournament_id
            and m.round in ('r16','qf','sf','final')
            and m.home_team_id is not null
          union all
          select m.away_team_id,
                 case m.round when 'r16' then 0 when 'qf' then 1 when 'sf' then 2 when 'final' then 3 end
          from matches m
          where m.tournament_id = p_tournament_id
            and m.round in ('r16','qf','sf','final')
            and m.away_team_id is not null
        ) participants
        group by team_id
      ) reached
      left join (
        select m.winner_team_id as team_id
        from matches m
        where m.tournament_id = p_tournament_id
          and m.round = 'final'
          and m.result_state in ('confirmed', 'corrected')
          and m.winner_team_id is not null
      ) champ on champ.team_id = reached.team_id
    ) act on act.team_id = pp.team_id
  ) ks
  left join teams tm on tm.id = ks.team_id
  where ks.k >= 0;

  insert into score_events
    (entry_id, category, match_id, team_id, points, joker, explanation, calculation_version)
  select
    e.id, 'awards', null, null, 25, false,
    format('%s · golden boot', coalesce(pl.name, 'Top scorer')), 1
  from entries e
  join tournaments t on t.id = e.tournament_id
  join bonus_predictions bp on bp.entry_id = e.id
  join players pl on pl.id = bp.golden_boot_player_id
  where e.tournament_id = p_tournament_id
    and t.golden_boot_player_id is not null
    and bp.golden_boot_player_id = t.golden_boot_player_id;

  select bool_and(result_state in ('confirmed', 'corrected'))
    into v_group_complete
    from matches
    where tournament_id = p_tournament_id and round = 'group';

  if coalesce(v_group_complete, false) then
    select sum(home_score + away_score)
      into v_actual_goals
      from matches
      where tournament_id = p_tournament_id
        and round = 'group'
        and result_state in ('confirmed', 'corrected');

    insert into score_events
      (entry_id, category, match_id, team_id, points, joker, explanation, calculation_version)
    select g.entry_id, 'awards', null, null, b.pts, false, 'Total goals · ' || b.detail, 1
    from (
      select mp.entry_id, abs(sum(mp.home_score + mp.away_score) - v_actual_goals) as diff
      from match_predictions mp
      join matches m on m.id = mp.match_id
      join entries e on e.id = mp.entry_id
      where m.round = 'group' and e.tournament_id = p_tournament_id
      group by mp.entry_id
    ) g
    cross join lateral (
      select case when g.diff = 0 then 40 when g.diff <= 5 then 30 when g.diff <= 10 then 20 else 0 end as pts,
             case when g.diff = 0 then 'exact group-stage goals' else 'group-stage goals · close' end as detail
    ) b
    where b.pts > 0;
  end if;

  perform capture_rank_history(p_tournament_id);
end;
$$;

revoke all on function public.recompute_tournament_scores(uuid) from public, anon, authenticated;
grant execute on function public.recompute_tournament_scores(uuid) to service_role;

-- Recompute on every authoritative result or participant change. The lifecycle
-- write and the recompute share the same transaction and tournament lock.
create or replace function public.trg_recompute_on_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recompute_tournament_scores(new.tournament_id);
  return new;
end;
$$;

revoke all on function public.trg_recompute_on_result()
  from public, anon, authenticated;

drop trigger if exists recompute_scores_on_result on public.matches;
create trigger recompute_scores_on_result
  after update of
    home_team_id,
    away_team_id,
    result_state,
    result_method,
    home_score,
    away_score,
    home_score_90,
    away_score_90,
    home_score_120,
    away_score_120,
    home_penalties,
    away_penalties,
    winner_team_id
  on public.matches
  for each row
  execute function public.trg_recompute_on_result();

commit;
