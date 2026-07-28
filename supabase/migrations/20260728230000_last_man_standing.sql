-- Euro 2028 Predictor — Last Man Standing
--
-- Contract 53 (ADR-0010, stage B6). The second bonus game, in the TOURNAMENT
-- format (Euro 2024 / World Cup 2026 style — decided 2026-07-28, recorded in
-- competition-structure.md §4 and scoring-rules.md §8), not the weekly EPL
-- format:
--
--   - rounds are the competition's stored windows (round deadlines at the
--     window lock — no per-kickoff locks);
--   - each surviving entrant picks ONE team playing in that round's fixtures
--     before the deadline, and may change the pick until then;
--   - group rounds: the picked team must WIN its match — a draw eliminates;
--     knockout rounds: the picked team must ADVANCE (authoritative winner,
--     extra time and penalties count);
--   - each team may be used ONCE per competition;
--   - no pick by the deadline = eliminated when the round settles;
--   - a round settles only when every fixture is officially confirmed and
--     the deadline (plus any scheduled settle instant) has passed — nothing
--     is ever decided from a provisional result;
--   - whole-round wipeout voids the round: if a settled round would
--     eliminate every remaining survivor, they all carry through;
--   - survivors through the final window are champions (co-champions
--     possible); elimination is permanent.
--
-- Survival is FULLY RE-DERIVED from selections and confirmed results on every
-- authoritative result change, inside the same advisory-locked result
-- operation as every other recompute (§9): corrections and clears
-- automatically re-eliminate or un-eliminate. No incremental state is
-- trusted; outcomes are the only derived artefact.

begin;

create table public.bonus_lms_selections (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,
  user_id uuid not null,
  window_id uuid not null
    references public.bonus_competition_windows(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One pick per round.
  unique (competition_id, user_id, window_id),
  -- Each team once per competition — the constraint that makes 24-team LMS bite.
  unique (competition_id, user_id, team_id),
  foreign key (competition_id, user_id)
    references public.bonus_competition_entrants(competition_id, user_id)
    on delete cascade
);

create index bonus_lms_selections_window_idx
  on public.bonus_lms_selections (window_id);

-- Depth behind the RPC: the window must belong to a Last Man Standing
-- competition, be open (a scheduled deadline that has not passed), and the
-- team must actually play in one of the round's fixtures.
create or replace function predictor_internal.assert_bonus_lms_selection_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game text;
  v_window_competition uuid;
  v_opens timestamptz;
  v_locks timestamptz;
begin
  select w.competition_id, w.opens_at, w.locks_at, c.game_key
    into v_window_competition, v_opens, v_locks, v_game
    from public.bonus_competition_windows w
    join public.bonus_competitions c on c.id = w.competition_id
    where w.id = new.window_id;

  if v_window_competition is distinct from new.competition_id
    or v_game <> 'last_man_standing' then
    raise exception 'Selections belong to a Last Man Standing round'
      using errcode = 'check_violation';
  end if;

  if v_opens is null or now() < v_opens then
    raise exception 'This round is not open yet'
      using errcode = 'check_violation';
  end if;

  if v_locks is null then
    raise exception 'This round has no scheduled deadline yet'
      using errcode = 'check_violation';
  end if;

  if now() >= v_locks then
    raise exception 'This round has locked'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1
    from public.bonus_window_fixtures f
    join public.matches m on m.id = f.match_id
    where f.window_id = new.window_id
      and (m.home_team_id = new.team_id or m.away_team_id = new.team_id)
  ) then
    raise exception 'The picked team does not play in this round'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger assert_bonus_lms_selection_shape
before insert or update on public.bonus_lms_selections
for each row
execute function predictor_internal.assert_bonus_lms_selection_shape();

alter table public.bonus_lms_selections enable row level security;

revoke all on table public.bonus_lms_selections
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.assert_bonus_lms_selection_shape()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Voluntary pick, version-guarded, changeable until the round deadline.
-- ---------------------------------------------------------------------------

