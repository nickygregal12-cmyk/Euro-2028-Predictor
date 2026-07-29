# Current quality status

> The only live implementation and hosted-status authority. Current `main` code, migrations and executable tests override older audits, reconciliations, TODOs and chat narratives. Hosted claims require a dated verifier.

**Status date:** 29 July 2026  
**Assessed baseline:** contract 60 on `main` at `7555db4625f8e1c4d9a0cb72185c40391cf90f3f`

## Baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository contract | **Verified:** 60 canonical migrations through `20260729110000_predictor_cup_lint_safe_qualification.sql`; `config/deployment-contract.json` declares `contractVersion: 60` and `requiredMigrationCount: 60`. |
| PR #193 | Open, draft and unmerged (`merged_at = null`). Contracts 61–62 are deliberately excluded from this contract-60 baseline. Exact head `901a2bb92b74979283491e5c85d71b01657193a9` passed CI `30456665007`, Database parity `30456665266` and Browser E2E `30456664993`. |
| Development Supabase | **REQUIRES OWNER VERIFICATION:** run the migration-history and privilege SQL in [`investigations/2026-07-29-euro-2028-baseline-readiness.md`](investigations/2026-07-29-euro-2028-baseline-readiness.md), then record verifier/date. |
| Production Supabase | **REQUIRES OWNER VERIFICATION:** run the same migration count/highest-version query against production and record verifier/date. |
| Netlify non-production contexts | **REQUIRES OWNER VERIFICATION:** inspect `dev`, `branch-deploy`, `deploy-preview` and exact preview `/release.json`; record contract, commit and Supabase project with verifier/date. |
| Published production application | **REQUIRES OWNER VERIFICATION:** inspect production `/release.json` and deployment identity; record any deliberate application/database split with verifier/date. Historical repository records identify PR #184 as the last verified Bonus Games application cut, but this document does not independently re-verify it. |
| Branch cleanup | **REQUIRES OWNER VERIFICATION:** PR #194 remains the branch inventory authority; record whether it was merged and deletions executed. |

Production is a controlled future-tournament target, not an active Euro 2028 service. Repository facts are verified at contract 60. No current hosted alignment statement is made without the owner checks above.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Repository contract | **Verified at 60.** Migration count, highest filename and deployment-contract values agree. |
| Contract 61–62 candidate | **Repository-side complete and green, not shipped.** PR #193 is deliberately excluded from the baseline until merged. |
| Final tie-break decision | **Resolved for the candidate.** Migration 62 automatically activates the five tie-breakers after every tournament result is confirmed/corrected; live ranks remain points/shared-rank based. See `DEC-003`. |
| Prediction aggregate privacy | **Open merge risk.** Migration 61 has no minimum cohort threshold; one submitted entry can produce aggregate output. See `DEC-004` and `PRIV-001`. |
| Hosted contract and release alignment | **REQUIRES OWNER VERIFICATION.** Exact checks are in the baseline-readiness report. |
| Database lint and automated repository validation | **Verified for current `main` through existing CI evidence.** PR #193's candidate also passed exact-head CI, Database parity and Browser E2E, but remains unmerged. |
| Launch readiness | **Not ready.** Official data, hosted verification, privacy acceptance, operational ownership, manual accessibility and the full dress rehearsal remain. |

## Implemented contract-60 foundation

- authoritative locks, submission, results, revisions, scoring, qualification and bracket replay;
- exact result-revision content proof across confirm, penalty correction and clear;
- automatic valid-entry submission using the authoritative validator;
- deterministic group/tie resolution and real winner propagation;
- bounded overall/private-league reads, representative scale evidence and operating caps;
- secure co-member profiles, H2H totals, rank history and bracket health;
- private Account controls and non-resurrecting pre-lock Original entry clearing;
- separate Bonus Games storage and rules for KO Predictor, Last Man Standing and Predictor Cup;
- desktop/phone Browser E2E for the three Bonus Games against disposable contract-60 Supabase;
- resilient Match Centre, Predict journey and Matches tournament-information views;
- automated axe coverage and exact-head release controls.

Hosted publication of any listed capability is **REQUIRES OWNER VERIFICATION** unless a dated verifier is added.

## Contract-62 candidate — future intent, not baseline behaviour

PR #193 proposes:

1. bounded authenticated post-lock prediction consensus and a richer locked My Entry/Trends experience;
2. automatic final standings activation after every result is confirmed/corrected;
3. identical five-step final ordering for overall and private leagues;
4. desktop/mobile Trends, overflow and accessibility coverage.

The candidate preserves Original/Bonus competition separation, does not rewrite entries or predictions, does not change point awards and does not alter lock rules. It also exposes aggregate output with a cohort of one; `PRIV-001` must be resolved or explicitly accepted before merge.

## Immediate product and assurance gaps

- owner verification of development/production Supabase and all Netlify contexts;
- PR #193 merge/exclusion decision after `PRIV-001` is handled;
- remaining loading, empty, retry and error-state coverage on secondary surfaces;
- official teams, fixtures, regulations, kickoff times and lock instant;
- deliberate production registration opening for each Bonus Game;
- manual keyboard/screen-reader/contrast review;
- complete-volume scoring, rollback and recovery dress rehearsal;
- named monitoring, backup, Cron and incident owners;
- Auth/SMTP, Turnstile and leaked-password decisions.

## Development mode

| Change class | Gate |
| --- | --- |
| UI, copy, styling, docs | CI; targeted preview/UI verification when relevant |
| Features and development schema | CI plus relevant unit/integration, Database parity and Browser E2E |
| Production schema, auth, scoring, destructive work or release | Recovery evidence when data is at risk, preflight, explicit approval, hosted verification and dated release evidence |

Production promotion is milestone-only. A development/production split may be recorded only after owner verification identifies the actual hosted contracts.

## Current next batch

1. Complete PR #195's contract-60 baseline reconciliation and readiness report.
2. Owner runs and records the exact hosted checks for development Supabase, production Supabase and Netlify.
3. Resolve or explicitly accept `PRIV-001`, then decide whether PR #193 is merged or excluded.
4. Complete branch cleanup from PR #194 and the remaining launch-readiness work.

## Documentation authority

- Current facts: this file.
- Future sequence: [`../roadmap.md`](../roadmap.md).
- Deferred decisions: [`deferred-decisions.md`](deferred-decisions.md).
- Current risks: [`risk-register.md`](risk-register.md).
- Scoring: [`../scoring-rules.md`](../scoring-rules.md).
- Operations: the relevant `docs/ops-*.md` runbook.
- Dated reconciliations and audits: historical evidence only.