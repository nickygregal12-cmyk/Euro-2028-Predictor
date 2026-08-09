# Euro 2028 Predictor — 03:00 progress handover — 9 August 2026

## Executive summary

This run did not repeat the known unavailable Team-SSO interactive-browser path for PR #593. It merged the completed 01:00 handover, independently rechecked the repository/hosted/active-site baseline, discovered that a fuller EURO-002 Contract-134 candidate was already in flight as PR #602, diagnosed its exact CI/database failures from GitHub artifacts, repaired those integration defects, retired the duplicate Contract-134 branch opened during this run, and left the fuller candidate on a fresh exact head with the full gate set rerunning.

No hosted schema/data mutation, Edge Function deployment, provider request, Netlify configuration change or Production deployment was performed.

## Current repository baseline

- Repository: `nickygregal12-cmyk/Euro-2028-Predictor`
- `main`: `7e6aeacafbb4c19ab1752068ffa65c4baace61af`
- Latest `main`: `docs: record 2026-08-09 01:00 predictor progress (#601)`
- Repository contract on `main`: 133
- Latest repository migration on `main`: `20260808003000_private_season_cup_player_reads.sql`

PR #601 was exact-head green at `6a77b07492ea0141c1c2672ee007c9074afe994c` and was squash-merged under expected-head protection, producing current main `7e6aeacafbb4c19ab1752068ffa65c4baace61af`.

## Hosted database baseline

Fresh read-only migration-ledger queries were performed against the supplied projects.

### Development — `iouzoutneyjpugbbtdem`

- 133 migrations applied.
- Latest migration version: `20260808003000`.
- Contract 133 is hosted.

### Production — `vkfnsqdyhvtwyqkisxhk`

- 132 migrations applied.
- Latest migration version: `20260807210812`.
- Contract 133 is not hosted.

The live machine/document authority on `main` still trails the independently observed Development-133 fact; PR #597 remains the deliberately queued reconciliation path and should not be bypassed merely to equalise prose during unrelated work.

## Active Netlify site

Only the active site was inspected:

- project: `euro28predictor`
- site id: `c69da01a-4650-43db-a1d2-b78b7f8e198a`
- primary domain: `euro28predictor.com`
- Production deploy: `6a6bac566b6e440008d44e5b`
- state: `ready`
- published commit: `8244b7222b9d108e59380fd16351c02b578497ee`
- Production Lighthouse: Performance 96, Accessibility 100, Best Practices 100, SEO 100.

The historic `euro28-predictor-dev` site was not inspected or used.

## PR #593 — no state change

PR #593 remains:

- open/draft;
- exact head `7b542f61bb8fd265ce077cc53fa392c8282dd46a`;
- mergeable;
- CI #2594 — success;
- Browser E2E #1422 — success;
- CodeQL #307 — success.

Its only remaining acceptance gate remains the real signed-in desktop + phone journey through the Team-SSO-protected exact deploy preview. The connected tooling still cannot cross that interactive perimeter. This run therefore did not spend another session rediscovering the same limitation and did not weaken Team SSO.

PR #597 and PR #600 remain intentionally behind this gate. PR #600's exact-head CI/Browser/CodeQL candidate was already green; neither PR was merged out of sequence.

## EURO-002 / Contract 134 — duplicate detected and consolidated

The 01:00 handover freed Contract 134 for ADR 0026 EURO-002. At the start of this run a clean branch `feature/contract-134-euro-publication-lifecycle` was opened and draft PR #603 created with a deliberately narrow internal publication-state authority.

During the open-PR reconciliation, PR #602 was discovered already in flight from the same Contract-133 baseline. #602 is the stronger candidate and includes the missing bounded consumption boundary that the first draft intentionally deferred:

- one server-owned lifecycle: `hidden -> prelaunch -> registration-open -> live -> completed -> archived`;
- default `hidden` fail-closed state;
- private singleton state and append-only transition history;
- bounded `public.euro_publication_state()` read exposing only state/change time;
- authenticated `public.admin_transition_euro_publication_state(text,text,text)` entry point with an internal signed-in `super_admin` owner gate;
- adjacent forward transitions only, mandatory reason and optimistic expected-state checking;
- 29 dedicated pgTAP assertions;
- deployment contract 134 and the two reviewed public RPC signatures;
- no EURO-003/004 UI/route enforcement yet and no hosted rollout.

PR #603 was therefore closed as superseded rather than allowing two branches to compete for Contract 134. Its hosted-inventory guard had passed, but its fuller authority sweep had not been completed; no hosted write ever occurred from it.

## PR #602 — failure diagnosis

Original exact head inspected: `cf18f33db41062f80b2eebe6c73c594cab08858f`.

The initial exact-head picture was:

- Hosted migration inventory #462 — success;
- CodeQL #389 — success;
- Browser E2E #1467 — success;
- CI #2676 — failure;
- Database parity #1155 — failure.

The CI and pgTAP artifacts were downloaded and read rather than inferring from exit codes.

