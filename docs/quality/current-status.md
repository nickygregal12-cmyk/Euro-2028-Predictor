# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and freshly verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 30 July 2026

## Product position

The repository is a multi-competition football prediction platform in transition. Euro 2028 is the first recoverable competition baseline, not the endpoint of the programme.

- **user evidence:** [`../architecture/phase-0-world-cup-evidence.md`](../architecture/phase-0-world-cup-evidence.md) — owner observation of a live World Cup predictor with roughly 60 users across a full tournament. It is the only user evidence the programme holds, and it corrects six recorded planning assumptions;
- recoverable Euro baseline: `euro-2028-baseline` → `1fb8ffd36ad113079181829a8bcc47175c43b6da`;
- remaining Euro-specific work: parked in [`../../MASTER-TODO.md`](../../MASTER-TODO.md) until **January 2028**;
- product phases and gates: [`../architecture/programme-plan.md`](../architecture/programme-plan.md);
- engineering sequence: [`../architecture/multi-competition-hub-build-plan.md`](../architecture/multi-competition-hub-build-plan.md);
- current execution sequence: [`../roadmap.md`](../roadmap.md);
- platform decisions: [`../adr/0011-multi-competition-platform.md`](../adr/0011-multi-competition-platform.md) through [`../adr/0019-brand-decision-deferred.md`](../adr/0019-brand-decision-deferred.md).

