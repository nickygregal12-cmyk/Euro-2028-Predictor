# Production migration-history proof — repository migrations 1–20

**Workstream:** `OPS-006-HOSTED-SCHEMA-COMPATIBILITY`  
**Date:** 23 July 2026  
**Production project:** `vkfnsqdyhvtwyqkisxhk`  
**Repository baseline:** `main` after merged PR #16  
**Operation type:** read-only schema/history reconciliation

## Verdict

The live production database contains the independently verified structural effects of every repository migration from 1 through 20.

The Supabase migration-history API currently returns an empty migration list for production. The schema was created through manual SQL application rather than a tracked CLI push.

It is therefore technically supportable to mark repository migration timestamps 1–20 as **applied in migration history only**, provided that:

1. the committed baseline verifier still returns `all_structural_effects_present = true` immediately before repair;
2. the linked project is proven to be `vkfnsqdyhvtwyqkisxhk`;
3. the repair output is retained;
4. `supabase migration list` then shows 1–20 aligned;
5. `supabase db push --dry-run` proposes migrations 21–33 only.

No migration-history row was inserted or changed during this proof.

## Important distinction

This report proves that the schema effects needed to avoid replaying migrations 1–20 are present. It does **not** claim the current production database is perfectly identical to every historical migration statement.

Some earlier function definitions were intentionally superseded by later migrations. The verifier therefore checks surviving objects and the final downstream definitions rather than requiring an obsolete intermediate body to remain installed.

A separate current drift also exists: many functions have explicit execution grants to `anon`, `authenticated` and `service_role`, including functions that historical migrations intended to restrict. Replaying migrations 1–20 would not reliably remove those direct grants. This remains the separate `SECURITY-003` function-grant/search-path hardening workstream and must not be disguised as migration-history reconciliation.

## Evidence method

The committed script `scripts/database-rollout/production-baseline-1-20-verification.sql` checks production read-only using:

- table, column, view and index existence;
- RLS enablement and named policies;
- check, unique and foreign-key constraints;
- foreign-key deletion actions;
- function signatures, security mode and selected function-body invariants;
- trigger names, target tables, functions and trigger column lists;
- service-role execution required by the scorer;
- optimistic-concurrency and submission integrity definitions;
- a separate function-ACL drift inventory.

The live execution returned:

```text
all_structural_effects_present = true
```

All twenty individual migration checks returned true.

## Per-migration proof

| # | Repository migration | Live production evidence | Result |
| --- | --- | --- | --- |
| 1 | `20260719120000_init_v0_1.sql` | Initial profile/tournament/team/group/fixture/entry/prediction tables, RLS, named owner/reference policies and match-shape constraints | Proven present |
| 2 | `20260719130000_add_match_prediction_joker.sql` | `match_predictions.joker boolean not null default false` | Proven present |
| 3 | `20260719140000_add_predicted_tie_resolutions.sql` | Tie-resolution table, scope check, entry index, RLS and owner policy | Proven present |
| 4 | `20260719150000_enforce_joker_rules.sql` | Joker maximum/kickoff function and prediction trigger | Proven present |
| 5 | `20260719160000_add_bonus_and_submit.sql` | Players, bonus predictions, policies, unique entry relationship and submit RPC | Proven present |
| 6 | `20260719170000_lock_and_leaderboard.sql` | Tournament `lock_at`, lock functions/triggers and leaderboard RPC | Proven present |
| 7 | `20260719180000_add_leagues.sql` | League/member tables, read policies and all nine league RPCs | Proven present |
| 8 | `20260720120000_league_fk_semantics.sql` | Membership account deletion cascades; league-owner deletion restricts | Proven present |
| 9 | `20260720130000_add_scoring.sql` | `score_events`, `entry_totals`, scorer functions, policy and result trigger | Proven present |
| 10 | `20260720140000_fix_recompute_trigger.sql` | Result trigger always recomputes; scorer functions executable by service role | Proven present |
| 11 | `20260720150000_add_last_seen.sql` | `profiles.last_seen_at` and `last_seen_points` | Proven present |
| 12 | `20260720160000_add_profile_welcomed_at.sql` | `profiles.welcomed_at` | Proven present |
| 13 | `20260720170000_reveal_after_lock.sql` | Security-definer rival-entry RPC with lock and league-membership gates | Proven present |
| 14 | `20260720180000_add_rank_history.sql` | Rank-history table/policy/capture and scorer integration | Proven present |
| 15 | `20260720190000_profile_on_signup.sql` | `auth.users` insert trigger and security-definer profile creator | Proven present |
| 16 | `20260720200000_display_name_moderation.sql` | Display-name moderation function and profile trigger | Proven present |
| 17 | `20260720210000_rate_limits.sql` | Rate-limit event log, function and prediction/league triggers | Proven present |
| 18 | `20260721120000_scoring_positions_knockout_awards.sql` | Golden Boot field, group-order helpers, completed scorer and broadened result/award triggers | Proven present |
| 19 | `20260721130000_match_centre.sql` | Stage ordinal and both match-centre RPCs | Proven present |
| 20 | `20260722120000_write_integrity.sql` | Three version columns, `PT409` trigger, three version triggers and safe-partial submit checks | Proven present |

## Function ACL drift

The verification run found the following functions directly executable by `anon` despite their server/internal or signed-in-only intent:

- `_actual_group_order(uuid)`;
- `_group_h2h_stats(uuid, uuid[])`;
- `_resolve_group_cluster(uuid, uuid[])`;
- `capture_rank_history(uuid)`;
- all league mutation/read RPCs;
- `enforce_rate_limit(text, integer)`;
- `get_leaderboard(uuid)`;
- both Match Centre RPCs;
- `get_rival_entry(uuid, uuid)`;
- `recompute_all_scores()`;
- `recompute_tournament_scores(uuid)`;
- `submit_entry(uuid)`.

This is not evidence that migrations 1–20 are absent. It is current hosted ACL drift and is already tracked under `SECURITY-003`.

Do not combine function-grant changes into the migration-history metadata repair unless a separately reviewed security migration is ready and has passed development rehearsal.

## Prepared history-only repair

After the production write/deploy freeze, backup evidence and final baseline verification, the operator may run the following **metadata-only** command against the explicitly linked production project:

```bash
supabase migration repair \
  20260719120000 \
  20260719130000 \
  20260719140000 \
  20260719150000 \
  20260719160000 \
  20260719170000 \
  20260719180000 \
  20260720120000 \
  20260720130000 \
  20260720140000 \
  20260720150000 \
  20260720160000 \
  20260720170000 \
  20260720180000 \
  20260720190000 \
  20260720200000 \
  20260720210000 \
  20260721120000 \
  20260721130000 \
  20260722120000 \
  --status applied
```

`migration repair` changes only Supabase migration tracking metadata. It does not execute the migration SQL.

## Required verification after repair

Run and retain:

```bash
supabase migration list
supabase db push --dry-run
```

Required result:

- local and remote history align for 1–20;
- migrations 21–33 remain remote-pending;
- no unknown remote migration appears;
- the dry run proposes exactly the thirteen repository migrations 21–33 in timestamp order.

Stop if the output differs. Do not repair 21–33 as applied on production because their SQL has not run there.

## Current recommendation

The production 1–20 baseline is sufficiently evidenced for a controlled history-only repair during the approved migrations 21–33 rollout procedure.

Production remains unchanged. The next production-mutating action still requires explicit approval, verified recovery evidence, a linked-project identity check and immediate rerun of both the baseline and migrations 21–33 preflight scripts.