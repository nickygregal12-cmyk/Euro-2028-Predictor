# Predictor Cup lint-safe progression

**Date:** 29 July 2026  
**Contract:** 59

## Finding

The owner-authorised contract-58 production promotion completed its exact pending-chain dry run, applied migrations 56–58 and passed preserved-data and privilege verification. Hosted `supabase db lint`, however, reported one static-analysis error in `admin_settle_predictor_cup_round`: the analyser could not resolve the session-local `pg_temp.cup_round_seats` table used only while moving playoff winners and byes into the fixed seeded bracket.

The existing contract-56 pgTAP lifecycle had already executed this path successfully. The issue was lint visibility, not a failed Cup rule or production data mutation.

## Resolution

Contract 59 replaces only that temporary-table handoff with an equivalent statement-local CTE and renames the loop variable so it no longer shadows its declaration. It does not change:

- qualification or seeding rules;
- playoff, bye or bracket-seat arithmetic;
- points, extra-time, Penalty Number or walkover decisions;
- stored fixture/audit output;
- service-role-only execution.

## Verification

- rollback-only hosted development rewrite test confirmed the `pg_temp` reference was removed and the CTE/slot loop were present;
- clean rebuild from all 59 canonical migrations passed;
- local database lint passed;
- the full pgTAP suite, including the Predictor Cup lifecycle and focused contract-59 assertions, passed;
- TypeScript/PostgreSQL parity passed;
- development migration history was aligned to canonical version `20260729100000`.

Production remained at contract 58 while this hotfix passed its independent gates.
