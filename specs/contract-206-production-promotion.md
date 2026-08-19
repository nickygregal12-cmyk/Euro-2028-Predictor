# Contract 206 Production promotion

## Problem and operator outcome

Repository Contract 206 is ahead of both hosted databases. Production must not
receive `20260819110000_same_season_player_profile.sql` until Development has
proved the contract and the existing Production safeguards have been replayed
for the exact 205 to 206 boundary.

The operator outcome is a reviewable, manual-only pair of workflows that makes
the Production promotion ready to run immediately after Development is recorded
at 206, without weakening the encrypted-backup or restore-rehearsal gates.

## Scope

In scope:

- one exact 205 to 206 Production rehearsal;
- one exact 205 to 206 Production rollout;
- reuse the existing `production-backup.yml` encrypted backup as rollback
  authority;
- run Contract 206's `252_same_season_player_profile_visibility.sql` suite on a
  disposable restore before Production can be mutated;
- prove the migration set is exactly one additive file and that Production is
  exactly Contract 205 before promotion;
- compare player-owned, AI-Lab, cron and publication-state measurements before
  and after, because Contract 206 changes functions only.

Out of scope:

- changing the generic Production backup workflow;
- push, schedule, automatic or background Production promotion;
- bypassing the Development-first rule;
- updating hosted contract records before hosted evidence exists;
- updating Netlify's production contract declaration before Production is
  independently read back at 206;
- Contracts 207/208 or any other open migration branch.

## Governing authorities

- `AGENTS.md`
- `NOW.md`
- `config/deployment-contract.json`
- `config/development-hosted-contract.json`
- `config/production-hosted-contract.json`
- `.github/workflows/production-backup.yml`
- `.github/workflows/production-198-to-205-rehearsal.yml`
- `.github/workflows/production-198-to-205-rollout.yml`
- `supabase/migrations/20260819110000_same_season_player_profile.sql`
- `supabase/tests/252_same_season_player_profile_visibility.sql`

## Acceptance scenarios

1. A rehearsal refuses unless it is manually dispatched against the exact
   Production project with the exact confirmation phrase and a successful
   encrypted backup artifact.
2. A rehearsal refuses while the committed Development hosted record is below
   Contract 206.
3. Both workflows refuse if repository head has moved above or below Contract
   206, if Production is not exactly Contract 205, or if the dry-run migration
   set differs from the single Contract 206 migration.
4. Rehearsal restores current Production into a disposable Supabase, applies
   Contract 206 only there, and the 21-assertion Contract 206 pgTAP suite passes.
5. Rehearsal proves the new by-ref RPC is authenticated-only while the legacy
   UUID RPC remains authenticated-only and narrow.
6. Rollout requires the successful backup and exact-head successful rehearsal
   before applying anything to Production.
7. Rollout verifies Production at Contract 206 and proves measured data, cron,
   AI Lab and publication-state counts did not move.
8. No workflow changes the Production backup's manual-only trigger or turns the
   Production promotion into a push/scheduled path.

## Privacy and security constraints

The new same-season profile path must not expose the target authentication UUID,
must not widen the legacy UUID-addressed profile read, and must not widen pin or
Prediction DNA capabilities. Production secrets must remain scoped to GitHub
Actions and must never be printed.

## Rollout order and rollback boundary

Development 205 to 206 -> reconcile Development hosted record -> fresh encrypted
Production backup -> 205 to 206 rehearsal -> 205 to 206 Production rollout ->
independent Production read-back -> reconcile Production hosted record -> update
both Netlify Production `EURO28_DEPLOYED_DB_CONTRACT` values to 206 -> deploy.

The encrypted Production backup is the rollback authority. No later stage is
allowed to infer that an earlier one succeeded.

## Completion predicate

The preparation is complete when the exact two manual-only Production workflow
files are merged and green under repository CI. The hosted promotion is complete
only after the workflows have actually run successfully and fresh Supabase
read-back confirms Contract 206.
