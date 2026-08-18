-- Contract 199: one fixture, one market, one piece of betting evidence.
--
-- The guard against advising a fixture twice asked whether the PREDICTION
-- already carried a bet. `ai.predictions` is unique on (model_id, fixture,
-- horizon), so every retrain minted a fresh prediction row for a fixture that
-- had already been advised and a second paper bet was recorded on the same
-- match. Production held 226 `ai.bets` rows over 125 fixture/market pairs, with
-- 38 fixtures carrying two bets on the SAME selection at the SAME bookmaker.
--
-- Two properties are asserted, and the second is the one that matters more:
-- the repeats stop counting as evidence, AND every row survives in `ai.bets`
-- with the row that superseded it named. Deleting history is how the same
-- defect gets rediscovered.

begin;

select plan(12);

-- ---------------------------------------------------------------------------
-- The installed authority.
-- ---------------------------------------------------------------------------

select ok(
  exists (
    select 1
      from pg_catalog.pg_rewrite r
      join pg_catalog.pg_depend d
        on d.classid = 'pg_catalog.pg_rewrite'::regclass
       and d.objid = r.oid
     where r.ev_class = 'ai.valid_bets'::regclass
       and d.refclassid = 'pg_catalog.pg_class'::regclass
       and d.refobjid = 'ai.bet_advice_identity'::regclass
  ),
  'ai.valid_bets reads the canonical-advice authority rather than restating it'
);

select ok(
  position('advised_at' in pg_get_viewdef('ai.bet_advice_identity'::regclass, true)) > 0
  and position('row_number' in pg_get_viewdef('ai.bet_advice_identity'::regclass, true)) > 0,
  'canonical advice is ranked by advised_at, so it is the earliest and not the best'
);

select is(
  (select count(*)::integer
     from information_schema.role_table_grants
    where table_schema = 'ai'
      and table_name = 'bet_advice_identity'
      and grantee in ('PUBLIC', 'anon', 'authenticated')),
  0,
  'no browser role can read the advice-identity view'
);

-- ---------------------------------------------------------------------------
-- Behaviour over real rows.
-- ---------------------------------------------------------------------------

insert into ai.bookmakers (code, name, kind, is_real_price)
values ('T247', 'Test book 247', 'bookmaker', true)
on conflict (code) do nothing;

insert into ai.models (id, league, version, family, training_matches, artifact_sha256)
values ('00000000-0000-4000-8000-000000000247', 'EPL', 'contract-199', 'poisson', 10,
        repeat('a', 64));

insert into ai.fixtures (id, division, season, league_key, match_date, kickoff_at,
                         home_canonical, away_canonical)
values ('00000000-0000-4000-8000-000000000248', 'E0', '2627', 'EPL',
        (now() + interval '3 days')::date, now() + interval '3 days',
        'Contract199 Home', 'Contract199 Away');

insert into ai.predictions (id, model_id, league, fixture_id, kickoff_at,
                            home_canonical, away_canonical, p_home, p_draw, p_away,
                            predicted_result, features, horizon, hours_to_kickoff,
                            features_version)
values ('00000000-0000-4000-8000-000000000249',
        '00000000-0000-4000-8000-000000000247', 'EPL',
        '00000000-0000-4000-8000-000000000248', now() + interval '3 days',
        'Contract199 Home', 'Contract199 Away', .55, .25, .20, 'H', '{}',
        't168', 72, 'f2'),
       ('00000000-0000-4000-8000-000000000250',
        '00000000-0000-4000-8000-000000000247', 'EPL',
        '00000000-0000-4000-8000-000000000248', now() + interval '3 days',
        'Contract199 Home', 'Contract199 Away', .58, .23, .19, 'H', '{}',
        't72', 72, 'f2');

-- The same match, advised twice, a day apart. The later one carries the better
-- price, which is exactly the row a "keep the best" rule would choose.
insert into ai.bets (id, prediction_id, model_id, league, fixture_id, selection,
                     kickoff_at, bookmaker, odds_taken, model_prob, edge,
                     stake_fraction, stake_units, is_paper, status, market, advised_at)
values ('00000000-0000-4000-8000-000000000251',
        '00000000-0000-4000-8000-000000000249',
        '00000000-0000-4000-8000-000000000247', 'EPL',
        '00000000-0000-4000-8000-000000000248', 'H', now() + interval '3 days',
        'T247', 2.10, .55, .155, .01, 1, true, 'advised', '1X2',
        now() - interval '2 days'),
       ('00000000-0000-4000-8000-000000000252',
        '00000000-0000-4000-8000-000000000250',
        '00000000-0000-4000-8000-000000000247', 'EPL',
        '00000000-0000-4000-8000-000000000248', 'H', now() + interval '3 days',
        'T247', 2.40, .58, .392, .01, 1, true, 'advised', '1X2',
        now() - interval '1 day');

select is(
  (select count(*)::integer from ai.bets
    where fixture_id = '00000000-0000-4000-8000-000000000248'),
  2,
  'both advice rows survive in ai.bets as the immutable record of what was said'
);

select is(
  (select count(*)::integer from ai.valid_bets
    where fixture_id = '00000000-0000-4000-8000-000000000248'),
  1,
  'exactly one of them is evidence'
);

select is(
  (select odds_taken from ai.valid_bets
    where fixture_id = '00000000-0000-4000-8000-000000000248'),
  2.10::numeric,
  'the canonical row is the EARLIEST advice, not the one with the friendliest price'
);

select is(
  (select advice_rank::integer from ai.bet_advice_identity
    where bet_id = '00000000-0000-4000-8000-000000000252'),
  2,
  'the superseded row is ranked second'
);

select is(
  (select canonical_bet_id from ai.bet_advice_identity
    where bet_id = '00000000-0000-4000-8000-000000000252'),
  '00000000-0000-4000-8000-000000000251'::uuid,
  'an excluded row names the row that superseded it'
);

select is(
  (select advice_rows::integer from ai.bet_advice_identity
    where bet_id = '00000000-0000-4000-8000-000000000251'),
  2,
  'the canonical row records how many opinions about this match exist'
);

-- ---------------------------------------------------------------------------
-- A void settlement needs no scoreline; every other outcome still does.
-- ---------------------------------------------------------------------------

select col_is_null(
  'ai'::name, 'bet_results'::name, 'actual_result'::name,
  'ai.bet_results.actual_result is nullable, so a returned stake is expressible'
);

insert into ai.bet_results (bet_id, actual_result, settlement_outcome,
                            commission_rate, pnl_units, return_per_unit)
values ('00000000-0000-4000-8000-000000000251', null, 'void', 0, 0, 0);

select is(
  (select settlement_outcome from ai.bet_results
    where bet_id = '00000000-0000-4000-8000-000000000251'),
  'void',
  'a postponed fixture returns its stake instead of leaving the bet advised forever'
);

-- `actual_result in (...)` against a null evaluates to NULL and a CHECK passes
-- on NULL, so the non-void arm is written with an explicit `is not null`. This
-- is the assertion that caught it.
select throws_ok(
  $$update ai.bet_results set settlement_outcome = 'loss'
     where bet_id = '00000000-0000-4000-8000-000000000251'$$,
  '23514',
  null,
  'a non-void settlement is still refused without a result'
);

select * from finish();

rollback;
