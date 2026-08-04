# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and freshly verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 3 August 2026

## Product position

The product is the **Football Prediction Hub** (ADR 0020): a multi-competition football prediction platform. Euro 2028 is the first recoverable competition baseline, not the endpoint of the programme. The first supported domestic competition seasons are Premier League 2026/27 and Scottish Premiership 2026/27, alongside Euro 2028.

- **user evidence:** [`../architecture/phase-0-world-cup-evidence.md`](../architecture/phase-0-world-cup-evidence.md) — owner observation of a live World Cup predictor with roughly 60 users across a full tournament. It is the only user evidence the programme holds, and it corrects six recorded planning assumptions;
- recoverable Euro baseline: `euro-2028-baseline` → `1fb8ffd36ad113079181829a8bcc47175c43b6da`;
- remaining Euro-specific work: parked in [`../../MASTER-TODO.md`](../../MASTER-TODO.md) until **January 2028**;
- product phases and gates: [`../architecture/programme-plan.md`](../architecture/programme-plan.md);
- engineering sequence: [`../architecture/multi-competition-hub-build-plan.md`](../architecture/multi-competition-hub-build-plan.md);
- current execution sequence: [`../roadmap.md`](../roadmap.md);
- platform decisions: [`../adr/0011-multi-competition-platform.md`](../adr/0011-multi-competition-platform.md) through [`../adr/0024-development-environment-operating-model.md`](../adr/0024-development-environment-operating-model.md); the product model is [`../adr/0020-football-prediction-hub-product-model.md`](../adr/0020-football-prediction-hub-product-model.md).

