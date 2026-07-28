-- Euro 2028 Predictor — Predictor Cup qualification and knockouts
--
-- Contract 56 (ADR-0010, stage B7c — the final Cup stage). Everything after
-- the three group matchdays (docs/predictor-cup-rules.md §6–§8, §9.3, §10.1,
-- §11.3):
--
--   - the QUALIFICATION GATE (service-role, audited): runs only when all
--     three group windows have settled; ranks every group with the full §5.2
--     order INCLUDING steps 4–5 (the mini head-to-head among exactly tied
--     players — this gate is the only decision they can affect); stores each
--     member's final group position;
--   - automatic qualifiers (§6.2): 1st and 2nd of four-player groups, 1st of
--     three-player groups; the wildcard pool (4-player 3rds and 3-player
--     2nds) fills to the target round(entrants × 2 ÷ 3) under the §6.3
--     cross-group order — head-to-head table points PER SCHEDULED FIXTURE
--     first, because raw table points are never compared across group sizes;
--   - seeding (§7.1): band 1 group winners, band 2 automatic runners-up,
--     band 3 wildcards; within a band the same per-fixture order;
--   - bracket arithmetic (§7.2): Q qualifiers, P the largest power of two
--     ≤ Q; Q − P playoff ties between the lowest 2(Q − P) seeds (highest
--     remaining vs lowest), 2P − Q byes to the top seeds; §7.3 same-group
--     avoidance by deterministic eligible seed swap; after the playoff the
--     bracket is FIXED — round-of-P seats follow the canonical seeded
--     layout (1 meets 2 only in the final) and later rounds pair adjacent
--     slot winners, never a redraw;
--   - knockout resolution (§8): normal Cup points → Extra-Time Accuracy
--     (lower total scoreline error, the B7b 999-per-missing-fixture sentinel
--     charged) → the PENALTY NUMBER decider. Lanes are parity-fixed at
--     round creation — the better seed (the home side) holds the ODD lane,
--     the opponent the EVEN lane — so both numbers can never be equidistant
--     from the whole-number actual total (§8.3);
--   - §9.3 walkovers: an active submitter advances over a complete
--     non-submitter; two non-submitters, or a points-and-error tie with no
--     valid Penalty Numbers, advance the better seed by administrative
--     walkover — never described as extra time or penalties;
--   - §10.1 hard gate: a round settles only through the service-role settle
--     operation, only when its window has settled (deadline passed, every
--     designated real fixture officially confirmed), and each tie's stored
--     winner/decided-by is immutable audit data; the next round's fixtures
--     are created in the same operation;
--   - §11.3 honours: the final's winner is the Predictor Cup Champion
--     (entrant outcome + competition completion); the Golden Predictor
--     (highest cumulative Cup prediction points regardless of elimination)
--     is derived at read time in the my-cup read.
--
-- The penalty-number submission is the only new authenticated write; the
-- gate and settle operations are service-role only (owner-run, like the
-- draw). Group scoring stays fully read-derived; knockout advancement is
-- stored at the gate because §10.3 makes post-finalisation corrections a
-- documented admin procedure, never an automatic reprice.

begin;

-- ---------------------------------------------------------------------------
-- Qualification and bracket columns.
-- ---------------------------------------------------------------------------

alter table public.bonus_cup_members
  add column group_position smallint
    check (group_position between 1 and 4),
  add column qualified_as text
    check (qualified_as in ('winner', 'runner_up', 'wildcard')),
  add column seed integer check (seed > 0);

-- Seeds are unique per competition and exist only for qualifiers.
create unique index bonus_cup_members_seed_once
  on public.bonus_cup_members (competition_id, seed)
  where seed is not null;

alter table public.bonus_cup_fixtures
  -- Seats in the bracket round this fixture belongs to (P, P/2, …, 2).
  -- Null for group fixtures and for the pre-bracket playoff.
  add column round_size integer check (round_size >= 2),
  -- Playoff: tie index t (winner takes seat 2P − Q + t).
  -- Knockout: slot k of the round (winners of slots 2k−1 and 2k meet next).
  add column bracket_slot integer check (bracket_slot > 0),
  add column winner_user_id uuid references auth.users (id),
  add column decided_by text
    check (decided_by in (
      'points', 'extra_time', 'penalty_number', 'walkover', 'admin_walkover'
    )),
  add column settled_at timestamptz,
  add constraint bonus_cup_fixtures_stage_bracket_shape check (
    (stage = 'group' and round_size is null and bracket_slot is null)
    or (stage = 'playoff' and round_size is null and bracket_slot is not null)
    or (stage = 'knockout' and round_size is not null and bracket_slot is not null)
  ),
  add constraint bonus_cup_fixtures_group_never_settles check (
    stage <> 'group'
    or (winner_user_id is null and decided_by is null and settled_at is null)
  ),
  add constraint bonus_cup_fixtures_settle_shape check (
    ((winner_user_id is null) = (decided_by is null))
    and ((winner_user_id is null) = (settled_at is null))
  ),
  add constraint bonus_cup_fixtures_winner_played check (
    winner_user_id is null
    or winner_user_id in (home_user_id, away_user_id)
  );

-- ---------------------------------------------------------------------------
-- Penalty Numbers (§8.3): one per entrant per knockout window, parity-laned.
-- ---------------------------------------------------------------------------

create table public.bonus_cup_penalty_numbers (
  competition_id uuid not null
    references public.bonus_competitions(id) on delete cascade,
  window_id uuid not null
    references public.bonus_competition_windows(id) on delete cascade,
  user_id uuid not null,
  value smallint not null check (value between 0 and 99),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (window_id, user_id),
  foreign key (competition_id, user_id)
    references public.bonus_competition_entrants(competition_id, user_id)
    on delete restrict
);

alter table public.bonus_cup_penalty_numbers enable row level security;

revoke all on table public.bonus_cup_penalty_numbers
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Canonical seeded bracket layout: seat order for a round of p seats such
-- that seats 1 and 2 can only meet in the final. Internal only.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_bracket_order(
  p_size integer
)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_order integer[] := array[1];
  v_next integer[];
  v_target integer;
  v_seat integer;