## Repository and release baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Current `main` | Read it from git. A hand-copied SHA in a live-authority document is stale the next time anything merges, and this row held `ce17a7fd` through roughly twenty-five subsequent merges. Fixed anchors that do *not* move are the `euro-2028-baseline` tag and the dated per-PR rows below. |
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
| Stage C design baseline | **PR #236 merged** 30 July 2026. It approves the design and authorises pre-migration contract-test planning only; it does not authorise a Stage C migration |
| Stage C pre-migration contracts | **All seven landed.** TypeScript: `stageCRelationCoverage`, `stageCFunctionCoverage`, `stageCTriggerBindingCoverage`, `stageCTournamentIdCompatibility`, `stageCEuroSeedPreservation`. pgTAP: `031_stage_c_reference_scope_before_state.sql` (PR #286), `032_stage_c_lock_before_state.sql` (PR #292). Guarded by `tests/scripts/stageCContractInventory.test.ts` — adding an eighth without recording it here fails CI |
| Stage C remaining blocker | The data-protection review (issue #272). Roadmap step 4 is complete; step 3 is not, and it gates the migration |
| Cup winner deletion semantics | PR #271 → contract **64**. Not a Stage C migration; an independent declaration of an omitted `on delete` action, applied to development and owner-verified |
| Production posture | Controlled pre-launch target; no development or simulation write path may target production |

## Hosted evidence boundary

This status includes fresh read-only GitHub and Netlify inspection and limited read-only development Supabase catalogue inspection. It does **not** refresh canonical hosted migration applied-state, target privileges, production data or preservation counts.

The development Supabase inspection was limited to project identity/version and catalogue metadata: public relations, columns, constraints, triggers, RLS policies and function definitions. No application rows or personal data were read, and no database write was performed.

| Target | Current evidence | Fresh check required |
| --- | --- | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | healthy Postgres 17; read-only catalogue showed 34 RLS-enabled public tables plus `entry_totals` and the current validator/function graph. **Contract 64 applied and owner-verified on 30 July 2026**: `bonus_cup_fixtures_winner_user_id_fkey` returns `confdeltype = r`, `condeferrable = false`. Behaviour-preserving — the same delete was measured to fail identically at contract 63 and 64 on a local PostgreSQL 16 cluster built from the committed migrations, naming the same constraint. | **REQUIRES OWNER VERIFICATION:** canonical applied-state and privilege queries before relying on hosted alignment or applying a migration. Development is now one contract ahead of production, which remains at 63 |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | owner-verified at contract 63 on 29 July 2026 with preserved-data postflight; not freshly inspected here | **REQUIRES OWNER VERIFICATION:** read-only applied-state, privilege and preservation checks before any write |
| Production Netlify `main` | ready deploy `6a6b84f20937ff0008c07ccd` from exact commit `ce17a7fd5e7270ec11f053e3d2cd5b43fe5c8cab`, published 30 July 2026; 35 redirects and one header rule processed; no secret-scan matches. **Production deploys are paused from contract 64 onward** — the repository requires 64, production Supabase is at 63, and the prebuild contract gate refuses the build. The last good deploy stays live, so this is a paused pipeline rather than an outage. Owner-accepted on 30 July 2026 | clears when production Supabase receives the migration and the `production` context sets `EURO28_DEPLOYED_DB_CONTRACT=64`; rerun exact-origin smoke before a production-risk milestone |
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
| Timezone authority | **Seam landed; season value absent.** PR #252 separates `competitionTimeZone` from `viewerTimeZone`, but adapters still fall back to the viewer until Stage C supplies `tournaments.display_timezone`. |
| Timezone positive control | **Corrected.** PR #255 uses real `lockScopes` and the real `competitionTimeZone` config field. |
| Account deletion | **Unsafe current behaviour, fully characterised.** Competitive rows still use mixed cascade/restrict/set-null/no-action references to `auth.users`; PR #246 pins the before-state but does not fix it. |
| TypeScript/static coverage | **Exhaustive for committed TS/TSX.** PRs #255, #258 and #261 cover application, tests, e2e, production-smoke, tools and configs; PR #261 guards future files and states strictness explicitly. |
| Deploy-gate JavaScript | **Type-checked.** PR #264 covers the three production-decision gates; remaining JavaScript files are measured in an explicit deferred inventory. |
| Leaderboard scale | **Measured, not redesigned.** PR #266 confirms full-field aggregation cost scales with `score_events`; about 35 ms/page at the enforced 250-entry synthetic case and about 652 ms mean at 5,000 entries/300,000 events. ACQ-R02 remains open; hosted concurrency is untested and no materialised standings table exists. |
| Stage C | **Design complete for review; implementation not started.** Draft PR #236 defines the proposed schema and exhaustive current-object coverage without SQL. |
| Public launch readiness | **Not ready.** Domestic-season implementation, ingestion, operations, accessibility, legal/client and brand gates remain. |
| Production mutation | **Prohibited without explicit owner approval and the full milestone process.** |

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

PRs #245 and #246 remain the before-state controls. PR #252 is the application seam. PRs #250, #255, #258, #261, #264 and #265 are preservation invariants. None supplies the Stage C schema or completes the timezone/deletion design.

## Stage C — competition-season schema design

Draft PR #236 contains:

- `docs/architecture/stage-c-competition-season-schema.md`;
- `docs/architecture/stage-c-schema-coverage.md`;
- the architecture index update.

It proposes one evolved shared model rather than parallel tournament/season tables; composite competition-season safeguards; explicit rounds and monotonic lock evidence; `profiles` as the durable pseudonymisable competitive anchor; a persisted competition timezone wired through the landed seam; and preservation/hostile-cross-season evidence.

No migration exists and no hosted schema operation is authorised. Design approval authorises pre-migration contract-test planning only.

## Open platform gaps

- reviewed and implemented competition-season schema;
- data-protection review for auth erasure versus pseudonymised competitive history;
- fixture/result ingestion and provider evidence;
- season Predictor, Last Man Standing and Cup implementations;
- cross-competition hub and weekly action surfaces;
- hosted/concurrent leaderboard performance evidence before a material cap increase;
- notification/client distribution;
- manual accessibility, legal, operations, load and public-launch proof;
- brand clearance and close-season product decision.

## Documentation authority

- Current facts: this file.
- Parent programme phases and gates: [`../architecture/programme-plan.md`](../architecture/programme-plan.md).
- Child engineering sequence: [`../architecture/multi-competition-hub-build-plan.md`](../architecture/multi-competition-hub-build-plan.md).
- Current position and next executable slice: [`../roadmap.md`](../roadmap.md).
- Detailed active/parked inventory: [`../../MASTER-TODO.md`](../../MASTER-TODO.md).
- Decisions: [`../adr/README.md`](../adr/README.md).
- Current risks and findings: [`risk-register.md`](risk-register.md).
- Scoring: [`../scoring-rules.md`](../scoring-rules.md).
- State architecture: [`../architecture-and-tournament-states.md`](../architecture-and-tournament-states.md).
- Operations: the relevant `docs/ops/` runbook.
- Dated reconciliations and audits: historical evidence only.