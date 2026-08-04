-- Contract 84: which clubs a Last Man Standing entrant may pick.
--
-- These functions take jsonb and return jsonb, touching no relation, so every
-- rule can be exercised directly with no seeded rows, no foreign keys and no
-- trigger to fight. That makes this the behavioural half of the parity: the
-- TypeScript suite executes the TypeScript and READS the SQL, and reading
-- cannot catch a rule that changed shape while keeping its keywords.
--
-- It caught one during review. Deleting the unknown-club check from the fixture
-- loop left the string `'unknown_team'` in the function — it also appears in
-- the used-list loop — so a text assertion still passed while a fixture naming
-- a club that does not exist was silently accepted. Only running it, or pinning
-- the loop structurally, tells the difference.
--
-- THE RULE MOST WORTH PROTECTING is the mandatory reset: a player whose used
-- list covers every club playing once RESETS rather than being eliminated on
-- availability grounds. Availability never eliminates (ADR 0013).
--
-- THE PROPERTY THAT FAILS SILENTLY is club-name collation. Auto-assignment
-- returns the FIRST eligible club by name, so a locale-aware ordering hands a
-- different club to a player who missed their pick — survival or elimination
-- decided by the database's locale. The clubs below are chosen so C and ICU
-- disagree; names that sort identically under both would prove nothing.

begin;
select plan(14);

-- ---------------------------------------------------------------------------
-- Club ordering, and what auto-assignment does with it.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_lms_eligibility(
    '[{"fixtureId":"f1","homeTeamId":"t1","awayTeamId":"t2"}]'::jsonb,
    '[{"teamId":"t1","name":"ATH MADRID"},{"teamId":"t2","name":"afc wimbledon"}]'::jsonb,
    '[]'::jsonb),
  '{"ok": true, "eligibleTeamIds": ["t1", "t2"], "usedListReset": false,
    "doubleFixtureTeamIds": []}'::jsonb,
  'clubs order by code point, so ATH MADRID precedes afc wimbledon'
);

select is(
  predictor_internal.auto_assign_lms_team(
    '[{"fixtureId":"f1","homeTeamId":"t1","awayTeamId":"t2"}]'::jsonb,
    '[{"teamId":"t1","name":"ATH MADRID"},{"teamId":"t2","name":"afc wimbledon"}]'::jsonb,
    '[]'::jsonb),
  't1',
  'a missed pick auto-assigns the code-point-first club, not the case-folded one'
);

select is(
  predictor_internal.resolve_lms_eligibility(
    '[{"fixtureId":"f1","homeTeamId":"t2","awayTeamId":"t1"}]'::jsonb,
    '[{"teamId":"t1","name":"Rangers"},{"teamId":"t2","name":"Rangers"}]'::jsonb,
    '[]'::jsonb),
  '{"ok": true, "eligibleTeamIds": ["t2", "t1"], "usedListReset": false,
    "doubleFixtureTeamIds": []}'::jsonb,
  'clubs sharing a name keep first-seen order, matching stable JavaScript sorting'
);

-- ---------------------------------------------------------------------------
-- Availability never eliminates.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_lms_eligibility(
    '[{"fixtureId":"f1","homeTeamId":"t1","awayTeamId":"t2"}]'::jsonb,
    '[{"teamId":"t1","name":"Alpha"},{"teamId":"t2","name":"Beta"}]'::jsonb,
    '["t1","t2"]'::jsonb),
  '{"ok": true, "eligibleTeamIds": ["t1", "t2"], "usedListReset": true,
    "doubleFixtureTeamIds": []}'::jsonb,
  'a used list covering every playing club RESETS rather than eliminating'
);

select is(
  predictor_internal.resolve_lms_eligibility(
    '[{"fixtureId":"f1","homeTeamId":"t1","awayTeamId":"t2"}]'::jsonb,
    '[{"teamId":"t1","name":"Alpha"},{"teamId":"t2","name":"Beta"}]'::jsonb,
    '["t1"]'::jsonb),
  '{"ok": true, "eligibleTeamIds": ["t2"], "usedListReset": false,
    "doubleFixtureTeamIds": []}'::jsonb,
  'the reset does not fire while a club is still available'
);

