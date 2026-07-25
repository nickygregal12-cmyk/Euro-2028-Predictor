# CLAUDE.md — Euro 2028 Predictor

Project guidance for coding-agent sessions. Read `AGENTS.md` and `docs/quality/current-status.md` before changing the repository. This file is a convenience summary; those sources are authoritative.

## Project

A mobile-first Euro 2028 football predictor built with React 19, TypeScript, Vite, Supabase and Netlify. The Original Predictor covers group scores, manual predicted tie resolution, best-third qualification, a winner-only bracket, Jokers, Golden Boot, derived group-stage goals and leagues/social views.

Do not import rules or features from previous World Cup projects, old branches, prototypes or chats.

## Current production status

The former production application/database mismatch is resolved.

Current verified pair:

- approved/deployed commit `902a37aa6c50c967f8080d751147a5733b251fe3`;
- Netlify production deploy `6a652c3d3416d26d595ae2ef`;
- production Supabase `vkfnsqdyhvtwyqkisxhk`;
- repository, production database and Netlify contract `35`;
- exactly 35 canonical production migration-history rows;
- `replace_predicted_progression` and `delete_match_prediction` present;
- 63/63 database verification checks passed;
- rollback-only atomic bracket, submission and result-lifecycle smoke checks passed;
- live metadata, security headers, SPA routes, assets and anonymous browser journeys passed;
- no development Supabase endpoint or browser request was present.

Read `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md` for the executed rollout.

Do not describe production as contract 20, missing migrations 21–35, lacking the two client RPCs or frozen by the compatibility gate.

Migration 36 remains draft-only in PR #76. It was not applied and must remain outside production until separately reviewed, merged, rehearsed and approved.

## Remaining operational and launch work

The compatible production pair does not make the product tournament-launch-ready. Remaining work includes:

- production monitoring, alert ownership and incident response;
- version-controlled administrator authorization and browser result administration;
- Turnstile/non-production CAPTCHA verification and leaked-password protection decision;
- branch-protection verification;
- official Euro 2028 teams, fixtures, regulations and lock instant;
- full tournament dress rehearsal and manual screen-reader review;
- periodic backup/restore and application-rollback rehearsal;
- wider reference integrity work, including any future migration 36 rollout.

The accepted recovery artifact and corrected clean restore are proven. Recovery evidence does not remove the need for future backups, retention discipline, monitoring or final launch rollback rehearsal.

Netlify non-production isolation is resolved: deploy previews, branch deploys and Netlify development use development Supabase; production uses production Supabase. All contexts declare contract 35 because both hosted databases are verified through migration 35.

Two separate hosted findings remain:

- `OPS-008` / issue #27: `euro28-predictor-dev.netlify.app` is a public legacy deployment from `worldcup2026/euro28-development`, points at inactive staging project `gcfdwobpnanjchcnvdco`, enables time travel and runs health/observability/hourly-heartbeat functions. It is not a current Euro 2028 environment and must not be modified from this workstream.
- `AUTH-001` / issue #28: the real Turnstile site key is inherited by non-production contexts, but development Supabase CAPTCHA configuration and the Cloudflare hostname allowlist remain unverified. Do not broaden hostname access or mix test/real keys and secrets.

## Sources of truth

| Topic | Document |
| --- | --- |
| Current implementation, hosted state and next action | `docs/quality/current-status.md` |
| Completed production contract-35 promotion | `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md` |
| Accepted production recovery proof | `docs/quality/reconciliations/2026-07-25-final-recovery-acceptance.md` |
| Netlify environment isolation | `docs/quality/reconciliations/2026-07-24-netlify-environment-isolation.md` |
| Legacy development and Turnstile evidence | `docs/quality/reconciliations/2026-07-24-legacy-development-site-and-turnstile.md` |
| Production backup and restore procedure | `docs/ops-production-backup-restore.md` |
| Latest formal pre-rollout audit | `docs/quality/audits/2026-07-25-repeat-verification-audit.md` |
| Agent/Git/database discipline | `AGENTS.md` |
| Current risks | `docs/quality/risk-register.md` |
| Feature/safeguard classifications | `docs/quality/feature-baseline.md` |
| Hosted migration inventory | `docs/ops-pending-migrations.md` |
| Completed rollout record/repeat procedure | `docs/ops-hosted-migration-rollout.md` |
| Deployment contract | `config/deployment-contract.json` |
| Scoring and entry validity | `docs/scoring-rules.md` |
| Tournament facts | `docs/tournament-structure.md` |
| Architecture/states | `docs/architecture-and-tournament-states.md` |
| Design system | `docs/design-system.md` |
| Competition separation | `docs/competition-structure.md` |
| Future sequence | `docs/roadmap.md`; `docs/build-todo.md` |

