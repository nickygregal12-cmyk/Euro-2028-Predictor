# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and freshly verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 30 July 2026 (revised after the Stage B merge)

## Product position

The repository is a multi-competition prediction platform in transition. The completed Euro 2028 tournament product is the first recoverable competition baseline, not the endpoint of the forward programme.

- the annotated `euro-2028-baseline` tag resolves to `1fb8ffd36ad113079181829a8bcc47175c43b6da`;
- the remaining Euro 2028 scope is parked in [`../../MASTER-TODO.md`](../../MASTER-TODO.md);
- the scheduled return date is **January 2028**;
- product phases and gates are in [`../architecture/programme-plan.md`](../architecture/programme-plan.md);
- engineering sequencing is in [`../architecture/multi-competition-hub-build-plan.md`](../architecture/multi-competition-hub-build-plan.md);
- the thin current-position roadmap is [`../roadmap.md`](../roadmap.md);
- platform decisions are governed by [`../adr/0011-multi-competition-platform.md`](../adr/0011-multi-competition-platform.md) through [`../adr/0018-pre-launch-promotion-cadence.md`](../adr/0018-pre-launch-promotion-cadence.md).

## Repository baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Recoverable Euro baseline | `euro-2028-baseline` → `1fb8ffd36ad113079181829a8bcc47175c43b6da` |
| Application/database contract at the tag | 63 canonical migrations through `20260729154931_prediction_consensus_minimum_cohort.sql` |
| Forward architecture | ADRs 0011–0018 plus the parent programme and child engineering workstream |
| Current development position | Stage B complete and merged to clean `main`. PR #226 was intentionally merged by the owner on 30 July 2026 as [`2648540`](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/commit/2648540), carrying Matches, Match Centre, entry lock and the `MatchTemporalState` retirement onto the merged foundation/Home work |
| Next engineering stage | Stage C competition-season schema. Its Stage B precondition is now met, so Stage C design is authorised; implementation still requires the applicable migration approval and preflight process |
| Production posture | Controlled pre-launch target; no development or simulation write path is permitted |

## Hosted evidence boundary

This documentation task had **no fresh Supabase or Netlify inspection**. Hosted statements below are the last owner-verified repository record from **29 July 2026**, not fresh inspection. Run the named target checks again before operational reliance.

| Target | Last recorded state | Fresh check required |
| --- | --- | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | owner-verified at contract 63 on 29 July 2026 | **REQUIRES OWNER VERIFICATION:** run the canonical applied-state and privilege queries |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | owner-verified at contract 63 on 29 July 2026 with preserved-data postflight | **REQUIRES OWNER VERIFICATION:** run read-only applied-state, privilege and preservation checks before any write |
| Netlify contexts | owner-verified on 29 July 2026 as contract 63 with development/production Supabase separation | **REQUIRES OWNER VERIFICATION:** inspect each context's release identity and environment |
| Published production application | owner-verified deploy `6a6a53af58a0a500096b7cb1` from `ff633396e04eca77ed4456c5537ab361d9d259ee`, published 29 July 2026 | **REQUIRES OWNER VERIFICATION:** fetch `/release.json` and run exact-origin smoke |
| Production data/recovery | owner-verified preserved counts and same-day encrypted contract-60 backup/restore evidence on 29 July 2026 | **REQUIRES OWNER VERIFICATION:** take a fresh backup/restore proof before a data-risk milestone |

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Euro 2028 baseline | **Tagged and recoverable.** Product work through contract 63 is preserved at `euro-2028-baseline`. |
| Euro 2028 forward work | **Parked.** Remaining tournament data, presentation, rehearsal and release items return in January 2028. |
| Platform direction | **Established by ADRs 0011–0018.** Forward documents and agent framing are aligned to the multi-competition programme. |
| Context engine | **Merged on `main`.** `src/domain/competition/` provides `context.ts`, `kinds.ts`, `lockState.ts` and `matchState.ts`, and Home, Matches, Match Centre and entry lock all consume it. |
| Stage B exit | **Met.** The shared engine owns every migrated surface's timing decisions on `main`, and `MatchTemporalState` no longer appears anywhere under `src/`. |
| Preview evidence | **Exact PR preview verified for the integration candidate before merge.** The Netlify preview-identity blocker recorded on PRs #209, #216 and #222–#224 did not recur on later pull requests. |
| Automated control coverage | **Extended on 30 July 2026 by PRs #228, #229, #232, #233 and #235.** Production guard expectations, the deployment-contract RPC allow-list, the Supabase browser key, the Content-Security-Policy, the `VITE_*` surface and five TypeScript/PostgreSQL value mirrors are now enforced rather than declared. |
| Contract alignment | **Last owner-verified at 63 on 29 July 2026; fresh hosted verification required before reliance.** |
| Recovery and preservation | **Historical evidence exists; refresh at the next production-risk milestone.** |
| Bonus Games Browser E2E | **Implemented.** PR #187 provides authenticated desktop/phone lifecycle proof for KO Predictor, Last Man Standing and Predictor Cup; it is not an open launch-readiness gap. |
| Public launch readiness | **Not ready.** The domestic-season platform, ingestion, operations, accessibility and legal/client gates remain. |
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
- automated desktop/phone accessibility checks and targeted overflow tests;
- deployment-contract, migration timestamp, CI, Database parity, Browser E2E and exact-release controls.

