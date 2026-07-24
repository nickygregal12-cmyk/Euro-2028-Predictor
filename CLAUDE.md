# CLAUDE.md — Euro 2028 Predictor

Project guidance for coding-agent sessions. Read `AGENTS.md` and `docs/quality/current-status.md` before changing the repository. This file is a convenience summary; those sources are authoritative.

## Project

A mobile-first Euro 2028 football predictor built with React 19, TypeScript, Vite, Supabase and Netlify. The Original Predictor covers group scores, manual predicted tie resolution, best-third qualification, a winner-only bracket, Jokers, Golden Boot, derived group-stage goals and leagues/social views.

Do not import rules or features from previous World Cup projects, old branches, prototypes or chats.

## Current critical status

The production application/database mismatch remains live:

- application-code baseline `a403b0796853453cb4115aea55729aced192a6ca` introduced the currently deployed database dependencies;
- production Supabase still has the original 20-migration schema and no tracked migration-history table;
- production lacks `replace_predicted_progression` used by bracket persistence;
- production lacks `delete_match_prediction` used by persisted score clearing;
- authenticated users still have old direct progression and match-prediction delete privileges;
- the repository has 35 migrations;
- hosted development has migrations 21–35 applied and verified;
- production has 15 pending migrations, 21–35.

Expected live behavior: bracket saves fail; clearing a stored score reaches a save error and reload can restore the old row. Do not add a direct-table fallback.

A hard application/database deployment gate contains further release risk:

- repository application contract is `35`;
- deploy-preview, branch-deploy and Netlify dev declare hosted contract `35`;
- production declares hosted contract `20`;
- new production builds fail before Vite while the current ready production deploy remains active.

Never change production `EURO28_DEPLOYED_DB_CONTRACT` to `35` merely to make a build pass. It may change only after migrations 21–35, post-rollout verification, advisors and required production smoke tests have passed.

Normal production promotion remains paused until a reviewed plan restores a compatible app/schema pair. Never point production at development Supabase. Do not apply hosted migrations without explicit owner approval, fresh preflights, a proven recovery artifact and the controlled rollout runbook.

The current Supabase organization is on Free. Prepared backup tooling is not recovery evidence. Before a production migration window, a fresh logical bundle must be encrypted, retained off the working machine, retrieved, checksum-verified and successfully restored to a disposable target.

Netlify non-production isolation is resolved on the current production site: deploy previews, branch deploys and Netlify development use development Supabase; production remains production.

Two separate hosted findings remain:

- `OPS-008` / issue #27: `euro28-predictor-dev.netlify.app` is a public legacy deployment from `worldcup2026/euro28-development`, points at inactive staging project `gcfdwobpnanjchcnvdco`, enables time travel and runs health/observability/hourly-heartbeat functions. It is not a current Euro 2028 environment and must not be modified from this workstream.
- `AUTH-001` / issue #28: the real Turnstile site key is inherited by non-production contexts, but the development Supabase CAPTCHA configuration and Cloudflare hostname allowlist are unverified. Do not broaden hostname access or mix test/real keys and secrets.

## Sources of truth

| Topic | Document |
| --- | --- |
| Current implementation, hosted state and next action | `docs/quality/current-status.md` |
| Current production release evidence | `docs/quality/reconciliations/2026-07-24-post-merge-production-release-state.md` |
| Application/database deploy gate | `docs/quality/reconciliations/2026-07-24-app-schema-deployment-gate.md` |
| Production recovery readiness | `docs/quality/reconciliations/2026-07-24-production-recovery-readiness.md` |
| Netlify environment isolation | `docs/quality/reconciliations/2026-07-24-netlify-environment-isolation.md` |
| Legacy development and Turnstile evidence | `docs/quality/reconciliations/2026-07-24-legacy-development-site-and-turnstile.md` |
| Production backup and restore proof | `docs/ops-production-backup-restore.md` |
| Latest formal audit | `docs/quality/audits/2026-07-23-live-environment-audit.md` |
| Hosted migration/security evidence | `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`; `2026-07-24-function-privilege-hardening.md` |
| Submission settlement evidence | `docs/quality/reconciliations/2026-07-24-submit-save-barrier.md` |
| Persisted score-clearing evidence | `docs/quality/reconciliations/2026-07-24-score-clearing.md` |
| Agent/Git/database discipline | `AGENTS.md` |
| Current risks | `docs/quality/risk-register.md` |
| Hosted migration inventory | `docs/ops-pending-migrations.md` |
| Production rollout | `docs/ops-hosted-migration-rollout.md` |
| Deployment contract | `config/deployment-contract.json` |
| Scoring and entry validity | `docs/scoring-rules.md` |
| Tournament facts | `docs/tournament-structure.md` |
| Architecture/states | `docs/architecture-and-tournament-states.md` |
| Design system | `docs/design-system.md` |
| Competition separation | `docs/competition-structure.md` |
| Future sequence | `docs/roadmap.md`; `docs/build-todo.md` |

