-- Contract 194 — `CUP-004`: a Championship tie asks whether each entrant may
-- actually contest it.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT, MEASURED ON THE INSTALLED CATALOGUE
-- ---------------------------------------------------------------------------
--
-- `admin_settle_predictor_cup_round` decides a knockout tie from two things:
-- whether each side SUBMITTED predictions, and how they scored. Counted over
-- the installed definition — contract 98's, 289 lines:
--
--     game_memberships   0
--     disqualif          0
--     withdraw           0
--     left_at            0
--
-- Eligibility is never consulted. So an entrant who has been DISQUALIFIED or
-- who has WITHDRAWN, but who submitted predictions before that happened, still
-- wins their tie on points and advances through the bracket. The
-- disqualification authority even writes `bonus_competition_entrants.outcome =
-- 'eliminated'`, and the settlement driver reads neither that nor the
-- membership it came from.
--
-- That is a correctness defect rather than a missing feature, and it is worth
-- saying plainly: the platform can already remove a player from a competition
-- and then let them win a knockout tie.
--
-- ---------------------------------------------------------------------------
-- ELIGIBILITY IS NOT SUBMISSION, AND THE EXISTING LADDER IS UNTOUCHED
-- ---------------------------------------------------------------------------
--
-- The two questions are unrelated, and keeping them apart is what makes this
-- change safe:
--
--   * "neither entrant SUBMITTED" is an existing rule with an existing answer —
--     `admin_walkover`, resolved by the better seed. ADR 0022 forbids altering
--     any qualification, seeding, bye, playoff-pairing or Penalty Number rule
--     while rescoping this machinery, and ONE function serves both the
--     tournament and the season, so changing it would change the tournament.
--     **It is not changed.**
--
--   * "neither entrant may CONTEST the tie" has no existing rule, because
--     nothing ever asked. That is the case ADR 0028 § 8 decides.
--
-- The eligibility branch therefore sits ABOVE the submission ladder, and the
-- ladder is carried through unedited. Where both entrants are eligible — which
-- is every tie on every hosted environment today — this function behaves
-- exactly as it did.
--
-- ---------------------------------------------------------------------------
-- WHAT ADR 0028 § 8 SAYS, AND WHERE EACH CLAUSE LANDS
-- ---------------------------------------------------------------------------
--
--   "if one entrant cannot legally contest the tie, the eligible opponent
--    advances"          -> the branch below, `decided_by = 'walkover'`
--   "the platform records the reason/audit evidence"
--                       -> `bonus_competition_audit`, action
--                          `cup_tie_walkover_ineligible`, carrying the STORED
--                          membership state rather than a paraphrase of it
--   "it does not invent a football score or prediction points"
--                       -> nothing is written to any score, prediction or points
--                          relation on this path, and the audit row says so
--   "if neither entrant is eligible, resolution goes through an explicit
--    rule/admin path rather than fabricating a winner"
--                       -> the whole-window refusal above the loop
--
-- `decided_by` stays inside its existing vocabulary. A new value such as
-- `ineligible_opponent` was considered and rejected: ADR 0028 § 8 names AUDIT
-- EVIDENCE as where the reason belongs, and widening a stored vocabulary the
-- ADR did not ask to widen would be a rule decision taken by a migration.
--
-- ---------------------------------------------------------------------------
-- WHY "NEITHER ELIGIBLE" REFUSES THE WHOLE WINDOW
-- ---------------------------------------------------------------------------
--
-- The function already refuses to run against a window in which any tie is
-- settled — "This Cup round has already been settled". So a run that settled
-- three ties and left a fourth open could never be re-driven: the second run
-- would find the three and refuse, and the fourth would be stranded forever.
--
-- Settling a window is therefore all-or-nothing, and the refusal has to be too.
-- Nothing is written, the message names the bracket slots, and the window can
-- be driven normally once the tie has been decided explicitly.
--
-- ---------------------------------------------------------------------------
-- IT FAILS TOWARDS THE STATUS QUO
-- ---------------------------------------------------------------------------
--
-- `cup_entrant_eligibility` reports `eligible` when NO membership row exists.
-- That is deliberate and is the safe direction: a missing row is an absence of
-- evidence, not evidence of ineligibility, and treating it as a disqualification
-- would hand ties to opponents on the strength of a gap in the data. Every
-- entrant predating `game_memberships`, and every competition whose entry path
-- does not write one, therefore behaves exactly as before.
--
-- ---------------------------------------------------------------------------
-- SAFE TO RUN TWICE
-- ---------------------------------------------------------------------------
--
-- Unchanged, and by refusal rather than by no-op: the already-settled guard
-- fires on the second run. A settled legitimate winner is never revisited,
-- because the driver never reaches the loop.

