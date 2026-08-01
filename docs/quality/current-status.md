# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and freshly verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 1 August 2026

## Product position

The repository is a multi-competition football prediction platform in transition. Euro 2028 is the first recoverable competition baseline, not the endpoint of the programme.

The visible product is now the **Football Prediction Hub**: `/` is the authenticated hub with My competitions and Discover, competitions have stable season routes, and the Euro dashboard sits behind `/competitions/euro/2028/original` with its scoring and stored data unchanged. Landed by PR #346 on 1 August 2026. The join and leave controls on those surfaces are non-persistent placeholders until Stage C1b supplies membership.

- **user evidence:** [`../architecture/phase-0-world-cup-evidence.md`](../architecture/phase-0-world-cup-evidence.md) — owner observation of a live World Cup predictor with roughly 60 users across a full tournament. It is the only user evidence the programme holds, and it corrects six recorded planning assumptions;
- recoverable Euro baseline: `euro-2028-baseline` → `1fb8ffd36ad113079181829a8bcc47175c43b6da`;
- remaining Euro-specific work: parked in [`../../MASTER-TODO.md`](../../MASTER-TODO.md) until **January 2028**;
- product phases and gates: [`../architecture/programme-plan.md`](../architecture/programme-plan.md);
- engineering sequence: [`../architecture/multi-competition-hub-build-plan.md`](../architecture/multi-competition-hub-build-plan.md);
- current execution sequence: [`../roadmap.md`](../roadmap.md);
- platform decisions: [`../adr/0011-multi-competition-platform.md`](../adr/0011-multi-competition-platform.md) through [`../adr/0020-football-prediction-hub-product-model.md`](../adr/0020-football-prediction-hub-product-model.md);
- **domestic rule authority:** ADR 0020 amends five named rules in ADRs 0011–0014 — Joker count, Joker unit, post-lock postponement, lock-policy ownership and Predictor Championship entry close. Its reconciliation table is the list; everything not named there stays authoritative in its original record. Read ADR 0020 before implementing any domestic game rule.

## Repository and release baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Current `main` | Read it from git. A hand-copied SHA in a live-authority document is stale the next time anything merges. Fixed anchors that do not move are the `euro-2028-baseline` tag and dated per-PR evidence. |
| Repository contract | **64** canonical migrations through `20260730180000_cup_winner_deletion_semantics.sql` |
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
| Stage C database contracts | Seven original suites plus `stageC1NonInterference`: TypeScript `stageCRelationCoverage`, `stageCFunctionCoverage`, `stageCTriggerBindingCoverage`, `stageCTournamentIdCompatibility`, `stageCEuroSeedPreservation`, `stageC1NonInterference`; pgTAP `031_stage_c_reference_scope_before_state.sql` and `032_stage_c_lock_before_state.sql`. Inventory guarded by `stageCContractInventory.test.ts` |
| Next executable issue | **#303 — exact C1 migration planning and disposable proof.** No C2 work belongs in that issue and no hosted write is authorised |
| Cup winner deletion semantics | PR #271 → contract **64**. Not a Stage C migration; an independent declaration of an omitted `on delete` action, applied to development and owner-verified |
| Production posture | Controlled pre-launch target; production remains contract 63 and deploys stay paused until an intentional release milestone |

## Hosted evidence boundary

This status includes fresh read-only GitHub and Netlify inspection and limited read-only development Supabase catalogue inspection. It does **not** refresh canonical hosted migration applied-state, target privileges, production data or preservation counts.

The development Supabase inspection was limited to project identity/version and catalogue metadata. No application rows or personal data were read, and no database write was performed.