Older audits and Git history remain evidence, not current instructions.

## Architecture rules

- Put tournament rules in pure functions under `src/domain/tournament/`.
- Components render domain results; they do not invent standings, scoring or bracket rules.
- All browser Supabase access goes through `src/services/supabase/`.
- Database rules are authoritative for locks, submission, derived positions, results, progression, scoring and deletion boundaries.
- Internal trigger/integrity/maintenance helpers receive no Data API execution.
- Authenticated/service RPC access is an explicit allowlist; future functions default owner-only.
- Manual submission flushes score/bracket debounces and awaits every prediction save key before `submit_entry`.
- Save errors and optimistic conflicts block submission.
- Clearing either side of a complete score queues `delete_match_prediction(...)` on the same serialized match key.
- Prediction deletion must use the exact row version read; unknown or stale versions conflict rather than deleting unseen work.
- Never restore old direct progression/delete writes as a production-compatibility shortcut.
- Production Netlify context must use production Supabase; deploy-preview, branch-deploy and dev must use development Supabase.
- Never weaken or bypass either Netlify prebuild guard to make a deploy pass.
- Adding a migration requires review and update of `config/deployment-contract.json`.
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

## Verified repository/development position

The 35-migration chain and hosted development verify:

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

These database controls are not production capabilities until migrations 21–35 are applied and verified there. The clients for bracket persistence and score clearing are already deployed, making backend compatibility the immediate release gate.

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
7. Update current status, risk register, migration inventory and a dated reconciliation when hosted facts change—including automatic deployments and environment-context changes.
8. Use Netlify previews for visual review only after both prebuild guards pass. Auth journeys require separately verified Turnstile/Supabase CAPTCHA configuration.

## Immediate order

1. Freeze the approved production state and create the fresh logical backup bundle using `docs/ops-production-backup-restore.md`.
2. Encrypt it, retain it off the working machine, retrieve it, verify checksums and complete a disposable restore rehearsal.
3. Name the operator, recovery decision owner and change window; approve the production migrations 21–35 window only after recovery evidence is accepted.
4. Rerun both production preflights and apply the exact 1–20 history-only repair.
5. Require `supabase db push --dry-run` to show migrations 21–35 only.
6. Apply migrations 21–35 only after explicit approval; run exact post-verification, advisors and smoke tests.
7. Only after those checks pass, update production `EURO28_DEPLOYED_DB_CONTRACT` from `20` to `35` and retry the approved production deploy.
8. Verify the current production pointer advances and record the exact release/application/database pair.
9. Browser-verify bracket save/reload, immediate final-edit submission and score clear/reload/conflict/lock behavior; add durable E2E and close `REL-003`/`DATA-005`.
10. Resolve issue #28 through an approved production/non-production Turnstile model and verify preview auth.
11. Resolve issue #27 only through a separate legacy-site owner decision; do not touch the World Cup repository from this workstream.
12. Enable leaked-password protection through a separate approved Auth change.
13. Address `REL-002`, then `REL-006`.
14. Implement automatic real R16 population.

## Hard prohibitions

- No direct push to `main`.
- No production database mutation, remote reset or unreviewed repair SQL.
- No production-to-development fallback.
- No direct-table fallback for missing production RPCs.
- No Netlify context crossing or prebuild-guard bypass.
- No early production deployment-contract change.
- No current-project change to the legacy World Cup deployment/backend.
- No broad Turnstile hostname shortcut or unmatched site-key/secret configuration.
- No claimed deployment or authenticated journey without hosted verification.
- No scoring or competition-rule change without updating authoritative rules and tests.
- No reliance on chat memory over repository evidence.