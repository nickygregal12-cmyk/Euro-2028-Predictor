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
- safe immutable revision history;
- regulation, extra-time, penalty and unresolved-participant handling;
- authorised/unauthorised desktop and mobile Browser E2E;
- production assignment/revocation model based on server-owned Auth
  `app_metadata`, never `profiles.role`.

Exit: an authorised administrator can manage the full result lifecycle in development; ordinary users cannot.

## Stage 2 — Full tournament lifecycle simulation: in progress

Completed in PR #122:

- seeded full 51-match tournament lifecycle with representative users and a league;
- valid pre-tournament entries, predicted tables, brackets, lock and submission;
- all 36 group results through standings and best-third qualification;
- server-owned actual Round-of-16 population using the six-group allocation contract;
- all 15 knockout matches through regulation, extra time and penalties;
- correction, clearing, downstream replay and scoring recomputation;
- rank-history checkpoints, champion scoring and immutable revisions;
- clean rebuild from 39 canonical migrations in disposable local Supabase;
- Browser E2E setup changed from manual R16 injection to real group completion.

Remaining exit work:

1. Complete exact-head deploy-preview and authenticated Browser E2E for PR #122.
2. Verify product-facing Match Centre, tournament, league and H2H states across lifecycle transitions.
3. Implement explicit resolution when an actual third-place tie crosses the qualification boundary.
4. Prove repeat/reset isolation remains clean after the product-facing journeys are added.

Exit: the complete tournament can be run repeatedly in development with deterministic database and browser evidence and no manual database repair.

## Stage 3 — Original Predictor integrity gaps

- make Match Centre/H2H consume authoritative knockout winner and method data;
- implement the actual unresolved third-place qualification-boundary workflow;
- add automatic valid-entry submission;
- add reminders after Auth/SMTP verification;
- bound leaderboard and standing reads;
- profile scoring and league summaries at representative scale.

## Stage 4 — Core product experience

- complete other-player profiles and richer H2H;
- add rank-over-time and bracket health;
- expand Match Centre/tournament states;
- add account, privacy and contact-admin surfaces;
- add post-lock trends;
- finish mobile, empty/error-state and accessibility work.

## Stage 5 — Bonus competitions

Build only after the Original Predictor lifecycle is proven:

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
