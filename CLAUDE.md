# CLAUDE.md — Euro 2028 Predictor

Project guidance for coding-agent sessions. Read `AGENTS.md` and `docs/quality/current-status.md` before changing the repository. This file is a convenience summary; those sources are authoritative.

## Project

A mobile-first Euro 2028 football predictor built with React 19, TypeScript, Vite, Supabase and Netlify. The Original Predictor covers group scores, manual predicted tie resolution, best-third qualification, a winner-only bracket, Jokers, Golden Boot, derived group-stage goals and leagues/social views.

Do not import rules or features from previous World Cup projects, old branches, prototypes or chats.

## Current repository and hosted status

The repository is at contract `36`:

- migration `20260725010000_authoritative_reference_integrity.sql` is merged through PR #76;
- `config/deployment-contract.json` requires 36 migrations and contract 36;
- disposable CI, Database parity and Browser E2E passed on the migration PR’s final head;
- PR #101 merged the repository reconciliation;
- issue #72 (`DATA-003`) is closed as repository implementation complete.

Hosted environments remain behind the repository:

- development Supabase `iouzoutneyjpugbbtdem` is last verified at contract 35;
- final-target Supabase `vkfnsqdyhvtwyqkisxhk` is last verified at contract 35;
- the Netlify context historically named `production` is the controlled final-target environment, not an active Euro 2028 tournament;
- the retained contract-35 application/database evidence remains valid until a dated contract-36 hosted reconciliation replaces it.

Do not describe migration 36 as draft or unmerged. Do not describe either hosted database as contract 36 until it has been inspected, migrated and verified.

## Current hard gate

The immediate workstream is hosted contract-36 alignment, beginning with development only:

1. inspect development migration history and guarded relationships read-only;
2. require a dry run showing only migration 36;
3. apply and verify migration 36 in development;
4. update preview/branch/dev contract declarations to 36;
5. restore exact-head deploy-preview smoke on the current `euro28predictor` Netlify project;
6. prepare the final-target upgrade separately and require explicit owner approval before any write.

Never weaken either prebuild guard or change a hosted contract merely to make a build pass.

## Remaining operational and launch work

A compatible repository/database contract does not make the product tournament-launch-ready. Remaining work includes:

- server-authorized administrator capabilities and browser result workflows;
- authoritative knockout winner/method/extra-time/penalty consumption in Match Centre and H2H;
- real Round-of-16 population and actual unresolved-tie handling;
- automatic valid-entry submission and reminders;
- monitoring ownership, retention/privacy and incident response;
- Turnstile/non-production CAPTCHA verification and leaked-password protection decision;
- branch-protection verification;
- official Euro 2028 teams, fixtures, regulations and lock instant;
- full tournament dress rehearsal and manual screen-reader review;
- periodic backup/restore and application-rollback rehearsal.

The accepted recovery artifact and corrected clean restore are proven. Recovery evidence does not remove the need for future backups, retention discipline, monitoring or final launch rollback rehearsal.

## Netlify and legacy-site boundaries

- The current repository’s Netlify project is `euro28predictor`.
- Final-target Netlify uses final-target Supabase only.
- Deploy previews, branch deploys and Netlify development use development Supabase only.
- Exact-head preview smoke must use a deploy preview belonging to the current `euro28predictor` project.
- `euro28-predictor-dev.netlify.app` is a legacy deployment from `worldcup2026/euro28-development` using inactive Supabase project `gcfdwobpnanjchcnvdco`.
- Never use that legacy site as a current preview target or modify it from this repository workstream.
- The real Turnstile site key reaches non-production contexts, but development Supabase CAPTCHA configuration and the Cloudflare hostname allowlist remain unverified.
- Do not broaden `netlify.app` hostname access or mix unmatched test/real keys and secrets.

## Sources of truth

| Topic | Document |
| --- | --- |
| Current implementation, hosted state and next action | `docs/quality/current-status.md` |
| Contract-36 control-plane reconciliation | `docs/quality/reconciliations/2026-07-26-contract-36-control-plane-repair.md` |
| Repository contract-36 reconciliation | `docs/quality/reconciliations/2026-07-26-contract-36-repository-reconciliation.md` |
| Retained final-target contract-35 evidence | `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md` |
| Accepted recovery proof | `docs/quality/reconciliations/2026-07-25-final-recovery-acceptance.md` |
| Agent/Git/database discipline | `AGENTS.md` |
| Current risks | `docs/quality/risk-register.md` |
| Feature/safeguard classifications | `docs/quality/feature-baseline.md` |
| Hosted migration inventory | `docs/ops-pending-migrations.md` |
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
- Never weaken or bypass the Netlify environment or deployment-contract guards.
- Adding a migration requires review and update of `config/deployment-contract.json` plus hosted migration planning.
- Original Predictor and bonus games remain separate competitions and score systems.
- Predicted and real brackets never blend.
- Fail closed on unresolved ties, invalid references and unknown official data.
- Knockout UI and social calculations use authoritative `winner_team_id`/result-method data; they must not infer penalty winners from a tied public score.

## Scoring

`docs/scoring-rules.md` is authoritative:

- group result 3; exact score 5 total;
- five Jokers, doubling group-match points only;
- group positions 2 each plus 5 complete-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group goals 40 / 30 / 20, tiered.

Keep TypeScript, SQL and tests aligned. Automatic deadline submission is an approved target rule but remains unimplemented until server scheduling and exact-boundary tests exist.

## Required workflow

1. Start from current `main` on a dedicated branch.
2. Confirm the target environment and current app/schema compatibility.
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
7. Update current status, risk register, feature baseline, migration inventory and a dated reconciliation when material facts change.
8. Use Netlify previews only after both prebuild guards pass. Auth journeys require separately verified Turnstile/Supabase CAPTCHA configuration.

## Immediate order

1. Finish and merge the contract-36 control-plane documentation repair.
2. Inspect and upgrade development Supabase to contract 36 with preserved evidence.
3. Restore exact-head contract-36 deploy-preview smoke on the current Netlify project.
4. Prepare but do not automatically execute the final-target contract-36 upgrade.
5. Continue the server-authorized administrator/result-management workstream.
6. Repair authoritative knockout-winner consumption in Match Centre and H2H.
7. Implement real R16 population and actual tie decisions.
8. Implement automatic valid-entry submission.
9. Complete branch protection, Auth/CAPTCHA, monitoring ownership, accessibility and full rehearsal work.
10. Replace provisional tournament data only from authoritative UEFA sources when available.

## Hard prohibitions

- No direct push to `main`.
- No final-target database mutation, remote reset or unreviewed repair SQL.
- No final-target-to-development fallback.
- No direct-table fallback around protected RPCs.
- No Netlify context crossing or prebuild-guard bypass.
- No contract change before the target database is migrated and verified.
- No current-project change to the legacy World Cup deployment/backend.
- No broad Turnstile hostname shortcut or unmatched site-key/secret configuration.
- No claimed deployment or authenticated journey without hosted verification.
- No scoring or competition-rule change without updating authoritative rules and tests.
- No reliance on chat memory over repository evidence.
