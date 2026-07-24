# CLAUDE.md — Euro 2028 Predictor

Project guidance for coding-agent sessions. Read `AGENTS.md` and `docs/quality/current-status.md` before changing the repository. This file is a convenience summary; those sources are authoritative.

## Project

A mobile-first Euro 2028 football predictor built with React 19, TypeScript, Vite, Supabase and Netlify. The Original Predictor covers group scores, manual predicted tie resolution, best-third qualification, a winner-only bracket, Jokers, Golden Boot, derived group-stage goals and leagues/social views.

Do not import rules or features from previous World Cup projects, old branches, prototypes or chats.

## Current critical status

The production application/database mismatch remains live and broadened after PR #20:

- Netlify automatically published production commit `a403b0796853453cb4115aea55729aced192a6ca`;
- production Supabase still has the original 20-migration schema and no tracked migration-history table;
- production lacks `replace_predicted_progression` used by bracket persistence;
- production lacks `delete_match_prediction` used by persisted score clearing;
- authenticated users still have old direct progression and match-prediction delete privileges;
- the repository has 35 migrations;
- hosted development has migrations 21–35 applied and verified;
- production has 15 pending migrations, 21–35.

Expected live behavior: bracket saves fail; clearing a stored score reaches a save error and reload can restore the old row. Do not add a direct-table fallback.

Normal production promotion must pause until a reviewed plan restores a compatible app/schema pair. Never point production at development Supabase. Do not apply hosted migrations without explicit owner approval, fresh preflights, verified recovery evidence and the controlled rollout runbook.

## Sources of truth

| Topic | Document |
| --- | --- |
| Current implementation, hosted state and next action | `docs/quality/current-status.md` |
| Current production release evidence | `docs/quality/reconciliations/2026-07-24-post-merge-production-release-state.md` |
| Latest formal audit | `docs/quality/audits/2026-07-23-live-environment-audit.md` |
| Hosted migration/security evidence | `docs/quality/reconciliations/2026-07-23-hosted-migration-rehearsal.md`; `2026-07-24-function-privilege-hardening.md` |
| Submission settlement evidence | `docs/quality/reconciliations/2026-07-24-submit-save-barrier.md` |
| Persisted score-clearing evidence | `docs/quality/reconciliations/2026-07-24-score-clearing.md` |
| Agent/Git/database discipline | `AGENTS.md` |
| Current risks | `docs/quality/risk-register.md` |
| Hosted migration inventory | `docs/ops-pending-migrations.md` |
| Production rollout | `docs/ops-hosted-migration-rollout.md` |
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
6. Update current status, risk register, migration inventory and a dated reconciliation when hosted facts change—including automatic deployments.
7. Use Netlify previews for visual review only after preview data isolation is confirmed.

## Immediate order

1. Review and approve the production migrations 21–35 window, recovery evidence and operator.
2. Run both production preflights and the exact 1–20 history-only repair.
3. Require `supabase db push --dry-run` to show migrations 21–35 only.
4. Apply migrations 21–35 only after explicit approval; run exact post-verification, advisors and smoke tests.
5. Browser-verify bracket save/reload, immediate final-edit submission and score clear/reload/conflict/lock behavior; add durable E2E and close `REL-003`/`DATA-005`.
6. Isolate production Netlify preview/branch contexts (`OPS-007`).
7. Enable leaked-password protection through a separate approved Auth change.
8. Address `REL-002`, then `REL-006`.
9. Implement automatic real R16 population.
10. Rehearse backup/restore before launch readiness.

## Hard prohibitions

- No direct push to `main`.
- No production database mutation, remote reset or unreviewed repair SQL.
- No production-to-development fallback.
- No direct-table fallback for missing production RPCs.
- No claimed deployment without hosted verification.
- No scoring or competition-rule change without updating authoritative rules and tests.
- No reliance on chat memory over repository evidence.
