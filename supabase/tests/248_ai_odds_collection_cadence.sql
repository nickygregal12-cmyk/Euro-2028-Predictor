-- Contract 200: the paid odds collector must poll faster than the value gate
-- ages a price out.
--
-- The heartbeat asked for a paid-covered kickoff inside TWENTY-FOUR HOURS and
-- did nothing when there was none, while the lab forecasts ten days ahead and
-- `ai.price_age_limit_seconds` refuses any real-book quote older than twelve.
-- Between matchday clusters nothing was collected, every quote aged out, and
-- every recommendation became PASS_STALE_PRICE. Production at 10:00 UTC on
-- 18 August 2026: 52 scheduled fixtures, nearest kickoff fifty-seven hours away,
-- last dispatch 18:45 on the 17th, all 120 current recommendations PASS — from a
-- gate that had produced BET decisions on fresh prices the afternoon before.
--
-- THE INVARIANT, not the four numbers: at every distance from kickoff the
-- collector may wait strictly less than the gate accepts as a current price.
-- Anything else guarantees a stale window in every cycle however the gate is
-- written, and a suite that pinned the literals would pass on a cadence that
-- could never work.

begin;

select plan(8);

select ok(
  (select p.provolatile = 'i'
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'ai' and p.proname = 'odds_poll_max_gap_seconds'),
  'the cadence is an IMMUTABLE function of the distance to kickoff'
);

select is(
  (select count(*)::integer
     from (values (0.25), (1.0), (2.0), (2.001), (4.0), (8.0), (8.001),
                  (12.0), (24.0), (24.001), (96.0), (180.0)) as h(hours)
    where ai.odds_poll_max_gap_seconds(h.hours)
          >= ai.price_age_limit_seconds(h.hours, false)),
  0,
  'at every distance the collector waits strictly less than the gate allows'
);

select is(
  (select count(*)::integer
     from (values (0.25), (1.0), (2.0), (2.001), (4.0), (8.0), (8.001),
                  (12.0), (24.0), (24.001), (96.0), (180.0)) as h(hours)
    where ai.odds_poll_max_gap_seconds(h.hours) is null),
  0,
  'every distance the lab forecasts over has a cadence tier'
);

select is(ai.odds_poll_max_gap_seconds(1.0), 600,
          'inside two hours of kickoff, at most ten minutes');
select is(ai.odds_poll_max_gap_seconds(4.0), 3000,
          'inside eight hours, at most fifty minutes');
select is(ai.odds_poll_max_gap_seconds(20.0), 21600,
          'inside a day, at most six hours');
select is(ai.odds_poll_max_gap_seconds(120.0), 28800,
          'inside seven and a half days, at most eight hours — the tier that did '
          'not exist, and whose absence emptied the Bet Builder between matchdays');

select ok(
  ai.odds_poll_max_gap_seconds(180.001) is null
  and ai.odds_poll_max_gap_seconds(null) is null,
  'beyond seven and a half days, and with no upcoming fixture, the answer is '
  'do not spend a credit rather than a long interval'
);

select * from finish();

rollback;
