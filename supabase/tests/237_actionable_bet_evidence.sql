-- Contract 190: synthetic/reference prices remain historical/research evidence,
-- never actionable betting evidence.
--
-- The first four assertions inspect the INSTALLED authority. The remaining ten
-- exercise it over real rows: two simulated pre-190 MAX bets remain in ai.bets,
-- but disappear from every actionable read; real PS/B365 bets remain visible;
-- and fresh MAX/AVG/unknown writes fail even in paper mode.

begin;

select plan(14);

-- pg_get_viewdef() is a decompiled reconstruction whose schema qualification
-- depends on the caller's search_path. Prove relation identity from the stored
-- rewrite dependencies instead; keep text inspection only for the predicates.
select ok(
  exists (
    select 1
      from pg_catalog.pg_rewrite r
      join pg_catalog.pg_depend d
        on d.classid = 'pg_catalog.pg_rewrite'::regclass
       and d.objid = r.oid
     where r.ev_class = 'ai.valid_bets'::regclass
       and d.refclassid = 'pg_catalog.pg_class'::regclass
       and d.refobjid = 'ai.valid_predictions'::regclass
  )
  and exists (
    select 1
      from pg_catalog.pg_rewrite r
      join pg_catalog.pg_depend d
        on d.classid = 'pg_catalog.pg_rewrite'::regclass
       and d.objid = r.oid
     where r.ev_class = 'ai.valid_bets'::regclass
       and d.refclassid = 'pg_catalog.pg_class'::regclass
       and d.refobjid = 'ai.bookmakers'::regclass
  )
  and position('is_real_price' in pg_get_viewdef('ai.valid_bets'::regclass, true)) > 0
  and position('aggregate' in pg_get_viewdef('ai.valid_bets'::regclass, true)) > 0,
  'ai.valid_bets enforces valid prediction plus real non-aggregate venue identity'
);

select ok(
  position('v_kind' in pg_get_functiondef('ai.reject_unbettable_price()'::regprocedure)) > 0
  and position('aggregate' in pg_get_functiondef('ai.reject_unbettable_price()'::regprocedure)) > 0
  and position('not v_real' in pg_get_functiondef('ai.reject_unbettable_price()'::regprocedure)) > 0
  and position('not new.is_paper' in lower(pg_get_functiondef('ai.reject_unbettable_price()'::regprocedure))) = 0,
  'ai.reject_unbettable_price enforces registry actionability with no paper-mode waiver'
);

select ok(
  position(
    'not v_book.is_real_price' in pg_get_functiondef(
      'public.admin_ai_bet_builder_candidates(text,text[],timestamp with time zone,timestamp with time zone,integer)'::regprocedure
    )
  ) > 0
  and position(
    'v_book.kind = ''aggregate''' in pg_get_functiondef(
      'public.admin_ai_bet_builder_candidates(text,text[],timestamp with time zone,timestamp with time zone,integer)'::regprocedure
    )
  ) > 0,
  'Bet Builder candidate RPC fails closed on reference-only books'
);

select is(
  (select count(*)::integer
     from ai.bookmakers
    where code in ('AVG','MAX')
      and (is_real_price or kind <> 'aggregate')),
  0,
  'AVG/MAX remain reference-only registry entries'
);

-- ---------------------------------------------------------------------------
-- FOUR fixtures, one valid future prediction each, one bet each.
--
-- This was one fixture carrying all four bets, which is the shape Production
-- actually had and is exactly the shape contract 199 exists to stop:
-- `ai.valid_bets` now admits only the CANONICAL advice for a fixture and market,
-- so four bets on one fixture would collapse to one and every count below would
-- be measuring the canonical rule rather than the venue rule this file is about.
-- Separating them keeps each assertion testing what it was written to test.
-- ---------------------------------------------------------------------------
insert into ai.models (id, league, version, family, training_matches, status)
values (md5('q190-model')::uuid, 'Q190', 'q190-v1', 'poisson', 500, 'challenger');