create or replace function public.save_lms_selection(
  p_window_id uuid,
  p_team_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_competition_id uuid;
  v_published boolean;
  v_game text;
  v_outcome text;
  v_row_id uuid;
  v_stored_version integer;
  v_new_version integer;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select w.competition_id, c.published, c.game_key
    into v_competition_id, v_published, v_game
    from public.bonus_competition_windows w
    join public.bonus_competitions c on c.id = w.competition_id
    where w.id = p_window_id;

  if v_competition_id is null or not v_published or v_game <> 'last_man_standing' then
    raise exception 'Round not found'
      using errcode = 'no_data_found';
  end if;

  select entrant.outcome
    into v_outcome
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = v_competition_id
      and entrant.user_id = v_uid;

  if v_outcome is null then
    raise exception 'Enter Last Man Standing to make picks'
      using errcode = 'insufficient_privilege';
  end if;

  if v_outcome in ('eliminated') then
    raise exception 'You have been eliminated from this competition'
      using errcode = '55000';
  end if;

  if p_team_id is null then
    raise exception 'A team pick is required'
      using errcode = 'check_violation';
  end if;

  -- Team reuse gets a clear error before the unique constraint would fire.
  if exists (
    select 1
    from public.bonus_lms_selections sel
    where sel.competition_id = v_competition_id
      and sel.user_id = v_uid
      and sel.team_id = p_team_id
      and sel.window_id <> p_window_id
  ) then
    raise exception 'Each team can only be used once in Last Man Standing'
      using errcode = 'unique_violation';
  end if;

  select sel.id, sel.version
    into v_row_id, v_stored_version
    from public.bonus_lms_selections sel
    where sel.competition_id = v_competition_id
      and sel.user_id = v_uid
      and sel.window_id = p_window_id
    for update;

  if v_row_id is null then
    if p_expected_version is not null and p_expected_version <> 0 then
      raise exception 'selection version conflict (expected %, stored none)',
        p_expected_version
        using errcode = 'PT409';
    end if;

    insert into public.bonus_lms_selections (
      competition_id, user_id, window_id, team_id
    ) values (
      v_competition_id, v_uid, p_window_id, p_team_id
    );
    v_new_version := 0;
  else
    if p_expected_version is null
      or p_expected_version is distinct from v_stored_version then
      raise exception 'selection version conflict (expected %, stored %)',
        p_expected_version, v_stored_version
        using errcode = 'PT409';
    end if;

    update public.bonus_lms_selections sel
      set team_id = p_team_id,
          version = v_stored_version + 1,
          updated_at = now()
      where sel.id = v_row_id;
    v_new_version := v_stored_version + 1;
  end if;

  return jsonb_build_object(
    'window_id', p_window_id,
    'team_id', p_team_id,
    'version', v_new_version
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Bounded LMS read: entrant state, survivor counts, rounds with the caller's
-- own picks and the real-fixture facts needed to render choices and history.
-- ---------------------------------------------------------------------------

create or replace function public.get_my_lms(
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
  v_competition_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select competition.id
    into v_competition_id
    from public.bonus_competitions competition
    where competition.tournament_id = p_tournament_id
      and competition.game_key = 'last_man_standing'
      and competition.published;

  if v_competition_id is null then
    raise exception 'Last Man Standing is not available for this tournament'
      using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'competition_id', v_competition_id,
    'entrant', (
      select jsonb_build_object(
        'joined_at', entrant.joined_at,
        'outcome', entrant.outcome
      )
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition_id
        and entrant.user_id = v_uid
    ),
    'entrant_count', (
      select count(*)::integer
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition_id
    ),
    'remaining_count', (
      select count(*)::integer
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition_id
        and entrant.outcome <> 'eliminated'
    ),
    'used_team_ids', coalesce(
      (
        select jsonb_agg(sel.team_id order by sel.team_id)
        from public.bonus_lms_selections sel
        where sel.competition_id = v_competition_id
          and sel.user_id = v_uid
      ),
      '[]'::jsonb
    ),
    'windows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', bounded_window.id,
            'sequence', bounded_window.sequence,
            'label', bounded_window.label,
            'opens_at', bounded_window.opens_at,
            'locks_at', bounded_window.locks_at,
            'settles_at', bounded_window.settles_at,
            'my_selection', (
              select jsonb_build_object(
                'team_id', sel.team_id,
                'version', sel.version
              )
              from public.bonus_lms_selections sel
              where sel.competition_id = v_competition_id
                and sel.user_id = v_uid
                and sel.window_id = bounded_window.id
            ),
            'fixtures', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'match_id', bounded_fixture.match_id,
                    'round', bounded_fixture.round,
                    'kickoff_at', bounded_fixture.kickoff_at,
                    'home_team_id', bounded_fixture.home_team_id,
                    'away_team_id', bounded_fixture.away_team_id,
                    'result_state', bounded_fixture.result_state,
                    'home_score', bounded_fixture.home_score,
                    'away_score', bounded_fixture.away_score,
                    'winner_team_id', bounded_fixture.winner_team_id
                  )
                  order by bounded_fixture.kickoff_at nulls last, bounded_fixture.match_id
                )
                from (
                  select
                    m.id as match_id, m.round, m.kickoff_at,
                    m.home_team_id, m.away_team_id,
                    m.result_state, m.home_score, m.away_score, m.winner_team_id
                  from public.bonus_window_fixtures f
                  join public.matches m on m.id = f.match_id
                  where f.window_id = bounded_window.id
                  order by m.kickoff_at nulls last, m.id
                  limit 16
                ) bounded_fixture
              ),
              '[]'::jsonb
            )
          )
          order by bounded_window.sequence
        )
        from (
          select w.id, w.sequence, w.label, w.opens_at, w.locks_at, w.settles_at
          from public.bonus_competition_windows w
          where w.competition_id = v_competition_id
          order by w.sequence
          limit 12
        ) bounded_window
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Survival re-derivation. Runs inside the single result operation via the
-- bonus fan-out trigger below. Deterministic from stored selections and
-- officially confirmed results only.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.recompute_lms_for_tournament(
  p_tournament_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_competition_id uuid;
  v_alive uuid[];
  v_survivors uuid[];
  v_any_settled boolean := false;
  v_final_settled boolean := false;
  v_last_sequence integer;
  w record;
  v_changed integer := 0;
begin
  select competition.id
    into v_competition_id
    from public.bonus_competitions competition
    where competition.tournament_id = p_tournament_id
      and competition.game_key = 'last_man_standing';

  if v_competition_id is null then
    return;
  end if;

  select coalesce(array_agg(entrant.user_id), '{}')
    into v_alive
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = v_competition_id;

  select max(win.sequence)
    into v_last_sequence
    from public.bonus_competition_windows win
    where win.competition_id = v_competition_id;

  for w in
    select win.id, win.sequence
    from public.bonus_competition_windows win
    where win.competition_id = v_competition_id
      -- A round settles only when it locked, every fixture is officially
      -- confirmed and any scheduled settle instant has passed.
      and win.locks_at is not null and now() >= win.locks_at
      and (win.settles_at is null or now() >= win.settles_at)
      and exists (
        select 1 from public.bonus_window_fixtures f where f.window_id = win.id
      )
      and not exists (
        select 1
        from public.bonus_window_fixtures f
        join public.matches m on m.id = f.match_id
        where f.window_id = win.id
          and m.result_state not in ('confirmed', 'corrected')
      )
    order by win.sequence
  loop
    v_any_settled := true;

    select coalesce(array_agg(candidate.user_id), '{}')
      into v_survivors
      from unnest(v_alive) as candidate(user_id)
      where exists (
        select 1
        from public.bonus_lms_selections sel
        join public.bonus_window_fixtures f on f.window_id = w.id
        join public.matches m
          on m.id = f.match_id
          and (m.home_team_id = sel.team_id or m.away_team_id = sel.team_id)
        where sel.competition_id = v_competition_id
          and sel.user_id = candidate.user_id
          and sel.window_id = w.id
          and (
            (m.round = 'group' and (
              (m.home_team_id = sel.team_id and m.home_score > m.away_score)
              or (m.away_team_id = sel.team_id and m.away_score > m.home_score)
            ))
            or (m.round <> 'group' and m.winner_team_id = sel.team_id)
          )
      );

    -- Whole-round wipeout voids the round: everyone still standing carries.
    if cardinality(v_survivors) = 0 and cardinality(v_alive) > 0 then
      v_survivors := v_alive;
    end if;

    v_alive := v_survivors;

    if w.sequence = v_last_sequence then
      v_final_settled := true;
    end if;
  end loop;

  update public.bonus_competition_entrants entrant
    set outcome = derived.outcome,
        updated_at = now()
    from (
      select
        e.user_id,
        case
          when not (e.user_id = any (v_alive)) then 'eliminated'
          when v_final_settled then 'champion'
          when v_any_settled then 'survived'
          else 'active'
        end as outcome
      from public.bonus_competition_entrants e
      where e.competition_id = v_competition_id
    ) derived
    where entrant.competition_id = v_competition_id
      and entrant.user_id = derived.user_id
      and entrant.outcome is distinct from derived.outcome;

  get diagnostics v_changed = row_count;

  if v_changed > 0 then
    insert into public.bonus_competition_audit (competition_id, action, detail)
    values (
      v_competition_id,
      'lms_resolved',
      jsonb_build_object(
        'outcomes_changed', v_changed,
        'remaining', cardinality(v_alive),
        'final_settled', v_final_settled
      )
    );
  end if;
end;
$$;

-- Extend the bonus fan-out leg of the single result operation (§9) to cover
-- both delivered games; each recompute stays independent.
create or replace function predictor_internal.trg_recompute_bonus_on_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform predictor_internal.recompute_ko_predictor_for_match(new.id);
  perform predictor_internal.recompute_lms_for_tournament(new.tournament_id);
  return new;
end;
$$;

revoke all on function predictor_internal.recompute_lms_for_tournament(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.save_lms_selection(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.get_my_lms(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.save_lms_selection(uuid, uuid, integer)
  to authenticated, service_role;
grant execute on function public.get_my_lms(uuid)
  to authenticated, service_role;

commit;
