-- Contract 199: one fixture, one market, one piece of betting evidence — and a
-- settlement outcome that does not need a scoreline to exist.
--
-- TWO DEFECTS, BOTH FOUND ON PRODUCTION ON 18 AUGUST 2026, BOTH ABOUT THE SAME
-- CONFUSION: what a single piece of paper-betting evidence IS.
--
-- 1. REPEATED ADVICE ON ONE MATCH.
--    `find_value` refused to advise a fixture twice by asking whether the
--    PREDICTION already carried a bet. But `ai.predictions` is unique on
--    (model_id, fixture, horizon), so every retrain mints a fresh prediction row
--    for a fixture that was already advised, the guard found no bet against the
--    new id, and a second paper bet was recorded on the same match. Production
--    measured 226 ai.bets rows over 125 fixture/market pairs: 49 pairs carried
--    two rows and 6 carried three, and 38 fixtures held two bets on the SAME
--    selection at the SAME bookmaker. Each repeat counted one opinion about one
--    match more than once in the bet count, the exposure, the hit rate, the ROI
--    and the CLV sample — the last of which is the lab's primary metric and the
--    number the publication gate reads.
--
--    The code guard is fixed in the same movement so no new repeat can be
--    written. This contract handles the rows that already exist, and it does so
--    WITHOUT DELETING OR REWRITING ANY OF THEM. ai.bets stays the immutable
--    historical record of what the lab actually said and when. Validity is
--    decided by the existing ai.valid_bets authority, which already carries two
--    limbs — the forecast must not be quarantined, and the venue must be a real
--    non-aggregate book — and now carries a third: the row must be the CANONICAL
--    advice for its fixture and market.
--
--    Canonical means EARLIEST, by advised_at, then created_at, then id. Earliest
--    rather than best is the whole point. It is the advice the corrected guard
--    would itself have produced and kept, it is the price the lab could actually
--    have taken at the first moment it said BET, and it cannot be accused of
--    picking the repeat with the friendliest odds after the fact. Every excluded
--    row remains readable, with the row that superseded it named, through
--    ai.bet_advice_identity.
--
-- 2. SETTLEMENT REQUIRED A SCORELINE.
--    ai.bet_results.actual_result was NOT NULL and checked against H/D/A, so a
--    bet on a fixture that never produced a result could not be settled at all,
--    even though settlement_outcome has always accepted 'void'. A postponed or
--    abandoned fixture therefore left its bet advised forever, which reads as a
--    broken pipeline rather than as a returned stake. actual_result becomes
--    nullable, permitted to be null ONLY on a void settlement, and required on
--    every other outcome. No existing row changes: all of them are win or loss
--    and all of them name a result.
--
-- Nothing here settles, voids, deletes or rewrites a single historical row. It
-- changes which rows count as evidence, and it makes one more outcome
-- expressible.

begin;

-- ---------------------------------------------------------------------------
-- 1. The advice identity, with its audit trail.
-- ---------------------------------------------------------------------------
create or replace view ai.bet_advice_identity as
  select b.id                        as bet_id,
         b.fixture_id,
         b.market,
         b.league,
         b.advised_at,
         b.created_at,
         row_number() over w         as advice_rank,
         (row_number() over w) = 1   as is_canonical,
         first_value(b.id) over w    as canonical_bet_id,
         count(*) over (partition by b.fixture_id, b.market) as advice_rows
    from ai.bets b
  window w as (partition by b.fixture_id, b.market
               order by b.advised_at, b.created_at, b.id);

comment on view ai.bet_advice_identity is
  'One row per ai.bets row, saying whether it is the canonical advice for its '
  'fixture and market and, when it is not, which row superseded it. Canonical is '
  'the EARLIEST advice by (advised_at, created_at, id): the advice the corrected '
  'find_value guard would have kept, chosen without reference to the odds so a '
  'repeat can never be selected for being the friendliest. Every row stays '
  'readable here, including the excluded ones. This is the audit trail for the '
  'third limb of ai.valid_bets.';

