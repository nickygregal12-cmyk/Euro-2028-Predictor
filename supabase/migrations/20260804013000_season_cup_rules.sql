-- Contract 74: the season Predictor Championship's pure rules, with parity.
--
-- Counterparts to `settleCupTie`, `selectCupFormat` and
-- `resolvePublicCupLaunch` in `src/domain/season/`, held in step by
-- `tests/database-parity/seasonCupParity.test.ts`.
--
-- WHY THIS IS NEW SQL RATHER THAN A REUSE. `predictor_internal.cup_*` already
-- exists, but it implements the TOURNAMENT Predictor Cup: its ordering uses the
-- §6.3 wildcard normalisation, `table_points / (group_size - 1)`, comparing
-- across groups of different sizes. The season Championship (ADR 0014) ranks by
-- an eight-step tie-break over draw number, window prediction points, scoreline
-- error and head-to-head. Those are two rule sets for two competitions, not two
-- implementations of one, so nothing here touches the tournament machinery.
--
-- Scope: the three authorities that are genuinely pure. The group table and the
-- schedule generator need the persistence decision ADR 0022's correction defers
-- to after C1b, and are deliberately absent rather than guessed at.

-- ---------------------------------------------------------------------------
-- Settling one Cup tie.
--
-- THE RULE THAT MATTERS: a Cup tie is settled on RAW fixture points only.
-- The permitted values are 0, 3 and 5 — the league's Joker doubling must never
-- reach the Championship, so a doubled value is REFUSED rather than counted.
-- Accepting 6 or 10 here would let a player carry their league Joker into a
-- knockout tie and win it on points the Cup does not award.
--
-- Only fixtures confirmed by the cutoff count, and the settlement reports what
-- it was decided on: "settled on 9 of 10" is a fact the interface must be able
-- to state, not a detail to round away.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.settle_season_cup_tie(
  p_fixtures jsonb,
  p_home jsonb,
  p_away jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_card integer;
  v_distinct integer;
  v_confirmed text[];
  v_home_total integer := 0;
  v_away_total integer := 0;
  v_result text;
  v_home_match integer;
  v_away_match integer;
  v_points integer;
  v_fixture text;
begin
  if p_fixtures is null or jsonb_typeof(p_fixtures) <> 'array'
     or coalesce(btrim(p_home->>'entryId'), '') = ''
     or coalesce(btrim(p_away->>'entryId'), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  select count(*), count(distinct fixture->>'fixtureId')
    into v_card, v_distinct
    from jsonb_array_elements(p_fixtures) as fixture;

  if v_card = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_fixtures) as fixture
     where coalesce(btrim(fixture->>'fixtureId'), '') = ''
  ) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;
  if v_distinct <> v_card then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_fixture');
  end if;
  if p_home->>'entryId' = p_away->>'entryId' then
    return jsonb_build_object('ok', false, 'reason', 'same_entrant_twice');
  end if;

  select array_agg(fixture->>'fixtureId')
    into v_confirmed
    from jsonb_array_elements(p_fixtures) as fixture
   where (fixture->>'confirmedByCutoff')::boolean;

  -- Nothing confirmed is not a goalless draw. Awarding a match point each for
  -- a tie whose fixtures never played would settle a knockout round on no
  -- evidence, so it refuses.
  if v_confirmed is null or array_length(v_confirmed, 1) is null then
    return jsonb_build_object('ok', false, 'reason', 'no_settled_fixtures');
  end if;

  -- Points offered for a fixture that is not on the card, or that the cutoff
  -- did not confirm, are refused rather than ignored: a caller sending them
  -- disagrees with this function about which fixtures decided the tie, and
  -- silently dropping them would settle it on a card neither side agreed to.
  foreach v_fixture in array array(
    select jsonb_object_keys(p_home->'fixturePoints')
    union
    select jsonb_object_keys(p_away->'fixturePoints')
  ) loop
    if not exists (
      select 1 from jsonb_array_elements(p_fixtures) as fixture
       where fixture->>'fixtureId' = v_fixture
    ) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_input');
    end if;
    if not (v_fixture = any (v_confirmed)) then
      return jsonb_build_object('ok', false, 'reason', 'points_for_unconfirmed_fixture');
    end if;
  end loop;

  foreach v_fixture in array v_confirmed loop
    v_points := (p_home->'fixturePoints'->>v_fixture)::integer;
    if v_points is null then
      return jsonb_build_object('ok', false, 'reason', 'points_missing_for_confirmed_fixture');
    end if;
    if v_points not in (0, 3, 5) then
      return jsonb_build_object('ok', false, 'reason', 'points_off_raw_scale');
    end if;
    v_home_total := v_home_total + v_points;

    v_points := (p_away->'fixturePoints'->>v_fixture)::integer;
    if v_points is null then
      return jsonb_build_object('ok', false, 'reason', 'points_missing_for_confirmed_fixture');
    end if;
    if v_points not in (0, 3, 5) then
      return jsonb_build_object('ok', false, 'reason', 'points_off_raw_scale');
    end if;
    v_away_total := v_away_total + v_points;
  end loop;

  if v_home_total > v_away_total then
    v_result := 'home_win'; v_home_match := 3; v_away_match := 0;
  elsif v_away_total > v_home_total then
    v_result := 'away_win'; v_home_match := 0; v_away_match := 3;
  else
    v_result := 'draw'; v_home_match := 1; v_away_match := 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'settlement', jsonb_build_object(
      'result', v_result,
      'home', jsonb_build_object('entryId', p_home->>'entryId',
                                 'points', v_home_total, 'matchPoints', v_home_match),
      'away', jsonb_build_object('entryId', p_away->>'entryId',
                                 'points', v_away_total, 'matchPoints', v_away_match),
      'settledOnFixtures', array_length(v_confirmed, 1),
      'fixtureCardSize', v_card,
      'reducedSet', array_length(v_confirmed, 1) < v_card));
