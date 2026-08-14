-- Contract 190: synthetic/reference prices remain historical/research evidence,
-- never actionable betting evidence.

begin;

select plan(4);

-- The one evidence view must enforce BOTH authorities: forecast validity and
-- real-venue identity. This is structural so an empty test table cannot make a
-- broken definition pass vacuously.
select ok(
  position('ai.valid_predictions' in pg_get_viewdef('ai.valid_bets'::regclass, true)) > 0
  and position('ai.bookmakers' in pg_get_viewdef('ai.valid_bets'::regclass, true)) > 0
  and position('is_real_price' in pg_get_viewdef('ai.valid_bets'::regclass, true)) > 0
  and position('aggregate' in pg_get_viewdef('ai.valid_bets'::regclass, true)) > 0,
  'ai.valid_bets enforces valid prediction plus real non-aggregate venue identity'
);

-- Future writes must fail closed in BOTH paper and real modes. The trigger body
-- must not contain the old `and not new.is_paper` waiver.
select ok(
  position('v_kind' in pg_get_functiondef('ai.reject_unbettable_price()'::regprocedure)) > 0
  and position('aggregate' in pg_get_functiondef('ai.reject_unbettable_price()'::regprocedure)) > 0
  and position('not v_real' in pg_get_functiondef('ai.reject_unbettable_price()'::regprocedure)) > 0
  and position('not new.is_paper' in lower(pg_get_functiondef('ai.reject_unbettable_price()'::regprocedure))) = 0,
  'ai.reject_unbettable_price enforces registry actionability with no paper-mode waiver'
);

-- The bounded Bet Builder may list/reference an aggregate elsewhere, but its
-- candidate RPC must refuse to turn one into an action venue.
select ok(
  position(
    'not v_book.is_real_price',
    pg_get_functiondef(
      'public.admin_ai_bet_builder_candidates(text,text[],timestamp with time zone,timestamp with time zone,integer)'::regprocedure
    )
  ) > 0
  and position(
    'v_book.kind = ''aggregate''',
    pg_get_functiondef(
      'public.admin_ai_bet_builder_candidates(text,text[],timestamp with time zone,timestamp with time zone,integer)'::regprocedure
    )
  ) > 0,
  'Bet Builder candidate RPC fails closed on reference-only books'
);

-- Registry authority itself remains explicit for the two research references.
select is(
  (select count(*)::integer
     from ai.bookmakers
    where code in ('AVG','MAX')
      and (is_real_price or kind <> 'aggregate')),
  0,
  'AVG/MAX remain reference-only registry entries'
);

select finish();

rollback;