These capabilities are evidence for the first competition. They do not imply that season rules, season scoping or multi-competition surfaces already exist.

## Active work

### Stage A — authority and control alignment

The ADR stack, planning hierarchy, domain-path controls and current implementation authorities are established. Brand-clearance work remains governed by ADR 0017 and must not be inferred complete from engineering progress.

### Stage B — competition-context foundation and surface migration

Completed implementation sequence:

1. pure competition kinds, lock resolver, context resolver and match-state resolver merged through PR #212;
2. deterministic fake-clock coverage merged with the foundation;
3. Home migration merged through PR #219;
4. Matches migration implemented and validated in draft PR #216;
5. Match Centre migration implemented and validated in draft PR #222;
6. entry-lock migration implemented and validated in draft PR #223;
7. legacy `MatchTemporalState` retirement implemented and validated in draft PR #224;
8. clean-main integration assembled in PR #226 with current-main conflict resolutions preserved, verified on head `df8cb06`, and **intentionally merged by the owner on 30 July 2026 as `2648540`**.

Stage B is closed. Its exit condition — the shared engine owning every migrated surface's timing on clean `main` — is satisfied and directly checkable: `src/domain/competition/` is present and `MatchTemporalState` appears in no file under `src/`.

### Next — Stage C competition-season schema

Stage C has **not started**, but is no longer blocked: the Stage B baseline it waited for now exists on `main`.

The next authorised engineering slice is to design and review competition-season scoping while preserving existing relationship safeguards, independent entries/standings/history and the effective migration-control regime. The design decisions listed under Stage C in [`../../MASTER-TODO.md`](../../MASTER-TODO.md) — season tie-breaks, account deletion and anonymisation effects on historical integrity, and the UTC storage/rendering contract — are the ones that must be settled **before** dependent records exist, because they are far cheaper to decide than to migrate.

Any hosted schema mutation still requires the applicable approval and preflight process, and no migration may be authored without a way to verify it: the disposable Supabase rebuild, database lint, pgTAP and TypeScript/PostgreSQL parity gates are the evidence Stage C implementation is expected to produce.

## Parked Euro 2028 scope

The complete inventory is in [`../../MASTER-TODO.md`](../../MASTER-TODO.md). It includes official data, final tournament-only slices, administration fit-for-final verification, the full rehearsal, operational recovery and the published-release decision.

## Open platform gaps

- competition-season schema and scoping;
- fixture/result ingestion and provider evidence;
- season Predictor, Last Man Standing and Cup implementations;
- cross-competition hub and weekly action surfaces;
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
