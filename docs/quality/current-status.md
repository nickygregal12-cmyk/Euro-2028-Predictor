# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and freshly verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 4 August 2026

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
| Repository contract | **101** — 101 canonical migrations through `20260804293000_cup_split_stage_persistence.sql`. Development Supabase is hosted at **97**, applied 4 August 2026 by fast-lane run 30931550512 on `381e2d0`; production remains at **63**. Development trails the repository by four contracts until 98–101 are rolled out. Contract 87 is the first in this run to remove a database guarantee rather than only add one — it drops `bonus_lms_selections`' cycle-blind club key and replaces it with one scoped to `used_cycle` — and its rollout did carry the `structural` line the widened additive gate now emits, naming `drop constraint` rather than passing it in silence. Non-production Netlify contexts declare `EURO28_DEPLOYED_DB_CONTRACT=97` as of 4 August 2026, which now trails the repository again — the ordinary cycle, and previews will say so until 98–101 are rolled out and the declaration follows — **owner-reported, with no repository-side read path to confirm it** ([`../ops/ops-pending-migrations.md`](../ops/ops-pending-migrations.md) records which build-log line corroborates which value) — while production keeps its 63 declaration and the fatal contract gate. |
| Target design authority | **Added 4 August 2026.** [`../design/README.md`](../design/README.md) indexes the *Hub Architecture and Modernisation Plan* rev 1.5 and its landing-page prototype — what the product should look like when finished. Presentation and delivery only: it changes no scoring, lock, membership, settlement or visibility rule. **Its baseline is contract 93**, so Appendix D.2's reconciliation list predates contracts 94–101 and must be checked against this document before being treated as outstanding. The prototype's light theme inherited dark-tuned semantic colours and failed WCAG AA at 1.3–2.2:1; corrected and guarded by `tests/design/landingPrototypeContract.test.ts` |
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
| ADR 0022 Cup rescoping — **complete at contract 98** | The rescoping ADR 0022 (as corrected) directs was finished in four steps, and the last one was not where the record implied. Contracts 75, 76 and 77 neutralised `predictor_internal.cup_*`, and contract 76 recorded that **no function in the shared Cup machinery reads a tournament relation**. That was true and narrower than it sounded: it was a statement about `predictor_internal`, and the RPC layer above it had never been checked. Three functions there — `admin_settle_predictor_cup_round`, `submit_cup_penalty_number` and `get_my_cup` — still joined `bonus_window_fixtures` to `matches` for the two facts the Penalty Number rule (§8.3) needs. **For a season Cup that was not a gap but two defects**: the Penalty Number target would have summed to **zero**, silently making a guess of 0 exactly right and handing the tie to whoever guessed lowest, and the lock instant came back null so `submit_cup_penalty_number` refused every season submission with "This round's real fixtures are not scheduled yet". Contract 98 puts both behind a tournament limb, a season limb and a neutral combiner — the shape contracts 75–77 established, unioned rather than branched on competition kind. Evidence: a differential sweep over **700 generated windows** (300 tournament, 300 season, 100 carrying both) with zero divergence, against the replaced expressions reproduced inline; five sweep mutants killed at 340, 150, 100 and 281 mismatches, and `supabase/tests/149_cup_neutral_window_match_facts.sql` (23 assertions) with five further mutants killed. **Two things this deliberately did not settle**, both recorded rather than guessed: `get_my_cup(p_tournament_id)` still picks "the" published Cup for a competition with a bare `select … into` — no uniqueness constraint exists and ADR 0014 has private Cups alongside the public one, so in a season that returns an arbitrary row, and deciding which Cup a player sees is a product decision for the Cup surface; and `admin_draw_predictor_cup` still hardcodes the tournament's format (groups of three and four across three windows), which is the split-execution slice waiting on the `bonus_cup_fixtures_group_shape` decision. **One correction made in the writing:** the migration first justified its `status = 'played'` filter on abandoned season fixtures carrying the score they had reached. `season_fixtures_scores_match_status` (contract 68) makes carrying a score exactly equivalent to being `played`, so that was wrong and the filter is redundant — a sweep mutant removing it is equivalent. It is kept as intent and documented as redundant rather than counted as coverage |
| ADR 0022 | Merged 3 August 2026 (PR #383), **corrected the same day** (PR #384). Supplies the three LMS presets ADR 0013 mandated but left undefined, and the 100-entrant public Cup threshold ADR 0014 left open — both now executable. Its Cup-machinery decision was corrected on two wrong premises: there is no live entrant history, and the machinery is PostgreSQL (`predictor_internal.cup_*`) rather than TypeScript, so nothing in `src/domain` was extractable and ADR 0011's separation law was never at risk |
| ADR 0025 | **Accepted 4 August 2026.** Settles the four questions that were blocking forward work, all on owner decision. **(1) LMS `restart_all_reentered`** creates a NEW competition row rather than wiping the existing one — reuse would destroy the completed competition's picks, elimination history and audit trail — behind a separate idempotent lifecycle function under an advisory lock, with settlement continuing only to derive and report. Its prerequisite is the larger half: `bonus_competitions` currently conflates **game availability** with **competition instance**, and `unique (tournament_id, game_key)` cannot express a repeating competition, so that must be separated rather than merely relaxed. **(2) The Cup split is a distinct persisted stage** (`stage = 'split'`), with `phase_kind` and `parent_group_id` on groups, phase-aware membership so an entrant holds both an initial and a split membership, original memberships preserved permanently, `matchday` continuing as the overall Cup round number, and standings **derived** across both phases rather than copied into a starting total. Contract 79 was right not to widen `stage` first. **(3) Both tournament-path defects are corrected now** rather than deferred because production shares the structures; production promotion stays separately controlled. **The precondition audit ran on 4 August 2026 against development and production: `entry_automatic_submission_outcomes` is empty in both**, so no immutable audit row needs preserving and the corrected CHECK can be added fully validated. REL-001 takes a transaction-scoped advisory lock keyed by tournament id, blocking rather than try-lock, and closes independently of `DEC-009`. **(4) Appendix D.2 and contract 95 are different scopes with no conflict.** D.2 is Euro Original Predictor post-lock entry/profile reveal; contract 95 is the season Main Predictor leaderboard, gated on holding an `entries` row in that season and never on co-membership. Contract 95 is unchanged, the obsolete gates come out of the Euro post-lock RPCs only, and D.2's own text now records the boundary |
| Tournament-path defects — **both closed at contracts 99 and 100** | ADR 0025 decision 3, built 4 August 2026. **Contract 99** replaces the `entry_automatic_submission_outcomes` CHECK. Its refusal branch ended in `char_length(btrim(failure_message)) between 1 and 500`; with a null message that whole expression is NULL, and **a CHECK rejects only FALSE**, so the constraint that exists to guarantee every refusal explains itself accepted a refusal explaining nothing — on a table whose rows are immutable, where such a row could never afterwards be corrected. The fix is an explicit `failure_message is not null`, because a tighter bound cannot close a hole NULL walks through, and the constraint is renamed from its generated `_check` to `_outcome_shape`. **The ADR's precondition audit ran read-only against both hosted projects and found the table empty in each**, so no historical exception exists and it is added fully validated rather than NOT VALID. **Contract 100** closes REL-001, and the interesting part is where it was still open. `recompute_tournament_scores` already took `pg_advisory_xact_lock(hashtextextended(tournament_id::text, 0))` — which is why the 23 July audit could call REL-001 "materially addressed" and leave it Open. But confirming a result fires **two** after-row triggers on `matches`, and **PostgreSQL fires after-row triggers in name order**: `recompute_bonus_scores_on_result` sorts before `recompute_scores_on_result`, so the Bonus Games delete-and-rederive (`recompute_ko_predictor_for_match`, deleting and re-inserting `bonus_score_events`, then `recompute_lms_for_tournament`) ran **first, in full, holding no lock at all**. The lock being present on the loudest path is what made the quiet path easy to miss. Both functions now take the same transaction-scoped lock on the same key, **placed inside the functions rather than in the trigger**, so the guarantee does not depend on trigger firing order — the exact property that made the defect reachable. Evidence is a two-session probe: at contract 98 the second session was NOT blocked (defect reproduced); at contract 100 it blocks, a different tournament proceeds, the Bonus and Original paths block **each other** on the one key, rollback leaves zero advisory locks, and no session-scoped lock exists anywhere. `supabase/tests/150_tournament_path_defects.sql` holds 21 assertions with four mutants killed at 5, 4, 3 and 3 failures |
| Cup split-stage persistence — **contract 101** | ADR 0025 decision 2, built 4 August 2026. The split is now `stage = 'split'`, a distinct persisted stage rather than a group stage under another label — the thing contract 79 deliberately stopped short of, because a split round needs both `group_id` and `matchday` and the old shape constraint forbade a non-group stage from carrying either. `bonus_cup_groups` gains `phase_kind` and `parent_group_id`; both defaulted, so every hosted row keeps its meaning without being rewritten. Ordinal uniqueness becomes per phase, so the halves start a fresh sequence instead of continuing the league numbering. A **chain is unrepresentable rather than merely refused**: `parent_phase_kind` is a generated column that can only hold `'initial'` or NULL, and a composite FK then makes "parent is an initial group in this competition" a key lookup — a split half cannot parent another because its phase is not `'initial'`. `matchday` keeps counting past the league phase, per the ADR. **One deliberate departure from the shape ADR 0025 lists first, which the ADR permits:** split membership goes in a new `bonus_cup_split_members` rather than widening `bonus_cup_members`' `(competition_id, user_id)` key. Sixteen readers select on that key expecting one row, several through `select … into`; widening it would leave all of them correct *today* — every existing row is initial-phase — and silently turn them into arbitrary-row reads the moment the first split row is written, with no failing test at the point the hazard was introduced. That is the same defect shape found in `get_my_cup` at contract 98 and the bonus rederive functions at contract 100, and a separate relation cannot express it. It also preserves the original memberships by construction: nothing in contract 101 writes to `bonus_cup_members`. Evidence: `supabase/tests/151_cup_split_stage_persistence.sql`, 25 assertions, five mutants killed. **The tournament path was proven unchanged by execution rather than inspection** — a real `admin_draw_predictor_cup` run on contract 100 and on contract 101 wrote byte-identical groups, draw numbers, pairings and matchdays, and zero split rows. **Not yet done, and deliberately separate:** standings derived across both phases. ADR 0025 requires continuing standings to be derived from initial and split fixtures rather than copied into a starting total; that is a change to the ranking functions, not to storage, and it lands next |
| Next executable issue | **Remaining ADR 0025 work, in order:** standings derived across both Cup phases (the other half of decision 2), the Euro post-lock reveal gate removal (decision 4's code half), and last the LMS restart lifecycle — last because it needs `bonus_competitions`' availability/instance split first, which is the largest single piece outstanding. Contracts 98–101 all await a development fast-lane run. Every contract still merges only with exact-head CI, Database parity, Browser E2E, hosted-inventory and protected Netlify preview evidence, and reaches Development only through the ADR-0024 fast lane with the required confirmation phrase and postflight proof. No provider credential, provider request, Edge Function deployment, C2 work or production write is authorised by repository inclusion. |
| Cup winner deletion semantics | PR #271 → contract **64**. Not a Stage C migration; an independent declaration of an omitted `on delete` action, applied to development and owner-verified |
| Production posture | Controlled pre-launch target; production remains contract 63 and deploys stay paused until an intentional release milestone |

## Hosted evidence boundary

This status includes fresh read-only GitHub and Netlify inspection and limited read-only development Supabase catalogue inspection. It does **not** refresh canonical hosted migration applied-state, target privileges, production data or preservation counts.

The development Supabase inspection was limited to project identity/version and catalogue metadata. No application rows or personal data were read, and no database write was performed.

| Target | Current evidence | Fresh check required |
| --- | --- | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | healthy Postgres 17. **Contract 65 applied 2 August 2026** through the guarded rollout: prepare run 30771110879 (preflight, encrypted backup, source-equivalent restore rehearsal against the db-only disposable container, one-migration dry run) and apply run 30771280887. Postflight equivalence verified 3 August 2026: canonical postflight DO block passes on hosted; audit digest and all 34 preservation counts identical; Euro identity, auth FK matrix, ownership policies, browser grants, RLS state and trigger bindings byte-identical; the single delta is the migration's own authored `enforce_joker_rules` search-path pinning, accepted by the PR #368 comparator allowance in the hardening direction only. Rollout tooling hardened along the way in PRs #359–#367. **Contract 66 applied 3 August 2026** through the ADR 0024 development fast lane, run 30837677979: dispatch guards (main-only, exact `origin/main`, clean checkout, confirmation phrase, production ref refused by name), secret preflight proving the development URL resolves to `iouzoutneyjpugbbtdem`, the pending migration proven additive by `scripts/check-migration-additive.mjs`, a lightweight pre-apply schema and data snapshot retained as run evidence, then `supabase db push`. Postflight confirmed no migrations remain unapplied and reported `Development is at contract 66.` | Contract 96 is pending. Apply contracts 94–96 only after merge through `.github/workflows/development-fast-lane-rollout.yml`, requiring additive proof, the lightweight snapshot and postflight `Development is at contract 96.` |
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
| Provider custody | **Repository candidate complete at contract 96.** Raw-before-decode custody and processing evidence exist without giving provider data official-state authority. |
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

**This heading is now only partly true, and the part that changed is stated here rather than by rewriting the title.** As landed on 3 August 2026 nothing persisted, mirrored or rendered any of it. Contracts 68–96 have since given two of the three games a database and one of them a reader:

| Game | Persistence | Driven by | Read by a browser |
| --- | --- | --- | --- |
| Main Predictor | fixtures, predictions, cards, the lock ledger, and from contract 90 `season_matchweek_scores` | contract 93's hourly scoring job, over contract 91's settlement parity and contract 92's replay link; contract 94 ranks the result | contract 95's `get_season_leaderboard`, exercised by `/dev/season-leaderboard` |
| Last Man Standing | selections, windows, entrant state | contract 89's hourly settlement job, with contract 88's lock-time auto-assignment | no |
| Predictor Cup | Cup stores and neutral sources (contracts 74–79) | **nothing** — `select_season_cup_format`, `settle_season_cup_tie`, `resolve_public_cup_launch` and `cup_league_schedule` all have zero call sites and zero trigger bindings | no |

### TypeScript/PostgreSQL parity coverage

ADR 0012 requires it for season scoring and ADR 0022 requires it for the Cup. Current state, by module:

| Module | SQL counterpart | Parity suite |
| --- | --- | --- |
| `scoring` | yes | yes |
| `standings` | contract 94 | yes |
| `matchweekSettlement` | contract 91 | yes |
| `cardSubmission` | yes | yes (contract 96 run) |
| `lmsEligibility` | contract 84 | yes |
| `lmsRoundResolution` | yes | yes (contract 96 run) |
| `cupFormat` | contract 74 | yes (contract 96) |
| `cupTieSettlement` | contract 74 | yes (contract 96) |
| `cupLaunch` | contract 74 | yes (contract 96) |
| `cupSchedule` | yes | yes |
| `cupGroupTable` | yes | yes |
| `lmsPresets` | **none** | not applicable until one exists |
| `fixtureReassignment` | **none** | not applicable until one exists |

Building the Cup suite discharged the gap ADR 0022 names in terms — *"those modules require TypeScript/PostgreSQL parity coverage under `tests/database-parity/` … No such Cup parity suite exists yet"* — and immediately found a real drift: `settleCupTie` and `settle_season_cup_tie` disagreed on 40 of 1200 randomised ties about WHICH fault to report. Contract 96 corrected both sides. Neither had ever mis-settled a tie; the pair had simply never been compared, because nothing drives either of them and an unused pair cannot fail loudly.

**What is still true of all three games:** no product surface renders any of it. `/dev/season-leaderboard` reads a real season table from a real database and is DEV-only by design, with no navigation pointing at it. A player still cannot see a season score in the application.

### The Predictor Cup is rules without a driver, and the next step is not what it looks like

Four season Cup authorities have zero call sites and zero trigger bindings:
`select_season_cup_format`, `settle_season_cup_tie`, `resolve_public_cup_launch`
and `cup_league_schedule`. A Cup cannot currently be launched, drawn, scheduled
or settled by anything.

The tempting next step — write season Cup drivers — is **the wrong one, and
ADR 0022 says so**. Its owner-verified correction of 3 August 2026 records that
the qualification, seeding, group-finalisation, bracket and draw machinery is
already implemented in PostgreSQL for the tournament, behind
`admin_draw_predictor_cup`, `admin_finalise_predictor_cup_groups` and
`admin_settle_predictor_cup_round`, and that:

> "sharing happens **in the database**. The existing `predictor_internal.cup_*`
> functions are generalised from tournament scope to competition-season scope,
> so one implementation serves both, rather than a second season-specific set
> being written."

So the Cup's remaining work is a **behaviour-preserving rescoping** of existing
tournament functions, sequenced after C1b (contract 66, long landed), under the
explicit constraint that no qualification, seeding, bye, playoff-pairing or
Penalty Number rule may change while it happens. Contracts 75, 76 and 77 already
did exactly this for `cup_window_scores` and `cup_window_settled` — splitting a
tournament source from shared arithmetic and unioning a season source — so the
pattern is established and partly executed. What remains is `cup_seed_group`,
`cup_bracket_order`, `cup_final_group_tables` and the three admin RPCs.

The other obligation that record names is now discharged: *"those modules require
TypeScript/PostgreSQL parity coverage under `tests/database-parity/` … No such
Cup parity suite exists yet."* Contract 96 built it, and it found a real drift
within the hour.

**Deliberately not built, for want of authority:** `maxRemainingPoints` generalisation to a rolling season context (ADR 0012 names the consequence but not the semantics), and any season Cup qualification, seeding or bracket implementation (ADR 0022 as corrected: that machinery is SQL, and rescoping it follows C1b).

## Provider-ingestion authority boundary

Contract 96 is custody, not promotion:

- the Edge Function accepts only named, fixed providers and bounded relative paths;
- the caller key is checked before any provider I/O;
- exact raw response text is archived before parse or strict decode;
- processing attempts are append-only evidence;
- browser roles receive no relation or RPC access;
- safe response headers are allowlisted and response size is bounded;
- credential-shaped query parameters are rejected;
- no provider path may write official fixtures, results, lock state, points, totals, ranks or standings.

The Edge Function remains undeployed and no provider credential or request is part of contract 96 delivery.

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