begin;

-- ---------------------------------------------------------------------------
-- The eligibility authority. One function, reading the one place the platform
-- already records this.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_entrant_eligibility(
  p_competition_id uuid,
  p_user_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $eligibility$
  -- `game_memberships.status` is constrained to ('active', 'left',
  -- 'disqualified') and is what `admin_disqualify_competition_game_entry`
  -- writes. It is READ rather than copied: a second eligibility flag on the Cup
  -- tables would be a second answer to one question.
  select coalesce(
    (select case membership.status
              when 'active' then 'eligible'
              else membership.status
            end
       from public.game_memberships membership
      where membership.game_competition_id = p_competition_id
        and membership.user_id = p_user_id),
    -- No membership row: see the header. A gap in the data must not decide a
    -- knockout tie.
    'eligible');
$eligibility$;

comment on function predictor_internal.cup_entrant_eligibility(uuid, uuid) is
  'Contract 194 / CUP-004. Whether one entrant may contest a Championship tie, '
  'read from game_memberships.status: eligible, left or disqualified. Absent '
  'membership reports eligible, because a missing row is an absence of '
  'evidence rather than evidence of ineligibility.';

revoke all on function predictor_internal.cup_entrant_eligibility(uuid, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The settlement driver, redefined from its committed text with the
-- eligibility branch inserted above the submission ladder.
--
-- EXTRACTED PROGRAMMATICALLY rather than retyped, which is the method contracts
-- 118, 128 and 191 established after contract 114 silently reverted contract
-- 104 by restating a function from an older migration. Everything below the
-- eligibility branch is contract 98's text unchanged, and
-- `cupTieEligibilityParity.test.ts` proves that by diffing the two.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_settle_predictor_cup_round(p_competition_id uuid, p_window_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_competition public.bonus_competitions%rowtype;
  v_window public.bonus_competition_windows%rowtype;
  -- Contract 194 / `CUP-004`.
  v_home_eligible boolean;
  v_away_eligible boolean;
  v_blocked text;
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

  -- Contract 194 / `CUP-004`. ADR 0028 section 8: if NEITHER entrant may
  -- legally contest a tie, resolution goes through an explicit rule or admin
  -- path rather than a winner fabricated from ordinary scoring.
  --
  -- The refusal is for the WHOLE WINDOW rather than for the one tie, and that
  -- is forced by the guard directly above: a window that settled some of its
  -- ties and left one open could never be re-driven, because the second run
  -- would find a settled tie and refuse. Settling a window is all-or-nothing
  -- here, so a tie nobody may contest stops the window and names itself.
  --
  -- Nothing is written on this path. The message carries the bracket slot so
  -- an administrator can act on it without reading the table.
  select string_agg(fixture.bracket_slot::text, ', ' order by fixture.bracket_slot)
    into v_blocked
    from public.bonus_cup_fixtures fixture
   where fixture.competition_id = p_competition_id
     and fixture.window_id = p_window_id
     and fixture.stage <> 'group'
     and predictor_internal.cup_entrant_eligibility(
           p_competition_id, fixture.home_user_id) <> 'eligible'
     and predictor_internal.cup_entrant_eligibility(
           p_competition_id, fixture.away_user_id) <> 'eligible';

  if v_blocked is not null then
    raise exception
      'Neither entrant may contest tie(s) %; this needs an explicit decision rather than an automatic winner',
      v_blocked
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

    -- Contract 194 / `CUP-004`. Eligibility is decided BEFORE the submission
    -- ladder and is a different question from it: "did they predict" and "may
    -- they contest this tie" are unrelated, and until now only the first was
    -- asked. A disqualified entrant who had submitted before being removed
    -- still won on points.
    --
    -- No football score and no prediction points are invented. The eligible
    -- opponent simply advances, `decided_by` stays inside the existing
    -- vocabulary, and the REASON goes to audit evidence, which is where ADR
    -- 0028 section 8 puts it.
    v_home_eligible := predictor_internal.cup_entrant_eligibility(
      p_competition_id, v_fixture.home_user_id) = 'eligible';
    v_away_eligible := predictor_internal.cup_entrant_eligibility(
      p_competition_id, v_fixture.away_user_id) = 'eligible';

    if v_home_eligible <> v_away_eligible then
      v_decided := 'walkover';
      v_winner := case when v_home_eligible
        then v_fixture.home_user_id else v_fixture.away_user_id end;

      insert into public.bonus_competition_audit
        (competition_id, action, detail, actor_id)
      values (
        p_competition_id,
        'cup_tie_walkover_ineligible',
        jsonb_build_object(
          'window_id', p_window_id,
          'bracket_slot', v_fixture.bracket_slot,
          'advanced_user_id', v_winner,
          'ineligible_user_id', case when v_home_eligible
            then v_fixture.away_user_id else v_fixture.home_user_id end,
          -- The stored membership state, not a paraphrase of it, so the record
          -- says whether they withdrew or were disqualified.
          'ineligible_state', predictor_internal.cup_entrant_eligibility(
            p_competition_id, case when v_home_eligible
              then v_fixture.away_user_id else v_fixture.home_user_id end),
          'invented_score', false,
          'invented_points', false),
        (select auth.uid()));

    elsif v_home.submitted and v_away.submitted then
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

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_settle text := pg_get_functiondef(
    'public.admin_settle_predictor_cup_round(uuid, uuid)'::regprocedure);
begin
  -- The eligibility question is asked at all, which is the whole contract.
  if v_settle !~ 'cup_entrant_eligibility' then
    raise exception 'Settlement must consult eligibility';
  end if;

  -- And asked ABOVE the submission ladder. If the branch moved below it, a
  -- disqualified entrant who submitted would win on points again and every
  -- other assertion here would still pass.
  if position('v_home_eligible <> v_away_eligible' in v_settle) = 0
     or position('v_home_eligible <> v_away_eligible' in v_settle)
        > position('v_home.submitted and v_away.submitted' in v_settle) then
    raise exception 'Eligibility must be decided before the submission ladder';
  end if;

  -- The existing rule for "neither submitted" survives: ADR 0022 forbids
  -- altering it, and one function serves the tournament as well.
  if v_settle !~ 'admin_walkover' then
    raise exception 'The existing admin_walkover rule must survive';
  end if;

  -- No invented result. The settlement path may not write a score, a prediction
  -- or a points row.
  if v_settle ~ 'public\.season_fixtures|public\.matches|public\.season_predictions'
     or v_settle ~ 'public\.season_matchweek_scores|public\.bonus_score_events' then
    raise exception 'A walkover must not invent a score or prediction points';
  end if;

  -- The reason is recorded where ADR 0028 § 8 puts it.
  if v_settle !~ 'cup_tie_walkover_ineligible' then
    raise exception 'A walkover must record its reason as audit evidence';
  end if;

  -- Neither-eligible refuses rather than deciding.
  if v_settle !~ 'needs an explicit decision rather than an automatic winner' then
    raise exception 'A tie nobody may contest must not be decided automatically';
  end if;

  -- The already-settled guard still stands, which is what makes a second run
  -- safe and a settled winner final.
  if v_settle !~ 'This Cup round has already been settled' then
    raise exception 'Re-running must remain safe';
  end if;
end;
$$;

commit;