-- ---------------------------------------------------------------------------
-- 2. Validity gains its third limb.
-- ---------------------------------------------------------------------------
create or replace view ai.valid_bets as
  select b.*
    from ai.bets b
    join ai.bookmakers bk on bk.code = b.bookmaker
   where exists (select 1 from ai.valid_predictions p where p.id = b.prediction_id)
     and bk.is_real_price = true
     and bk.kind <> 'aggregate'
     and exists (select 1 from ai.bet_advice_identity i
                  where i.bet_id = b.id and i.is_canonical);

comment on view ai.valid_bets is
  'Actionable betting evidence only, on three limbs: the originating forecast '
  'must remain in ai.valid_predictions, the recorded bookmaker must be a real '
  'non-aggregate venue in ai.bookmakers, and the row must be the canonical '
  'advice for its fixture and market per ai.bet_advice_identity. Base ai.bets '
  'rows stay immutable historical record. All CLV, ROI, exposure, evidence and '
  'publication reads consume this view.';

-- ---------------------------------------------------------------------------
-- 3. A void settlement does not need a scoreline.
-- ---------------------------------------------------------------------------
alter table ai.bet_results alter column actual_result drop not null;

alter table ai.bet_results drop constraint if exists bet_results_actual_result_check;

alter table ai.bet_results
  add constraint bet_results_actual_result_check
  -- `actual_result in (...)` alone is NOT ENOUGH on the non-void arm: against a
  -- null it evaluates to NULL, and a CHECK passes on NULL. Written that way the
  -- constraint accepted a 'loss' with no result — exactly the hole it exists to
  -- close — and a test caught it. The explicit `is not null` makes the arm
  -- evaluate to FALSE instead.
  check (
    case
      when settlement_outcome = 'void'
        then actual_result is null or actual_result in ('H', 'D', 'A')
      else actual_result is not null and actual_result in ('H', 'D', 'A')
    end
  );

comment on column ai.bet_results.actual_result is
  'The 1X2 outcome the fixture produced. Null is permitted only on a void '
  'settlement, where the fixture never produced one and the stake is returned.';

-- ---------------------------------------------------------------------------
-- 4. Prove the contract on the data that is here, before it is trusted.
-- ---------------------------------------------------------------------------
do $$
declare
  v_bets           integer;
  v_identity_rows  integer;
  v_canonical      integer;
  v_pairs          integer;
  v_valid          integer;
  v_valid_pairs    integer;
begin
  select count(*) into v_bets from ai.bets;
  select count(*) into v_identity_rows from ai.bet_advice_identity;
  select count(*) into v_canonical from ai.bet_advice_identity where is_canonical;
  select count(*) into v_pairs
    from (select distinct fixture_id, market from ai.bets) p;

  -- Every bet is classified exactly once, and exactly one row per fixture and
  -- market is canonical. Neither is a matter of opinion, so both are asserted.
  if v_identity_rows <> v_bets then
    raise exception 'ai.bet_advice_identity covers % of % ai.bets rows',
      v_identity_rows, v_bets;
  end if;
  if v_canonical <> v_pairs then
    raise exception 'canonical rows % do not equal fixture/market pairs %',
      v_canonical, v_pairs;
  end if;

  -- ai.valid_bets can now hold at most one row per fixture and market.
  select count(*), count(distinct (fixture_id, market))
    into v_valid, v_valid_pairs
    from ai.valid_bets;
  if v_valid <> v_valid_pairs then
    raise exception 'ai.valid_bets holds % rows over % fixture/market pairs',
      v_valid, v_valid_pairs;
  end if;

  raise notice 'contract 199: % ai.bets rows, % canonical over % fixture/market '
               'pairs, ai.valid_bets now % rows',
    v_bets, v_canonical, v_pairs, v_valid;
end;
$$;

commit;