select is(
  predictor_internal.resolve_lms_eligibility(
    '[{"fixtureId":"f1","homeTeamId":"t1","awayTeamId":"t2"},
      {"fixtureId":"f2","homeTeamId":"t1","awayTeamId":"t2"}]'::jsonb,
    '[{"teamId":"t1","name":"Alpha"},{"teamId":"t2","name":"Beta"}]'::jsonb,
    '["t1","t2"]'::jsonb),
  '{"ok": true, "eligibleTeamIds": [], "usedListReset": false,
    "doubleFixtureTeamIds": ["t1", "t2"]}'::jsonb,
  'a round where nobody plays once does NOT reset — eligibility stays empty and the caller fails closed'
);

select is(
  predictor_internal.auto_assign_lms_team(
    '[{"fixtureId":"f1","homeTeamId":"t1","awayTeamId":"t2"},
      {"fixtureId":"f2","homeTeamId":"t1","awayTeamId":"t2"}]'::jsonb,
    '[{"teamId":"t1","name":"Alpha"},{"teamId":"t2","name":"Beta"}]'::jsonb,
    '["t1","t2"]'::jsonb),
  null::text,
  'and auto-assignment returns null there rather than inventing a pick'
);

-- ---------------------------------------------------------------------------
-- A club playing twice is ineligible however fresh the used list.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_lms_eligibility(
    '[{"fixtureId":"f1","homeTeamId":"t1","awayTeamId":"t2"},
      {"fixtureId":"f2","homeTeamId":"t1","awayTeamId":"t3"}]'::jsonb,
    '[{"teamId":"t1","name":"Alpha"},{"teamId":"t2","name":"Beta"},
      {"teamId":"t3","name":"Gamma"}]'::jsonb,
    '[]'::jsonb),
  '{"ok": true, "eligibleTeamIds": ["t2", "t3"], "usedListReset": false,
    "doubleFixtureTeamIds": ["t1"]}'::jsonb,
  'a club playing twice is excluded and reported separately'
);

-- ---------------------------------------------------------------------------
-- Refusals, and the order they are decided in.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_lms_eligibility(
    '[{"fixtureId":"f1","homeTeamId":"t1","awayTeamId":"ghost"}]'::jsonb,
    '[{"teamId":"t1","name":"Alpha"},{"teamId":"t2","name":"Beta"}]'::jsonb,
    '[]'::jsonb),
  '{"ok": false, "reason": "unknown_team"}'::jsonb,
  'a fixture naming a club that does not exist is refused — the case a text assertion missed'
);

select is(
  predictor_internal.resolve_lms_eligibility(
    '[{"fixtureId":"f1","homeTeamId":"ghost","awayTeamId":"ghost"}]'::jsonb,
    '[{"teamId":"t1","name":"Alpha"},{"teamId":"t2","name":"Beta"}]'::jsonb,
    '[]'::jsonb),
  '{"ok": false, "reason": "team_against_itself"}'::jsonb,
  'an unknown club against itself reports self-play, because that is tested first'
);

select is(
  predictor_internal.resolve_lms_eligibility(
    '[{"fixtureId":"f1","homeTeamId":"t1","awayTeamId":"t2"},
      {"fixtureId":"f1","homeTeamId":"t2","awayTeamId":"t1"}]'::jsonb,
    '[{"teamId":"t1","name":"Alpha"},{"teamId":"t2","name":"Beta"}]'::jsonb,
    '[]'::jsonb),
  '{"ok": false, "reason": "duplicate_fixture"}'::jsonb,
  'the same fixture id twice is refused rather than deduplicated'
);

select is(
  predictor_internal.resolve_lms_eligibility(
    '[{"fixtureId":"f1","homeTeamId":"t1","awayTeamId":"t2"}]'::jsonb,
    '[{"teamId":"t1","name":"Alpha"},{"teamId":"t2","name":"   "}]'::jsonb,
    '[]'::jsonb),
  '{"ok": false, "reason": "invalid_input"}'::jsonb,
  'a blank club name is refused — the name is what the ordering depends on'
);

select is(
  predictor_internal.resolve_lms_eligibility(
    '[{"fixtureId":"f1","homeTeamId":"t1","awayTeamId":"t2"}]'::jsonb,
    '[{"teamId":"t1","name":"Alpha"},{"teamId":"t2","name":"Beta"}]'::jsonb,
    '["ghost"]'::jsonb),
  '{"ok": false, "reason": "unknown_team"}'::jsonb,
  'an unknown club in the used list is refused too'
);

select is(
  predictor_internal.resolve_lms_eligibility('{}'::jsonb, '[]'::jsonb, '[]'::jsonb),
  '{"ok": false, "reason": "invalid_input"}'::jsonb,
  'a non-array input is refused rather than treated as empty'
);

select * from finish();
rollback;
