-- Contract 85: read a Last Man Standing result, and replay a season from it.
--
-- Contracts 71–73 decide a pick, a round and a season. Contract 84 decides who
-- may be picked and who is assigned when nobody picks. Nothing turns a RESULT
-- into any of that. This does — the derivation layer the settlement job runs
-- on, which is the next contract.
--
-- WHAT THIS CONTRACT IS NOT. It adds no job and writes no row. The three
-- functions here are pure or read-only, and nothing calls them yet. The
-- scheduled job that replays every entrant and writes the projection lands
-- next, and the advisory lock described below belongs to it.
--
-- ---------------------------------------------------------------------------
-- SURVIVAL IS DERIVED, NOT SPENT
-- ---------------------------------------------------------------------------
--
-- The obvious implementation settles each round incrementally: read the
-- entrant's lives and saves, spend one, write it back. That is wrong here, and
-- the reason is corrections.
--
-- A season result can be corrected. `admin_correct_match_result` exists because
-- results are entered by a human and humans mistype. If survival were spent
-- incrementally, correcting a 1-0 to a 0-1 four rounds later would leave an
-- entrant eliminated by a defeat that never happened, and no amount of
-- re-running the job would bring them back — the life is already gone. The
-- state would have to be un-spent, which means reversal logic that must itself
-- be correct in every order.
--
-- So `season_lms_entrant_state` is a PROJECTION, not the truth. The truth is
-- (setup + picks + results), and the job REPLAYS it from the first round every
-- time, using `replay_lms_entrant` below. Re-running is therefore idempotent by construction rather than by a
-- ledger, and a corrected result simply produces a different answer on the next
-- run. It is the same delete-and-rederive choice `recompute_tournament_scores`
-- makes for tournament scoring, for the same reason.
--
-- Nothing wrote that table before this migration, so nothing is being
-- reinterpreted — the projection reading is established here rather than
-- retrofitted.
--
-- THE COST is that replay is O(rounds) per entrant per run, and the known risk
-- REL-001 records that the tournament's delete-and-rederive is not serialised.
-- The job must not inherit that: it needs a transaction-scoped advisory lock
-- per competition so two concurrent runs cannot interleave a replay. That is a
-- requirement ON the next contract, recorded here because this is where the
-- reasoning lives — not a claim that anything takes a lock today.
--
-- ---------------------------------------------------------------------------
-- WHAT A RESULT MEANS TO A PICK
-- ---------------------------------------------------------------------------
--
-- `season_fixtures.status` is the season's own vocabulary, and only 'played'
-- means the result stands — contract 68 constrains it to mean both scores are
-- present. Every other status is a POSTPONEMENT for LMS purposes:
--
--   scheduled  — not played yet;
--   postponed  — will be played later;
--   abandoned  — started and void, the partial score never stands (ADR 0012);
--   void       — never to be played.
--
-- All four survive and consume nothing, which is the fail-safe direction: a
-- player is never eliminated by a fixture that did not produce a result. Their
-- club stays consumed either way — ADR 0013 is explicit that a postponed pick's
-- club is not handed back, and only the mandatory reset returns clubs to the
-- pool.
--
-- Treating 'void' as a defeat would eliminate players for a match nobody
-- played; treating it as a win would hand out free survival. A postponement is
-- the only reading that adds no information, which is what a non-result is.

begin;