insert into ai.fixtures (
  id, division, season, league_key, match_date, kickoff_at,
  home_canonical, away_canonical, status)
select md5('q190-fixture-' || tag)::uuid, 'Q190', '2627', 'Q190',
       (now() + interval '3 days')::date, now() + interval '3 days',
       'Q190 Home ' || tag, 'Q190 Away ' || tag, 'scheduled'
  from unnest(array['max-settled', 'max-open', 'ps-settled', 'b365-open']) as tag;

insert into ai.predictions (
  id, model_id, league, fixture_id, kickoff_at, home_canonical, away_canonical,
  p_home, p_draw, p_away, predicted_result, predicted_score, features)
select md5('q190-prediction-' || tag)::uuid, md5('q190-model')::uuid, 'Q190',
       md5('q190-fixture-' || tag)::uuid, now() + interval '3 days',
       'Q190 Home ' || tag, 'Q190 Away ' || tag,
       0.50000, 0.25000, 0.25000, 'H', '2-1',
       '{"elo_diff":40,"season_progress":0.5,"home_is_newcomer":0,"away_is_newcomer":0}'::jsonb
  from unnest(array['max-settled', 'max-open', 'ps-settled', 'b365-open']) as tag;

-- Simulate immutable rows that existed before Contract 190. Disabling ONLY the
-- newly-strengthened trigger is deliberate: every other ai.bets constraint and
-- lifecycle trigger stays installed, so these are normal valid historical rows
-- except for their reference-only bookmaker identity.
alter table ai.bets disable trigger bets_real_price;

insert into ai.bets (
  id, prediction_id, model_id, league, fixture_id, selection, advised_at,
  kickoff_at, bookmaker, odds_taken, model_prob, edge, stake_fraction,
  stake_units, is_paper, market, status)
values
  (md5('q190-max-settled')::uuid, md5('q190-prediction-max-settled')::uuid, md5('q190-model')::uuid,
   'Q190', md5('q190-fixture-max-settled')::uuid, 'H', now(), now() + interval '3 days',
   'MAX', 2.500, 0.50000, 0.25000, 0.02000, 2.0000, true, '1X2', 'settled'),
  (md5('q190-max-open')::uuid, md5('q190-prediction-max-open')::uuid, md5('q190-model')::uuid,
   'Q190', md5('q190-fixture-max-open')::uuid, 'D', now(), now() + interval '3 days',
   'MAX', 4.000, 0.25000, 0.00000, 0.01000, 1.0000, true, '1X2', 'advised');

alter table ai.bets enable trigger bets_real_price;

-- Real venues pass the same trigger in paper mode.
insert into ai.bets (
  id, prediction_id, model_id, league, fixture_id, selection, advised_at,
  kickoff_at, bookmaker, odds_taken, model_prob, edge, stake_fraction,
  stake_units, is_paper, market, status)
values
  (md5('q190-ps-settled')::uuid, md5('q190-prediction-ps-settled')::uuid, md5('q190-model')::uuid,
   'Q190', md5('q190-fixture-ps-settled')::uuid, 'H', now(), now() + interval '3 days',
   'PS', 2.400, 0.50000, 0.20000, 0.02000, 2.0000, true, '1X2', 'settled'),
  (md5('q190-b365-open')::uuid, md5('q190-prediction-b365-open')::uuid, md5('q190-model')::uuid,
   'Q190', md5('q190-fixture-b365-open')::uuid, 'D', now(), now() + interval '3 days',
   'B365', 3.900, 0.25000, -0.02500, 0.01000, 1.0000, true, '1X2', 'advised');

insert into ai.bet_results (
  bet_id, actual_result, won, settlement_outcome, pnl_units, return_per_unit,
  odds_closing, fair_prob_closing, clv, beat_closing_price)
