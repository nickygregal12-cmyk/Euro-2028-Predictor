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
--
-- ---------------------------------------------------------------------------
-- THE BASE IS THE CATALOGUE, NOT A MIGRATION FILE
-- ---------------------------------------------------------------------------
--
-- The first draft of this contract restated the function from the committed
-- text of contract 149, the last migration whose FILE holds a full body for it.
-- That text is not the installed definition: contract 102 later patched the
-- installed function in place, and restating the older body silently reverted
-- that patch. Suite 153 caught it -- "no authority treats every non-group stage
-- as knockout" -- which is exactly the regression contract 102 exists to stop.
--
-- "Extract programmatically rather than retype" was not enough on its own. A
-- function that has been patched in place has no file holding its current body,
-- so this contract patches `pg_get_functiondef` instead, guards each anchor,
-- and asserts afterwards that contract 102's split-safety survived.

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
-- The settlement driver, patched IN PLACE from its installed definition.
--
-- WHY THIS IS A `pg_get_functiondef` PATCH RATHER THAN A RESTATED FUNCTION.
-- The first draft of this contract restated the function from the committed
-- text of contract 149 (`20260804263000_cup_neutral_window_match_facts.sql`),
-- which is the last migration whose FILE contains a full body for it. That
-- text is not the installed definition. Contract 102
-- (`20260804323000_cup_split_stage_persistence.sql`) later patched the
-- installed function in exactly this way, replacing `fixture.stage <> 'group'`
-- with `fixture.stage in ('playoff', 'knockout')` so that a stored `split`
-- fixture cannot enter the knockout settler, and pinning the member roster to
-- `phase_kind = 'initial'`. Restating the older body silently reverted both,
-- and suite 153 caught it: "no authority treats every non-group stage as
-- knockout" failed, which is precisely the regression contract 102 exists to
-- prevent.
--
-- Reading committed text is therefore not enough on its own. A function that
-- has been patched in place has no file that holds its current body, so the
-- only honest base is the CATALOGUE. Every replacement below is anchored on
-- text contract 102 does not touch, each one refuses if its anchor has moved,
-- and the block asserts afterwards that contract 102's split-safety survived.
-- ---------------------------------------------------------------------------

