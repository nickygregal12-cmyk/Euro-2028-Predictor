# CLAUDE.md — Euro 2028 Predictor

Convenience summary for coding-agent sessions. [`AGENTS.md`](AGENTS.md) and [`docs/quality/current-status.md`](docs/quality/current-status.md) are authoritative.

## Baseline

- React 19, TypeScript, Vite, Supabase and Netlify.
- Current `main` is repository contract 60 with 60 migrations through `20260729110000_predictor_cup_lint_safe_qualification.sql`.
- `config/deployment-contract.json` agrees at `contractVersion: 60` and `requiredMigrationCount: 60`.
- PR #193 is open, draft and unmerged. Contracts 61–62 are excluded from the contract-60 baseline.
- PR #193 exact head `901a2bb92b74979283491e5c85d71b01657193a9` passed CI `30456665007`, Database parity `30456665266` and Browser E2E `30456664993`.
- Development Supabase, production Supabase and Netlify context contracts are **REQUIRES OWNER VERIFICATION**. Do not repeat an undated hosted alignment claim.
- Normal work happens against development; production promotion is milestone-only.

Do not import rules or features from previous projects, old branches, prototypes or chats.

## Contract-62 candidate decisions

- Final standings activate automatically only after every tournament result is confirmed/corrected; live standings remain points/shared-rank based (`DEC-003`).
- Prediction consensus has no minimum cohort threshold; a single submitted entry can produce output. `PRIV-001` must be resolved or explicitly accepted before PR #193 merges (`DEC-004`).
- These are tested candidate behaviours, not contract-60 baseline behaviour.

## Proportionate checks

- UI/copy/docs: CI and a targeted preview/UI check when relevant.
- Features/development schema: CI plus relevant Database parity or Browser E2E.
- Production schema/auth/scoring/destructive work: recovery evidence where needed, preflight, explicit approval, hosted verification and dated evidence.

Ordinary development does not require production backup, production smoke or a new reconciliation document.

## Architecture

- Tournament rules live under `src/domain/tournament/`.
- Components render domain results rather than inventing rules.
- Browser Supabase access goes through `src/services/supabase/`.
- Keep pure response parsing/models separate from configured Supabase wrappers.
- Database rules are authoritative for locks, submission, results, progression, scoring and profile reveal/access boundaries.
- Original Predictor and bonus games remain separate.
- Predicted and real brackets never blend.
- Knockout UI consumes authoritative winner/result-method data.
- Profile/H2H headline totals and ranks come from bounded server reads.
- Other-player profiles remain limited to authenticated league co-members.

## Scoring

[`docs/scoring-rules.md`](docs/scoring-rules.md) is authoritative:

- group result 3; exact score 5 total;
- five Jokers, group-match points only;
- positions 2 each plus 5 full-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group goals 40 / 30 / 20;
- KO Predictor is a separate score system: exact 5 / result 3 / through +2;
- Last Man Standing uses tournament-format survival, one team once and wipeout voiding.

## Current order

1. Finish PR #195's contract-60 baseline reconciliation.
2. Owner records development/production Supabase and Netlify verification results.
3. Resolve or explicitly accept `PRIV-001`, then decide PR #193's merge/exclusion.
4. Complete branch cleanup from PR #194 and remaining launch-readiness work.

## Hard boundaries

- No direct push to `main`.
- No unapproved production mutation, reset or repair.
- No direct-table fallback around protected RPCs.
- No Netlify/Supabase context crossing or guard bypass.
- No current-project modification of the legacy World Cup deployment.
- No scoring or rule change without authority and test updates.
- No hosted claim without a dated verifier and exact evidence.
- No control-document deletion as cleanup; archive and repair links.