# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 29 July 2026

## Baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository candidate | PR #193 declares 62 canonical migrations through `20260729122200_final_standings_tiebreaks.sql`; `main` and production remain at 60 until the milestone promotion is explicitly approved |
| Delivery evidence | PRs #122–#145 establish lifecycle, bounded reads, scale, Profile/H2H and privacy; PRs #150, #157 and #164 deliver Bonus Games; PRs #162, #165 and #166 complete Match Centre and Predict resilience; PRs #167, #171 and #174 deliver Account controls and race-safe clearing; PR #177 adds axe coverage; PR #178 rebuilds Matches; PR #180 makes Predictor Cup lint-resolvable; PRs #187, #189 and #191 close the latest browser/database audit gaps; PR #193 is the post-lock/final-standings development batch |
| Development Supabase | `iouzoutneyjpugbbtdem` — exactly 62 canonical versions through `20260729122200`; post-lock consensus, final standings functions and browser-role privileges verified |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — exactly 60 canonical versions; encrypted backup/restore, dry-runs, preservation checks, privileges and hosted database lint passed |
| Netlify contexts | `dev`, `branch-deploy` and `deploy-preview` declare 62 and use development Supabase; `production` declares 60 and uses production Supabase |
| Verified production application | Bonus Games release deploy `6a69c4178767280008845b27`, ready, from `0fe61a84bc43a7894b0de5b4bc923e188f043c14` (PR #184) |
| Production data preservation | one Auth user, one profile, one entry, one league, one league member, 51 matches and 36 saved Original predictions preserved; Bonus Games catalogue is 3 competitions / 14 windows / 102 fixture links; player-created Bonus Games data remains zero |
| Production registration state | all three Bonus Games retain `registration_opens_at = null`; entry remains closed until a later owner-approved opening decision |
| Production recovery | fresh encrypted contract-55 baseline backup restored successfully before 55→60; the contract-60 backup verifier subsequently passed |

Production is a controlled future-tournament target, not an active Euro 2028 service. Development is intentionally ahead at contract 62 for PR #193 while production remains re-locked at contract 60. This is a recorded milestone split, not an accidental divergence. No contract-61/62 production write or production deploy has been performed.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Contract alignment | **Controlled split.** Development Supabase and all non-production Netlify contexts are at 62; production Supabase and production Netlify remain at 60. |
| Production publication | **Unchanged and verified at 60.** The last product release remains the exact PR #184 Bonus Games deployment. |
| Recovery | **Verified for production 60.** A fresh encrypted backup restored successfully before milestone writes; production promotion to 62 requires a new preflight/backup/approval cycle. |
| Production preservation | **Verified.** No production data, registration state or schema was changed by PR #193 development work. |
| Database lint and parity | **Clean at candidate 62.** A disposable 62-migration rebuild, lint, all pgTAP suites and TypeScript/PostgreSQL parity pass. |
| Administrator result control | **Implemented and audit-proven.** Confirm/correct/clear, immutable revisions, result methods and exact before/after content are browser/database proven. |
| Actual qualification control | **Implemented.** Exact third-place boundary ties are authorised, reasoned, revisioned and replayed transactionally. |
| Automatic valid-entry recovery | **Implemented.** A database-owned job submits only complete valid entries at lock and exposes immutable owner outcomes. |
| Bounded reads and capacity | **Implemented.** Overall/private standings, profiles, H2H and post-lock consensus use bounded server contracts. |
| Tournament database lifecycle | **Proven through candidate 62.** Full-tournament, correction, replay, automatic submission, Cup, rank-history, revision-content, consensus and final-standings pgTAP journeys pass. |
| Profile/H2H and privacy | **Proven.** Other-player detail remains authenticated/co-member-only; rank history has direct behavioural coverage. |
| Post-lock Original experience | **Implemented in PR #193 development.** A richer locked My Entry state and bounded Trends page expose crowd signals without revealing peer entries. |
| Final standings | **Implemented in PR #193 development.** Live ranks stay points-only; after every result, overall/private leagues apply exact scores, correct outcomes, correct knockout teams, champion and closest goals. |
| Bonus Games | **Visible, production-hosted and browser-proven.** KO Predictor, Last Man Standing and Predictor Cup remain separate and production registration remains closed. |
| Accessibility automation | **Expanded in PR #193.** The Trends route is included in axe scans and has desktop/phone overflow coverage; manual review remains. |
| Launch readiness | **Not ready.** Official data, manual accessibility, Auth/SMTP ownership, operational ownership and the later dress rehearsal remain. |

## Implemented foundation

- authoritative locks, submission, results, revisions, scoring, qualification and bracket replay;
- exact result-revision and H2H rank-history behavioural proof;
- automatic valid-entry submission using the manual validator;
- deterministic group/tie resolution and real knockout winner propagation;
- bounded overall/private standings, profiles, H2H, post-lock consensus and operating caps;
- richer post-lock My Entry with review, trends, joker, profile and standings actions;
- bounded Trends view: champion race, predicted final, awards, agreement/division, trusted team, goals spread and caller-only uniqueness;
- final standings activation and explanation for overall/private leagues using the approved five-step order;
- private Account controls and race-safe Original entry clearing;
- isolated KO Predictor, Last Man Standing and Predictor Cup with browser lifecycle proof;
- resilient Match Centre, Predict and Matches tournament-information views;
- automated desktop/phone axe coverage plus targeted mobile overflow tests;
- environment contract guards, CI, Database parity, Browser E2E and exact-head release controls;
- production backup/restore and exact contract-60 release evidence.

## Immediate product gaps

- remaining loading, empty, retry and error-state coverage across secondary comparison, transfer and invitation surfaces;
- trustworthy pre-auth private-league invite context and aggregate-disclosure abuse review;
- manual keyboard, screen-reader and contrast review across core desktop/phone journeys;
- reminder delivery only after Auth/SMTP ownership and reliability are verified;
- official teams, fixtures, regulations, kickoff times and lock instant;
- deliberate production registration opening for each Bonus Game after official-data and support gates;
- operational ownership for monitoring, backups, Cron alerts and incident response;
- later complete-volume recomputation, rollback and full tournament dress rehearsal;
- deferred Matches slices: live predicted/actual tables, mid-groups bracket projection and feed-gated top scorers.

## Development mode

| Change class | Gate |
| --- | --- |
| UI, copy, styling, docs | CI; targeted preview/UI verification when relevant |
| Features and development schema | CI plus relevant unit/integration, Database parity and Browser E2E |
| Production schema, auth, scoring, destructive work or release | Backup when data is at risk, preflight, explicit approval, full verification and dated evidence |

Production promotion is milestone-only. Development may advance ahead of production only when the split is recorded here. The heavier release posture returns around six months before the tournament, or earlier when real users or valuable live data appear.

## Current next batch

**Secondary resilience, invite trust and manual accessibility**

1. Complete loading, empty, retry and unavailable-data states on H2H/player comparisons, private-league transfer/search and invitation surfaces.
2. Finish trustworthy pre-auth invite context without exposing private membership or prediction data; include aggregate-disclosure abuse review.
3. Run a documented keyboard, screen-reader and contrast review across Home, Predict/My Entry, Trends, Matches, leagues, Profile/H2H, Bonus Games and Account on desktop/phone.
4. Close any defects found with targeted Browser E2E and axe regressions before starting official-data ingestion work.

## Operational follow-ups

- keep production smoke and backup workflows pinned to contract 60 until promotion is explicitly approved;
- keep production locked between milestones;
- do not set Bonus Games registration opening instants yet;
- name monitoring, backup and Cron alert ownership;
- decide leaked-password protection and final Turnstile configuration;
- verify branch protection and required checks;
- rehearse application rollback and later repeat backup restore against the then-current production artifact.

## Documentation authority

- Current facts: this file.
- Future sequence: `docs/roadmap.md`.
- Scoring: `docs/scoring-rules.md`.
- Architecture/tournament states: `docs/architecture-and-tournament-states.md`.
- Operations: the relevant `docs/ops-*.md` runbook.
- Dated reconciliations and audits: historical evidence only.
