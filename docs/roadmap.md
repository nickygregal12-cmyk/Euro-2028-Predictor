# Euro 2028 Predictor — Roadmap

**Status date:** 27 July 2026  
**Authority:** The only live execution sequence. Use `docs/quality/current-status.md` for current facts.

## Stage 0 — Contract-38 baseline and release closure: complete

- repository, development and production aligned at contract 38;
- encrypted backup and disposable restore verified;
- production contract-38 release published and exact-head smoke passed;
- production locked for milestone-only promotion;
- administrator authorization/RPC foundation merged.

## Stage 1 — Admin Control Room completion: complete

- result confirm, correct and clear forms;
- review before mutation and required reasons for correction/clear;
- safe immutable result revision history;
- regulation, extra-time, penalty and unresolved-participant handling;
- authorised/unauthorised desktop and mobile Browser E2E;
- production assignment/revocation model based on server-owned Auth
  `app_metadata`, never `profiles.role`.

Exit met: an authorised administrator can manage the full result lifecycle in development; ordinary users cannot.

## Stage 2 — Full tournament lifecycle simulation: complete

Delivered through PRs #122, #124 and #126:

- seeded full 51-match tournament lifecycle with representative users and a league;
- valid pre-tournament entries, predicted tables, brackets, lock and submission;
- all 36 group results through standings and best-third qualification;
- server-owned actual Round-of-16 population using the six-group allocation contract;
- explicit authorised resolution when an actual third-place tie crosses fourth place;
- exact tie-set validation, required reason, review and immutable qualification revisions;
- group-result fingerprints that invalidate stale decisions;
- all 15 knockout matches through regulation, extra time and penalties;
- Match Centre, fixtures and H2H consumption of the authoritative knockout winner;
- correction, clearing, downstream replay and scoring recomputation;
- refusal and transactional rollback when a played R16 fixture would be rewritten;
- rank-history checkpoints, champion scoring and immutable revisions;
- clean rebuild from 40 canonical migrations in disposable local Supabase;
- authenticated Browser E2E using real group completion rather than participant injection;
- deterministic resolve, correct, clear and reset journeys with no production data.

Exit met: the complete tournament can be run repeatedly in development with deterministic database and browser evidence and no manual database repair.

## Stage 3A — Automatic valid-entry recovery at lock: complete

Delivered through PR #128 and contract 41:

- database-owned one-minute scheduler using Supabase Cron;
- server-only processor that reuses the existing authoritative submission validator;
- complete valid entries automatically submitted at the real post-lock processing time;
- incomplete or invalid entries left unsubmitted with a safe validator reason;
- immutable per-entry/per-lock automatic outcome history;
- owner-only manual, automatic, pending and failed status RPC;
- Review-page success/failure state without changing the existing manual submit flow;
- transaction-local after-lock refresh limited to derived group positions;
- no relaxation of user-owned prediction locks, version checks or ownership rules;
- 28 database lifecycle assertions and authenticated complete/incomplete browser journeys;
- clean rebuild from 41 canonical migrations.

Exit met: a complete saved entry cannot be stranded solely because its owner forgot to press Submit, while invalid entries remain safely excluded and auditable.

## Stage 3B — Original Predictor bounded reads and scale: current

1. Inventory every leaderboard, standing, H2H and comparison RPC/query with its current limit, sort keys and response shape.
2. Add explicit bounds and stable pagination where reads can grow with users, leagues or fixtures.
3. Seed representative volumes at the intended 250-user / 20-league development caps.
4. Capture query plans, response sizes and score-recomputation timings.
5. Test profiles, leagues, scoring summaries and comparison surfaces at those caps.
6. Repair completion, loading, empty and error states exposed by the scale journeys.
7. Add reminders only after Auth/SMTP ownership and delivery reliability are verified.

Exit: public reads remain bounded and core Original Predictor surfaces remain correct and responsive at the intended caps.

## Stage 4 — Core product experience

- complete other-player profiles and richer H2H;
- add rank-over-time and bracket health;
- expand Match Centre/tournament states;
- add account, privacy and contact-admin surfaces;
- add post-lock trends;
- finish mobile, empty/error-state and accessibility work.

## Stage 5 — Bonus competitions

Build only after the Original Predictor lifecycle and integrity/scale stage are proven:

1. KO Predictor;
2. Last Man Standing;
3. Predictor Cup.

Each mode keeps its own entry window, rules, scoring and leagues.

## Stage 6 — Operations and launch preparation

- monitoring ownership and incident response;
- Auth, SMTP, CAPTCHA and leaked-password decisions;
- branch protection and required checks;
- official teams, fixtures, regulations and lock instant;
- privacy/GDPR self-service;
- security, accessibility and performance assurance;
- full dress rehearsal, application rollback and backup/restore rehearsal.

Reintroduce stricter release governance around six months before Euro 2028, or earlier when real users or valuable live data appear.

## Non-negotiable rules

- Original and bonus points/leagues never combine.
- Predicted and real brackets never blend.
- Database rules protect locks, results and scoring inputs.
- Submission waits for current writes to settle.
- Protected RPCs never gain unsafe direct-table fallbacks.
- Public function execution is closed by default.
- Production writes require explicit owner approval.
- Production promotion is milestone-only.
- Official future facts remain provisional until authoritative verification.