end;
$$;

revoke all on function predictor_internal.settle_season_cup_tie(jsonb, jsonb, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Choosing a format for the field that turned up.
--
-- A field below four declines to head-to-head rather than running a Cup: three
-- entrants is not a competition, and pretending otherwise produces a trophy
-- nobody contested. Above the group cap, or too late in the season for two
-- meetings, the field is drawn into BALANCED groups of at most twenty — thirty
-- entrants is two groups of fifteen, never a twenty and a ten. When even the
-- smallest group cannot fit two meetings in the rounds that remain, the answer
-- is a refusal rather than a shortened format nobody agreed to.
--
-- The tail is part of the answer, not a detail: an odd meeting count is
-- balanced by a post-split round-robin, an even one leaves a seeded playoff
-- window, and a Cup that does not fill the season REPORTS the leftover rounds
-- rather than padding them away. Returning the shape without the tail would
-- make the two implementations look equal while disagreeing about the
-- calendar, which is the mismatch this parity exists to catch.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.select_season_cup_format(
  p_field_size integer,
  p_remaining_rounds integer
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_meetings integer;
  v_league_rounds integer;
  v_top integer;
  v_bottom integer;
  v_split integer;
  v_window integer;
  v_largest integer;
  v_group_count integer;
  v_base integer;
  v_remainder integer;
  v_sizes jsonb;
begin
  if p_field_size is null or p_remaining_rounds is null
     or p_field_size < 2 or p_remaining_rounds < 1 then
    return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
  end if;

  if p_field_size < 4 then
    return jsonb_build_object('kind', 'declined_head_to_head');
  end if;

  v_meetings := p_remaining_rounds / (p_field_size - 1);

  if p_field_size <= 20 and v_meetings >= 2 then
    -- An odd meeting count is balanced by a split. If the split does not fit
    -- the calendar, one meeting fewer is even and needs none. The count is at
    -- least two here, so the step down always lands on an even number and this
    -- resolves in one pass rather than looping.
    if v_meetings % 2 = 1 then
      v_league_rounds := v_meetings * (p_field_size - 1);
      v_top := ceil(p_field_size::numeric / 2)::integer;
      v_bottom := p_field_size / 2;
      -- A k-entrant round-robin occupies k - 1 rounds when k is even, k when
      -- odd, because an odd half carries a bye.
      v_split := case when v_top % 2 = 0 then v_top - 1 else v_top end;

      if v_league_rounds + v_split <= p_remaining_rounds then
        return jsonb_build_object(
          'kind', 'single_group',
          'meetings', v_meetings,
          'leagueRounds', v_league_rounds,
          'tail', jsonb_build_object(
            'kind', 'split',
            'topHalfSize', v_top,
            'bottomHalfSize', v_bottom,
            'splitRounds', v_split),
          'leftoverRounds', p_remaining_rounds - v_league_rounds - v_split);
      end if;

      v_meetings := v_meetings - 1;
    end if;

    v_league_rounds := v_meetings * (p_field_size - 1);
    v_window := p_remaining_rounds - v_league_rounds;

    return jsonb_build_object(
      'kind', 'single_group',
      'meetings', v_meetings,
      'leagueRounds', v_league_rounds,
      'tail', case
        when v_window > 0 then
          jsonb_build_object('kind', 'seeded_playoff_window', 'rounds', v_window)
        else jsonb_build_object('kind', 'none')
      end,
      'leftoverRounds', 0);
  end if;

  v_largest := least(20, (p_remaining_rounds / 2) + 1);
  if v_largest < 4 then
    return jsonb_build_object('kind', 'refused', 'reason', 'insufficient_rounds');
  end if;

  v_group_count := ceil(p_field_size::numeric / v_largest)::integer;
  v_base := p_field_size / v_group_count;
  v_remainder := p_field_size % v_group_count;

  -- The smallest group is always the base size, so this is the same check as
  -- "the last balanced group is below the minimum field".
  if v_base < 4 then
    return jsonb_build_object('kind', 'refused', 'reason', 'insufficient_rounds');
  end if;

  select jsonb_agg(
           case when slot <= v_remainder then v_base + 1 else v_base end
           order by slot)
    into v_sizes
    from generate_series(1, v_group_count) as slot;

  return jsonb_build_object(
    'kind', 'groups', 'groupCount', v_group_count, 'groupSizes', v_sizes);
end;
$$;

revoke all on function predictor_internal.select_season_cup_format(integer, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Whether the public Cup may open.
--
-- One public Cup runs per competition season (ADR 0014), so an already-running
-- competition refuses however many have queued behind it. The shortfall is
-- returned rather than just a boolean, because "23 more needed" is what the
-- interface has to say.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.resolve_public_cup_launch(
  p_entrants integer,
  p_public_cup_running boolean
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_entrants is null or p_entrants < 0 or p_public_cup_running is null then
      jsonb_build_object('open', false, 'entrants', 0,
                         'shortfall', 100, 'reason', 'invalid_input')
    when p_public_cup_running then
      jsonb_build_object('open', false, 'entrants', p_entrants,
                         'shortfall', greatest(0, 100 - p_entrants), 'reason', 'already_running')
    when p_entrants >= 100 then
      jsonb_build_object('open', true, 'entrants', p_entrants)
    else
      jsonb_build_object('open', false, 'entrants', p_entrants,
                         'shortfall', 100 - p_entrants, 'reason', 'below_threshold')
  end;
$$;

revoke all on function predictor_internal.resolve_public_cup_launch(integer, boolean)
  from public, anon, authenticated;
