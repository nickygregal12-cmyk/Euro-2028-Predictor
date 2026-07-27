# Euro 2028 Predictor — Roadmap

**Status date:** 27 July 2026
**Authority:** The only live execution sequence. Use `docs/quality/current-status.md` for current facts.

## Stage 0 — Contract-38 baseline and release closure: complete

- repository, development and production aligned at contract 38;
- encrypted backup and disposable restore verified;
- production contract-38 release published and exact-head smoke passed;
- production locked for milestone-only promotion;
- administrator authorization/RPC foundation merged.

## Stage 1 — Admin Control Room completion

1. Add result confirm, correct and clear forms.
2. Require review before mutation and reasons for correction/clear.
3. Present revision history safely.
4. Cover regulation, extra time, penalties and unresolved states.
5. Add authorised/unauthorised desktop and mobile Browser E2E.
6. Define the production administrator assignment model without relying on `profiles.role`.

Exit: an authorised administrator can manage the full result lifecycle in development; ordinary users cannot.

## Stage 2 — Full tournament lifecycle simulation

1. Seed a complete tournament and representative users/leagues.
2. Simulate pre-tournament entry, locks and submission.
3. Run group matches through standings, ties and best thirds.
4. Populate and play the real knockout bracket.
5. Exercise result correction, clearing, replay and scoring recomputation.
6. Verify rank history, Match Centre, H2H and completion states.
7. Prove reset/repeat isolation without production data.

Exit: the complete tournament can be run repeatedly in development with deterministic evidence and no manual database repair.

## Stage 3 — Original Predictor integrity gaps

- make Match Centre/H2H consume authoritative knockout winner and method data;
- implement actual Round-of-16 population and unresolved actual ties;
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