Older audits and reconciliations remain evidence of the state at their date, not current instructions.

## Architecture rules

- Put tournament rules in pure functions under `src/domain/tournament/`.
- Components render domain results; they do not invent standings, scoring or bracket rules.
- All browser Supabase access goes through `src/services/supabase/`.
- Database rules are authoritative for locks, submission, derived positions, results, progression, scoring and deletion boundaries.
- Internal trigger/integrity/maintenance helpers receive no Data API execution.
- Authenticated/service RPC access is an explicit allowlist; future functions default owner-only.
- Manual submission flushes score/bracket debounces and awaits every prediction save key before `submit_entry`.
- Save errors and optimistic conflicts block submission.
- Clearing either side of a complete score uses `delete_match_prediction(...)` on the serialized match key.
- Prediction deletion must use the exact row version read; unknown or stale versions conflict rather than deleting unseen work.
- Production Netlify context must use production Supabase; deploy-preview, branch-deploy and dev must use development Supabase.
- Never weaken or bypass either Netlify prebuild guard to make a deploy pass.
- Adding a migration requires review and update of `config/deployment-contract.json` plus hosted migration planning.
- Never use the legacy `euro28-predictor-dev` site for current testing or modify its World Cup repository/backend from this workstream.
- Never authorise broad `netlify.app` Turnstile hostname access merely to cover previews.
- Original Predictor and bonus games remain separate competitions and score systems.
- Predicted and real brackets never blend.
- Fail closed on unresolved ties, invalid references and unknown official data.

## Scoring

`docs/scoring-rules.md` is authoritative:

- group result 3; exact score 5 total;
- five Jokers, doubling group-match points only;
- group positions 2 each plus 5 complete-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group goals 40 / 30 / 20, tiered.

Keep TypeScript, SQL and tests aligned. Automatic deadline submission is documented but unimplemented.

## Verified production contract

The production 35-migration chain verifies:

- TypeScript/PostgreSQL group-order parity;
- RPC-only submission and server-derived positions;
- same-tournament and lock boundaries;
- authoritative result lifecycle and revisions;
- serialized scoring;
- real winner propagation and predicted-bracket replay;
- atomic complete-bracket replacement;
- zero anonymous public-function execution;
- exact authenticated/service allowlists and fixed helper search paths;
- pending-write settlement before submission;
- version-safe persisted score clearing with derived-position invalidation.

## Required workflow

1. Start from current `main` on a dedicated branch.
2. Confirm target environment and current app/schema compatibility.
3. Keep each PR to one coherent concern.
4. Run application checks:

```bash
npm ci
npm run build
npm run lint
npm run test
npm audit --omit=dev --audit-level=high
```

5. For database/tournament changes, also run the disposable Supabase rebuild, database lint, all pgTAP suites and TypeScript/PostgreSQL parity from `.github/workflows/database-parity.yml`.
6. Update the deployment contract whenever migrations or required application RPCs change.
7. Update current status, risk register, feature baseline, migration inventory and a dated reconciliation when hosted facts change.
8. Use Netlify previews for visual review only after both prebuild guards pass. Auth journeys require separately verified Turnstile/Supabase CAPTCHA configuration.

## Immediate order

1. Reconcile and merge the contract-35 production documentation update.
2. Add production error reporting, alert ownership and critical-journey monitoring.
3. Resolve issue #28 through an approved production/non-production Turnstile model and verify preview auth.
4. Review leaked-password protection as a separate Auth change.
5. Resolve issue #27 only through a separate legacy-site owner decision.
6. Verify branch protection and required checks.
7. Complete wider reference-integrity work; keep PR #76 and migration 36 separate until reviewed.
8. Implement the approved administrator model and browser result workflows.
9. Add authenticated production browser smoke journeys without mutating retained real predictions unexpectedly.
10. Complete manual screen-reader review and full tournament dress rehearsal.
11. Replace provisional tournament data only from authoritative UEFA sources when available.

## Hard prohibitions

- No direct push to `main`.
- No production database mutation, remote reset or unreviewed repair SQL.
- No production-to-development fallback.
- No direct-table fallback around protected RPCs.
- No Netlify context crossing or prebuild-guard bypass.
- No contract change before the target database is migrated and verified.
- No current-project change to the legacy World Cup deployment/backend.
- No broad Turnstile hostname shortcut or unmatched site-key/secret configuration.
- No claimed deployment or authenticated journey without hosted verification.
- No scoring or competition-rule change without updating authoritative rules and tests.
- No reliance on chat memory over repository evidence.