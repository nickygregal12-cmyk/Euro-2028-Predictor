-- Contract 85: what a result means to a Last Man Standing pick, and what a
-- season of them adds up to.
--
-- Both functions exercised here are pure — one takes a status and a scoreline,
-- the other an array of outcomes — so every rule is directly assertable with no
-- seeded rows. That is why the rule was split from the read: the reader
-- `season_lms_pick_outcome` needs fixtures and a window link, while the rule
-- itself needs nothing but its arguments.
--
-- NEVER ELIMINATE ON ABSENT INFORMATION. Only `status = 'played'` with both
-- scores present is a result. Everything else — scheduled, postponed,
-- abandoned, void — is a postponement that survives and consumes nothing. An
-- abandoned fixture's partial score does NOT stand (ADR 0012), which is why a
-- 2-0 abandonment is not a win for the club that was leading.
--
-- SURVIVAL IS DERIVED, NOT SPENT. The replay folds from the first round every
-- time, so a corrected result changes the answer instead of leaving an entrant
-- eliminated by a defeat that no longer exists. The final two assertions are
-- that correction, stated as a pair.

begin;
select plan(16);

-- ---------------------------------------------------------------------------
-- A standing result.
-- ---------------------------------------------------------------------------

select is(predictor_internal.lms_outcome_from_fixture('played', 2::smallint, 1::smallint, true),
  'won', 'the home club winning 2-1 is a win for whoever picked home');
select is(predictor_internal.lms_outcome_from_fixture('played', 2::smallint, 1::smallint, false),
  'lost', 'and a defeat for whoever picked away');
select is(predictor_internal.lms_outcome_from_fixture('played', 0::smallint, 3::smallint, false),
  'won', 'the away club winning 0-3 is a win for whoever picked away');
select is(predictor_internal.lms_outcome_from_fixture('played', 1::smallint, 1::smallint, true),
  'drew', 'a level score is a draw, whichever club was picked');

-- ---------------------------------------------------------------------------
-- Everything that is not a standing result.
-- ---------------------------------------------------------------------------

select is(predictor_internal.lms_outcome_from_fixture('scheduled', null, null, true),
  'postponed', 'a fixture not yet played eliminates nobody');
select is(predictor_internal.lms_outcome_from_fixture('postponed', null, null, true),
  'postponed', 'nor does one moved to a later date');
select is(predictor_internal.lms_outcome_from_fixture('abandoned', 2::smallint, 0::smallint, true),
  'postponed', 'an abandoned fixture''s partial score does NOT stand — 2-0 up is not a win');
select is(predictor_internal.lms_outcome_from_fixture('void', null, null, false),
  'postponed', 'a fixture that will never be played is not a defeat either');
select is(predictor_internal.lms_outcome_from_fixture('played', null, null, true),
  'postponed', 'a played fixture with no score recorded is treated as no result, not as a draw');

-- ---------------------------------------------------------------------------
-- Replaying a season.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.replay_lms_entrant('["won","won","won"]'::jsonb, 0, 0, 'eliminate'),
  '{"alive": true, "livesRemaining": 0, "savesRemaining": 0, "eliminatedAfterRounds": null}'::jsonb,
  'three wins on no allowances survives'
);

select is(
  predictor_internal.replay_lms_entrant('["won","lost","won"]'::jsonb, 1, 0, 'eliminate'),
  '{"alive": true, "livesRemaining": 0, "savesRemaining": 0, "eliminatedAfterRounds": null}'::jsonb,
  'a defeat spends the life and the season continues'
);

select is(
  predictor_internal.replay_lms_entrant('["won","lost","won"]'::jsonb, 0, 0, 'eliminate'),
  '{"alive": false, "livesRemaining": 0, "savesRemaining": 0, "eliminatedAfterRounds": 2}'::jsonb,
  'without a life the replay STOPS at the defeat — a later win cannot revive anyone'
);

select is(
  predictor_internal.replay_lms_entrant('["postponed","postponed","postponed"]'::jsonb, 0, 0, 'eliminate'),
  '{"alive": true, "livesRemaining": 0, "savesRemaining": 0, "eliminatedAfterRounds": null}'::jsonb,
  'postponements consume nothing, however many there are'
);

select is(
  predictor_internal.replay_lms_entrant('["won"]'::jsonb, 0, 0, 'nonsense'),
  '{"refused": "invalid_input"}'::jsonb,
  'an unrecognised draws rule is refused rather than guessed'
);

-- ---------------------------------------------------------------------------
-- The correction this design exists for.
--
-- Same entrant, same picks, one result restated. Incremental spending could not
-- produce these two answers from the same stored state; replay does, because it
-- never stored the spending in the first place.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.replay_lms_entrant('["won","lost","won"]'::jsonb, 0, 0, 'eliminate'))->>'alive',
  'false',
  'as first reported, the entrant is out'
);

select is(
  (predictor_internal.replay_lms_entrant('["won","won","won"]'::jsonb, 0, 0, 'eliminate'))->>'alive',
  'true',
  'and once the result is corrected they are back in, with no reversal logic anywhere'
);

select * from finish();
rollback;
