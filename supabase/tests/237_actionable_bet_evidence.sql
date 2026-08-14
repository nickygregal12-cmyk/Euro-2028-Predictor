-- Contract 190: synthetic/reference prices remain historical/research evidence,
-- never actionable betting evidence.

begin;

-- The one evidence view must enforce BOTH authorities: forecast validity and
-- real-venue identity. This is structural so an empty test table cannot make a
-- broken definition pass vacuously.
do $$
declare v_def text := pg_get_viewdef('ai.valid_bets'::regclass, true);
begin
  if position('ai.valid_predictions' in v_def) = 0 then
    raise exception 'ai.valid_bets lost the prediction-validity authority';
  end if;
  if position('ai.bookmakers' in v_def) = 0
     or position('is_real_price' in v_def) = 0
     or position('aggregate' in v_def) = 0 then
    raise exception 'ai.valid_bets does not enforce real non-aggregate venue identity: %', v_def;
  end if;
end $$;

-- Future writes must fail closed in BOTH paper and real modes. The trigger body
-- must not contain the old `and not new.is_paper` waiver.
do $$
declare v_def text := pg_get_functiondef('ai.reject_unbettable_price()'::regprocedure);
begin
  if position('v_kind' in v_def) = 0
     or position('aggregate' in v_def) = 0
     or position('not v_real' in v_def) = 0 then
    raise exception 'ai.reject_unbettable_price does not enforce registry actionability';
  end if;
  if position('not new.is_paper' in lower(v_def)) > 0 then
    raise exception 'paper mode still waives bookmaker actionability';
  end if;
end $$;

-- The bounded Bet Builder may list/reference an aggregate elsewhere, but its
-- candidate RPC must refuse to turn one into an action venue.
do $$
declare v_def text := pg_get_functiondef(
  'public.admin_ai_bet_builder_candidates(text,text[],timestamp with time zone,timestamp with time zone,integer)'::regprocedure);
begin
  if position('not v_book.is_real_price' in v_def) = 0
     or position('v_book.kind = ''aggregate''' in v_def) = 0 then
    raise exception 'Bet Builder candidate RPC does not fail closed on reference-only books';
  end if;
end $$;

-- Registry authority itself remains explicit for the two research references.
do $$
begin
  if exists (
      select 1 from ai.bookmakers
       where code in ('AVG','MAX')
         and (is_real_price or kind <> 'aggregate')) then
    raise exception 'AVG/MAX registry authority drifted into actionable state';
  end if;
end $$;

rollback;