| Target | Current evidence | Fresh check required |
| --- | --- | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | healthy Postgres 17. **Contract 64 applied and owner-verified on 30 July 2026**. | **REQUIRES OWNER VERIFICATION:** canonical applied-state and privilege queries before relying on hosted alignment or applying a migration. Development is one contract ahead of production. |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | owner-verified at contract 63 on 29 July 2026 with preserved-data postflight; not freshly inspected here | **REQUIRES OWNER VERIFICATION:** read-only applied-state, privilege and preservation checks before any write |
| Production Netlify `main` | last good ready deploy remains live. **Production deploys are paused from contract 64 onward** because the repository requires 64 while production Supabase remains 63. This is a paused pipeline, not an outage. | Keep paused until an intentional migration/release milestone with exact-origin smoke and owner approval; do not promote merely to equalise contract numbers |
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
| Timezone authority | **Seam landed; persistence belongs to C1.** PR #252 separates `competitionTimeZone` from `viewerTimeZone`, but adapters still fall back to the viewer until C1 supplies `tournaments.display_timezone`. |
| Account deletion | **Unsafe current behaviour, fully characterised and owned by C2.** PR #246 pins the before-state. C1 has executable non-interference and overlay guards preventing ownership/deletion changes; issue #272 remains the blocker. |
| TypeScript/static coverage | **Exhaustive for committed TS/TSX.** PRs #255, #258 and #261 cover application, tests, e2e, production-smoke, tools and configs. |
| Deploy-gate JavaScript | **Type-checked.** PR #264 covers the three production-decision gates; the remaining JavaScript inventory is explicit. |
| Leaderboard scale | **Measured, not redesigned.** ACQ-R02 remains open; hosted concurrency is untested and no materialised standings table exists. |
| Football Prediction Hub shell | **Landed (PR #346).** Hub root, My competitions/Discover, competition-season routes and a reusable competition dashboard. The competition catalogue is a static placeholder and membership does not persist. |
| Domestic rule authority | **Reconciled (PR #346).** ADR 0020 amends five named rules in ADRs 0011–0014 and states what is unchanged. No contradictory ADR pair remains live. |
| Game-owned lock policy | **Not started, and a prerequisite for the domestic Main Predictor.** `src/domain/competition/kinds.ts` pins `bufferMinutes` to the competition — exactly 30 for `league_season`, enforced by `isLeagueSeasonCompetitionConfig`. ADR 0020 moves buffer and scope to the game so Main Predictor (0) and LMS (30) can differ inside one competition. |
| Stage C1 | **Migration drafted and proven on disposable infrastructure (PR #317); not merged, and blocked.** Two defects found on 1 August 2026: the PostgREST embed row below, now fixed on the branch, and the irreversible entry lock below, which is unresolved and needs an owner decision. `ci` and `local-supabase` pass; the authenticated browser suite went from 37 failures to 6. No hosted write exists or is authorised. |
| Entry lock became irreversible | **Open defect in PR #317; blocks its merge.** The migration's rewritten `enforce_entry_lock_generic` treats the existence of a `competition_lock_events` row as a lock, independently of `tournaments.lock_at`. `record_tournament_lock_transition` writes that row the first time a lock instant passes, the table is append-only with `prevent_lock_event_mutation` refusing both `delete` and `update`, and no administrative clear function exists. A tournament whose `lock_at` has *ever* been in the past is therefore locked permanently: restoring `lock_at` to the future leaves prediction writes rejected with `23514`, reproduced locally at contract 65 with `lock_at` 30 days ahead. This is what the remaining six browser failures are. It also contradicts the audited admin override in ADR 0020, and exceeds this migration's own approved scope — issue #303 authorises lock-transition **evidence**, and [`stage-c1-schema-overlay.md`](../architecture/stage-c1-schema-overlay.md) dispositions the table as an "internal append-only observed lock transition" with no browser authority, not as an enforcement input. |
| PostgREST embeds under composite keys | **Guarded.** The C1 migration creates a second foreign key for 39 child/parent pairs, which made the one unqualified embed in the codebase fail with `PGRST201` and took out 37 authenticated browser journeys. Fixed by naming the key; `postgrestEmbedDisambiguation.test.ts` now requires every embed to name its key. Stage C1b adds further composite keys, so this stays load-bearing. |
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

These are evidence for the first competition. They do not imply that season rules, season scoping or multi-competition surfaces already exist.

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
- **Stage C1 schema overlay:** `stageC1SchemaOverlayCoverage.test.ts` proves all 35 current relations/view, four proposed C1 relations and 51 reviewed functions are dispositioned.

PRs #245 and #246 remain before-state controls. PR #252 is the application seam. The C1 migration must preserve PR #246 unchanged; C2 later replaces its expected after-state only after issue #272.

## Stage C implementation boundary

The original combined design remains in:

- [`../architecture/stage-c-competition-season-schema.md`](../architecture/stage-c-competition-season-schema.md);
- [`../architecture/stage-c-schema-coverage.md`](../architecture/stage-c-schema-coverage.md).

The accepted governance amendment [`../architecture/stage-c1-c2-governance.md`](../architecture/stage-c1-c2-governance.md) controls the split, [`../architecture/stage-c1-contract-classification.md`](../architecture/stage-c1-contract-classification.md) controls the assertion boundary, and [`../architecture/stage-c1-schema-overlay.md`](../architecture/stage-c1-schema-overlay.md) is the C1 implementation authority. C1 may implement competition-season identity, rounds, timezone, locks and same-season safeguards while preserving current auth ownership. C2 owns profile ownership, account erasure, pseudonymisation and related RLS and remains blocked.

No migration exists and no hosted schema operation is authorised.

## Open platform gaps

- Stage C1 migration merge, then Stage C1b competition/game membership persistence;
- game-owned lock policy, replacing the competition-level `bufferMinutes`;
- the competition slug the C1 migration derives for Euro (`uefa-euro`) does not match the hub route slug (`euro`); reconcile before the hub reads real competition records;
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
