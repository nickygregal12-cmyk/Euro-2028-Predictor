-- ---------------------------------------------------------------------------
-- Contract 98 — the Cup RPC layer stops reading a tournament relation.
--
-- ADR 0022 (as corrected, 3 August 2026) decided that Cup sharing happens in
-- the database: the existing `predictor_internal.cup_*` functions are
-- generalised from tournament scope to competition-season scope, so one
-- implementation serves both. Contracts 75, 76 and 77 did that for the
-- internal machinery — points, settlement, and the two season sources — and
-- contract 76 recorded that no function in the shared Cup machinery reads a
-- tournament relation.
--
-- That claim was true and it was also narrower than it sounded. It was about
-- `predictor_internal.cup_*`. The RPC layer above it was never checked, and
-- three of its functions still join `bonus_window_fixtures` to `matches`
-- directly:
--
--   * `admin_settle_predictor_cup_round` — the Penalty Number target (§8.3):
--     total regulation-time goals across the round's designated real matches;
--   * `submit_cup_penalty_number` — the instant the Penalty Number locks, the
--     first kickoff among those same fixtures;
--   * `get_my_cup` — the same instant, for display.
--
-- WHAT THAT MEANT FOR A SEASON CUP, concretely, because "not yet generalised"
-- undersells it. A season Cup's designated fixtures live in
-- `season_cup_window_fixtures` (contract 77), which those queries do not read.
-- So for every season knockout round:
--
--   * the Penalty Number target would have summed to **zero** — not failed,
--     not refused, just silently made a guess of 0 the exact answer and
--     handed the tie to whoever guessed lowest;
--   * `submit_cup_penalty_number` would find a null first kickoff and refuse
--     every submission with "This round's real fixtures are not scheduled
--     yet", so nobody could enter a Penalty Number in the first place.
--
-- The second failure is loud and the first is silent, which is the wrong way
-- round: a competitor could not submit, and if they somehow had, the tie-break
-- would have decided the round on a fabricated total. Both are fixed here.
--
-- ---------------------------------------------------------------------------
-- METHOD
-- ---------------------------------------------------------------------------
--
-- Exactly the shape contracts 75-77 established, and deliberately not a new
-- one: a tournament-named limb, a season-named limb, and a neutral combiner
-- that unions them rather than branching on competition kind. Branching would
-- reintroduce two implementations of one rule with an `if` between them, which
-- is what ADR 0022 rejected.
--
-- The tournament limb is the existing query, moved and not edited. With the
-- season link empty the combiner returns exactly what the inline query
-- returned, so the tournament Cup is behaviour-identical — established here by
-- a differential sweep over generated windows, not asserted.
--
-- NO RULE CHANGES. ADR 0022: "no qualification, seeding, bye, playoff-pairing
-- or Penalty Number rule may be altered while relocating or rescoping the
-- implementation." The Penalty Number rule is untouched — same target, same
-- lock instant, same comparison. Only where the two facts are read from moves.
--
-- ---------------------------------------------------------------------------
-- TWO PLACES THE SEASON MODEL IS NOT SYMMETRIC WITH THE TOURNAMENT, AND WHY
-- ---------------------------------------------------------------------------
--
-- 1. GOALS: the season limb says `status = 'played'` where the tournament limb
--    filters nothing. **That filter is redundant today and is kept anyway, so
--    read it as intent rather than as coverage.**
--
--    The first draft justified it on the belief that an `abandoned` season
--    fixture carries the score it had reached when it was abandoned, so
--    summing it would count goals from a match that never finished. That is
--    wrong: `season_fixtures_scores_match_status` (contract 68) makes carrying
--    a score exactly equivalent to being `played`, so an abandoned or void
--    fixture has null scores and `sum` skips it with or without the filter.
--    The sweep computes its season reference WITHOUT the filter for that
--    reason — the two agreeing is what establishes the redundancy, and if the
--    constraint were ever relaxed the reference would diverge and say so.
--
--    It is kept because it states the rule the function depends on at the
--    point that depends on it, rather than borrowing it from a CHECK three
--    migrations away. `149_cup_neutral_window_match_facts.sql` pins both
--    halves: that the constraint refuses a scored non-played fixture, and that
--    the limb ignores one if the constraint ever stops.
--
--    Separately, and not what the filter is for: the total can only ever be
--    read at settlement, and `cup_window_settled` will not settle while
--    `cup_season_window_unsettled` sees any linked fixture that is not
--    `played`. So every linked season fixture is `played` at the one call
--    site regardless.
--
-- 2. KICKOFF: the season limb filters nothing, including `postponed`.
--    That is consistent with the rest of the season model rather than an
--    oversight: contract 91's `season_matchweek_card` maps `postponed` to
--    `scheduled`, treating a postponed fixture as still to come. A null
--    `kickoff_at` drops out of `min` on both limbs, which is the existing
--    tournament behaviour and fails closed — an unscheduled round refuses the
--    Penalty Number rather than opening it.
--
--    Consequence worth stating: a postponed fixture that keeps a past
--    `kickoff_at` would lock the Penalty Number early. That is an ingestion
--    obligation — a postponement must move or null its kickoff — not a rule
--    this function can repair, and inventing a repair here would put a second
--    opinion about postponement in the Cup code.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT SETTLE
-- ---------------------------------------------------------------------------
--
-- `get_my_cup(p_tournament_id)` still selects "the" published `predictor_cup`
-- for a competition with a bare `select ... into` — no `limit`, no ordering.
-- Nothing enforces one published Cup per competition, and ADR 0014 has private
-- Cups alongside the public one, so in a season that select would return an
-- arbitrary row. It is left alone deliberately: deciding which Cup a player
-- sees is a product decision for the season Cup surface, not something a
-- rescoping migration may pick by choosing a sort order. Recorded in
-- `docs/quality/current-status.md` as an open question rather than fixed
-- quietly here.
--
-- The draw's format arithmetic is also unchanged. `admin_draw_predictor_cup`
-- reads no tournament relation — it is already competition-scoped — but it
-- hardcodes the tournament's format: groups of three and four across exactly
-- three matchday windows. ADR 0014's selector owns the season's format, and
-- contract 79 deliberately kept the format limit "in the code that owns the
-- format" with `cupStoreDomains.test.ts` pinning it. Teaching the draw to
-- consult the selector is the split-execution slice, which still waits on the
-- `bonus_cup_fixtures_group_shape` decision.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- Goal total: the Penalty Number target (§8.3).
-- ---------------------------------------------------------------------------

