-- Contract 71: the Last Man Standing pick resolution, with TypeScript parity.
--
-- `src/domain/season/lmsRoundResolution.ts` decides one entrant's fate from
-- their pick's fixture outcome. This is its PostgreSQL counterpart, held in
-- step by `tests/database-parity/lmsResolutionParity.test.ts`.
--
-- The rule most likely to be reimplemented wrongly is the asymmetry between
-- the two currencies:
--
--     a Save rescues a DRAW.      A Save never rescues a DEFEAT.
--     a Life rescues either.
--
-- Spend a Save on a defeat and an entrant survives a round they should have
-- gone out in — and because the counter still decrements, the state looks
-- entirely plausible afterwards. Nothing detects it except a test that loses
-- while holding Saves, which is why one exists.
--
-- The order within a draw matters too: Saves are spent before Lives, so an
-- entrant holding both keeps the scarcer currency for the defeat that a Save
-- cannot cover.
--
-- LMS awards no points. It eliminates. There is deliberately no scoring
-- function here.
--
-- This contract adds the rule, not its storage: no LMS setup or entrant
-- lives/saves state is persisted yet, so the function takes them as arguments
-- exactly as the TypeScript does. Persistence follows separately.

create or replace function predictor_internal.resolve_lms_pick(
  p_outcome text,
  p_draws_rule text,
  p_lives_remaining integer,
  p_saves_remaining integer
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    -- Counters must be whole and non-negative. A refusal is not survival:
    -- callers fail closed on it rather than reading a missing `alive`.
    when p_lives_remaining is null or p_saves_remaining is null
      or p_lives_remaining < 0 or p_saves_remaining < 0
      then jsonb_build_object('refused', 'invalid_input')
    when p_outcome not in ('won', 'drew', 'lost', 'postponed')
      or p_draws_rule not in ('eliminate', 'survive')
      then jsonb_build_object('refused', 'invalid_input')

    when p_outcome = 'won' then jsonb_build_object(
      'alive', true, 'via', 'win',
      'livesRemaining', p_lives_remaining, 'savesRemaining', p_saves_remaining)

    -- A postponement survives without consuming anything. The team stays
    -- used — that is owned by eligibility, not by this rule.
    when p_outcome = 'postponed' then jsonb_build_object(
      'alive', true, 'via', 'postponement',
      'livesRemaining', p_lives_remaining, 'savesRemaining', p_saves_remaining)

    when p_outcome = 'drew' and p_draws_rule = 'survive' then jsonb_build_object(
      'alive', true, 'via', 'draw_survives',
      'livesRemaining', p_lives_remaining, 'savesRemaining', p_saves_remaining)

    -- Draw under the eliminating rule: Save first, then Life.
    when p_outcome = 'drew' and p_saves_remaining > 0 then jsonb_build_object(
      'alive', true, 'via', 'save',
      'livesRemaining', p_lives_remaining, 'savesRemaining', p_saves_remaining - 1)
    when p_outcome = 'drew' and p_lives_remaining > 0 then jsonb_build_object(
      'alive', true, 'via', 'life',
      'livesRemaining', p_lives_remaining - 1, 'savesRemaining', p_saves_remaining)
    when p_outcome = 'drew' then jsonb_build_object(
      'alive', false, 'livesRemaining', 0, 'savesRemaining', p_saves_remaining)

    -- Defeat: a Life or nothing. Saves are deliberately not consulted, and
    -- are returned untouched so the caller can see they were not spent.
    when p_outcome = 'lost' and p_lives_remaining > 0 then jsonb_build_object(
      'alive', true, 'via', 'life',
      'livesRemaining', p_lives_remaining - 1, 'savesRemaining', p_saves_remaining)
    else jsonb_build_object(
      'alive', false, 'livesRemaining', 0, 'savesRemaining', p_saves_remaining)
  end;
$$;

revoke all on function predictor_internal.resolve_lms_pick(text, text, integer, integer)
  from public, anon, authenticated;
