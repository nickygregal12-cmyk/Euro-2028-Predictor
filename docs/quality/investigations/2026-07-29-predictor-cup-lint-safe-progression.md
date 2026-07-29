# Predictor Cup lint-safe qualification and progression

**Date:** 29 July 2026  
**Contracts:** 59–60

## Finding

The owner-authorised production promotion completed its exact pending-chain dry run, applied contracts 56–58 and passed preserved-data and privilege verification. Hosted `supabase db lint` then exposed two static-analysis errors in the contract-56 service functions:

- `admin_settle_predictor_cup_round` referenced the session-local `pg_temp.cup_round_seats` table while moving playoff winners and byes into the fixed seeded bracket;
- `admin_finalise_predictor_cup_groups` referenced the session-local `pg_temp.cup_gate_tables` cache while calculating qualification and seeding.

The existing contract-56 pgTAP lifecycle had already executed both paths successfully. The findings were lint visibility problems, not failed Cup rules or production data mutations.

## Resolution

Contract 59 replaces the playoff seat handoff with an equivalent statement-local CTE. Contract 60 replaces the qualification cache with repeated reads from the same authoritative deterministic final-table function. The migrations also remove explicit declarations for integer `FOR` loop variables and type empty seed arrays explicitly.

They do not change:

- group ranking or qualification rules;
- wildcard ordering or seeding bands;
- playoff, bye or bracket-seat arithmetic;
- points, extra-time, Penalty Number or walkover decisions;
- stored fixture/audit output;
- service-role-only execution.

## Verification

- rollback-only hosted development tests confirmed both rewrites and showed zero remaining application SQL functions with temporary-table dependencies;
- clean rebuild from all 60 canonical migrations passed;
- local database lint passed;
- the full pgTAP suite, including the Predictor Cup lifecycle and focused contracts 59–60 assertions, passed;
- TypeScript/PostgreSQL parity passed;
- development migration history was aligned to canonical versions `20260729100000` and `20260729110000`;
- production dry-runs and preserved-count comparisons passed for both function-only migrations;
- production database lint passed at contract 60;
- production retained one Auth user, one profile, one entry, one league, 51 matches and 36 saved predictions, with no synthetic Bonus Games rows.