-- ---------------------------------------------------------------------------
-- The result-to-outcome rule, kept PURE so it is directly exercisable.
--
-- Splitting the rule from the read is deliberate and matches contracts 80, 82
-- and 84: a function that reads tables needs seeded rows and foreign keys to
-- test, while this one needs nothing but its arguments.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.lms_outcome_from_fixture(
  p_status text,
  p_home_score smallint,
  p_away_score smallint,
  p_picked_home boolean
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    -- Anything that is not a standing result is a postponement: survive,
    -- consume nothing. Never eliminate on absent information.
    when p_status is distinct from 'played' then 'postponed'
    when p_home_score is null or p_away_score is null then 'postponed'
    when p_picked_home is null then null
    when p_home_score = p_away_score then 'drew'
    when (p_home_score > p_away_score) = p_picked_home then 'won'
    else 'lost'
  end;
$$;

revoke all on function predictor_internal.lms_outcome_from_fixture(text, smallint, smallint, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What one entrant's pick did in one window.
--
-- Null when the picked club has no fixture in the window at all, which is not a
-- postponement but a contradiction — the selection trigger requires the club to
-- play in the round. Callers fail closed on null rather than guessing.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_lms_pick_outcome(
  p_tournament_id uuid,
  p_window_id uuid,
  p_team_id uuid
)
returns text
language sql
stable
set search_path = ''
as $$
  select predictor_internal.lms_outcome_from_fixture(
           fixture.status, fixture.home_score, fixture.away_score,
           fixture.home_team_id = p_team_id)
    -- `season_cup_window_fixtures` despite the name. It is
    -- (window_id -> bonus_competition_windows, season_fixture_id ->
    -- season_fixtures) and contains nothing Cup-specific but its NAME, so Last
    -- Man Standing reuses it rather than adding a second table holding the same
    -- relation. Renaming is unavailable: contract 77 is applied to development
    -- and migrations are append-only after hosted application.
    from public.season_cup_window_fixtures link
    join public.season_fixtures fixture
      on fixture.id = link.season_fixture_id
     and fixture.tournament_id = p_tournament_id
   where link.window_id = p_window_id
     and (fixture.home_team_id = p_team_id or fixture.away_team_id = p_team_id)
   -- A club plays at most once per round; contract 84 makes a club playing
   -- twice ineligible, so it can never have been picked. `limit 1` is a
   -- belt-and-braces guard, not a tie-break.
   limit 1;
$$;

revoke all on function predictor_internal.season_lms_pick_outcome(uuid, uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Replay one entrant's whole season, in window order.
--
-- Folds contract 71's `resolve_lms_pick` over the rounds. Stops at the first
-- elimination: a player who is out does not keep spending, and later rounds
-- cannot revive them.
--
-- A round the entrant did not pick in is NOT auto-assigned here. Assignment
-- happens when the round LOCKS, not when it settles, because the club must be
-- chosen from the clubs playing that round and recorded as consumed. This
-- function replays what was recorded; it does not invent history.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.replay_lms_entrant(
  p_outcomes jsonb,
  p_lives integer,
  p_saves integer,
  p_draws_rule text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_outcome jsonb;
  v_lives integer := p_lives;
  v_saves integer := p_saves;
  v_step jsonb;
  v_rounds integer := 0;
begin
  if p_outcomes is null or jsonb_typeof(p_outcomes) <> 'array'
     or p_lives is null or p_saves is null or p_lives < 0 or p_saves < 0
     or p_draws_rule not in ('eliminate', 'survive') then
    return jsonb_build_object('refused', 'invalid_input');
  end if;

  for v_outcome in
    select value from jsonb_array_elements(p_outcomes) with ordinality as t(value, position)
    order by t.position
  loop
    v_rounds := v_rounds + 1;

    -- A round with no recorded outcome cannot be replayed. Refusing beats
    -- assuming: assuming survival hands out a free round, assuming defeat
    -- eliminates on missing data.
    if v_outcome is null or jsonb_typeof(v_outcome) = 'null' then
      return jsonb_build_object('refused', 'invalid_input');
    end if;

    v_step := predictor_internal.resolve_lms_pick(
      v_outcome #>> '{}', p_draws_rule, v_lives, v_saves);

    if v_step ? 'refused' then
      return jsonb_build_object('refused', v_step->>'refused');
    end if;

    v_lives := (v_step->>'livesRemaining')::integer;
    v_saves := (v_step->>'savesRemaining')::integer;

    if not (v_step->>'alive')::boolean then
      return jsonb_build_object(
        'alive', false,
        'livesRemaining', v_lives,
        'savesRemaining', v_saves,
        'eliminatedAfterRounds', v_rounds);
    end if;
  end loop;

  return jsonb_build_object(
    'alive', true,
    'livesRemaining', v_lives,
    'savesRemaining', v_saves,
    'eliminatedAfterRounds', null);
end;
$$;

revoke all on function predictor_internal.replay_lms_entrant(jsonb, integer, integer, text)
  from public, anon, authenticated;

commit;