-- The tournament limb, lifted verbatim from `admin_settle_predictor_cup_round`.
-- Regulation time: group matches carry no extra time, knockouts record the
-- 90-minute score separately.
create or replace function predictor_internal.cup_tournament_window_goal_total(
  p_window_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
      case when m.round = 'group'
        then m.home_score + m.away_score
        else m.home_score_90 + m.away_score_90
      end), 0)::integer
    from public.bonus_window_fixtures f
    join public.matches m on m.id = f.match_id
    where f.window_id = p_window_id
$$;

-- The season limb. League football has no extra time, so the recorded score
-- IS the regulation-time score; there is no 90-minute column to prefer.
create or replace function predictor_internal.cup_season_window_goal_total(
  p_window_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(sf.home_score + sf.away_score), 0)::integer
    from public.season_cup_window_fixtures link
    join public.season_fixtures sf on sf.id = link.season_fixture_id
    where link.window_id = p_window_id
      and sf.status = 'played'
$$;

-- The neutral combiner. Addition, not a branch: a window served by one limb
-- gets zero from the other, and the arithmetic cannot tell which it was.
create or replace function predictor_internal.cup_window_goal_total(
  p_window_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (predictor_internal.cup_tournament_window_goal_total(p_window_id)
        + predictor_internal.cup_season_window_goal_total(p_window_id))::integer
$$;

-- ---------------------------------------------------------------------------
-- First kickoff: the instant the Penalty Number locks.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_tournament_window_first_kickoff(
  p_window_id uuid
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select min(m.kickoff_at)
    from public.bonus_window_fixtures f
    join public.matches m on m.id = f.match_id
    where f.window_id = p_window_id
$$;

create or replace function predictor_internal.cup_season_window_first_kickoff(
  p_window_id uuid
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select min(sf.kickoff_at)
    from public.season_cup_window_fixtures link
    join public.season_fixtures sf on sf.id = link.season_fixture_id
    where link.window_id = p_window_id
$$;

-- `least` ignores nulls, so a window served by one limb takes that limb's
-- instant, and a window served by neither stays null and fails closed.
create or replace function predictor_internal.cup_window_first_kickoff(
  p_window_id uuid
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select least(
    predictor_internal.cup_tournament_window_first_kickoff(p_window_id),
    predictor_internal.cup_season_window_first_kickoff(p_window_id)
  )
$$;

revoke all on function predictor_internal.cup_tournament_window_goal_total(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.cup_season_window_goal_total(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.cup_window_goal_total(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.cup_tournament_window_first_kickoff(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.cup_season_window_first_kickoff(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.cup_window_first_kickoff(uuid)
  from public, anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- The three callers, redefined to read the neutral facts.
--
-- Bodies are the contract 63/50-era definitions unchanged apart from the read
-- itself, taken from `pg_get_functiondef` on a database with every committed
-- migration applied so that no intervening redefinition is silently reverted.
-- Everything else in each function -- the guards, the ordering, the audit rows,
-- the Penalty Number comparison -- is byte-identical to what is hosted today.
-- ---------------------------------------------------------------------------

-- The Penalty Number target (§8.3): total regulation-time goals across the
-- round's designated real fixtures, now from whichever competition supplied
-- them.
CREATE OR REPLACE FUNCTION public.admin_settle_predictor_cup_round(p_competition_id uuid, p_window_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_actual_total := predictor_internal.cup_window_goal_total(p_window_id);

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
    -- seat 2P − Q + t. The bracket is fixed from here (§7.3). Keep the seat set
    -- inside the statement so static database analysis can resolve every
    -- relation without changing the deterministic layout.
    v_layout := predictor_internal.cup_bracket_order(v_p);
    for v_slot in 1..(v_p / 2) loop
      insert into public.bonus_cup_fixtures
        (competition_id, stage, window_id, round_size, bracket_slot,
         home_user_id, away_user_id)
      with cup_round_seats as (
        select member.seed as seat, member.user_id
        from public.bonus_cup_members member
        where member.competition_id = p_competition_id
          and member.seed between 1 and v_byes
        union all
        select v_byes + fixture.bracket_slot, fixture.winner_user_id
        from public.bonus_cup_fixtures fixture
        where fixture.competition_id = p_competition_id
          and fixture.window_id = p_window_id
          and fixture.stage = 'playoff'
      )
      select p_competition_id, 'knockout', v_next_window, v_p, v_slot,
             home_seat.user_id, away_seat.user_id
      from cup_round_seats home_seat
      cross join cup_round_seats away_seat
      where home_seat.seat = v_layout[2 * v_slot - 1]
        and away_seat.seat = v_layout[2 * v_slot];
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
$function$;

-- The Penalty Number lock instant: the first kickoff among those fixtures.
-- Still fails closed on a null, which is now reachable for a season round
-- that has genuinely not been scheduled rather than for every season round.
CREATE OR REPLACE FUNCTION public.submit_cup_penalty_number(p_competition_id uuid, p_window_id uuid, p_value smallint, p_expected_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  v_first_kickoff := predictor_internal.cup_window_first_kickoff(p_window_id);

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
$function$;

-- The same instant, for display. `get_my_cup`'s competition selection is
-- deliberately untouched; see the header.
CREATE OR REPLACE FUNCTION public.get_my_cup(p_tournament_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        select predictor_internal.cup_window_first_kickoff(fixture.window_id) as at
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
$function$;

commit;
