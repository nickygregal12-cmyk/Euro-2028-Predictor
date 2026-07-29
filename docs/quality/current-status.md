# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 29 July 2026

## Baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Repository candidate | PR #193 at contract 63 with 63 canonical migrations through `20260729154931_prediction_consensus_minimum_cohort.sql`; merge and exact production application release remain pending final-head gates |
| Delivery evidence | PRs #122–#145 establish lifecycle, bounded reads, scale, Profile/H2H and privacy; PRs #150, #157 and #164 deliver Bonus Games; PRs #162, #165 and #166 complete Match Centre and Predict resilience; PRs #167, #171 and #174 deliver Account controls and race-safe clearing; PR #177 adds axe coverage; PR #178 rebuilds Matches; PR #180 makes Predictor Cup lint-resolvable; PRs #187, #189 and #191 close browser/database audit gaps; PR #193 adds post-lock consensus, final standings, cohort privacy and migration timestamp controls |
| Development Supabase | `iouzoutneyjpugbbtdem` — verified at exactly 63 versions through `20260729154931`; public consensus gate and private-helper privileges verified |
| Production Supabase | `vkfnsqdyhvtwyqkisxhk` — promoted and verified at exactly 63 canonical versions through `20260729154931`; preserved-data and privilege checks passed |
| Netlify contexts | `dev`, `branch-deploy`, `deploy-preview` and `production` all declare contract 63; non-production contexts use development Supabase and production uses production Supabase |
| Verified production application | Current live application remains the contract-60 Bonus Games release deploy `6a69c4178767280008845b27` from `0fe61a84bc43a7894b0de5b4bc923e188f043c14` until PR #193 is merged and an exact contract-63 production deployment is verified |
| Production data preservation | one Auth user, one profile, one entry, one league, one league member, 51 matches and 36 saved Original predictions preserved; Bonus Games catalogue remains 3 competitions and player-created Bonus Games data remains zero |
| Production registration state | all three Bonus Games retain `registration_opens_at = null`; entry remains closed until a later owner-approved opening decision |
| Production recovery | same-day encrypted contract-60 backup/restore evidence remains the recovery point; exact 60→63 preflight and postflight proved all tracked production counts unchanged |

The repository, development database, production database and every Netlify contract declaration are aligned at contract 63. The application release is intentionally one step behind until the exact PR #193 final head passes preview and repository gates, is merged, and the resulting production deployment is verified. No tag has been created.

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Contract alignment | **Aligned at 63.** Repository candidate, development Supabase, production Supabase and all Netlify context declarations match. Environment-specific Supabase URLs remain correctly separated. |
| Production publication | **Pending exact application release.** The database and environment contract are ready; the currently published application remains contract 60 until PR #193 promotion is complete. |
| Recovery | **Verified recovery point and guarded promotion.** Same-day encrypted backup/restore evidence exists, production was required to be exactly contract 60 before promotion, and postflight proved preservation at 63. |
| Production preservation | **Verified.** User, profile, entry, league, membership, match, prediction and Bonus Games counts were unchanged across 60→63. |
| Database lint and parity | **Clean at 63.** Disposable rebuild, lint, all pgTAP suites and TypeScript/PostgreSQL parity pass. |
| Administrator result control | **Implemented and audit-proven.** Confirm/correct/clear, immutable revisions, result methods and exact before/after content are browser/database proven. |
| Actual qualification control | **Implemented.** Exact third-place boundary ties are authorised, reasoned, revisioned and replayed transactionally. |
| Automatic valid-entry recovery | **Implemented.** A database-owned job submits only complete valid entries at lock and exposes immutable owner outcomes. |
| Bounded reads and capacity | **Implemented.** Overall/private standings, profiles, H2H and post-lock consensus use bounded server contracts. |
| Tournament database lifecycle | **Proven and production-hosted through 63.** Full-tournament, correction, replay, automatic submission, Cup, rank-history, revision-content, consensus, cohort suppression and final-standings database contracts are present. |
| Profile/H2H and privacy | **Production-hosted at 63.** Other-player detail remains authenticated/co-member-only; tournament-wide consensus is suppressed below ten submitted entries and the private aggregate helper is inaccessible to browser roles. |
| Post-lock Original experience | **Implemented in PR #193.** A richer locked My Entry state and bounded Trends page expose crowd signals only after lock and only from an eligible cohort. |
| Final standings | **Implemented in PR #193 and production database.** Live ranks stay points-only; after every result, overall/private leagues apply exact scores, correct outcomes, correct knockout teams, champion and closest goals. |
| Bonus Games | **Visible, production-hosted and browser-proven.** KO Predictor, Last Man Standing and Predictor Cup remain separate and production registration remains closed. |
| Accessibility automation | **Expanded in PR #193.** Trends is included in axe scans and desktop/phone overflow coverage; manual review remains. |
| Baseline tag readiness | **Pending.** Requires exact final-head preview/repository gates, merge, exact production deploy and smoke evidence. |
| Launch readiness | **Not ready for public tournament operation.** Official data, manual accessibility, Auth/SMTP ownership, operational ownership and the later dress rehearsal remain. |

## Implemented foundation

- authoritative locks, submission, results, revisions, scoring, qualification and bracket replay;
- exact result-revision and H2H rank-history behavioural proof;
- automatic valid-entry submission using the manual validator;
- deterministic group/tie resolution and real knockout winner propagation;
- bounded overall/private standings, profiles, H2H and post-lock consensus with a ten-entry privacy threshold;
- richer post-lock My Entry with review, trends, joker, profile and standings actions;
- bounded Trends view: champion race, predicted final, awards, agreement/division, trusted team, goals spread and caller-only uniqueness;
- explicit non-error `not_enough_entries` state below the consensus threshold;
- final standings activation and explanation for overall/private leagues using the approved five-step order;
- private Account controls and race-safe Original entry clearing;
- isolated KO Predictor, Last Man Standing and Predictor Cup with browser lifecycle proof;
- resilient Match Centre, Predict and Matches tournament-information views;
- automated desktop/phone axe coverage plus targeted mobile overflow tests;
- environment contract guards, migration timestamp guard, CI, Database parity, Browser E2E and exact-head release controls;
- production database contract 63 with preserved data and verified public/private function privileges.

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
| Production schema, auth, scoring, destructive work or release | Recovery evidence when data is at risk, preflight, explicit approval, full verification and dated evidence |

Production promotion is milestone-only. The heavier release posture returns around six months before the tournament, or earlier when real users or valuable live data appear.

## Current next batch

**Complete contract-63 release and baseline preparation**

1. Pass exact PR #193 final-head CI, Database parity, authenticated Browser E2E and deploy-preview smoke at contract 63.
2. Merge PR #193 to `main` only after all required checks are green.
3. Verify the exact contract-63 production deploy, `/release.json`, production Supabase target and production smoke.
4. Reconcile the final production deploy evidence and prepare the immutable baseline tag command.

## Operational follow-ups

- keep all Netlify contract declarations at 63 unless a reviewed future migration changes the contract;
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
