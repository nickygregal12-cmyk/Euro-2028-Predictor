-- Contract 74: the season Predictor Championship's pure rules.
--
-- The parity test reads these bodies as text. This runs them, against the
-- cases where a plausible reimplementation quietly disagrees:
--
--   * a Joker-doubled fixture value reaching a competition that awards none;
--   * a tie with nothing confirmed being settled as a goalless draw;
--   * a format that reports its shape but not the calendar it leaves;
--   * groups filled to the cap rather than balanced.
--
-- All three functions are pure, so nothing is seeded and nothing is rolled
-- back but the transaction itself.

begin;
select plan(23);

-- ---------------------------------------------------------------------------
-- A Cup tie settles on RAW fixture points only.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"f1","confirmedByCutoff":true},
      {"fixtureId":"f2","confirmedByCutoff":true}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"f1":6,"f2":3}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"f1":3,"f2":3}}'::jsonb),
  '{"ok": false, "reason": "points_off_raw_scale"}'::jsonb,
  'a doubled result (6) is refused rather than counted'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"f1","confirmedByCutoff":true}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"f1":3}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"f1":10}}'::jsonb),
  '{"ok": false, "reason": "points_off_raw_scale"}'::jsonb,
  'a doubled exact score (10) is refused on either side of the tie'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"f1","confirmedByCutoff":true},
      {"fixtureId":"f2","confirmedByCutoff":true}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"f1":5,"f2":3}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"f1":3,"f2":0}}'::jsonb),
  '{"ok": true,
    "settlement": {"result": "home_win",
                   "home": {"entryId": "home", "points": 8, "matchPoints": 3},
                   "away": {"entryId": "away", "points": 3, "matchPoints": 0},
                   "settledOnFixtures": 2,
                   "fixtureCardSize": 2,
                   "reducedSet": false}}'::jsonb,
  'a full card settles on totals and awards three for the win'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"f1","confirmedByCutoff":true}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"f1":3}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"f1":3}}'::jsonb),
  '{"ok": true,
    "settlement": {"result": "draw",
                   "home": {"entryId": "home", "points": 3, "matchPoints": 1},
                   "away": {"entryId": "away", "points": 3, "matchPoints": 1},
                   "settledOnFixtures": 1,
                   "fixtureCardSize": 1,
                   "reducedSet": false}}'::jsonb,
  'equal totals draw at one point each'
);

-- ---------------------------------------------------------------------------
-- What the tie was settled on is part of the answer.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"f1","confirmedByCutoff":true},
      {"fixtureId":"f2","confirmedByCutoff":false}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"f1":5}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"f1":3}}'::jsonb),
  '{"ok": true,
    "settlement": {"result": "home_win",
                   "home": {"entryId": "home", "points": 5, "matchPoints": 3},
                   "away": {"entryId": "away", "points": 3, "matchPoints": 0},
                   "settledOnFixtures": 1,
                   "fixtureCardSize": 2,
                   "reducedSet": true}}'::jsonb,
  'a postponement reduces the card and the settlement says so'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"f1","confirmedByCutoff":true},
      {"fixtureId":"f2","confirmedByCutoff":false}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"f1":5,"f2":5}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"f1":3}}'::jsonb),
  '{"ok": false, "reason": "points_for_unconfirmed_fixture"}'::jsonb,
  'points for a fixture the cutoff excluded are refused, not silently dropped'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"f1","confirmedByCutoff":true},
      {"fixtureId":"f2","confirmedByCutoff":true}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"f1":5}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"f1":3,"f2":3}}'::jsonb),
  '{"ok": false, "reason": "points_missing_for_confirmed_fixture"}'::jsonb,
  'a confirmed fixture with no points refuses rather than scoring it zero'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"f1","confirmedByCutoff":false}]'::jsonb,
    '{"entryId":"home","fixturePoints":{}}'::jsonb,
    '{"entryId":"away","fixturePoints":{}}'::jsonb),
  '{"ok": false, "reason": "no_settled_fixtures"}'::jsonb,
  'a tie with nothing confirmed refuses instead of settling a goalless draw'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"f1","confirmedByCutoff":true},
      {"fixtureId":"f1","confirmedByCutoff":true}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"f1":3}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"f1":3}}'::jsonb),
  '{"ok": false, "reason": "duplicate_fixture"}'::jsonb,
  'the same fixture twice is refused rather than double-counted'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"f1","confirmedByCutoff":true}]'::jsonb,
    '{"entryId":"same","fixturePoints":{"f1":3}}'::jsonb,
    '{"entryId":"same","fixturePoints":{"f1":3}}'::jsonb),
  '{"ok": false, "reason": "same_entrant_twice"}'::jsonb,
  'an entrant cannot play itself'
);

