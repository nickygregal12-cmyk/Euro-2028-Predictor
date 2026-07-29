# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 29 July 2026

## Baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository contract | 60 canonical migrations through `20260729110000_predictor_cup_lint_safe_qualification.sql` |
| Delivery evidence | PRs #122–#145 establish the lifecycle, bounded reads, scale, Profile/H2H and privacy foundations; PRs #150, #157 and #164 deliver Bonus Games B1–B7c; PRs #162, #165 and #166 complete Match Centre resilience, the prediction journey and truthful Matches states; PRs #167, #171 and #174 deliver Account controls, race-safe clearing, privacy and Contact admin; PR #177 adds automated axe coverage; PR #178 rebuilds Matches as tournament information; PR #180 makes Predictor Cup qualification/progression fully lint-resolvable |
| Release source before alignment | `2d96f4e178520028270ba237eabb87a13c5536fc` — merge of PR #180 on top of all application changes through PR #178 |
| Development Supabase | `iouzoutneyjpugbbtdem` — exactly 60 canonical versions; migration history, privileges, lint and lifecycle tests verified |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — exactly 60 canonical versions; encrypted backup/restore, dry-runs, preserved-data checks, privilege checks and hosted database lint passed |
| Netlify contexts | `dev`, `branch-deploy` and `deploy-preview` declare 60 and use development Supabase; `production` is being aligned to 60 and remains bound to production Supabase |
| Production data preservation | one Auth user, one profile, one entry, one league, one league member, 51 matches and 36 saved predictions preserved; all Bonus Games tables remain empty |
| Production recovery | fresh encrypted contract-55 baseline backup and disposable restore rehearsal passed immediately before the approved 55→60 promotion |
| Production release gate | exact contract-60 release identity, HTTP smoke and Chromium smoke must pass against the release-alignment merge before closure |

Production is a controlled future-tournament target, not an active Euro 2028 service. Its database is aligned at contract 60. The application release is published only from the exact contract-60 release-alignment merge and is re-locked after exact production smoke.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Contract alignment | **Database aligned at 60.** Repository, development and production Supabase share the exact canonical 60-migration history. All Netlify contexts must report contract 60 against their correct Supabase project. |
| Recovery | **Verified.** A fresh encrypted production backup restored successfully into disposable local Supabase before the milestone writes. |
| Production preservation | **Verified.** Every pre-release user/profile/entry/league/match/prediction count remained unchanged and no synthetic Bonus Games data was created. |
| Database lint | **Clean.** Contracts 59–60 removed the only remaining application SQL temporary-table dependencies while retaining the tested Predictor Cup rules and service-only privileges. |
| Administrator result control | **Implemented.** Protected routes, capability checks, confirm/correct/clear, immutable revisions and regulation/extra-time/penalty handling are browser-proven. |
| Actual qualification control | **Implemented.** Exact third-place boundary ties are detected, authorised, reasoned, revisioned and replayed transactionally. |
| Automatic valid-entry recovery | **Implemented.** A database-owned one-minute job submits only complete valid entries at lock and exposes immutable owner outcomes. |
| Bounded Original Predictor reads | **Implemented.** Overall and private-league standings use server-ranked keyset pagination with deterministic ordering and bounded caller context. |
| Operating-cap enforcement | **Implemented.** Public signup and league creation are serialised and authoritatively capped; the current public signup limit remains 50 pending SMTP verification. |
| Tournament database lifecycle | **Proven.** Deterministic full-tournament, correction, replay, automatic-submission, Cup and excess-data pgTAP journeys pass from a clean 60-migration rebuild. |
| Product-facing result lifecycle | **Proven.** Match Centre, Matches and H2H consume server-owned result/winner data. |
| Profile/H2H and privacy | **Proven.** Own Profile/H2H are resilient; other-player detail remains authenticated and co-member-only with pre/post-lock reveal boundaries. |
| Account controls | **Implemented.** Display name, password, email, reminders, privacy/contact content, sign-out and pre-lock Original entry clearing are delivered. Cleared entry identities retire so stale autosaves cannot resurrect picks. |
| Bonus Games | **Complete.** Platform, KO Predictor, Last Man Standing and the full Predictor Cup qualification/knockout/honours lifecycle are delivered and production-aligned. |
| Prediction journey | **Implemented.** The Predict hub, forward stage flow, review/submission states and post-lock spectator/My-entry foundations are delivered. |
| Tournament information | **Implemented first cut.** Matches contains real-results group tables, best thirds, authoritative knockout bracket and result-derived tournament statistics. |
| Accessibility automation | **Implemented.** Axe WCAG 2.2 AA scans cover the key authenticated desktop/phone surfaces; manual review remains. |
| Launch readiness | **Not ready.** Official data, remaining post-lock product states, operational ownership and the later full dress rehearsal remain. |