do $patch$
declare
  v_definition text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure
  ) into v_definition;

  -- 1. Three locals for the eligibility branch.
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '  v_window public.bonus_competition_windows%rowtype;',
    '  v_window public.bonus_competition_windows%rowtype;' || chr(10) ||
    '  -- Contract 194 / `CUP-004`.' || chr(10) ||
    '  v_home_eligible boolean;' || chr(10) ||
    '  v_away_eligible boolean;' || chr(10) ||
    '  v_blocked text;'
  );
  if v_definition = v_original then
    raise exception 'Expected Cup settlement declaration block was not found';
  end if;

  -- 2. The whole-window refusal, immediately after the already-settled guard.
  --
  -- ADR 0028 section 8: if NEITHER entrant may legally contest a tie,
  -- resolution goes through an explicit rule or admin path rather than a winner
  -- fabricated from ordinary scoring.
  --
  -- The refusal is for the WHOLE WINDOW rather than for the one tie, and that
  -- is forced by the guard it sits under: a window that settled some of its
  -- ties and left one open could never be re-driven, because the second run
  -- would find a settled tie and refuse. Settling a window is all-or-nothing
  -- here, so a tie nobody may contest stops the window and names itself.
  --
  -- Nothing is written on this path. The message carries the bracket slot so an
  -- administrator can act on it without reading the table.
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '    raise exception ''This Cup round has already been settled''' || chr(10) ||
    '      using errcode = ''55000'';' || chr(10) ||
    '  end if;',
    '    raise exception ''This Cup round has already been settled''' || chr(10) ||
    '      using errcode = ''55000'';' || chr(10) ||
    '  end if;' || chr(10) ||
    '' || chr(10) ||
    '  -- Contract 194 / `CUP-004`. A tie neither entrant may contest is not' || chr(10) ||
    '  -- decided here; see ADR 0028 section 8. Nothing is written.' || chr(10) ||
    '  select string_agg(fixture.bracket_slot::text, '', '' order by fixture.bracket_slot)' || chr(10) ||
    '    into v_blocked' || chr(10) ||
    '    from public.bonus_cup_fixtures fixture' || chr(10) ||
    '   where fixture.competition_id = p_competition_id' || chr(10) ||
    '     and fixture.window_id = p_window_id' || chr(10) ||
    '     and fixture.stage in (''playoff'', ''knockout'')' || chr(10) ||
    '     and predictor_internal.cup_entrant_eligibility(' || chr(10) ||
    '           p_competition_id, fixture.home_user_id) <> ''eligible''' || chr(10) ||
    '     and predictor_internal.cup_entrant_eligibility(' || chr(10) ||
    '           p_competition_id, fixture.away_user_id) <> ''eligible'';' || chr(10) ||
    '' || chr(10) ||
    '  if v_blocked is not null then' || chr(10) ||
    '    raise exception' || chr(10) ||
    '      ''Neither entrant may contest tie(s) %; this needs an explicit decision rather than an automatic winner'',' || chr(10) ||
    '      v_blocked' || chr(10) ||
    '      using errcode = ''55000'';' || chr(10) ||
    '  end if;'
  );
  if v_definition = v_original then
    raise exception 'Expected Cup already-settled guard was not found';
  end if;

  -- 3. The eligibility branch, ABOVE the submission ladder.
  --
  -- The two questions are unrelated, and keeping them apart is what makes this
  -- safe. "Neither entrant SUBMITTED" is an existing rule with an existing
  -- answer -- `admin_walkover`, resolved by the better seed -- and ADR 0022
  -- forbids altering it while rescoping this machinery. The ladder below is
  -- carried through unedited; it is only demoted to `elsif`.
  --
  -- No football score and no prediction points are invented. The eligible
  -- opponent simply advances, `decided_by` stays inside the existing
  -- vocabulary, and the REASON goes to audit evidence, which is where ADR 0028
  -- section 8 puts it.
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '    if v_home.submitted and v_away.submitted then',
    '    -- Contract 194 / `CUP-004`. Eligibility is decided BEFORE the' || chr(10) ||
    '    -- submission ladder and is a different question from it: "did they' || chr(10) ||
    '    -- predict" and "may they contest this tie" are unrelated, and until now' || chr(10) ||
    '    -- only the first was asked. A disqualified entrant who had submitted' || chr(10) ||
    '    -- before being removed still won on points.' || chr(10) ||
    '    v_home_eligible := predictor_internal.cup_entrant_eligibility(' || chr(10) ||
    '      p_competition_id, v_fixture.home_user_id) = ''eligible'';' || chr(10) ||
    '    v_away_eligible := predictor_internal.cup_entrant_eligibility(' || chr(10) ||
    '      p_competition_id, v_fixture.away_user_id) = ''eligible'';' || chr(10) ||
    '' || chr(10) ||
    '    if v_home_eligible <> v_away_eligible then' || chr(10) ||
    '      v_decided := ''walkover'';' || chr(10) ||
    '      v_winner := case when v_home_eligible' || chr(10) ||
    '        then v_fixture.home_user_id else v_fixture.away_user_id end;' || chr(10) ||
    '' || chr(10) ||
    '      insert into public.bonus_competition_audit' || chr(10) ||
    '        (competition_id, action, detail, actor_id)' || chr(10) ||
    '      values (' || chr(10) ||
    '        p_competition_id,' || chr(10) ||
    '        ''cup_tie_walkover_ineligible'',' || chr(10) ||
    '        jsonb_build_object(' || chr(10) ||
    '          ''window_id'', p_window_id,' || chr(10) ||
    '          ''bracket_slot'', v_fixture.bracket_slot,' || chr(10) ||
    '          ''advanced_user_id'', v_winner,' || chr(10) ||
    '          ''ineligible_user_id'', case when v_home_eligible' || chr(10) ||
    '            then v_fixture.away_user_id else v_fixture.home_user_id end,' || chr(10) ||
    '          -- The stored membership state, not a paraphrase of it, so the' || chr(10) ||
    '          -- record says whether they withdrew or were disqualified.' || chr(10) ||
    '          ''ineligible_state'', predictor_internal.cup_entrant_eligibility(' || chr(10) ||
    '            p_competition_id, case when v_home_eligible' || chr(10) ||
    '              then v_fixture.away_user_id else v_fixture.home_user_id end),' || chr(10) ||
    '          ''invented_score'', false,' || chr(10) ||
    '          ''invented_points'', false),' || chr(10) ||
    '        (select auth.uid()));' || chr(10) ||
    '' || chr(10) ||
    '    elsif v_home.submitted and v_away.submitted then'
  );
  if v_definition = v_original then
    raise exception 'Expected Cup submission ladder was not found';
  end if;

  -- Contract 102 must still hold. This is the assertion the first draft of this
  -- contract would have failed: a restated body reintroduced `stage <> 'group'`
  -- and dropped `stage in ('playoff', 'knockout')`, so a stored `split` fixture
  -- would have entered the knockout settler again.
  if position('stage <> ''group''' in v_definition) > 0
    or position('stage in (''playoff'', ''knockout'')' in v_definition) = 0 then
    raise exception 'Cup round settlement lost contract 102 split-safety';
  end if;

  -- And the roster pin contract 102 added.
  if position('member.phase_kind = ''initial''' in v_definition) = 0 then
    raise exception 'Cup round settlement lost contract 102 initial-roster pinning';
  end if;

  execute v_definition;
end;
$patch$;

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
