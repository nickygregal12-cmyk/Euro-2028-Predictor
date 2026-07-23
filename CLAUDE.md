# CLAUDE.md — Euro 2028 Predictor

Project guidance for Claude Code sessions. Read `AGENTS.md` and `docs/quality/current-status.md` before making changes. This file is a convenience summary; those documents are authoritative.

## Project

A mobile-first Euro 2028 football predictor built with React 19, TypeScript, Vite, Supabase and Netlify. The Original Predictor covers group score predictions, manual predicted tie resolution, best-third qualification, a winner-only knockout bracket, jokers, Golden Boot, derived group-stage goals and leagues/social views.

Do not import rules or features from previous World Cup projects, old branches, prototypes or chats.

## Current critical status

The production application/database mismatch remains live:

- production Netlify serves the post-PR #14 atomic-bracket client;
- production Supabase still has the original 20-migration schema;
- production lacks `replace_predicted_progression`, which the deployed bracket save path calls;
- the repository has 34 migrations;
- hosted development has migrations 21–34 applied and verified against the exact normalized production entry;
- production has 14 pending migrations, 21–34.

Normal production promotion must pause until a reviewed plan restores a compatible application/database pair. Never solve this by pointing production at development Supabase. Do not apply hosted migrations without explicit owner approval, exact preflight evidence, verified recovery evidence and the controlled rollout runbook.

## Sources of truth

| Topic | Document |
| --- | --- |
| Current implementation, hosted status and next action | `docs/quality/current-status.md` |
| Latest formal audit | `docs/quality/audits/2026-07-23-live-environment-audit.md` |
| Latest hosted migration/security evidence | `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`; `docs/quality/reconciliations/2026-07-24-function-privilege-hardening.md` |
| Agent/Git/database discipline | `AGENTS.md` |
| Current risks | `docs/quality/risk-register.md` |
| Hosted migration inventory | `docs/ops-pending-migrations.md` |
| Production rollout | `docs/ops-hosted-migration-rollout.md` |
| Scoring and entry validity | `docs/scoring-rules.md` |
| Tournament facts | `docs/tournament-structure.md` |
| Architecture and tournament states | `docs/architecture-and-tournament-states.md` |
| Design system and interface rules | `docs/design-system.md` |
| Competition separation | `docs/competition-structure.md` |
| Current future sequence | `docs/roadmap.md`; `docs/build-todo.md` |

Older dated audits and Git history remain evidence, not current instructions.

## Architecture

- Put tournament rules in pure functions under `src/domain/tournament/`.
- Components render domain results; they do not invent standings, scoring or bracket rules.
- All browser Supabase access goes through `src/services/supabase/`.
- The latest repository database chain is authoritative for locks, submission, derived positions, results, progression, scoring and function execution boundaries.
- Internal integrity, trigger and maintenance helpers receive no Data API execution.
- Authenticated and service-role RPC access is an explicit allowlist; future public functions default to owner-only.
- Original Predictor and bonus games remain separate competitions and score systems.
- Predicted and real brackets never blend.
- Fail closed on unresolved ties, invalid references and unknown official data.

## Scoring

`docs/scoring-rules.md` is authoritative. Current values:

- group result 3; exact score 5 total;
- five jokers, doubling group-match points only;
- group positions 2 each plus 5 complete-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group goals 40 / 30 / 20, tiered.

Keep `src/domain/tournament/scoringConfig.ts`, SQL and tests aligned. Automatic deadline submission is documented but not implemented.

## Repository and hosted-development database position

The 34-migration repository chain and hosted development provide verified coverage for:

- TypeScript/PostgreSQL predicted group-order parity;
- RPC-only submission and server-derived predicted group positions;
- same-tournament and lock boundaries;
- authoritative result lifecycle and revisions;
- serialized scoring recomputation;
- real winner propagation;
- predicted bracket-tree replay;
- atomic complete-bracket replacement;
- no anonymous public-function execution;
- exact authenticated/service function allowlists;
- owner-only future function defaults;
- fixed helper search paths.

These are not production capabilities until migrations 21–34 are applied and verified there.

## Required workflow

1. Start from current `main` on a dedicated branch.
2. Confirm the target environment and current app/schema compatibility.
3. Keep the PR to one coherent concern.
4. Run application checks:

```bash
npm ci
npm run build
npm run lint
npm run test
npm audit --omit=dev --audit-level=high
```

5. For database/tournament changes, also run the disposable Supabase migration rebuild, database lint, all pgTAP tests and TypeScript/PostgreSQL parity represented by `.github/workflows/database-parity.yml`.
6. Update `current-status.md`, `risk-register.md`, migration inventory and a dated reconciliation note when their facts change.
7. Use Netlify previews for visual review only after preview data isolation is confirmed; successful deployment is not proof of database compatibility.

## Immediate order

1. Review and approve the production migrations 21–34 window, backup/recovery evidence and operator.
2. Run the two committed production preflights and exact 1–20 history-only repair.
3. Require `supabase db push --dry-run` to show migrations 21–34 only.
4. Apply migrations 21–34 only after explicit approval; run the exact post-rollout verifier, advisors and application smoke tests.
5. Isolate production Netlify preview/branch contexts from production Supabase (`OPS-007`).
6. Enable leaked-password protection through a separate approved Auth-setting change.
7. Flush/await pending writes before submission (`REL-003`).
8. Implement automatic real R16 population.
9. Add browser E2E and rehearse backup/restore before launch readiness.

## Hard prohibitions

- No direct push to `main`.
- No production database mutation, remote reset or unreviewed repair SQL.
- No production-to-development fallback.
- No claimed deployment without hosted verification.
- No scoring or competition-rule change without updating the authoritative rule document and tests.
- No reliance on chat memory over repository evidence.