-- Contract 184: qualification from a group of any permitted size (`CUP-001`).
--
-- THE ASSERTION THIS FILE EXISTS FOR is that the general rule REPRODUCES the
-- tournament's accepted 3- and 4-player rows exactly. That is what makes this
-- an extension of `docs/predictor-cup-rules.md` § 6.2 rather than a replacement
-- for it, and it is the only thing standing between a season fix and a silent
-- change to the tournament's own qualification.
--
-- The second is that the rule is checked at EVERY size from 3 to 20 rather than
-- at a couple of convenient ones. A hand-written table is wrong in the middle of
-- its range, not at its ends, and nobody checks the middle.
--
-- The third is the partition property: at every size the automatic places, the
-- wildcard pool and the eliminated ranks must together cover 1..N exactly once,
-- with no gap and no overlap. A gap is a rank that can neither qualify nor be
-- eliminated; an overlap is a player in two bands at once. Both are invisible in
-- a test that only counts qualifiers.

begin;

select plan(11);

-- ---------------------------------------------------------------------------
-- The tournament's own rows, unchanged
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.cup_group_automatic_places(4), 2,
  'a four-player group still qualifies 1st and 2nd automatically');

select is(
  predictor_internal.cup_group_qualifying_limit(4), 3,
  'and its wildcard pool is still 3rd alone, with 4th eliminated');

select is(
  predictor_internal.cup_group_automatic_places(3), 1,
  'a three-player group still qualifies 1st alone');

select is(
  predictor_internal.cup_group_qualifying_limit(3), 2,
  'and its wildcard pool is still 2nd alone, with 3rd eliminated');

-- ---------------------------------------------------------------------------
-- Every size the schema permits, against the published table
-- ---------------------------------------------------------------------------
--
-- The expected values are written out rather than recomputed, because a test
-- that recomputes the rule it is testing asserts only that the rule equals
-- itself. These are the rows in § 6.2.

select is(
  (select string_agg(
     n || ':' || predictor_internal.cup_group_automatic_places(n)
       || '-' || predictor_internal.cup_group_qualifying_limit(n), ' '
     order by n)
     from generate_series(3, 20) n),
  '3:1-2 4:2-3 5:2-4 6:3-4 7:3-5 8:4-6 9:4-6 10:5-7 11:5-8 12:6-8 13:6-9 '
  || '14:7-10 15:7-10 16:8-11 17:8-12 18:9-12 19:9-13 20:10-14',
  'every group size from 3 to 20 matches the published section 6.2 table');

-- ---------------------------------------------------------------------------
-- The properties that make it safe at any size
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from generate_series(3, 20) n
    where predictor_internal.cup_group_automatic_places(n)
        > predictor_internal.cup_group_qualifying_limit(n)),
  0,
  'automatic places never overshoot the two-thirds line, so the target is always reachable');

select is(
  (select count(*)::integer from generate_series(3, 20) n
    where predictor_internal.cup_group_qualifying_limit(n) >= n),
  0,
  'at every permitted size at least one entrant cannot qualify, which is what makes it a group stage');

select is(
  (select count(*)::integer from generate_series(3, 20) n
    where predictor_internal.cup_group_automatic_places(n) < 1),
  0,
  'and a group winner always qualifies');

-- THE PARTITION PROPERTY. Every rank in 1..N is in exactly one band.
select is(
  (select count(*)::integer
     from generate_series(3, 20) n
     cross join lateral generate_series(1, n) rank
    where (
      (rank <= predictor_internal.cup_group_automatic_places(n))::integer
      + (rank > predictor_internal.cup_group_automatic_places(n)
         and rank <= predictor_internal.cup_group_qualifying_limit(n))::integer
      + (rank > predictor_internal.cup_group_qualifying_limit(n))::integer
    ) <> 1),
  0,
  'automatic, wildcard and eliminated partition every rank exactly once at every size');

-- ---------------------------------------------------------------------------
-- The section 6.1 reconciliation, on the worked example in the rules document
-- ---------------------------------------------------------------------------
--
-- 100 entrants as 5 groups of 20: 50 automatic, 20 wildcard candidates, a
-- target of 67. The pool must be able to cover the shortfall, or the bracket
-- silently comes out undersized -- which is the failure mode CUP-001 describes.

select ok(
  (5 * predictor_internal.cup_group_automatic_places(20))
  + (5 * (predictor_internal.cup_group_qualifying_limit(20)
          - predictor_internal.cup_group_automatic_places(20)))
  >= round(100 * 2.0 / 3)::integer,
  'the worked example reaches its section 6.1 target: 5 groups of 20 can supply 67 qualifiers');

-- The driver reads the rule rather than restating it. Asserted on the INSTALLED
-- definition, because that is the property the whole contract turns on: the two
-- hard-coded sizes must be gone from it.
select ok(
  pg_get_functiondef('public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure)
    not like '%gate.group_size = 4 and gate.group_rank = 3%'
  and pg_get_functiondef('public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure)
    like '%cup_group_automatic_places%',
  'the finalisation driver reads the rule functions and no longer hard-codes sizes 3 and 4');

select * from finish();
rollback;