begin
  if p_size < 2 or (p_size & (p_size - 1)) <> 0 then
    raise exception 'Bracket size must be a power of two (got %)', p_size
      using errcode = 'invalid_parameter_value';
  end if;

  while cardinality(v_order) < p_size loop
    v_target := cardinality(v_order) * 2 + 1;
    v_next := '{}';
    foreach v_seat in array v_order loop
      v_next := v_next || v_seat || (v_target - v_seat);
    end loop;
    v_order := v_next;
  end loop;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Final group tables under the complete §5.2 order (steps 1–8, including
-- the mini head-to-head steps 4–5 among exactly tied players). Internal.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_final_group_tables(
  p_competition_id uuid
)
returns table (
  user_id uuid,
  group_id uuid,
  group_size smallint,
  draw_number integer,
  table_points integer,
  points_for integer,
  points_against integer,
  window_points integer,
  exacts integer,
  corrects integer,
  scoreline_error integer,
  position integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with members as (
    select member.user_id, member.group_id, grp.size, member.draw_number
    from public.bonus_cup_members member
    join public.bonus_cup_groups grp on grp.id = member.group_id
    where member.competition_id = p_competition_id
  ),
  window_totals as (
    select
      member.user_id,
      coalesce(sum(scores.points), 0)::integer as window_points,
      coalesce(sum(scores.exacts), 0)::integer as exacts,
      coalesce(sum(scores.corrects), 0)::integer as corrects,
      coalesce(sum(scores.scoreline_error), 0)::integer as scoreline_error
    from members member
    left join public.bonus_competition_windows win
      on win.competition_id = p_competition_id
      and win.sequence between 1 and 3
    left join lateral (
      select * from predictor_internal.cup_window_scores(p_competition_id, win.id) s
      where s.user_id = member.user_id
    ) scores on true
    group by member.user_id
  ),
  results as (
    select
      fixture.group_id,
      side.user_id,
      side.opponent_id,
      side.table_points,
      side.points_for,
      side.points_against
    from public.bonus_cup_fixtures fixture
    cross join lateral (
      select * from predictor_internal.cup_window_scores(p_competition_id, fixture.window_id) s
      where s.user_id = fixture.home_user_id
    ) home_score
    cross join lateral (
      select * from predictor_internal.cup_window_scores(p_competition_id, fixture.window_id) s
      where s.user_id = fixture.away_user_id
    ) away_score
    cross join lateral (values
      (
        fixture.home_user_id,
        fixture.away_user_id,
        case
          when home_score.submitted and not away_score.submitted then 3
          when not home_score.submitted then 0
          when home_score.points > away_score.points then 3
          when home_score.points < away_score.points then 0
          else 1
        end,
        home_score.points,
        away_score.points
      ),
      (
        fixture.away_user_id,
        fixture.home_user_id,
        case
          when away_score.submitted and not home_score.submitted then 3
          when not away_score.submitted then 0
          when away_score.points > home_score.points then 3
          when away_score.points < home_score.points then 0
          else 1
        end,
        away_score.points,
        home_score.points
      )
    ) side(user_id, opponent_id, table_points, points_for, points_against)
    where fixture.competition_id = p_competition_id
      and fixture.stage = 'group'
      and predictor_internal.cup_window_settled(fixture.window_id)
  ),
  per_user as (
    select
      member.user_id,
      member.group_id,
      member.size,
      member.draw_number,
      coalesce(sum(result.table_points), 0)::integer as table_points,
      coalesce(sum(result.points_for), 0)::integer as points_for,
      coalesce(sum(result.points_against), 0)::integer as points_against,
      totals.window_points,
      totals.exacts,
      totals.corrects,
      totals.scoreline_error
    from members member
    join window_totals totals on totals.user_id = member.user_id
    left join results result
      on result.user_id = member.user_id and result.group_id = member.group_id
    group by member.user_id, member.group_id, member.size, member.draw_number,
      totals.window_points, totals.exacts, totals.corrects, totals.scoreline_error
  ),
  -- Steps 4–5: among players whose steps 0–3 key is identical, a mini
  -- head-to-head of table points then prediction-point difference.
  with_mini as (
    select
      p.*,
      coalesce((
        select sum(r.table_points)::integer
        from results r
        join per_user tied
          on tied.group_id = p.group_id
          and tied.user_id = r.opponent_id
          and tied.table_points = p.table_points
          and tied.window_points = p.window_points
          and tied.exacts = p.exacts
          and tied.corrects = p.corrects
        where r.user_id = p.user_id and r.group_id = p.group_id
      ), 0) as mini_points,
      coalesce((
        select sum(r.points_for - r.points_against)::integer
        from results r
        join per_user tied
          on tied.group_id = p.group_id
          and tied.user_id = r.opponent_id
          and tied.table_points = p.table_points
          and tied.window_points = p.window_points
          and tied.exacts = p.exacts
          and tied.corrects = p.corrects
        where r.user_id = p.user_id and r.group_id = p.group_id
      ), 0) as mini_difference
    from per_user p
  )
  select
    wm.user_id,
    wm.group_id,
    wm.size as group_size,
    wm.draw_number,
    wm.table_points,
    wm.points_for,
    wm.points_against,
    wm.window_points,
    wm.exacts,
    wm.corrects,
    wm.scoreline_error,
    row_number() over (
      partition by wm.group_id
      order by
        wm.table_points desc,
        wm.window_points desc,
        wm.exacts desc,
        wm.corrects desc,
        wm.mini_points desc,
        wm.mini_difference desc,
        (wm.points_for - wm.points_against) desc,
        wm.scoreline_error asc,
        wm.draw_number asc
    )::integer as position
  from with_mini wm
$$;

revoke all on function predictor_internal.cup_bracket_order(integer)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.cup_final_group_tables(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The qualification gate (service-role only, audited, runs exactly once).
-- ---------------------------------------------------------------------------

create or replace function public.admin_finalise_predictor_cup_groups(
  p_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_competition public.bonus_competitions%rowtype;
  v_unsettled integer;
  v_total integer;
  v_target integer;
  v_automatic integer;
  v_wildcards integer;
  v_q integer;
  v_p integer := 1;
  v_ties integer;
  v_byes integer;
  v_rounds integer;
  v_needed integer;
  v_playoff_window uuid;
  v_first_round_window uuid;
  v_layout integer[];
  v_home_seeds integer[] := '{}';
  v_away_seeds integer[] := '{}';
  t integer;
  u integer;
  v_swap integer;
  k integer;
begin
  select * into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id
    for update;

  if not found or v_competition.game_key <> 'predictor_cup' then
    raise exception 'Predictor Cup competition not found'
      using errcode = 'no_data_found';
  end if;

  if v_competition.draw_completed_at is null then
    raise exception 'The Cup group stage has not been drawn'
      using errcode = '55000';
  end if;

  if exists (
    select 1 from public.bonus_cup_members member
    where member.competition_id = p_competition_id
      and member.qualified_as is not null
  ) or exists (
    select 1 from public.bonus_cup_fixtures fixture
    where fixture.competition_id = p_competition_id
      and fixture.stage <> 'group'
  ) then
    raise exception 'The Cup group stage has already been finalised'
      using errcode = '55000';
  end if;

  select count(*) into v_unsettled
    from public.bonus_competition_windows win
    where win.competition_id = p_competition_id
      and win.sequence between 1 and 3
      and not predictor_internal.cup_window_settled(win.id);

  if v_unsettled > 0 then
    raise exception 'All three Cup group windows must settle before qualification (% pending)',
      v_unsettled
      using errcode = '55000';
  end if;

  -- The complete §5.2 tables, stored once as the immutable gate basis.
  drop table if exists pg_temp.cup_gate_tables;
  create temporary table cup_gate_tables on commit drop as
    select * from predictor_internal.cup_final_group_tables(p_competition_id);

  select count(*) into v_total from pg_temp.cup_gate_tables;

  update public.bonus_cup_members member
    set group_position = gate.position::smallint,
        qualified_as = case
          when gate.position = 1 then 'winner'
          when gate.position = 2 and gate.group_size = 4 then 'runner_up'
          else null
        end
    from pg_temp.cup_gate_tables gate
    where member.competition_id = p_competition_id
      and member.user_id = gate.user_id;

  select count(*) into v_automatic
    from public.bonus_cup_members member
    where member.competition_id = p_competition_id
      and member.qualified_as is not null;

  v_target := round(v_total * 2.0 / 3)::integer;
  v_wildcards := greatest(0, v_target - v_automatic);

  -- §6.3 wildcard order across groups: per-scheduled-fixture table points
  -- first — raw table points are never compared across group sizes.
  update public.bonus_cup_members member
    set qualified_as = 'wildcard'
    from (
      select gate.user_id
      from pg_temp.cup_gate_tables gate
      where (gate.group_size = 4 and gate.position = 3)
        or (gate.group_size = 3 and gate.position = 2)
      order by
        gate.table_points::numeric / (gate.group_size - 1) desc,
        gate.window_points desc,
        gate.exacts desc,
        gate.corrects desc,
        gate.scoreline_error asc,
        gate.draw_number asc
      limit v_wildcards
    ) wildcard
    where member.competition_id = p_competition_id
      and member.user_id = wildcard.user_id;

  -- §7.1 seeding: winners, automatic runners-up, wildcards; the same
  -- per-fixture order inside each band.
  update public.bonus_cup_members member
    set seed = seeded.seed
    from (
      select
        gate.user_id,
        row_number() over (
          order by
            case qualifier.qualified_as
              when 'winner' then 1
              when 'runner_up' then 2
              else 3
            end,
            gate.table_points::numeric / (gate.group_size - 1) desc,
            gate.window_points desc,
            gate.exacts desc,
            gate.corrects desc,
            gate.scoreline_error asc,
            gate.draw_number asc
        )::integer as seed
      from pg_temp.cup_gate_tables gate
      join public.bonus_cup_members qualifier
        on qualifier.competition_id = p_competition_id
        and qualifier.user_id = gate.user_id
        and qualifier.qualified_as is not null
    ) seeded
    where member.competition_id = p_competition_id
      and member.user_id = seeded.user_id;

  update public.bonus_competition_entrants entrant
    set outcome = case when member.qualified_as is null
      then 'eliminated' else 'qualified' end
    from public.bonus_cup_members member
    where member.competition_id = p_competition_id
      and entrant.competition_id = p_competition_id
      and entrant.user_id = member.user_id;

  select count(*) into v_q
    from public.bonus_cup_members member
    where member.competition_id = p_competition_id and member.seed is not null;

  while v_p * 2 <= v_q loop
    v_p := v_p * 2;
  end loop;
  v_ties := v_q - v_p;
  v_byes := case when v_ties = 0 then 0 else 2 * v_p - v_q end;
  v_rounds := (select count(*) from generate_series(1, 30) n where (1 << n) <= v_p);

  -- §13.1: the whole knockout window plan must exist before the gate runs.
  v_needed := v_rounds + case when v_ties > 0 then 1 else 0 end;
  if (
    select count(*) from public.bonus_competition_windows win
    where win.competition_id = p_competition_id
      and win.sequence between 4 and 3 + v_needed
  ) <> v_needed then
    raise exception 'The Cup needs % knockout windows (sequences 4-%) configured before qualification',
      v_needed, 3 + v_needed
      using errcode = '55000';
  end if;

  if v_ties > 0 then
    select win.id into v_playoff_window
      from public.bonus_competition_windows win
      where win.competition_id = p_competition_id and win.sequence = 4;

    -- §7.2/§7.3: highest remaining vs lowest, then the deterministic
    -- same-group avoidance pass (first eligible swap of away sides).
    for t in 1..v_ties loop
      v_home_seeds := array_append(v_home_seeds, v_byes + t);
      v_away_seeds := array_append(v_away_seeds, v_q + 1 - t);
    end loop;

    for t in 1..v_ties loop
      if predictor_internal.cup_seed_group(p_competition_id, v_home_seeds[t])
        = predictor_internal.cup_seed_group(p_competition_id, v_away_seeds[t]) then
        for u in 1..v_ties loop
          if u <> t
            and predictor_internal.cup_seed_group(p_competition_id, v_home_seeds[t])
              <> predictor_internal.cup_seed_group(p_competition_id, v_away_seeds[u])
            and predictor_internal.cup_seed_group(p_competition_id, v_home_seeds[u])
              <> predictor_internal.cup_seed_group(p_competition_id, v_away_seeds[t]) then
            v_swap := v_away_seeds[t];
            v_away_seeds[t] := v_away_seeds[u];
            v_away_seeds[u] := v_swap;
            exit;
          end if;
        end loop;
      end if;
    end loop;

    for t in 1..v_ties loop
      insert into public.bonus_cup_fixtures
        (competition_id, stage, window_id, bracket_slot, home_user_id, away_user_id)
      select p_competition_id, 'playoff', v_playoff_window, t, home_member.user_id, away_member.user_id
      from public.bonus_cup_members home_member,
           public.bonus_cup_members away_member
      where home_member.competition_id = p_competition_id
        and home_member.seed = v_home_seeds[t]
        and away_member.competition_id = p_competition_id
        and away_member.seed = v_away_seeds[t];
    end loop;
  else
    -- No playoff needed: the round of P starts immediately in sequence 4.
    select win.id into v_first_round_window
      from public.bonus_competition_windows win
      where win.competition_id = p_competition_id and win.sequence = 4;

    v_layout := predictor_internal.cup_bracket_order(v_p);
    for k in 1..(v_p / 2) loop
      insert into public.bonus_cup_fixtures
        (competition_id, stage, window_id, round_size, bracket_slot,
         home_user_id, away_user_id)
      select p_competition_id, 'knockout', v_first_round_window, v_p, k,
             home_member.user_id, away_member.user_id
      from public.bonus_cup_members home_member,
           public.bonus_cup_members away_member
      where home_member.competition_id = p_competition_id
        and home_member.seed = v_layout[2 * k - 1]
        and away_member.competition_id = p_competition_id
        and away_member.seed = v_layout[2 * k];
    end loop;
  end if;

  insert into public.bonus_competition_audit (competition_id, action, detail)
  values (
    p_competition_id,
    'cup_groups_finalised',
    jsonb_build_object(
      'entrants', v_total,
      'target', v_target,
      'automatic', v_automatic,
      'wildcards', v_wildcards,
      'qualifiers', v_q,
      'bracket', v_p,
      'playoff_ties', v_ties,
      'byes', v_byes
    )
  );

  return jsonb_build_object(
    'competition_id', p_competition_id,
    'entrants', v_total,
    'target', v_target,
    'qualifiers', v_q,
    'automatic', v_automatic,
    'wildcards', v_wildcards,
    'bracket', v_p,
    'playoff_ties', v_ties,
    'byes', v_byes
  );
end;
$$;

-- Seed → group lookup used by the same-group avoidance pass. Internal.
create or replace function predictor_internal.cup_seed_group(
  p_competition_id uuid,
  p_seed integer
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.group_id
  from public.bonus_cup_members member
  where member.competition_id = p_competition_id and member.seed = p_seed
$$;

revoke all on function predictor_internal.cup_seed_group(uuid, integer)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The knockout round settle operation (service-role only, audited).
-- ---------------------------------------------------------------------------

create or replace function public.admin_settle_predictor_cup_round(
  p_competition_id uuid,
  p_window_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_competition public.bonus_competitions%rowtype;
  v_window public.bonus_competition_windows%rowtype;
  v_stage text;
  v_round_size integer;
  v_actual_total integer;
  v_fixture record;
  v_home record;
  v_away record;
  v_home_seed integer;
  v_away_seed integer;
  v_home_penalty smallint;
  v_away_penalty smallint;
  v_winner uuid;
  v_decided text;
  v_decisions jsonb := '[]'::jsonb;
  v_q integer;
  v_p integer := 1;
  v_byes integer;
  v_next_window uuid;
  v_layout integer[];
  v_champion uuid;
  k integer;
begin
  select * into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id
    for update;

  if not found or v_competition.game_key <> 'predictor_cup' then
    raise exception 'Predictor Cup competition not found'
      using errcode = 'no_data_found';
  end if;

  select * into v_window
    from public.bonus_competition_windows win
    where win.id = p_window_id and win.competition_id = p_competition_id;

  if not found then
    raise exception 'Cup window not found'
      using errcode = 'no_data_found';
  end if;

  select min(fixture.stage), min(fixture.round_size)
    into v_stage, v_round_size
    from public.bonus_cup_fixtures fixture
    where fixture.competition_id = p_competition_id
      and fixture.window_id = p_window_id
      and fixture.stage <> 'group';

  if v_stage is null then
    raise exception 'This window has no Cup knockout ties'
      using errcode = 'no_data_found';
  end if;

  if exists (
    select 1 from public.bonus_cup_fixtures fixture
    where fixture.competition_id = p_competition_id
      and fixture.window_id = p_window_id
      and fixture.winner_user_id is not null
  ) then
    raise exception 'This Cup round has already been settled'
      using errcode = '55000';
  end if;

  if not predictor_internal.cup_window_settled(p_window_id) then
    raise exception 'The round''s designated real fixtures are not all officially confirmed'
      using errcode = '55000';
  end if;

  -- The Penalty Number target: total regulation-time goals across the
  -- round's designated real matches (§8.3).
  select coalesce(sum(
      case when m.round = 'group'
        then m.home_score + m.away_score
        else m.home_score_90 + m.away_score_90
      end), 0)::integer
    into v_actual_total
    from public.bonus_window_fixtures f
    join public.matches m on m.id = f.match_id
    where f.window_id = p_window_id;

  for v_fixture in
    select * from public.bonus_cup_fixtures fixture
    where fixture.competition_id = p_competition_id
      and fixture.window_id = p_window_id
      and fixture.stage <> 'group'
    order by fixture.bracket_slot
  loop
    select * into v_home
      from predictor_internal.cup_window_scores(p_competition_id, p_window_id) s
      where s.user_id = v_fixture.home_user_id;
    select * into v_away
      from predictor_internal.cup_window_scores(p_competition_id, p_window_id) s
      where s.user_id = v_fixture.away_user_id;

    select member.seed into v_home_seed
      from public.bonus_cup_members member
      where member.competition_id = p_competition_id
        and member.user_id = v_fixture.home_user_id;
    select member.seed into v_away_seed
      from public.bonus_cup_members member
      where member.competition_id = p_competition_id
        and member.user_id = v_fixture.away_user_id;

    if v_home.submitted and v_away.submitted then
      if v_home.points <> v_away.points then
        v_decided := 'points';
        v_winner := case when v_home.points > v_away.points
          then v_fixture.home_user_id else v_fixture.away_user_id end;
      elsif v_home.scoreline_error <> v_away.scoreline_error then
        v_decided := 'extra_time';
        v_winner := case when v_home.scoreline_error < v_away.scoreline_error
          then v_fixture.home_user_id else v_fixture.away_user_id end;
      else
        select pn.value into v_home_penalty
          from public.bonus_cup_penalty_numbers pn
          where pn.window_id = p_window_id
            and pn.user_id = v_fixture.home_user_id;
        select pn.value into v_away_penalty
          from public.bonus_cup_penalty_numbers pn
          where pn.window_id = p_window_id
            and pn.user_id = v_fixture.away_user_id;

        if v_home_penalty is not null and v_away_penalty is not null then
          -- Opposite parity lanes: equidistance is impossible (§8.3).
          v_decided := 'penalty_number';
          v_winner := case
            when abs(v_home_penalty - v_actual_total)
              < abs(v_away_penalty - v_actual_total)
            then v_fixture.home_user_id else v_fixture.away_user_id end;
        elsif v_home_penalty is not null or v_away_penalty is not null then
          v_decided := 'walkover';
          v_winner := case when v_home_penalty is not null
            then v_fixture.home_user_id else v_fixture.away_user_id end;
        else
          v_decided := 'admin_walkover';
          v_winner := case when v_home_seed < v_away_seed
            then v_fixture.home_user_id else v_fixture.away_user_id end;
        end if;
      end if;
    elsif v_home.submitted or v_away.submitted then
      v_decided := 'walkover';
      v_winner := case when v_home.submitted
        then v_fixture.home_user_id else v_fixture.away_user_id end;
    else
      v_decided := 'admin_walkover';
      v_winner := case when v_home_seed < v_away_seed
        then v_fixture.home_user_id else v_fixture.away_user_id end;
    end if;

    update public.bonus_cup_fixtures fixture
      set winner_user_id = v_winner,
          decided_by = v_decided,
          settled_at = now()
      where fixture.id = v_fixture.id;

    update public.bonus_competition_entrants entrant
      set outcome = 'eliminated'
      where entrant.competition_id = p_competition_id
        and entrant.user_id = case when v_winner = v_fixture.home_user_id
          then v_fixture.away_user_id else v_fixture.home_user_id end;

    v_decisions := v_decisions || jsonb_build_object(
      'slot', v_fixture.bracket_slot,
      'decided_by', v_decided
    );
  end loop;

  -- Progression (§10.1: the settled round activates the next stage).
  if v_stage = 'playoff' then
    select count(*) into v_q
      from public.bonus_cup_members member
      where member.competition_id = p_competition_id and member.seed is not null;
    while v_p * 2 <= v_q loop
      v_p := v_p * 2;
    end loop;
    v_byes := 2 * v_p - v_q;

    select win.id into v_next_window
      from public.bonus_competition_windows win
      where win.competition_id = p_competition_id
        and win.sequence = v_window.sequence + 1;
    if v_next_window is null then
      raise exception 'The next Cup knockout window (sequence %) is not configured',
        v_window.sequence + 1
        using errcode = '55000';
    end if;

    -- Seats: byes keep their seed's seat; the winner of playoff tie t takes
    -- seat 2P − Q + t. The bracket is fixed from here (§7.3).
    drop table if exists pg_temp.cup_round_seats;
    create temporary table cup_round_seats on commit drop as
      select member.seed as seat, member.user_id
      from public.bonus_cup_members member
      where member.competition_id = p_competition_id
        and member.seed between 1 and v_byes
      union all
      select v_byes + fixture.bracket_slot, fixture.winner_user_id
      from public.bonus_cup_fixtures fixture
      where fixture.competition_id = p_competition_id
        and fixture.window_id = p_window_id
        and fixture.stage = 'playoff';

    v_layout := predictor_internal.cup_bracket_order(v_p);
    for k in 1..(v_p / 2) loop
      insert into public.bonus_cup_fixtures
        (competition_id, stage, window_id, round_size, bracket_slot,
         home_user_id, away_user_id)
      select p_competition_id, 'knockout', v_next_window, v_p, k,
             home_seat.user_id, away_seat.user_id
      from pg_temp.cup_round_seats home_seat,
           pg_temp.cup_round_seats away_seat
      where home_seat.seat = v_layout[2 * k - 1]
        and away_seat.seat = v_layout[2 * k];
    end loop;
  elsif v_round_size > 2 then
    select win.id into v_next_window
      from public.bonus_competition_windows win
      where win.competition_id = p_competition_id
        and win.sequence = v_window.sequence + 1;
    if v_next_window is null then
      raise exception 'The next Cup knockout window (sequence %) is not configured',
        v_window.sequence + 1
        using errcode = '55000';
    end if;

    insert into public.bonus_cup_fixtures
      (competition_id, stage, window_id, round_size, bracket_slot,
       home_user_id, away_user_id)
    select
      p_competition_id, 'knockout', v_next_window, v_round_size / 2,
      (higher.bracket_slot + 1) / 2,
      higher.winner_user_id, lower.winner_user_id
    from public.bonus_cup_fixtures higher
    join public.bonus_cup_fixtures lower
      on lower.competition_id = p_competition_id
      and lower.window_id = p_window_id
      and lower.stage = 'knockout'
      and lower.bracket_slot = higher.bracket_slot + 1
    where higher.competition_id = p_competition_id
      and higher.window_id = p_window_id
      and higher.stage = 'knockout'
      and higher.bracket_slot % 2 = 1;
  else
    -- The final: crown the champion (§11.3) and complete the competition.
    select fixture.winner_user_id into v_champion
      from public.bonus_cup_fixtures fixture
      where fixture.competition_id = p_competition_id
        and fixture.window_id = p_window_id
        and fixture.stage = 'knockout';

    update public.bonus_competition_entrants entrant
      set outcome = 'champion'
      where entrant.competition_id = p_competition_id
        and entrant.user_id = v_champion;

    update public.bonus_competitions competition
      set completed_at = now(), updated_at = now()
      where competition.id = p_competition_id;

    insert into public.bonus_competition_audit (competition_id, action, detail)
    values (
      p_competition_id,
      'cup_champion',
      jsonb_build_object('user_id', v_champion)
    );
  end if;

  insert into public.bonus_competition_audit (competition_id, action, detail)
  values (
    p_competition_id,
    'cup_round_settled',
    jsonb_build_object(
      'window_sequence', v_window.sequence,
      'stage', v_stage,
      'round_size', v_round_size,
      'actual_total_goals', v_actual_total,
      'decisions', v_decisions
    )
  );

  return jsonb_build_object(
    'competition_id', p_competition_id,
    'window_sequence', v_window.sequence,
    'stage', v_stage,
    'ties_settled', jsonb_array_length(v_decisions),
    'champion', v_champion
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Penalty Number submission (§8.3, §9.1): authenticated, parity-laned,
-- locked at the first real kickoff of the round's window.
-- ---------------------------------------------------------------------------

create or replace function public.submit_cup_penalty_number(
  p_competition_id uuid,
  p_window_id uuid,
  p_value smallint,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_fixture public.bonus_cup_fixtures%rowtype;
  v_first_kickoff timestamptz;
  v_is_home boolean;
  v_stored_version integer;
  v_new_version integer;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  if p_value is null or p_value < 0 or p_value > 99 then
    raise exception 'The Penalty Number must be a whole number from 0 to 99'
      using errcode = 'check_violation';
  end if;

  select * into v_fixture
    from public.bonus_cup_fixtures fixture
    where fixture.competition_id = p_competition_id
      and fixture.window_id = p_window_id
      and fixture.stage <> 'group'
      and v_uid in (fixture.home_user_id, fixture.away_user_id);

  if not found then
    raise exception 'You have no Cup tie in this round'
      using errcode = 'no_data_found';
  end if;

  if v_fixture.winner_user_id is not null then
    raise exception 'This Cup round has already been settled'
      using errcode = '55000';
  end if;

  select min(m.kickoff_at) into v_first_kickoff
    from public.bonus_window_fixtures f
    join public.matches m on m.id = f.match_id
    where f.window_id = p_window_id;

  if v_first_kickoff is null then
    raise exception 'This round''s real fixtures are not scheduled yet'
      using errcode = '55000';
  end if;

  if now() >= v_first_kickoff then
    raise exception 'The Penalty Number locked at the round''s first kickoff'
      using errcode = '55000';
  end if;

  -- Lanes are fixed at round creation: the home side (better seed) holds
  -- the ODD lane, the away side the EVEN lane (§8.3).
  v_is_home := v_fixture.home_user_id = v_uid;
  if v_is_home and p_value % 2 = 0 then
    raise exception 'Your lane is ODD — pick an odd number from 1 to 99'
      using errcode = 'check_violation';
  end if;
  if not v_is_home and p_value % 2 = 1 then
    raise exception 'Your lane is EVEN — pick an even number from 0 to 98'
      using errcode = 'check_violation';
  end if;

  select pn.version into v_stored_version
    from public.bonus_cup_penalty_numbers pn
    where pn.window_id = p_window_id and pn.user_id = v_uid
    for update;

  if v_stored_version is null then
    if p_expected_version is not null and p_expected_version <> 0 then
      raise exception 'penalty number version conflict (expected %, stored none)',
        p_expected_version
        using errcode = 'PT409';
    end if;

    insert into public.bonus_cup_penalty_numbers
      (competition_id, window_id, user_id, value)
    values (p_competition_id, p_window_id, v_uid, p_value);
    v_new_version := 0;
  else
    if p_expected_version is null
      or p_expected_version is distinct from v_stored_version then
      raise exception 'penalty number version conflict (expected %, stored %)',
        p_expected_version, v_stored_version
        using errcode = 'PT409';
    end if;

    update public.bonus_cup_penalty_numbers pn
      set value = p_value,
          version = v_stored_version + 1,
          updated_at = now()
      where pn.window_id = p_window_id and pn.user_id = v_uid;
    v_new_version := v_stored_version + 1;
  end if;

  return jsonb_build_object(
    'window_id', p_window_id,
    'value', p_value,
    'version', v_new_version,
    'locks_at', v_first_kickoff
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The my-cup read grows the knockout journey: qualification state, the
-- bracket, stored tie results, my Penalty Number lane and the honours.
-- ---------------------------------------------------------------------------

create or replace function public.get_my_cup(
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
  v_competition public.bonus_competitions%rowtype;
  v_group_id uuid;
  v_is_entrant boolean;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_competition
    from public.bonus_competitions competition
    where competition.tournament_id = p_tournament_id
      and competition.game_key = 'predictor_cup'
      and competition.published;

  if not found then
    raise exception 'The Predictor Cup is not available for this tournament'
      using errcode = 'no_data_found';
  end if;

  select member.group_id into v_group_id
    from public.bonus_cup_members member
    where member.competition_id = v_competition.id
      and member.user_id = v_uid;

  v_is_entrant := exists (
    select 1 from public.bonus_competition_entrants entrant
    where entrant.competition_id = v_competition.id
      and entrant.user_id = v_uid
  );

  return jsonb_build_object(
    'server_now', now(),
    'competition_id', v_competition.id,
    'registration_closes_at', v_competition.registration_closes_at,
    'draw_completed_at', v_competition.draw_completed_at,
    'completed_at', v_competition.completed_at,
    'entrant', (
      select jsonb_build_object(
        'joined_at', entrant.joined_at,
        'outcome', entrant.outcome
      )
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition.id
        and entrant.user_id = v_uid
    ),
    'entrant_count', (
      select count(*)::integer
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition.id
    ),
    'group_count', (
      select count(*)::integer
      from public.bonus_cup_groups grp
      where grp.competition_id = v_competition.id
    ),
    'my_member', case when v_group_id is null then null else (
      select jsonb_build_object(
        'draw_number', member.draw_number,
        'group_position', member.group_position,
        'qualified_as', member.qualified_as,
        'seed', member.seed
      )
      from public.bonus_cup_members member
      where member.competition_id = v_competition.id
        and member.user_id = v_uid
    ) end,
    'my_group', case when v_group_id is null then null else (
      select jsonb_build_object(
        'ordinal', grp.ordinal,
        'size', grp.size,
        'members', (
          select jsonb_agg(
            jsonb_build_object(
              'user_id', member.user_id,
              'display_name', coalesce(profile.display_name, 'Player'),
              'draw_number', member.draw_number
            )
            order by member.draw_number
          )
          from public.bonus_cup_members member
          left join public.profiles profile on profile.id = member.user_id
          where member.group_id = grp.id
        ),
        'standings', (
          with member_windows as (
            select
              member.user_id,
              member.draw_number,
              coalesce(profile.display_name, 'Player') as display_name,
              coalesce(sum(scores.points), 0)::integer as window_points,
              coalesce(sum(scores.exacts), 0)::integer as exacts,
              coalesce(sum(scores.corrects), 0)::integer as corrects,
              coalesce(sum(scores.scoreline_error), 0)::integer as scoreline_error
            from public.bonus_cup_members member
            left join public.profiles profile on profile.id = member.user_id
            left join public.bonus_competition_windows win
              on win.competition_id = v_competition.id
              and win.sequence between 1 and 3
            left join lateral (
              select * from predictor_internal.cup_window_scores(v_competition.id, win.id) s
              where s.user_id = member.user_id
            ) scores on true
            where member.group_id = v_group_id
            group by member.user_id, member.draw_number, profile.display_name
          ),
          settled_results as (
            select
              fixture.home_user_id,
              fixture.away_user_id,
              home_score.points as home_points,
              away_score.points as away_points,
              home_score.submitted as home_submitted,
              away_score.submitted as away_submitted
            from public.bonus_cup_fixtures fixture
            join lateral (
              select * from predictor_internal.cup_window_scores(v_competition.id, fixture.window_id) s
              where s.user_id = fixture.home_user_id
            ) home_score on true
            join lateral (
              select * from predictor_internal.cup_window_scores(v_competition.id, fixture.window_id) s
              where s.user_id = fixture.away_user_id
            ) away_score on true
            where fixture.group_id = v_group_id
              and predictor_internal.cup_window_settled(fixture.window_id)
          ),
          per_user as (
            select
              side.user_id,
              count(*)::integer as played,
              count(*) filter (where side.outcome = 'win')::integer as wins,
              count(*) filter (where side.outcome = 'draw')::integer as draws,
              count(*) filter (where side.outcome = 'loss')::integer as losses,
              coalesce(sum(side.points_for), 0)::integer as points_for,
              coalesce(sum(side.points_against), 0)::integer as points_against,
              coalesce(sum(side.table_points), 0)::integer as table_points
            from (
              select r.home_user_id as user_id,
                case
                  when r.home_submitted and not r.away_submitted then 'win'
                  when not r.home_submitted and r.away_submitted then 'loss'
                  when not r.home_submitted and not r.away_submitted then 'void'
                  when r.home_points > r.away_points then 'win'
                  when r.home_points < r.away_points then 'loss'
                  else 'draw'
                end as outcome,
                r.home_points as points_for,
                r.away_points as points_against,
                case
                  when r.home_submitted and not r.away_submitted then 3
                  when not r.home_submitted then 0
                  when r.home_points > r.away_points then 3
                  when r.home_points < r.away_points then 0
                  else 1
                end as table_points
              from settled_results r
              union all
              select r.away_user_id,
                case
                  when r.away_submitted and not r.home_submitted then 'win'
                  when not r.away_submitted and r.home_submitted then 'loss'
                  when not r.away_submitted and not r.home_submitted then 'void'
                  when r.away_points > r.home_points then 'win'
                  when r.away_points < r.home_points then 'loss'
                  else 'draw'
                end,
                r.away_points,
                r.home_points,
                case
                  when r.away_submitted and not r.home_submitted then 3
                  when not r.away_submitted then 0
                  when r.away_points > r.home_points then 3
                  when r.away_points < r.home_points then 0
                  else 1
                end
              from settled_results r
            ) side
            group by side.user_id
          )
          select jsonb_agg(
            jsonb_build_object(
              'user_id', ranked.user_id,
              'display_name', ranked.display_name,
              'played', ranked.played,
              'wins', ranked.wins,
              'draws', ranked.draws,
              'losses', ranked.losses,
              'points_for', ranked.points_for,
              'points_against', ranked.points_against,
              'table_points', ranked.table_points,
              'window_points', ranked.window_points,
              'position', ranked.position
            )
            order by ranked.position
          )
          from (
            select
              mw.user_id,
              mw.display_name,
              coalesce(pu.played, 0) as played,
              coalesce(pu.wins, 0) as wins,
              coalesce(pu.draws, 0) as draws,
              coalesce(pu.losses, 0) as losses,
              coalesce(pu.points_for, 0) as points_for,
              coalesce(pu.points_against, 0) as points_against,
              coalesce(pu.table_points, 0) as table_points,
              mw.window_points,
              row_number() over (
                order by
                  coalesce(pu.table_points, 0) desc,
                  mw.window_points desc,
                  mw.exacts desc,
                  mw.corrects desc,
                  coalesce(pu.points_for, 0) - coalesce(pu.points_against, 0) desc,
                  mw.scoreline_error asc,
                  mw.draw_number asc
              )::integer as position
            from member_windows mw
            left join per_user pu on pu.user_id = mw.user_id
          ) ranked
        )
      )
      from public.bonus_cup_groups grp
      where grp.id = v_group_id
    ) end,
    'my_fixtures', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'fixture_id', fixture.id,
            'stage', fixture.stage,
            'matchday', fixture.matchday,
            'round_size', fixture.round_size,
            'bracket_slot', fixture.bracket_slot,
            'window_label', win.label,
            'window_opens_at', win.opens_at,
            'window_locks_at', win.locks_at,
            'opponent', jsonb_build_object(
              'user_id', opponent.user_id,
              'display_name', coalesce(opponent_profile.display_name, 'Player')
            ),
            'my_points', my_score.points,
            'opponent_points', opponent_score.points,
            'decided_by', fixture.decided_by,
            'status', case
              when fixture.winner_user_id is not null then 'settled'
              when fixture.stage <> 'group' then 'pending'
              when predictor_internal.cup_window_settled(fixture.window_id)
                then 'settled' else 'pending' end,
            'result', case
              when fixture.winner_user_id is not null then
                case when fixture.winner_user_id = v_uid then 'win' else 'loss' end
              when fixture.stage <> 'group' then null
              when not predictor_internal.cup_window_settled(fixture.window_id) then null
              when my_score.submitted and not opponent_score.submitted then 'walkover_win'
              when not my_score.submitted and opponent_score.submitted then 'walkover_loss'
              when not my_score.submitted and not opponent_score.submitted then 'void'
              when my_score.points > opponent_score.points then 'win'
              when my_score.points < opponent_score.points then 'loss'
              else 'draw'
            end
          )
          order by win.sequence, fixture.matchday nulls last, fixture.created_at
        )
        from public.bonus_cup_fixtures fixture
        join public.bonus_competition_windows win on win.id = fixture.window_id
        cross join lateral (
          select case when fixture.home_user_id = v_uid
            then fixture.away_user_id else fixture.home_user_id end as user_id
        ) opponent
        left join public.profiles opponent_profile
          on opponent_profile.id = opponent.user_id
        left join lateral (
          select * from predictor_internal.cup_window_scores(v_competition.id, fixture.window_id) s
          where s.user_id = v_uid
        ) my_score on true
        left join lateral (
          select * from predictor_internal.cup_window_scores(v_competition.id, fixture.window_id) s
          where s.user_id = opponent.user_id
        ) opponent_score on true
        where fixture.competition_id = v_competition.id
          and v_uid in (fixture.home_user_id, fixture.away_user_id)
      ),
      '[]'::jsonb
    ),
    'penalty_number', (
      select jsonb_build_object(
        'window_id', win.id,
        'window_label', win.label,
        'lane', case when fixture.home_user_id = v_uid then 'odd' else 'even' end,
        'value', pn.value,
        'version', pn.version,
        'locks_at', first_kickoff.at,
        'locked', first_kickoff.at is not null and now() >= first_kickoff.at
      )
      from public.bonus_cup_fixtures fixture
      join public.bonus_competition_windows win on win.id = fixture.window_id
      left join public.bonus_cup_penalty_numbers pn
        on pn.window_id = fixture.window_id and pn.user_id = v_uid
      left join lateral (
        select min(m.kickoff_at) as at
        from public.bonus_window_fixtures f
        join public.matches m on m.id = f.match_id
        where f.window_id = fixture.window_id
      ) first_kickoff on true
      where fixture.competition_id = v_competition.id
        and fixture.stage <> 'group'
        and fixture.winner_user_id is null
        and v_uid in (fixture.home_user_id, fixture.away_user_id)
      limit 1
    ),
    'bracket', case when not v_is_entrant then null else coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'stage', fixture.stage,
            'round_size', fixture.round_size,
            'bracket_slot', fixture.bracket_slot,
            'window_sequence', win.sequence,
            'window_label', win.label,
            'home', jsonb_build_object(
              'user_id', fixture.home_user_id,
              'display_name', coalesce(home_profile.display_name, 'Player')
            ),
            'away', jsonb_build_object(
              'user_id', fixture.away_user_id,
              'display_name', coalesce(away_profile.display_name, 'Player')
            ),
            'winner_user_id', fixture.winner_user_id,
            'decided_by', fixture.decided_by
          )
          order by win.sequence, fixture.bracket_slot
        )
        from public.bonus_cup_fixtures fixture
        join public.bonus_competition_windows win on win.id = fixture.window_id
        left join public.profiles home_profile
          on home_profile.id = fixture.home_user_id
        left join public.profiles away_profile
          on away_profile.id = fixture.away_user_id
        where fixture.competition_id = v_competition.id
          and fixture.stage <> 'group'
      ),
      '[]'::jsonb
    ) end,
    'champion', (
      select jsonb_build_object(
        'user_id', fixture.winner_user_id,
        'display_name', coalesce(profile.display_name, 'Player')
      )
      from public.bonus_cup_fixtures fixture
      left join public.profiles profile on profile.id = fixture.winner_user_id
      where fixture.competition_id = v_competition.id
        and fixture.stage = 'knockout'
        and fixture.round_size = 2
        and fixture.winner_user_id is not null
    ),
    'golden_predictor', case
      when not v_is_entrant or v_competition.draw_completed_at is null then null
      else (
        with totals as (
          select
            member.user_id,
            member.draw_number,
            coalesce(sum(scores.points), 0)::integer as points,
            coalesce(sum(scores.exacts), 0)::integer as exacts,
            coalesce(sum(scores.corrects), 0)::integer as corrects,
            coalesce(sum(scores.scoreline_error), 0)::integer as scoreline_error
          from public.bonus_cup_members member
          left join public.bonus_competition_windows win
            on win.competition_id = v_competition.id
          left join lateral (
            select * from predictor_internal.cup_window_scores(v_competition.id, win.id) s
            where s.user_id = member.user_id
          ) scores on true
          where member.competition_id = v_competition.id
          group by member.user_id, member.draw_number
        ),
        ranked as (
          select
            t.*,
            row_number() over (
              order by t.points desc, t.exacts desc, t.corrects desc,
                t.scoreline_error asc, t.draw_number asc
            )::integer as rank
          from totals t
        )
        select jsonb_build_object(
          'top', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'user_id', top_ranked.user_id,
                'display_name', coalesce(profile.display_name, 'Player'),
                'points', top_ranked.points,
                'rank', top_ranked.rank
              )
              order by top_ranked.rank
            )
            from (
              select * from ranked order by rank limit 20
            ) top_ranked
            left join public.profiles profile on profile.id = top_ranked.user_id
          ), '[]'::jsonb),
          'me', (
            select jsonb_build_object('points', r.points, 'rank', r.rank)
            from ranked r where r.user_id = v_uid
          )
        )
      )
    end
  );
end;
$$;

revoke all on function public.get_my_cup(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_cup(uuid)
  to authenticated, service_role;

revoke all on function public.admin_finalise_predictor_cup_groups(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_finalise_predictor_cup_groups(uuid)
  to service_role;

revoke all on function public.admin_settle_predictor_cup_round(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_settle_predictor_cup_round(uuid, uuid)
  to service_role;

revoke all on function public.submit_cup_penalty_number(uuid, uuid, smallint, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_cup_penalty_number(uuid, uuid, smallint, integer)
  to authenticated, service_role;

commit;