-- ---------------------------------------------------------------------------
-- Format selection, including the calendar tail.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.select_season_cup_format(3, 38),
  '{"kind": "declined_head_to_head"}'::jsonb,
  'three entrants is offered head-to-head rather than a cup'
);

select is(
  predictor_internal.select_season_cup_format(8, 14),
  '{"kind": "single_group", "meetings": 2, "leagueRounds": 14,
    "tail": {"kind": "none"}, "knockout": null, "leftoverRounds": 0}'::jsonb,
  'an exact fit plays home and away with no tail at all'
);

select is(
  predictor_internal.select_season_cup_format(6, 24),
  '{"kind": "single_group", "meetings": 4, "leagueRounds": 20,
    "tail": {"kind": "none"},
    "knockout": {"rounds": 2, "qualifiers": 4},
    "leftoverRounds": 2}'::jsonb,
  'contract 198: an even meeting count RESERVES the bracket it can afford, and reports the rest as spare'
);

select is(
  predictor_internal.select_season_cup_format(6, 18),
  '{"kind": "single_group", "meetings": 3, "leagueRounds": 15,
    "tail": {"kind": "split", "topHalfSize": 3, "bottomHalfSize": 3,
             "splitRounds": 3},
    "knockout": null,
    "leftoverRounds": 0}'::jsonb,
  'an odd meeting count is balanced by a post-split round-robin'
);

select is(
  predictor_internal.select_season_cup_format(10, 30),
  '{"kind": "single_group", "meetings": 2, "leagueRounds": 18,
    "tail": {"kind": "none"},
    "knockout": {"rounds": 3, "qualifiers": 7},
    "leftoverRounds": 9}'::jsonb,
  'when the balancing split will not fit, it plays one meeting fewer rather than shortening the split, then reserves'
);

select is(
  predictor_internal.select_season_cup_format(30, 38),
  '{"kind": "groups", "knockout": {"rounds": 5, "qualifiers": 20}, "groupCount": 2, "groupSizes": [15, 15]}'::jsonb,
  'thirty entrants is two groups of fifteen, never a twenty and a ten'
);

select is(
  predictor_internal.select_season_cup_format(25, 38),
  '{"kind": "groups", "knockout": {"rounds": 5, "qualifiers": 17}, "groupCount": 2, "groupSizes": [13, 12]}'::jsonb,
  'an odd field balances with the larger group first'
);

select is(
  predictor_internal.select_season_cup_format(7, 6),
  '{"kind": "refused", "reason": "insufficient_rounds"}'::jsonb,
  'a smallest group below the minimum field refuses rather than running a three-team group'
);

select is(
  predictor_internal.select_season_cup_format(8, 0),
  '{"kind": "refused", "reason": "invalid_input"}'::jsonb,
  'a season with no rounds left is invalid input, not an empty cup'
);

-- ---------------------------------------------------------------------------
-- The public launch gate.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_public_cup_launch(100, false),
  '{"open": true, "entrants": 100}'::jsonb,
  'the public cup opens exactly at the threshold'
);

select is(
  predictor_internal.resolve_public_cup_launch(77, false),
  '{"open": false, "entrants": 77, "shortfall": 23, "reason": "below_threshold"}'::jsonb,
  'below the threshold it returns how many more are needed, not a bare refusal'
);

select is(
  predictor_internal.resolve_public_cup_launch(5000, true),
  '{"open": false, "entrants": 5000, "shortfall": 0, "reason": "already_running"}'::jsonb,
  'a running cup refuses however many have queued behind it'
);

select is(
  predictor_internal.resolve_public_cup_launch(-1, false),
  '{"open": false, "entrants": 0, "shortfall": 100, "reason": "invalid_input"}'::jsonb,
  'a negative entrant count is refused rather than treated as zero'
);

select * from finish();
rollback;
