# CLAUDE.md — Euro 2028 Predictor

Project guidance for coding-agent sessions. Read `AGENTS.md` and `docs/quality/current-status.md` first; this file is a convenience summary.

## Project

A mobile-first Euro 2028 predictor built with React 19, TypeScript, Vite, Supabase and Netlify. The Original Predictor covers group scores, manual predicted tie resolution, best-third qualification, a winner-only bracket, Jokers, Golden Boot, derived group goals and leagues/social views.

Do not import rules or features from previous World Cup projects, old branches, prototypes or chats.

## Current contract position

Repository and development are verified at contract `36`:

- 36 canonical migrations through `20260725010000_authoritative_reference_integrity.sql`;
- development Supabase `iouzoutneyjpugbbtdem` has exactly 36 migration-history versions;
- migration-36 preflight, private-function, trigger, privilege and rollback-only behaviour checks passed;
- Netlify `dev`, `branch-deploy` and `deploy-preview` contexts declare 36 and use development Supabase;
- PR #105 proved an exact-head 36/36 preview on the current `euro28predictor` project with HTTP and anonymous browser smoke.

The final target remains contract `35`:

- Supabase `vkfnsqdyhvtwyqkisxhk` is last verified through migration 35;
- Netlify `production` remains declared at 35;
- it is a controlled final target, not an active tournament;
- no final-target SQL or environment change was made during development promotion.

Read `docs/quality/reconciliations/2026-07-26-contract-36-development-promotion.md` for current evidence.

## Current hard gate

The next database stage is final-target preparation only:

1. inspect final-target state read-only;
2. preserve recoverable pre-change evidence;
3. prove migration 36 is the only canonical pending migration;
4. run the six migration preflight checks;
5. prepare exact application/verification/rollback-safe smoke commands;
6. obtain explicit owner approval before any database write;
7. apply/verify migration 36;
8. change production Netlify to 36 only after database verification;
9. require exact-head production release identity plus HTTP/browser smoke.

Never weaken prebuild guards or lift a hosted contract just to make a build pass.

## Smoke target split

- Preview smoke requires contract 36, the exact PR head and development Supabase.
- Production smoke currently requires the retained compatible 35/35 release and final-target Supabase.
- Both smoke implementations require `EURO28_SMOKE_EXPECTED_CONTRACT`.
- Production does not require the current `main` commit while the guard intentionally blocks contract-36 code from its contract-35 database.
- Restore exact-head production verification during final-target promotion.

## Remaining launch work

- server-authorized administrator capabilities and browser result workflows;
- authoritative knockout winner/method/extra-time/penalty consumption in Match Centre and H2H;
- real R16 population and actual unresolved ties;
- automatic valid-entry submission and reminders;
- monitoring ownership, retention/privacy and incident response;
- Turnstile/non-production CAPTCHA verification and leaked-password decision;
- branch protection;
- official teams, fixtures, regulations and lock instant;
- full dress rehearsal, screen-reader review, backup/restore and rollback rehearsal.

## Netlify and legacy boundaries

- Current project: `euro28predictor`.
- Production uses final-target Supabase only.
- Preview/branch/dev use development Supabase only.
- Legacy `euro28-predictor-dev.netlify.app` comes from `worldcup2026/euro28-development` and inactive project `gcfdwobpnanjchcnvdco`; never use or modify it here.
- Do not broaden Turnstile hostnames or mix unmatched test/real keys and secrets.

## Sources of truth

| Topic | Document |
| --- | --- |
| Current implementation/hosted state | `docs/quality/current-status.md` |
| Development contract-36 evidence | `docs/quality/reconciliations/2026-07-26-contract-36-development-promotion.md` |
| Retained final-target contract-35 evidence | `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md` |
| Agent/Git/database rules | `AGENTS.md` |
| Current risks | `docs/quality/risk-register.md` |
| Feature/safeguard classifications | `docs/quality/feature-baseline.md` |
| Hosted migration inventory | `docs/ops-pending-migrations.md` |
| Smoke/rollback runbook | `docs/ops-production-observability.md` |
| Deployment contract | `config/deployment-contract.json` |
| Scoring | `docs/scoring-rules.md` |
| Future sequence | `docs/roadmap.md`; `docs/build-todo.md` |

Older audits are evidence at their date, not current instructions.

## Architecture rules

- Tournament rules live in pure functions under `src/domain/tournament/`.
- Components render domain results rather than invent rules.
- Browser Supabase access goes through `src/services/supabase/`.
- Database rules are authoritative for locks, submission, results, progression and scoring.
- Internal integrity helpers receive no Data API execution.
- Browser/service RPCs are explicit allowlists.
- Manual submission waits for all current prediction writes to settle; errors/conflicts block submission.
- Persisted score clearing uses expected-version server boundaries.
- Never bypass environment/deployment-contract guards or protected RPCs.
- Original Predictor and bonus games remain separate.
- Predicted and real brackets never blend.
- Knockout UI/social calculations use authoritative winner/result-method data.

## Scoring

`docs/scoring-rules.md` remains authoritative:

- group result 3; exact score 5 total;
- five Jokers, doubling group-match points only;
- positions 2 each plus 5 full-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group goals 40 / 30 / 20.

Automatic deadline submission remains planned, not implemented.

## Required workflow

1. Start from current `main` on a dedicated branch.
2. Confirm target environment and contract compatibility.
3. Keep one coherent concern per PR.
4. Run `npm ci`, build, lint, tests and high-severity production audit.
5. For database work also run disposable rebuild, lint, pgTAP and parity.
6. Update deployment contract when migrations/required RPCs change.
7. Update current status, risk, feature baseline, migration inventory and a dated reconciliation when facts change.
8. Use target-specific release identity and smoke evidence.

## Immediate order

1. Merge development contract-36 promotion evidence.
2. Prepare final-target migration 36 read-only; do not write without explicit approval.
3. Continue server-authorized administrator/result management.
4. Repair authoritative knockout-result consumption.
5. Implement real R16/actual tie decisions.
6. Implement automatic submission.
7. Complete branch protection, Auth/CAPTCHA, monitoring, accessibility and rehearsal.
8. Replace provisional data only from authoritative sources.

## Hard prohibitions

- No direct push to `main`.
- No unapproved final-target mutation/reset/repair.
- No final-target-to-development fallback.
- No direct-table fallback around protected RPCs.
- No Netlify context crossing or guard bypass.
- No current-project modification of the legacy World Cup deployment/backend.
- No claimed deployment or authenticated journey without evidence.
- No scoring/rule change without authority/test updates.
- No reliance on chat memory over repository evidence.
