# Predictor progress handover — 2026-08-05 03:00

## Scope

Continued from the 01:00 handover against:

- GitHub: `nickygregal12-cmyk/Euro-2028-Predictor`
- Supabase development: `iouzoutneyjpugbbtdem`
- Supabase production: `vkfnsqdyhvtwyqkisxhk`
- Active Netlify project only: `euro28predictor` (`c69da01a-4650-43db-a1d2-b78b7f8e198a`)

The historic Netlify project remained out of scope and was not inspected or changed.

## Starting position

- PR #458 had merged as Contract 104.
- The 01:00 handover PR #461 was open and green.
- PR #460 had been restacked as Contract 105 and remained draft.
- Development Supabase remained at Contract 103.
- Production Supabase remained at Contract 63.

## Work completed

### 1. Verified Contract 104 exact-head evidence

PR #458 exact head `b14193f2a29c721cc625ba41178c0d699a3d428f` had completed successfully across:

- CI
- Browser E2E
- Database parity
- Hosted migration inventory
- Active-site Netlify deploy preview

The merged Contract-104 commit is `c76bca80e1ce6d8d40381d79ea7e4d22f364a4c7`.

### 2. Merged the 01:00 handover

PR #461 was squash-merged under expected-head protection.

- Head: `25fe412c8c169a0f93e583365bf801903e705a08`
- Merge commit: `96a5821f727ff5283d42fcb07c35383250a5d323`

### 3. Revalidated and merged Contract 105

PR #460 had been corrected and restacked on Contract-104 main. The final branch closes the Contract-102 split ancestry gap and derives the continuing Predictor Championship table from initial plus split fixtures instead of copying a starting total.

The final exact head `094d396a19d81271c2936aa16f408a36a8e960e9` passed:

- CI
- Browser E2E
- Database parity
- Hosted migration inventory
- active `euro28predictor` Netlify deploy preview

The PR was marked ready and squash-merged under expected-head protection.

- PR: #460
- Merge commit: `094258d38889d8a9d426df8b7ec9f077d190ad50`
- Repository contract after merge: **105**

Contract 105 adds:

- `predictor_internal.assert_bonus_cup_member_split_parent()`
- split-member ancestry enforcement
- populated split-parent immutability
- source initial-membership move/delete protection
- `predictor_internal.cup_split_group_tables(uuid)`
- derived initial-plus-split continuing standings
- trigger inventory and schema coverage updates
- pgTAP and TypeScript/PostgreSQL boundary tests

### 4. Rechecked hosted environments

Development Supabase remains at **103 migrations**, latest:

- `20260804333000_competition_instance_lineage`

Production Supabase remains intentionally at **63 migrations**, latest:

- `20260729154931_prediction_consensus_minimum_cohort`

No Supabase mutation was made during this session.

### 5. Rechecked active Netlify state

Only the permitted active project was inspected:

- project: `euro28predictor`
- site ID: `c69da01a-4650-43db-a1d2-b78b7f8e198a`
- domain: `euro28predictor.com`
- current deploy ID: `6a6bac566b6e440008d44e5b`
- state: `ready`
- team-login protection: enabled

No Netlify configuration or production deployment mutation was made.

## Current state

| Authority | State |
| --- | --- |
| Repository `main` | Contract **105** at `094258d38889d8a9d426df8b7ec9f077d190ad50` |
| Development Supabase | Contract **103** |
| Production Supabase | Contract **63**, unchanged |
| Active Netlify project | `euro28predictor`, ready |

The repository now leads development by two migrations:

1. `20260805001000_live_competition_callers.sql` — Contract 104
2. Contract-105 Cup split ancestry/continuing-table migration from PR #460

## Guarded-rollout boundary

The connected GitHub action surface available in this run did not expose a workflow-dispatch operation for the repository fast-lane. Applying the two migrations directly through the Supabase connector would bypass the repository-controlled rollout, evidence capture and automatic hosted-authority follow-up. That bypass was deliberately not taken.

This is an execution-surface limitation, not a migration or test failure.

## Risks and blockers

1. Development is two contracts behind repository main until the guarded fast-lane runs.
2. Any branch or preview declaring Contract 105 against Development will fail closed until hosted rollout and declaration alignment complete.
3. Production remains 42 contracts behind by design and must not be promoted merely to close the numerical gap.
4. Contract 105's cross-phase head-to-head behaviour is structurally supported, but the PR explicitly records that a dedicated behavioural assertion remains desirable.

## Exact next action for 05:00

1. Trigger the guarded development fast-lane from exact main `094258d38889d8a9d426df8b7ec9f077d190ad50` to apply Contracts 104 and 105 together.
2. Verify the development migration ledger reaches 105 and inspect:
   - `predictor_internal.current_public_competition_id(uuid,text)`
   - Contract-104 caller definitions and privilege revocations
   - `predictor_internal.assert_bonus_cup_member_split_parent()`
   - `assert_bonus_cup_member_split_parent` trigger binding
   - `predictor_internal.cup_split_group_tables(uuid)`
   - browser/service-role EXECUTE revocations
3. Merge the generated hosted-authority update only after its checks pass.
4. Reconcile any Netlify non-production contract declaration through the active `euro28predictor` project only.
5. Begin Contract 106 — the LMS wipeout restart lifecycle driver — only after Development 105 is verified and recorded.

Production must remain at Contract 63.
