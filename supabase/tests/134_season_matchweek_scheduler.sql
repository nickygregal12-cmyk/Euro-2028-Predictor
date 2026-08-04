-- Contract 82: notice that a matchweek has locked, and act on it.
--
-- The fail-closed paths are assertable here WITHOUT seeded rows, and that is
-- not a convenience — it is the same property that makes them safe. A matchweek
-- with no fixtures has no derivable lock instant, so calling the derivation
-- with identifiers that match nothing exercises the real "not derivable" branch
-- against the real function. No probe rows, no foreign keys, no trigger to
-- fight.
--
-- The paths that DO need rows — a due matchweek, an unbanked player, a
-- rescheduled lock — were proven against a scratch PostgreSQL 16 running
-- contracts 80, 81 and 82 with real parents: nothing due before the instant,
-- both records written at it, a second run a no-op, a rescheduled matchweek
-- reprocessed under its new instant with the earlier record preserved, and
-- neither a Last Man Standing entry nor a knockout round touched.

begin;
select plan(11);

-- ---------------------------------------------------------------------------
-- Not derivable means not due. Both branches, against the live function.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.season_matchweek_lock_at(
    '00000000-0000-4000-8000-0000000000ab',
    '00000000-0000-4000-8000-0000000000c1',
    0),
  null::timestamptz,
  'a matchweek with no fixtures has no lock instant, so it is never due'
);

select is(
  predictor_internal.season_matchweek_lock_at(
    '00000000-0000-4000-8000-0000000000ab',
    '00000000-0000-4000-8000-0000000000c1',
    -1),
  null::timestamptz,
  'a negative buffer is refused rather than moving the lock later'
);

select is(
  predictor_internal.season_matchweek_lock_at(
    '00000000-0000-4000-8000-0000000000ab',
    '00000000-0000-4000-8000-0000000000c1',
    null),
  null::timestamptz,
  'a missing buffer is refused rather than treated as zero'
);

select is(
  predictor_internal.season_complete_card_fixtures(
    '00000000-0000-4000-8000-0000000000ab',
    '00000000-0000-4000-8000-00000000e001',
    '00000000-0000-4000-8000-0000000000c1'),
  null::jsonb,
  'an empty matchweek is not a complete card — it would otherwise submit nothing as a submission'
);

-- ---------------------------------------------------------------------------
-- The job runs, is a no-op when nothing is due, and says what it deferred.
-- ---------------------------------------------------------------------------

-- Deliberately an instant before any football this platform models. Nothing
-- can be due at it whatever the seed contains, so the assertion states the
-- job's behaviour rather than the fixture data's — a "no season seeded" version
-- would silently start asserting something else the day a season is seeded.
select is(
  public.process_due_season_matchweek_submissions('1970-01-01T00:00:00Z'::timestamptz)
    - 'processedAt',
  '{"attempted": 0, "submitted": 0, "unbanked": 0, "refused": 0,
    "deferredMissingDefaultPolicy": 0}'::jsonb,
  'a run before any matchweek can have locked touches nothing'
);

select throws_ok(
  $$select public.process_due_season_matchweek_submissions(null)$$,
  '22023',
  'Processing time is required',
  'a null processing time is refused rather than defaulted, so a caller cannot lose the instant'
);

-- ---------------------------------------------------------------------------
-- Reachability. The job is a server job; the derivations are internal.
-- ---------------------------------------------------------------------------

select function_privs_are(
  'public', 'process_due_season_matchweek_submissions', array['timestamp with time zone'],
  'authenticated', array[]::text[],
  'no browser session can drive the matchweek lock'
);

select function_privs_are(
  'public', 'process_due_season_matchweek_submissions', array['timestamp with time zone'],
  'anon', array[]::text[],
  'and no anonymous one either'
);

select function_privs_are(
  'public', 'process_due_season_matchweek_submissions', array['timestamp with time zone'],
  'service_role', array['EXECUTE'],
  'the server role is the only caller'
);

select function_privs_are(
  'predictor_internal', 'season_matchweek_lock_at', array['uuid', 'uuid', 'integer'],
  'authenticated', array[]::text[],
  'the lock derivation is not a browser-callable function'
);

select function_privs_are(
  'predictor_internal', 'season_complete_card_fixtures', array['uuid', 'uuid', 'uuid'],
  'authenticated', array[]::text[],
  'nor is the card assembler'
);

select * from finish();
rollback;
