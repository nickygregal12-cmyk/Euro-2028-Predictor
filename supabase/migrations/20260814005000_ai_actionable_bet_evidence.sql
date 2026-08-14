-- Contract 190: a betting-evidence row must name a real actionable venue.
--
-- Contract 189 made ai.valid_bets the single authority for which bet rows may
-- contribute to performance, CLV, ROI, exposure and the publication gate. Its
-- only validity limb was the originating prediction. Production measurement on
-- 14 August 2026 then found 49 immutable historical paper rows advised at MAX,
-- which ai.bookmakers correctly defines as kind=aggregate/is_real_price=false.
-- Prediction quarantine removed 35, but 14 remained in ai.valid_bets.
--
-- This contract does not delete, rewrite, settle or void any historical bet.
-- It strengthens the existing authority instead: evidence is valid only when
-- BOTH the prediction is valid AND the bookmaker registry says the captured
-- venue is real and non-aggregate. It also closes the insert trigger's old
-- paper-mode exception so a synthetic reference cannot become a future bet row,
-- and refuses aggregate books at the bounded Bet Builder candidate RPC.

begin;

-- ---------------------------------------------------------------------------
-- 1. Future rows: paper mode does not manufacture an actionable venue.
-- ---------------------------------------------------------------------------
create or replace function ai.reject_unbettable_price()
returns trigger
language plpgsql
as $$
declare
  v_real boolean;
  v_kind text;
begin
  select is_real_price, kind
    into v_real, v_kind
    from ai.bookmakers
   where code = new.bookmaker;

  if v_real is null then
    raise exception 'Unknown bookmaker %', new.bookmaker using errcode = '22000';
  end if;

  if not v_real or v_kind = 'aggregate' then
    raise exception
      'Bookmaker % is reference-only (% / is_real_price=%), not an actionable venue',
      new.bookmaker, v_kind, v_real using errcode = '22000';
  end if;

  return new;
end;
$$;

comment on function ai.reject_unbettable_price() is
  'Rejects every ai.bets insert whose registry row is missing, non-real or aggregate. '
  'Paper mode and real-money mode share the same venue-actionability rule.';

-- ---------------------------------------------------------------------------
-- 2. Historical evidence: extend Contract 189's ONE bet-validity authority.
-- ---------------------------------------------------------------------------
create or replace view ai.valid_bets as
  select b.*
    from ai.bets b
    join ai.bookmakers bk on bk.code = b.bookmaker
   where exists (select 1 from ai.valid_predictions p where p.id = b.prediction_id)
     and bk.is_real_price = true
     and bk.kind <> 'aggregate';

comment on view ai.valid_bets is
  'Actionable betting evidence only: the originating forecast must remain in '
  'ai.valid_predictions AND the recorded bookmaker must be a real non-aggregate '
  'venue in ai.bookmakers. Base ai.bets rows stay immutable historical record. '
  'All CLV, ROI, exposure, evidence and publication reads consume this view.';

-- ---------------------------------------------------------------------------
-- 3. Bounded Bet Builder: aggregate/reference books cannot be requested as an
--    action venue even if an old recommendation row exists.
-- ---------------------------------------------------------------------------
create or replace function public.admin_ai_bet_builder_candidates(
  p_bookmaker text,
  p_leagues text[] default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_rows      jsonb;
  v_book      record;
  v_limit     integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_from      timestamptz := coalesce(p_from, now());
  v_to        timestamptz := coalesce(p_to, now() + interval '7 days');
begin
  perform predictor_internal.require_competition_admin();

  select * into v_book from ai.bookmakers b where b.code = p_bookmaker;
  if v_book is null then
    raise exception 'Unknown bookmaker %', p_bookmaker using errcode = '22023';
  end if;
  if not v_book.is_real_price or v_book.kind = 'aggregate' then
    raise exception 'Bookmaker % is reference-only and cannot supply actionable legs',
      p_bookmaker using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.kickoff_at, c.fixture_id), '[]'::jsonb)
    into v_rows
    from (
      select distinct on (r.prediction_id)
             r.id                        as recommendation_id,
             r.league,
             r.market,
             r.selection,
             r.bookmaker,
             r.odds_offered              as odds,
             r.calibrated_prob,
             r.fair_odds,
             r.expected_value            as model_edge,
             r.data_confidence,
             r.data_confidence_state,
             r.agreement_score,
             r.uncertainty_width,
             r.odds_captured_at,
             extract(epoch from (now() - r.odds_captured_at))::int as price_age_seconds,
             ai.price_age_limit_seconds(
               extract(epoch from (r.kickoff_at - now())) / 3600.0,
               not v_book.is_real_price)                           as price_age_limit_seconds,
             r.kickoff_at,
             p.fixture_id::text          as fixture_id,
             p.home_canonical,
             p.away_canonical,
             p.horizon,
             p.uses_market
        from ai.recommendations r
        join ai.valid_predictions p on p.id = r.prediction_id
        join ai.fixtures f on f.id = p.fixture_id
       where r.decision = 'BET'
         and r.bookmaker = p_bookmaker
         and f.status = 'scheduled'
         and r.kickoff_at between v_from and v_to
         and (p_leagues is null or r.league = any(p_leagues))
       order by r.prediction_id, r.decided_at desc
       limit v_limit) c;

  return jsonb_build_object(
    'bookmaker', jsonb_build_object(
      'code', v_book.code, 'name', v_book.name, 'kind', v_book.kind,
      'is_real_price', v_book.is_real_price,
      'exchange_commission', v_book.exchange_commission),
    'window', jsonb_build_object('from', v_from, 'to', v_to),
    'leagues', to_jsonb(p_leagues),
    'legs', v_rows,
    'leg_count', jsonb_array_length(v_rows),
    'truncated_at', v_limit,
    'source', 'ai.recommendations where decision = BET, at one real actionable bookmaker, '
              'excluding quarantined predictions and voided fixtures',
    'generated_at', now());
end;
$$;

comment on function public.admin_ai_bet_builder_candidates(text,text[],timestamptz,timestamptz,integer) is
  'Competition-admin Bet Builder leg read. p_bookmaker must resolve to a real, '
  'non-aggregate ai.bookmakers venue; AVG/MAX remain reference evidence only.';

commit;
