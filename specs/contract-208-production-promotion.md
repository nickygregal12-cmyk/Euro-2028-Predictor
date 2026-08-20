# Contract 208 Production promotion

## Exact boundary

Production is currently Contract 205. The intended single promotion is exactly these three additive migrations, in order:

1. `20260819110000_same_season_player_profile.sql`
2. `20260819120000_cup_phase_determinate_membership.sql`
3. `20260819130000_cup_bracket_outcome_and_knockout_stage.sql`

Development must reach and be independently recorded at Contract 208 first. Production remains read-only throughout the encrypted backup and disposable-restore rehearsal. The Production rollout may write only after both gates succeed.

## Required evidence

The rehearsal must prove the encrypted Production backup run succeeded and still has its encrypted artifact, restore the current Contract-205 Production database into a disposable local Supabase, dry-run exactly the three files above, apply them only to that disposable copy, and pass these behavioural suites:

- `252_same_season_player_profile_visibility.sql`
- `253_cup_phase_determinate_membership.sql`
- `254_cup_bracket_outcome_and_knockout_stage.sql`

Before/after measurements must show no movement in the protected player-owned, AI, cron or publication-state counts. The installed functions must preserve authenticated-only access and prove the Contract-207 determinate phase lookup plus the Contract-208 caller outcome / narrowed knockout-stage behaviour.

The rollout must require that successful backup and a successful rehearsal from the exact same repository head, independently confirm Production is still Contract 205, dry-run the same three-file set, apply it once, and verify the live ledger at Contract 208 with the same protected-state checks.

## Netlify boundary

Neither Production Netlify declaration may be raised ahead of the Production database. After an independent Production read-back proves Contract 208, set `EURO28_DEPLOYED_DB_CONTRACT=208` in the production context of both `predictorhub` and `euro28predictor`, then trigger and verify both Production deployments.

## Non-actions

This preparation does not mutate Production, does not alter `production-backup.yml`, does not add a push or schedule trigger to any Production workflow, and does not change a Netlify Production declaration. The normal Production workflows remain `workflow_dispatch` only.