## Repository and release baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Current `main` | Read it from git. A hand-copied SHA in a live-authority document is stale the next time anything merges. Fixed anchors that do not move are the `euro-2028-baseline` tag and dated per-PR evidence. |
| Repository contract | **96** — 96 canonical migrations through `20260804243000_cup_tie_settlement_refusal_order.sql`. Development Supabase is hosted at **95**, applied 4 August 2026 by fast-lane run 30923985137 on `21c9645`; production remains at **63**. Development trails the repository by one additive migration until the next fast-lane run. Contract 87 is the first in this run to remove a database guarantee rather than only add one — it drops `bonus_lms_selections`' cycle-blind club key and replaces it with one scoped to `used_cycle` — and its rollout did carry the `structural` line the widened additive gate now emits, naming `drop constraint` rather than passing it in silence. Non-production Netlify contexts still carry their separately managed `EURO28_DEPLOYED_DB_CONTRACT` declaration, while production keeps the fatal contract gate. |
| Contract at Euro baseline | 63 canonical migrations through `20260729154931_prediction_consensus_minimum_cohort.sql` — the tag is contract 63 and stays there; `main` has moved past it |
| Stage B integration | PR #226 → `2648540dc001c50305f1effa526fc16e43dcdb26` |
| Stage B inventory closure | PR #239 → `69f6e364132f6586d5de9ed8706b0802d14ec0fc` |
| Competition/viewer timezone seam | PR #252 → `1ec505a7d423c8d0b2b03327f8893e3954fa2246` |
| Complete TypeScript project coverage | PRs #255, #258 and #261 |
| JavaScript deploy-gate typecheck | PR #264 |
| Direct Data API exposure guard | PR #265 |
| ACQ-R02 scale evidence | PR #266; risk remains open |
| ACQ-R03 result-write evidence | PRs #269, #276 and #284 — full group stage, WAL, bloat, knockout cascade and a concurrency probe; risk remains In progress |
| Enum union/schema freshness guard | PR #279 |
| Coverage thresholds and compressed bundle budgets | PR #285; both are CI gates |
| Lint warnings fail CI | PR #287 — `oxlint --deny-warnings`; three `no-unsafe-finally` defects fixed |
| Stage C design baseline | **PR #236 merged** 30 July 2026. It is the combined design record and authorises pre-migration contract planning only |
| Stage C governance | [`stage-c1-c2-governance.md`](../architecture/stage-c1-c2-governance.md): C1 competition-season foundation may progress; C2 profile ownership/account erasure remains blocked by issue #272 |
| Stage C assertion classification | [`stage-c1-contract-classification.md`](../architecture/stage-c1-contract-classification.md): **40 C1, zero authorised C2 after-state and nine shared-before-state assertions**, enforced by `stageC1ContractClassification.test.ts` |
| Stage C1 implementation overlay | [`stage-c1-schema-overlay.md`](../architecture/stage-c1-schema-overlay.md): every original relation and reviewed function has a C1/C2/shared disposition; coverage is enforced by `stageC1SchemaOverlayCoverage.test.ts` |
| Stage C database contracts | Seven original suites plus `stageC1NonInterference`: TypeScript `stageCRelationCoverage`, `stageCFunctionCoverage`, `stageCTriggerBindingCoverage`, `stageCTournamentIdCompatibility`, `stageCEuroSeedPreservation`, `stageC1NonInterference`; pgTAP `031_stage_c_reference_scope_before_state.sql`, `032_stage_c_lock_before_state.sql` and `033_automatic_submission_trusted_path.sql`; source-level `stageC1LockFunctionConsistency` compares the entry-lock trigger definitions to each other, which `pg_proc` cannot do because the live database only shows the last of them. Inventory guarded by `stageCContractInventory.test.ts` |
| Stage C1 merge state | **Merged to `main`**: PR #317 (foundation), PR #349 (populated-audit hotfix), PR #350 (hosted evidence tooling), PR #351 (guarded GitHub development rollout workflow). The hosted development apply **completed**: contract 65 on 2 August 2026 through the guarded process, contract 66 on 3 August 2026 through the ADR 0024 fast lane. No owner action is outstanding |
| Game-owned lock policy | **PR #353 merged 2 August 2026.** `CompetitionConfig` carries no `lockPolicy`; the selected game supplies its own explicit policy (ADR 0020): Original Predictor entry/0-minute, Main Predictor matchweek/0-minute, Last Man Standing matchweek/30-minute. Missing, unknown, stale or incompatible policies fail closed |
| LeagueTable contrast guard | PR #344 merged 2 August 2026 — `--mut` is never a foreground; static design-system guard added |
| DEV season preview | PR #345 recovered under game-owned lock policy: same season resolving Main Predictor (0) and LMS (30) side by side; round-robin, BST/GMT and fail-closed evidence retained; DEV-only, no persistence |
| Season rule authorities | **Complete in pure domain, 3 August 2026.** PRs #372, #373, #375, #377, #379, #381 and #383 took `src/domain/season/` from three modules to thirteen, encoding every rule ADRs 0012, 0013 and 0014 pin down. Contracts 68–93 have since given the Main Predictor and Last Man Standing persistence, SQL parity and a driving job; the Predictor Cup has stores but still no caller, and **no season game has a surface**. See the season-domain section below |
| Season/Cup SQL parity | **Main Predictor scoring landed at contract 70** (`predictor_internal.season_fixture_points`, `season_matchweek_points`), held in step with `src/domain/season/scoring.ts` by `seasonScoringParity.test.ts` and proven against a real database by `122_season_scoring.sql`. **LMS pick resolution landed at contract 71** (`predictor_internal.resolve_lms_pick`), guarded by `lmsResolutionParity.test.ts` and `123_lms_pick_resolution.sql`; LMS awards no points, so this is survival parity rather than scoring parity. **LMS setup and entrant state landed at contract 72** (`season_lms_setups`, `season_lms_entrant_state`), with public competitions pinned to Classic in the schema and entrant allowances checked against their own setup. **LMS round conclusion and season exhaustion landed at contract 73** (`predictor_internal.conclude_lms_round`, `resolve_lms_season_exhaustion`), guarded by `lmsConclusionParity.test.ts` and `125_lms_round_conclusion.sql`. Stage F now has a complete rule-and-storage spine; what remains for LMS is the settlement job that calls these and the surfaces. **The season Cup's pure rules landed at contract 74** (`predictor_internal.settle_season_cup_tie`, `select_season_cup_format`, `resolve_public_cup_launch`), guarded by `seasonCupParity.test.ts` and `126_season_cup_rules.sql`. These are new functions, not a reuse of `predictor_internal.cup_*`: that machinery implements the **tournament** Cup's §6.3 wildcard normalisation, while the season Championship ranks by its own eight-step tie-break, and nothing in contract 74 touches it. **Still absent from Cup parity, deliberately:** `buildCupGroupTable`'s eight-step tie-break and `generateCupLeagueSchedule`'s circle method, both of which need the persistence decision ADR 0022 (as corrected) defers to after C1b. Cup persistence — ties, groups, schedules — remains absent in full. **The `predictor_internal.cup_*` rescoping ADR 0022 sequences after C1b is now unblocked, and its first step landed at contract 75**: `cup_window_scores` is split into `cup_tournament_fixture_points` (the tournament points source) and competition-agnostic arithmetic over a neutral per-member-per-fixture relation, so a season source returning the same shape becomes a drop-in. Behaviour-preserving and the signature is unchanged, so all sixteen call sites were untouched; equivalence was established by a differential harness running old against new over 300 randomised scenarios with zero mismatches, which diverged in 48 of 50 when the 999 sentinel was removed. Structural proof is `supabase/tests/127_cup_neutral_points_source.sql`; `109`–`114` remain the behaviour evidence and are unchanged. **Contract 76 completed the rescoping**, and it was smaller than the plan implied: tracing the call graph showed contract 75's split had cascaded, so `cup_final_group_tables` became neutral through `cup_window_scores` without a pass of its own, while `cup_seed_group` (only `bonus_cup_members`) and `cup_bracket_order` (pure arithmetic) never had a coupling. Only `cup_window_settled` remained, and contract 76 moved its `result_state` check into `cup_tournament_window_unsettled`. No function in the shared Cup machinery now reads a tournament relation, which `128_cup_neutral_settlement_source.sql` asserts as a set. **Contract 77 supplied those sources.** `season_cup_window_fixtures` is the season's window link — separate from `bonus_window_fixtures`, whose `match_id` is NOT NULL against `matches` inside its primary key, so serving a season from it would mean destructive change to a production-hosted tournament table; this is the same answer contract 68 gave when season fixtures became `season_fixtures` rather than a widening of `matches`. `cup_season_fixture_points` and `cup_season_window_unsettled` return exactly the shapes the shared functions consume, and `cup_window_scores`/`cup_window_settled` combine both sources by **union** rather than branching on competition kind, so they remain one implementation. Interchangeability was proven by scoring an identical scenario through each source — byte-identical output including the 999 sentinel — and the tournament path was proven unchanged by re-running the differential sweep with the season link empty across 300 scenarios. **Both parity suites deferred at contract 74 are now closed, and one of them by a correction.** `buildCupGroupTable` needed no new SQL: comparing its comparator against `cup_final_group_tables`' `order by` shows the tournament and season rank by **identical** nine keys, so `cupGroupTableParity.test.ts` pins them to the existing function. That contradicts contract 74's migration comment, which said the season ranks by its own eight-step tie-break and the two were "two rule sets for two competitions" — the substance was wrong; what is genuinely tournament-specific is the §6.3 wildcard normalisation in the qualification path, not the ordering. `generateCupLeagueSchedule` did need new SQL at contract 78: the tournament's schedule is hardcoded `values` tuples for groups of three and four, not a circle method. It was verified NOT to reproduce those tables — same pairings, different round assignment — so the tournament tables are untouched and no published fixture moves. **Cup persistence turned out to be mostly present.** `bonus_cup_groups`, `bonus_cup_members`, `bonus_cup_fixtures` and `bonus_competition_windows` were already competition-scoped and reach no tournament relation; what remained was two CHECK constraints encoding the tournament's format on shared tables — `size in (3, 4)` and `matchday between 1 and 3`. Contract 79 widened them to `size between 3 and 20` and `matchday > 0`, the first constraint relaxation in this run. The justification is that these were format rules, not integrity rules: `admin_draw_predictor_cup` computes its own sizes and matchdays, so the column was never what kept the tournament right. The compensating control is `cupStoreDomains.test.ts`, which pins that the draw still writes only sizes three and four and matchdays one to three, keeping the limit in the code that owns the format. `bonus_cup_fixtures.stage` was deliberately NOT widened: a season split stage would immediately violate `bonus_cup_fixtures_group_shape`, which requires a non-group stage to carry neither `group_id` nor `matchday` while split rounds need both, so it waits for the split-execution slice that settles its shape. Originally recorded as: and `tests/database-parity/cupPointsSourceBoundary.test.ts` is its before-state contract. Reading the functions first changed the shape of that work: `cup_window_scores` is not tournament-scoped by a parameter — its signature already takes `p_competition_id` — but reads `matches`, `match_predictions`, `bonus_knockout_predictions` and `entries.tournament_id` in its body, which a season Cup cannot reach. It conflates a tournament-specific points source with competition-agnostic aggregation, so the generalisation is a **split** around the neutral raw-points contract rather than a parameter swap. **Correction to contract 74's migration comment:** it placed the §6.3 normalisation `table_points / (group_size - 1)` in the tournament Cup's group-table ordering. The substance was right (the tournament does compare across differently sized groups) but the location was not — it is in the wildcard qualification path in `20260729050000_predictor_cup_knockouts.sql`, while the group table orders by nine keys now pinned by the before-state contract. That migration is applied to development and migrations are append-only after hosted application, so the correction lives in the test rather than in the migration.**The matchweek card's lock behaviour landed at contract 80** (`predictor_internal.resolve_season_card_at_lock`, `is_valid_scoreline`), guarded by `seasonCardLockParity.test.ts` and `132_season_card_lock_resolution.sql`. A differential sweep over 216 generated cases caught a real defect before it shipped: `is_valid_scoreline` returned NULL rather than false for an object carrying no `home` key, so `if not <null>` never fired and `{}` was accepted as a scoreline while TypeScript refused it. **Its storage landed at contract 81** — `season_matchweek_cards` and `season_matchweek_submission_outcomes`, guarded by `seasonCardStatusStorage.test.ts` and `133_season_card_status.sql`, with 19 accept/refuse probes run against a scratch PostgreSQL 16 on the real DDL. The design decision worth recording is that **`no_submission` is deliberately not a storable status**: rolling entry means absence IS that state, so a player who never engaged has no row. An explicit row would be the same rule written weakly — a later writer creating one per registered player "for completeness" would make every player look engaged, and totals that look entirely plausible would follow. The ledger mirrors `entry_automatic_submission_outcomes` but does **not** inherit its shape defect: that constraint's refusal branch ends in `char_length(btrim(<null>))`, which evaluates to NULL, and a CHECK treats NULL as satisfied — confirmed on a scratch database, which accepted an `invalid` outcome carrying no failure message at all. That table is production-hosted and out of scope to change; contract 81 tests `refusal_reason is not null` explicitly. **Contract 82 withdrew the pre-filled card**, on owner decision recorded in ADR 0012's 4 August 2026 amendment: the ADR had required every fixture pre-filled with "a sensible default" and partial cards auto-completed at lock, and neither survives, because a player must not benefit from not filling something in. A blank fixture now submits no prediction and scores nothing; `provenance` and `autoCompleted` leave the contract entirely, since nothing but the player can produce a prediction. Contract 80 is applied to development and migrations are append-only after hosted application, so the resolver is redefined in a new migration rather than edited. Equivalence was re-established over 738 differential cases with zero mismatches, and the sweep is not vacuous — restoring the prefill in SQL alone produced 16 immediately. **Contract 83 is the recurring scheduler**, guarded by `seasonMatchweekSchedulerParity.test.ts` and `134_season_matchweek_scheduler.sql`: the lock instant is derived from earliest kickoff minus the game's buffer exactly as `lockState.ts` derives it for the browser, both fail closed on an unconfirmed kickoff, and work is selected by property rather than by game name. What remains for the season card is the surfaces. **Previously:** The season domain modules have no PostgreSQL counterpart, so no parity suite exists for season scoring, LMS or the Cup. ADR 0012 requires season scoring parity and ADR 0022 (as corrected) records the Cup case. This gap closes only when the corresponding SQL lands |
| ADR 0022 | Merged 3 August 2026 (PR #383), **corrected the same day** (PR #384). Supplies the three LMS presets ADR 0013 mandated but left undefined, and the 100-entrant public Cup threshold ADR 0014 left open — both now executable. Its Cup-machinery decision was corrected on two wrong premises: there is no live entrant history, and the machinery is PostgreSQL (`predictor_internal.cup_*`) rather than TypeScript, so nothing in `src/domain` was extractable and ADR 0011's separation law was never at risk |
| Next executable issue | **C1b merged 3 August 2026 (PR #371) as contract 66 and applied to development the same day.** Current work is the season vertical slice at contract 67: the lock-scope reconciliation below, then season matchweeks, fixtures, predictions and entries, then the season scoring SQL with TypeScript/PostgreSQL parity. Provider-ingestion custody (PR #352 recreated on top of C1b) follows and is **not** contract 66; PR #352 remains a stale draft. No C2 work or production write is authorised |
| Cup winner deletion semantics | PR #271 → contract **64**. Not a Stage C migration; an independent declaration of an omitted `on delete` action, applied to development and owner-verified |
| Production posture | Controlled pre-launch target; production remains contract 63 and deploys stay paused until an intentional release milestone |

## Hosted evidence boundary

This status includes fresh read-only GitHub and Netlify inspection and limited read-only development Supabase catalogue inspection. It does **not** refresh canonical hosted migration applied-state, target privileges, production data or preservation counts.

The development Supabase inspection was limited to project identity/version and catalogue metadata. No application rows or personal data were read, and no database write was performed.

| Target | Current evidence | Fresh check required |
| --- | --- | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | healthy Postgres 17. **Contract 65 applied 2 August 2026** through the guarded rollout: prepare run 30771110879 (preflight, encrypted backup, source-equivalent restore rehearsal against the db-only disposable container, one-migration dry run) and apply run 30771280887. Postflight equivalence verified 3 August 2026: canonical postflight DO block passes on hosted; audit digest and all 34 preservation counts identical; Euro identity, auth FK matrix, ownership policies, browser grants, RLS state and trigger bindings byte-identical; the single delta is the migration's own authored `enforce_joker_rules` search-path pinning, accepted by the PR #368 comparator allowance in the hardening direction only. Rollout tooling hardened along the way in PRs #359–#367. **Contract 66 applied 3 August 2026** through the ADR 0024 development fast lane, run 30837677979: dispatch guards (main-only, exact `origin/main`, clean checkout, confirmation phrase, production ref refused by name), secret preflight proving the development URL resolves to `iouzoutneyjpugbbtdem`, the pending migration proven additive by `scripts/check-migration-additive.mjs`, a lightweight pre-apply schema and data snapshot retained as run evidence, then `supabase db push`. Postflight confirmed no migrations remain unapplied and reported `Development is at contract 66.` | Ordinary development work proceeds against contract 66. The repository is at 67 (`20260803180000_matchweek_lock_scope.sql`), so development trails the repository by one additive migration until the next fast-lane run; deploy previews build and report that gap rather than failing, per ADR 0024. |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | owner-verified at contract 63 on 29 July 2026 with preserved-data postflight; not freshly inspected here | **REQUIRES OWNER VERIFICATION:** read-only applied-state, privilege and preservation checks before any write |
| Production Netlify `main` | last good ready deploy remains live. **Production deploys are paused from contract 64 onward**; PR #317 raises the repository candidate to contract 65 while production Supabase remains 63. This is a paused pipeline, not an outage. | Keep paused until an intentional migration/release milestone with exact-origin smoke and owner approval; do not promote merely to equalise contract numbers |
| Non-production Turnstile | Netlify `dev`, branch deploys and deploy previews use Cloudflare's always-pass test site key; production retains a separate real key | **OPEN issue #28:** verify/set the matching development Supabase test secret and prove preview sign-up, login and recovery without CAPTCHA errors |
| Legacy `euro28-predictor-dev` Netlify site | owner chose retirement; anonymous public access was removed on 30 July 2026 and the site now requires Netlify team SSO | **OPEN issue #27:** disable the hourly scheduled function and verify its legacy Supabase disposition; current Euro environments remain untouched |
| Production data/recovery | owner-verified preserved counts and same-day encrypted backup/restore evidence on 29 July 2026 | **REQUIRES OWNER VERIFICATION:** fresh backup/restore proof before a data-risk milestone |

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Euro 2028 baseline | **Tagged and recoverable.** Tournament work through contract 63 is preserved. |
| Euro 2028 forward work | **Parked.** Remaining official data, presentation, rehearsal and release work returns in January 2028. |
| Context engine | **Complete.** Home, Matches, Match Centre and entry-lock decisions consume the shared competition context; `MatchTemporalState` is retired. |
| Stage B | **Complete and recorded.** PR #226 integrated the surfaces and PR #239 closed the retained checklist. |
| Cross-tournament read safety | **Landed.** `group_teams` reads are scoped through the selected tournament's groups. |
| Database API hardening | **Guarded.** PR #250 proves every public table has RLS and every security-definer function pins `search_path`; PR #265 pins every public view and direct browser relation grant. |
| Timezone authority | **Persisted in the C1 repository candidate.** PR #317 supplies `tournaments.display_timezone` to the PR #252 seam while retaining a contract-64 hosted fallback until an approved migration rollout. |
| Account deletion | **Unsafe current behaviour, fully characterised and owned by C2.** PR #246 pins the before-state. C1 has executable non-interference and overlay guards preventing ownership/deletion changes; issue #272 remains the blocker. |
| TypeScript/static coverage | **Exhaustive for committed TS/TSX.** PRs #255, #258 and #261 cover application, tests, e2e, production-smoke, tools and configs. |
| Deploy-gate JavaScript | **Type-checked.** PR #264 covers the three production-decision gates; the remaining JavaScript inventory is explicit. |
| Leaderboard scale | **Measured, not redesigned.** ACQ-R02 remains open; hosted concurrency is untested and no materialised standings table exists. |
| Stage C1 | **Implemented in repository/disposable evidence at contract 65.** Zero-to-current rebuild, database lint, pgTAP and TypeScript/PostgreSQL parity pass; hosted development and production remain unchanged pending review and explicit approval. The first hosted development attempt failed on the `bonus_competition_audit` scope backfill and rolled back atomically — rebuilds reach that statement with an empty audit table, and a row-level trigger does not fire on zero rows. The unhosted contract-65 migration is corrected in place, and `tests/migration-transition/` now crosses contract 64 to 65 against populated tables so rebuild-only coverage cannot hide the same class of defect again. See [`../ops/stage-c1-contract-65-rollout-recovery.md`](../ops/stage-c1-contract-65-rollout-recovery.md). |
| Stage C2 | **Blocked.** Independent data-protection review issue #272 must approve the retention/erasure boundary before profile ownership, pseudonymisation or related RLS work. |
| Public launch readiness | **Not ready.** Domestic-season implementation, ingestion, operations, accessibility, legal/client and brand gates remain. |
| Production mutation | **Prohibited without action-specific owner approval and the full milestone process.** |

## Baseline capabilities carried forward

- authoritative tournament locks, submission, results, revisions, scoring, qualification and bracket replay;
- automatic valid-entry submission using the authoritative validator;
- deterministic group/tie resolution and real knockout winner propagation;
- bounded overall/private standings, profiles, H2H and post-lock consensus;
- richer post-lock My Entry, Trends and final standings;
- private Account controls and race-safe Original entry clearing;
- isolated KO Predictor, Last Man Standing and Predictor Cup tournament implementations;
- protected browser result/qualification administration;
- authenticated desktop/phone Bonus Games lifecycle coverage;
- automated desktop/phone accessibility and targeted overflow checks;
- deployment-contract, migration timestamp, CI, full Database parity, Browser E2E and exact-release controls.

These are evidence for the first competition. Contract 65 adds the shared competition-season schema foundation. As of 3 August 2026 the domestic-season **rules** exist as pure domain authorities (below); their **persistence, surfaces, SQL parity and ingestion do not**.

## Season domain authorities — two of three now driven, none yet visible

Landed 3 August 2026 across PRs #372, #373, #375, #377, #379, #381 and #383. Thirteen modules under `src/domain/season/`, all pure: no storage, no network, no ambient clock, no tournament imports, each with source-level guards proving that.

| Area | Modules | Authority |
| --- | --- | --- |
| Main Predictor | `scoring`, `standings`, `matchweekSettlement`, `cardSubmission`, `fixtureReassignment` | ADR 0012 as amended by ADR 0020 |
| Last Man Standing | `lmsEligibility`, `lmsRoundResolution`, `lmsPresets` | ADR 0013 as amended by ADR 0020 and ADR 0022 |
| Predictor Cup | `cupFormat`, `cupTieSettlement`, `cupSchedule`, `cupGroupTable`, `cupLaunch` | ADR 0014 as amended by ADR 0020 and ADR 0022 |

**This heading is now only partly true, and the part that changed is stated here rather than by rewriting the title.** As landed on 3 August 2026 nothing persisted, mirrored or rendered any of it. Contracts 68–93 have since given two of the three games a database:

| Game | Persistence | Driven by | Surface |
| --- | --- | --- | --- |
| Main Predictor | fixtures, predictions, cards, the lock ledger, and from contract 90 `season_matchweek_scores` | contract 93's hourly scoring job, over contract 91's settlement parity and contract 92's replay link; contract 94 ranks the result into a table | contract 95's `get_season_leaderboard` — the first season RPC a browser role may call. No component renders it yet |
| Last Man Standing | selections, windows, entrant state | contract 89's hourly settlement job, with contract 88's lock-time auto-assignment | none |
| Predictor Cup | Cup stores and neutral sources (contracts 74–79) | **nothing** — `select_season_cup_format`, `settle_season_cup_tie`, `resolve_public_cup_launch` and `cup_league_schedule` all have zero call sites and zero trigger bindings | none |

**What is still true of all three:** no React component renders any of it. Contract 95 is the first crack in that — a season leaderboard is now reachable by an authenticated league co-member through `get_season_leaderboard`, bounded and cursor-paginated — but nothing in `src/` calls it, and Last Man Standing and the Predictor Cup still have no read at all. A player still cannot see a season score in the application.

The claim worth not repeating is the one this document made for a fortnight: "Main Predictor scoring has a PostgreSQL counterpart" was true of contract 70's pure functions the whole time, and hid the fact that nothing called them. A rule with a SQL implementation and no caller is not a rule the product enforces.

**Deliberately not built, for want of authority:** `maxRemainingPoints` generalisation to a rolling season context (ADR 0012 names the consequence but not the semantics), and any season Cup qualification, seeding or bracket implementation (ADR 0022 as corrected: that machinery is SQL, and rescoping it follows C1b).

## Development operating model — implemented controls

[ADR 0024](../adr/0024-development-environment-operating-model.md), landed 3 August 2026 (PRs #390, #392). Each control below exists in the repository and is guarded by an executable test; none of them changes a production boundary.

| Control | Implementation | Guard |
| --- | --- | --- |
| Additive development migrations skip the production-grade ceremony | `.github/workflows/development-fast-lane-rollout.yml` — dispatch-only, main-only, clean-checkout-only, confirmation phrase, refuses the production ref by name, checks the *secret* resolves to development rather than trusting the typed input, greps each pending migration for destructive statements, snapshots before applying | `tests/scripts/developmentFastLaneRollout.test.ts` |
| A trailing hosted database no longer fails a preview build | `scripts/validate-deployment-contract.mjs` — non-production contexts report the gap and build; `production` still throws | `tests/scripts/deploymentContractExpectations.test.ts` |
| Browser journeys are selected from the change | `scripts/select-browser-journeys.mjs` — unmapped path, mixed change, empty change or contract/schema change all widen to the full suite | `tests/scripts/browserJourneySelection.test.ts`, which additionally proves no spec is unreachable, no mapped prefix is stale, and the workflow checks out enough history for the diff to have a merge base |
| Development data is reseedable | `npm run reset:development` (`scripts/reset-development-seed.mjs`) — refuses both hosted project refs and any non-local host | `tests/scripts/seedContract.test.ts` |
| The browser seed states which contract it was reviewed against | `e2e/seed-contract.ts` — `SEED_REVIEWED_AT_CONTRACT` with the identity cast and requirements declared in one place | `tests/scripts/seedContract.test.ts` |

**Known follow-up.** `SEED_REVIEWED_AT_CONTRACT` is 65. C1b moves membership authority, so it must be raised to 66 and membership added to `SEED_REQUIREMENTS` once contract 66 lands.

## Landed control and Stage C foundation sequence

- **PR #228:** production guard derivation, tournament-scoped `group_teams`, real 404 routing, RPC allowlist enforcement, browser-key validation, reachability and TypeScript/SQL parity.
- **PR #229:** Original Predictor TypeScript/SQL scoring-value parity.
- **PR #232:** Database parity executes the complete `tests/database-parity/` directory and guards against future narrowing.
- **PR #233:** committed CSP requirements are checked against application resource use.
- **PR #235:** `VITE_*` declarations/templates and deployment-RPC/database-privilege relationships are held in step.
- **PR #245:** timezone-authority before-state, including viewer-dependent grouping and invalid-zone fail-quiet behaviour.
- **PR #246:** effective account-deletion foreign-key action matrix.
- **PR #250:** exhaustive public-table RLS and security-definer `search_path` guard.
- **PR #252:** competition/viewer timezone seam with behaviour-preserving fallback.
- **PR #255:** TypeScript test project and corrected timezone fixtures.
- **PR #258:** Playwright/e2e, TypeScript tools and config coverage.
- **PR #261:** production-smoke coverage, explicit strictness and exhaustive committed TS/TSX project guard.
- **PR #264:** `checkJs` project for the three deploy-gate JavaScript files and measured deferred JavaScript inventory.
- **PR #265:** exhaustive public view and direct browser relation-grant guard.
- **PR #266:** repeatable disposable-local ACQ-R02 scale benchmark and evidence update; no risk closure or schema change.
- **PR #286:** hostile cross-season/reference before-state pgTAP.
- **PR #292:** lock monotonicity and per-fixture late-write before-state pgTAP.
- **Stage C1 contract boundary:** `stageC1ContractClassification.test.ts` makes the 49-assertion split executable; `stageC1NonInterference` freezes the current auth FK and ownership-RLS boundary.
- **Stage C1 schema overlay:** `stageC1SchemaOverlayCoverage.test.ts` proves all 35 current relations/view, four implemented C1 relations and 51 reviewed functions are dispositioned.

PRs #245 and #246 remain before-state controls. PR #252 is the application seam. The C1 migration must preserve PR #246 unchanged; C2 later replaces its expected after-state only after issue #272.

## Stage C implementation boundary

The original combined design remains in:

- [`../architecture/stage-c-competition-season-schema.md`](../architecture/stage-c-competition-season-schema.md);
- [`../architecture/stage-c-schema-coverage.md`](../architecture/stage-c-schema-coverage.md).

The accepted governance amendment [`../architecture/stage-c1-c2-governance.md`](../architecture/stage-c1-c2-governance.md) controls the split, [`../architecture/stage-c1-contract-classification.md`](../architecture/stage-c1-contract-classification.md) controls the assertion boundary, and [`../architecture/stage-c1-schema-overlay.md`](../architecture/stage-c1-schema-overlay.md) is the C1 implementation authority. C1 may implement competition-season identity, rounds, timezone, locks and same-season safeguards while preserving current auth ownership. C2 owns profile ownership, account erasure, pseudonymisation and related RLS and remains blocked.

One coherent C1 migration exist in PR #317 and pass disposable proof. No hosted schema operation is authorised.

## Open platform gaps

- Stage C1 migration review, recovery evidence and separately approved hosted rollout;
- independent data-protection review and later Stage C2 implementation;
- fixture/result ingestion and provider evidence;
- season Predictor, Last Man Standing and Cup implementations;
- cross-competition hub and weekly action surfaces;
- hosted/concurrent leaderboard performance evidence before a material cap increase;
- notification/client distribution;
- manual accessibility, legal, operations, load and public-launch proof;
- brand selection after Phase 0 discovery and before the closed cohort.

## Documentation authority

- Current facts: this file.
- Parent programme phases and gates: [`../architecture/programme-plan.md`](../architecture/programme-plan.md).
- Child engineering sequence: [`../architecture/multi-competition-hub-build-plan.md`](../architecture/multi-competition-hub-build-plan.md).
- Current position and next executable slice: [`../roadmap.md`](../roadmap.md).
- Stage C split: [`../architecture/stage-c1-c2-governance.md`](../architecture/stage-c1-c2-governance.md).
- Stage C assertion boundary: [`../architecture/stage-c1-contract-classification.md`](../architecture/stage-c1-contract-classification.md).
- Stage C1 implementation authority: [`../architecture/stage-c1-schema-overlay.md`](../architecture/stage-c1-schema-overlay.md).
- Detailed active/parked inventory: [`../../MASTER-TODO.md`](../../MASTER-TODO.md).
- Decisions: [`../adr/README.md`](../adr/README.md).
- Current risks and findings: [`risk-register.md`](risk-register.md).
- Scoring: [`../scoring-rules.md`](../scoring-rules.md).
- State architecture: [`../architecture-and-tournament-states.md`](../architecture-and-tournament-states.md).
- Operations: the relevant `docs/ops/` runbook.
- Dated reconciliations and audits: historical evidence only.
