# Reconciliation — contract-44 production promotion (28 July 2026)

## Scope and approval

The owner explicitly directed promotion of all development-only migrations (contracts 39–44) to production Supabase `vkfnsqdyhvtwyqkisxhk` and the publication of the current application to the production site, noting the pre-launch context: no public users, a single owner account, two years before the tournament.

## Pre-promotion state and gate evidence

- Production recorded exactly 38 canonical migrations through `20260727080159_admin_result_revision_timestamp`.
- Data inventory before mutation: 1 auth user, 1 profile, 1 entry (36 match predictions, 8 progressions), 1 league, 0 results, 0 score events, reference data (1 tournament, 24 teams, 51 matches).
- Fresh encrypted backup: workflow run `30337648499` (Production backup, `main` @ `15e6c8e`) completed **success** immediately before migration, including the disposable-restore verification and encrypted artifact upload, under the contract-38 expectations then pinned.

## Applied scope

Migrations 39–44 applied in canonical order via the Supabase MCP SQL channel (postgres role — the same privilege level as CLI migration), each executed atomically inside the migration's own transaction together with its history row:

| # | Version | Name |
| ---: | --- | --- |
| 39 | `20260727150621` | `actual_round_of_16_population` |
| 40 | `20260727163339` | `actual_third_place_resolution` |
| 41 | `20260727174658` | `automatic_entry_submission` |
| 42 | `20260727182300` | `bounded_read_models` |
| 43 | `20260727183900` | `bounded_overall_leaderboard` |
| 44 | `20260727191942` | `operating_cap_enforcement` |

History-row note: rows record the exact canonical `version`, `name` and `created_by`; the `statements` column carries a dated pointer to the canonical repository file rather than the inline script (the CLI convention on development stores the raw file text). No verifier reads `statements`; version/name identity is canonical.

## Post-promotion verification

- `supabase_migrations.schema_migrations`: exactly **44** rows; latest `20260727191942_operating_cap_enforcement`; the six new versions byte-identical to the development history.
- Data unchanged: 1 user / 1 profile / 1 entry / 36 predictions / 8 progressions / 1 league / 0 score events / 0 automatic outcomes.
- `cron.job`: `euro28-auto-submit-due-entries` active on `* * * * *`.
- Old `get_leaderboard(uuid)` dropped; `get_leaderboard(uuid,integer,text)` present, anon denied, authenticated granted.
- All 13 `config/deployment-contract.json` required RPC signatures present.
- `get_public_capacity()`: 1/50 public users, 1/20 leagues, both available.
- Security advisors: only the known intentional posture (application-RPC allowlist WARNs, deny-by-default RLS INFO items, open `DB-001` mutable search path on `enforce_joker_rules`, open `AUTH-002` leaked-password decision). No new findings.

## Release side (application)

- Repository workflows re-pinned to contract 44 (`production-backup.yml` expectations, `production-smoke.yml` `EXPECTED_CONTRACT`).
- **Interim known state:** until the contract-44 application build is published, the production site still serves the locked contract-38 build, whose overall-standings read calls the dropped `get_leaderboard(uuid)` — that page fails against the contract-44 database. Accepted knowingly for the zero-user window; resolved by publishing the new build.
- Owner actions to complete the release (Netlify UI): set the production context's `EURO28_DEPLOYED_DB_CONTRACT` to `44`, merge the pending branch to `main`, publish the resulting production deploy, then run the manual production smoke workflow (now expecting 44) against the exact published head.

## Lock position

Production returns to milestone-locked after the release is published and smoked. Contracts beyond 44 (draft PR #138's 45–46) remain development-only until a future approved milestone.