values
  (md5('q190-max-settled')::uuid, 'H', true, 'win', 3.0000, 1.50000, 2.200, 0.45000, 0.12500, true),
  (md5('q190-ps-settled')::uuid, 'H', true, 'win', 2.8000, 1.40000, 2.200, 0.45000, 0.08000, true);

select is(
  (select count(*)::integer from ai.bets where league = 'Q190' and bookmaker = 'MAX'),
  2,
  'historical MAX rows remain in immutable base ai.bets'
);

select is(
  (select count(*)::integer from ai.valid_bets where league = 'Q190' and bookmaker = 'MAX'),
  0,
  'historical MAX rows are absent from actionable ai.valid_bets'
);

select is(
  (select count(*)::integer from ai.valid_bets where league = 'Q190' and bookmaker in ('PS','B365')),
  2,
  'real bookmaker rows remain visible in actionable ai.valid_bets'
);

select throws_ok(
  $$insert into ai.bets (
      id,prediction_id,model_id,league,fixture_id,selection,kickoff_at,bookmaker,
      odds_taken,model_prob,edge,stake_fraction,stake_units,is_paper,market,status)
    values (
      md5('q190-new-max')::uuid,md5('q190-prediction-max-settled')::uuid,md5('q190-model')::uuid,
      'Q190',md5('q190-fixture-max-settled')::uuid,'A',now()+interval '3 days','MAX',
      9.0,0.25,1.25,0.01,1.0,true,'1X2','advised')$$,
  '22000', null,
  'future MAX paper bets are rejected'
);

select throws_ok(
  $$insert into ai.bets (
      id,prediction_id,model_id,league,fixture_id,selection,kickoff_at,bookmaker,
      odds_taken,model_prob,edge,stake_fraction,stake_units,is_paper,market,status)
    values (
      md5('q190-new-avg')::uuid,md5('q190-prediction-max-settled')::uuid,md5('q190-model')::uuid,
      'Q190',md5('q190-fixture-max-settled')::uuid,'A',now()+interval '3 days','AVG',
      8.0,0.25,1.00,0.01,1.0,true,'1X2','advised')$$,
  '22000', null,
  'future AVG paper bets are rejected'
);

select throws_ok(
  $$insert into ai.bets (
      id,prediction_id,model_id,league,fixture_id,selection,kickoff_at,bookmaker,
      odds_taken,model_prob,edge,stake_fraction,stake_units,is_paper,market,status)
    values (
      md5('q190-new-unknown')::uuid,md5('q190-prediction-max-settled')::uuid,md5('q190-model')::uuid,
      'Q190',md5('q190-fixture-max-settled')::uuid,'A',now()+interval '3 days','NOT-A-BOOK',
      8.0,0.25,1.00,0.01,1.0,true,'1X2','advised')$$,
  '22000', null,
  'future unknown-book paper bets are rejected'
);

-- Exercise the three Contract-189 admin betting consumers through the real
-- competition-admin gate. The settled/open synthetic rows exist in ai.bets at
-- this point, so a consumer that bypasses ai.valid_bets would report 2, not 1.
select set_config('request.jwt.claims',
  json_build_object('sub', md5('q190-admin')::uuid, 'role', 'authenticated',
    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);

select is(
  ((public.admin_ai_betting_dashboard('Q190') -> 'profit' ->> 'settled_bets'))::integer,
  1,
  'admin betting dashboard excludes settled synthetic rows'
);

select is(
  ((public.admin_ai_betting_dashboard('Q190') -> 'open' ->> 'open_bets'))::integer,
  1,
  'admin betting dashboard excludes open synthetic exposure'
);

select is(
  ((public.admin_ai_evidence_by_market() -> '1X2' ->> 'settled_bets'))::integer,
  1,
  'admin market evidence excludes synthetic settled rows'
);

select is(
  ((public.admin_ai_betting_gate_status() -> 'settled_bets' ->> 'value'))::integer,
  1,
  'publication gate evidence excludes synthetic settled rows'
);

select * from finish();

rollback;
