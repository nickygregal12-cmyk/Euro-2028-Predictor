-- Contract 203: Bet Builder asks the database for the CURRENT decision.
--
-- `admin_ai_bet_builder_candidates` filtered `where r.decision = 'BET'` BEFORE
-- its `distinct on (r.prediction_id)`, so it returned the newest BET for a
-- prediction rather than the newest DECISION. A fixture whose price had gone
-- stale, and whose latest recommendation was therefore a PASS, still returned
-- its two-day-old BET as an actionable leg.
--
-- The browser knew. `src/services/supabase/betBuilder.ts` fetched
-- `admin_ai_recommendation_log` for all nine leagues, 500 rows each, kept the
-- newest row per fixture and market, and intersected the candidate list against
-- it — nine extra round trips to re-derive something the database could answer
-- in one, and a second definition of "current" living in TypeScript.
--
-- Contract 201 gave that rule one home: `ai.current_fixture_recommendations` is
-- the newest recorded decision per fixture across every forecast of it. The
-- candidate read now joins it and admits a leg only when the newest decision for
-- the fixture IS this recommendation and it is a BET. A stale BET cannot leak,
-- the browser filter becomes belt-and-braces rather than the only guard, and the
-- nine-request fan-out becomes one.
--
-- THE PROTECTION IS PRESERVED, NOT REMOVED. `ai.recommendations` stays
-- append-only: nothing is rewritten, and the older BET remains readable in the
-- decision log as the audit record of what the lab said at the time.
--
-- The response also carries the coverage counts, so a Bet Builder with no legs
-- can say WHY on the same screen: how many fixtures were analysed in the window,
-- how many have a current decision, and the distribution of refusal codes over
-- the ones that passed. A zero-leg builder that explains itself is the whole
-- difference between "no value right now" and "something is broken".

begin;

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
  v_coverage  jsonb;
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
      select cr.recommendation_id,
             cr.league,
             cr.market,
             cr.selection,
             cr.bookmaker,
             cr.odds_offered              as odds,
             cr.calibrated_prob,
             cr.fair_odds,
             cr.expected_value            as model_edge,
             cr.data_confidence,
             cr.data_confidence_state,
             cr.agreement_score,
             cr.uncertainty_width,
             cr.odds_captured_at,
             extract(epoch from (now() - cr.odds_captured_at))::int as price_age_seconds,
             ai.price_age_limit_seconds(
               extract(epoch from (cr.kickoff_at - now())) / 3600.0,
               not v_book.is_real_price)                            as price_age_limit_seconds,
             cr.kickoff_at,
             p.fixture_id::text           as fixture_id,
             p.home_canonical,
             p.away_canonical,
             p.horizon,
             p.uses_market
        -- ONE decision per fixture, and it must be the current one. The old read
        -- filtered to BET first and took the newest of THOSE, which is how a
        -- superseded BET survived a later PASS.
        from ai.current_fixture_recommendations cr
        join ai.valid_predictions p on p.id = cr.prediction_id
        join ai.fixtures f on f.id = cr.fixture_id
       where cr.decision = 'BET'
         and cr.bookmaker = p_bookmaker
         and f.status = 'scheduled'
         and cr.kickoff_at between v_from and v_to
         and (p_leagues is null or cr.league = any(p_leagues))
       order by cr.kickoff_at, cr.fixture_id
       limit v_limit) c;

  -- Why the list is the length it is, on the same read.
  select jsonb_build_object(
      'fixtures_in_window', count(*),
      'with_current_decision', count(*) filter (where cr.recommendation_id is not null),
      'actionable_anywhere', count(*) filter (where cr.decision = 'BET'),
      'actionable_at_this_book', count(*) filter (
        where cr.decision = 'BET' and cr.bookmaker = p_bookmaker),
      'passed', count(*) filter (where cr.decision = 'PASS'),
      'pass_reason_counts', (
        select coalesce(jsonb_object_agg(code, n), '{}'::jsonb)
          from (select code, count(*) as n
                  from ai.fixtures g
                  join ai.current_fixture_recommendations c2 on c2.fixture_id = g.id,
                       unnest(c2.reason_codes) as code
                 where g.status = 'scheduled'
                   and c2.kickoff_at between v_from and v_to
                   and (p_leagues is null or c2.league = any(p_leagues))
                   and c2.decision = 'PASS'
                 group by code) r))
    into v_coverage
    from ai.fixtures f
    left join ai.current_fixture_recommendations cr on cr.fixture_id = f.id
   where f.status = 'scheduled'
     and f.kickoff_at between v_from and v_to
     and (p_leagues is null or f.league_key = any(p_leagues));

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
    'coverage', v_coverage,
    'source', 'ai.current_fixture_recommendations where the NEWEST decision for the '
              'fixture is BET, at one real actionable bookmaker, excluding '
              'quarantined predictions and voided fixtures. A later PASS supersedes '
              'an earlier BET without either audit row being rewritten.',
    'generated_at', now());
end;
$$;

comment on function public.admin_ai_bet_builder_candidates(text,text[],timestamptz,timestamptz,integer) is
  'Competition-admin Bet Builder leg read. p_bookmaker must resolve to a real, '
  'non-aggregate ai.bookmakers venue; AVG/MAX remain reference evidence only. Only '
  'the CURRENT decision for a fixture can supply a leg, and the response carries '
  'the coverage counts and refusal distribution so an empty builder explains '
  'itself.';

-- The books read gains the same currency rule, so a book''s leg count on the
-- picker matches what selecting it actually returns.
create or replace function public.admin_ai_bet_builder_books()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  perform predictor_internal.require_competition_admin();
  return jsonb_build_object(
    'bookmakers', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.legs desc, b.code)
        from (
          select bk.code, bk.name, bk.kind, bk.is_real_price,
                 bk.exchange_commission,
                 count(cr.recommendation_id) filter (
                   where cr.decision = 'BET'
                     and cr.kickoff_at > now())          as legs,
                 max(cr.decided_at) filter (
                   where cr.decision = 'BET')            as last_decided_at
            from ai.bookmakers bk
            left join ai.current_fixture_recommendations cr
                   on cr.bookmaker = bk.code
           where bk.is_real_price and bk.kind <> 'aggregate'
           group by bk.code, bk.name, bk.kind, bk.is_real_price,
                    bk.exchange_commission) b), '[]'::jsonb),
    'generated_at', now());
end;
$$;

comment on function public.admin_ai_bet_builder_books() is
  'Competition-admin Bet Builder venue picker. Real non-aggregate venues only, '
  'each with the number of CURRENT BET decisions naming it, so the count on the '
  'picker is the number of legs selecting it returns.';

commit;