## Implemented foundation

- authoritative locks, submission, results, revisions, scoring, actual qualification and bracket replay;
- automatic valid-entry submission using the same server validator as manual submission;
- deterministic group/tie resolution and real winner propagation through all knockout rounds;
- bounded server-ranked overall/private-league reads, scale evidence and operating caps;
- secure co-member profiles, authoritative H2H totals, rank history and bracket health;
- private Account identity/auth controls, reminder preference, privacy guidance and configured Contact admin path;
- non-resurrecting pre-lock Original entry clearing that preserves accounts, leagues and Bonus Games;
- separate deny-all Bonus Games storage, voluntary registration, shared knockout predictions and KO Predictor standings;
- tournament-format Last Man Standing with one-use teams, deadline locks, result-correction re-derivation and wipeout handling;
- Predictor Cup deterministic draw, group scoring, qualification, wildcards, seeding, playoff/byes, Penalty Numbers, round settlement, champion and Golden Predictor;
- Predictor Cup service functions contain no temporary-table dependencies and remain service-role-only;
- Match Centre resilience and fixture switching;
- Predict hero/journey map and always-forward stage flow;
- Matches tournament-information group/bracket/stats sub-views;
- automated desktop/phone axe scans across key authenticated routes;
- environment/deployment-contract guards, CI, Database parity, Browser E2E and exact-head preview smoke;
- production backup/restore, contracts 56–60 promotion and hosted database verification.

## Immediate product gaps

- post-lock consensus/trends surface and richer My-entry reveal state;
- final league tie-breaker standings activation and explanation UI;
- remaining loading, empty, retry and error-state coverage across secondary comparison surfaces;
- reminder delivery only after Auth/SMTP ownership and reliability are verified;
- official teams, fixtures, regulations and lock instant;
- manual accessibility review and the later full product dress rehearsal;
- deferred Matches slices: live predicted/actual table switcher, mid-groups bracket projection and feed-gated top scorers.

## Development mode

The project uses proportionate controls:

| Change class | Gate |
| --- | --- |
| UI, copy, styling, docs | CI; targeted preview/UI verification when relevant |
| Features and development schema | CI plus relevant unit/integration, Database parity and Browser E2E |
| Production schema, auth, scoring, destructive work or release | Backup when data is at risk, preflight, explicit approval, full verification and dated evidence |

Production promotion is milestone-only. Development may advance ahead of production only when the split is recorded here. The heavier release posture returns around six months before the tournament, or earlier when real users or valuable live data appear.

## Current next batch

**Post-lock experience from the stable contract-60 baseline**

1. Build post-lock consensus/trends and the richer My-entry hero.
2. Activate league tie-breaker final standings (`calculateLeagueRank` wiring plus explanation UI).
3. Continue remaining mobile, empty/error-state and manual accessibility work alongside each feature.
4. Re-measure full recomputation at complete tournament result volume during the later dress rehearsal.

## Operational follow-ups

- keep the manual backup workflow pinned to contract 60 before its next milestone use;
- keep production locked between milestones;
- name monitoring/backup/Cron alert ownership;
- decide leaked-password protection and final Turnstile configuration;
- verify branch protection;
- rehearse application rollback and later repeat backup restore against the then-current production artifact.

## Documentation authority

- Current facts: this file.
- Future sequence: `docs/roadmap.md`.
- Scoring: `docs/scoring-rules.md`.
- Architecture/tournament states: `docs/architecture-and-tournament-states.md`.
- Operations: the relevant `docs/ops-*.md` runbook.
- Dated reconciliations and audits: historical evidence only.