### CI root cause

All pre-test CI stages passed: migration timestamps, documentation authority, generated NOW, Git-less hygiene, build, bundle budgets, lint and domain coverage.

The only Vitest failure was `tests/database-parity/liveCompetitionCallerBoundary.test.ts`, because a long-standing integration guard derives the current repository contract from `config/deployment-contract.json` and expected the live authorities to contain Contract 134, while one lower AGENTS.md sentence still literally said Contract 133.

### Database root cause

Disposable Supabase startup, full migration replay, provider-poll unauthorised-request proof and database lint all passed. The new dedicated `186_euro_publication_state.sql` suite itself passed.

The only pgTAP failure was test 6 in `080_function_privileges.sql`: `service_role cannot execute any function outside its explicit allowlist` found exactly one unexpected function. The migration deliberately grants `service_role` the bounded `euro_publication_state()` read for future server-side route/site guards, but the global service-role allowlist had not added that read.

This is an integration-inventory mismatch rather than an authority leak: mutation remains authenticated owner-only and the internal state/history tables remain directly inaccessible.

## PR #602 repairs made

A temporary self-removing repository workflow performed exact mechanical edits and then deleted itself. The durable changes were:

1. align the lower AGENTS.md repository-contract sentence to Contract 134 and `20260809001500_euro_publication_state.sql`;
2. align `docs/quality/current-status.md` repository-candidate and repository-contract text to Contract 134;
3. add only `euro_publication_state()` to the explicit service-role function allowlist while leaving `admin_transition_euro_publication_state(text,text,text)` excluded;
4. regenerate `NOW.md` through the repository-owned generator rather than hand-editing it.

The first repaired exact head cleared migration ordering, documentation authority, generated NOW, build, bundle budgets, lint and domain coverage. Its remaining Vitest failure exposed one canonical wording requirement in `current-status.md`, so a second self-removing mechanical helper restored the established `Development Supabase ... hosted at **132**` wording while explicitly noting that fresh independent read-only evidence has observed Development at 133 and the separate hosted-authority reconciliation remains queued.

A normal user-authored follow-up added `docs/architecture/euro-publication-lifecycle.md`, recording the Contract-134 boundary, role grants and deliberate EURO-003/004 non-scope. This produced the current candidate head:

`844660576abb324adca4de5aa907a73c153c77f1`

The temporary helper workflows are not present in the final candidate tree.

## Current Contract-134 gate state at handover creation

For exact head `844660576abb324adca4de5aa907a73c153c77f1` the full normal gate set has been dispatched:

- CI #2684 — queued/running;
- Database parity #1162 — queued/running;
- Browser E2E #1474 — queued/running;
- CodeQL #397 — queued/running;
- Hosted migration inventory — will run as part of the exact-head gate set.

The previous repaired head had already demonstrated Hosted migration inventory success and CodeQL success. The new exact head exists to rerun all gates after the final canonical status wording and architecture note; do not infer final green from the prior head.

Keep PR #602 draft until exact-head CI, Database parity/pgTAP, Browser E2E, CodeQL and hosted inventory are all green. Do not apply Contract 134 to Development merely because the repository candidate is ready.

## Hosted mutations

None.

- no Development schema/data write;
- no Production schema/data write;
- no Edge Function deployment;
- no provider request/backfill;
- no Netlify configuration or deploy mutation;
- no Team SSO change.

## Risks / blockers

1. #593 remains manually blocked by the real Team-SSO signed-in desktop + phone acceptance gate. It must not be merged on automated evidence alone.
2. #597 still owns the coherent Development-133 / Production-132 hosted-authority reconciliation and remains intentionally behind #593.
3. #600 is code-green but dependency-blocked behind #593/#597.
4. #602 is the single Contract-134 candidate now, but remains draft until its fresh exact-head gates finish.
5. Contract 134 is repository-only; rollout must not leapfrog the dependency/authority controls or become an excuse to publish Euro 2028.

## Exact next action for 05:00

1. Recheck PR #602 at exact head `844660576abb324adca4de5aa907a73c153c77f1`.
2. If any gate failed, inspect the exact artifact/log and repair only the demonstrated defect; do not start a competing Contract-134 branch.
3. If CI, Database parity/pgTAP, Browser E2E, CodeQL and hosted inventory are all green, mark #602 ready but keep hosted rollout separate from merge sequencing; re-evaluate whether it should merge before or after the #593/#597 authority chain based on current `main` and conflict state.
4. Check #593 only for a genuine external acceptance-state change. Do not repeat interactive-browser capability discovery.
5. If #593 remains blocked and #602 is green, take the next non-hosted EURO-003/004 design/guard slice only if it can be cleanly stacked without creating another migration-number race. Otherwise use the session to prepare exact restack/conflict resolution for #597/#600 or another coherent non-contract UI slice.
6. Production must remain untouched unless the repository's independent production controls explicitly authorise a concrete promotion.
