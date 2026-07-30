# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and freshly verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 30 July 2026

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
| Current `main` | Stage B merge commit `2648540dc001c50305f1effa526fc16e43dcdb26` |
| Recoverable Euro baseline | `euro-2028-baseline` → `1fb8ffd36ad113079181829a8bcc47175c43b6da` |
| Application/database contract at the tag | 63 canonical migrations through `20260729154931_prediction_consensus_minimum_cohort.sql` |
| Forward architecture | ADRs 0011–0018 plus the parent programme and child engineering workstream |
| Current development position | Stage B competition-context adoption is complete on `main`; the superseded Stage B PR stack is closed |
| Active prerequisite | PR #228 at `86a02ab1e7f44cb42718dada13de94e66ea0dcd6`, fully green and unmerged |
| Next engineering stage | Stage C competition-season schema design, after the PR #228 integration decision |
| Production posture | Controlled pre-launch target; no development or simulation write path is permitted |

## Hosted evidence boundary

This reconciliation includes fresh read-only GitHub and Netlify inspection for the Stage B merge and PR #228 preview. It includes **no fresh Supabase inspection**. Supabase and preserved-data statements remain the last owner-verified repository record from **29 July 2026** until the named checks are rerun.

| Target | Current evidence | Fresh check required |
| --- | --- | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | owner-verified at contract 63 on 29 July 2026 | **REQUIRES OWNER VERIFICATION:** run the canonical applied-state and privilege queries |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | owner-verified at contract 63 on 29 July 2026 with preserved-data postflight | **REQUIRES OWNER VERIFICATION:** run read-only applied-state, privilege and preservation checks before any write |
| Production Netlify `main` | freshly verified ready deploy `6a6b4b35e380b500085e5131` from Stage B merge `2648540dc001c50305f1effa526fc16e43dcdb26`, published 30 July 2026 | rerun exact-origin smoke before a production-risk milestone |
| PR #228 Netlify preview | exact preview identity, HTTP smoke and browser smoke passed on 30 July 2026 | repeat only if the PR head changes |
| Production data/recovery | owner-verified preserved counts and same-day encrypted contract-60 backup/restore evidence on 29 July 2026 | **REQUIRES OWNER VERIFICATION:** take a fresh backup/restore proof before a data-risk milestone |

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Euro 2028 baseline | **Tagged and recoverable.** Product work through contract 63 is preserved at `euro-2028-baseline`. |
| Euro 2028 forward work | **Parked.** Remaining tournament data, presentation, rehearsal and release items return in January 2028. |
| Platform direction | **Established by ADRs 0011–0018.** Forward documents and agent framing are aligned to the multi-competition programme. |
| Context engine | **Complete on `main`.** Home, Matches, Match Centre and entry-lock decisions consume the shared competition context, and the legacy `MatchTemporalState` layer is retired. |
| Stage B exit | **Complete.** PR #226 passed the full clean-main gate set and merged as `2648540dc001c50305f1effa526fc16e43dcdb26`. |
| Concurrent work | **PR #228 is the active prerequisite.** It is mergeable and fully green but remains unmerged. |
| Cross-tournament read safety | **Implemented in PR #228, not yet on `main`.** `group_teams` is scoped through the selected tournament's group ids there. |
| Contract alignment | **Repository contract remains 63; hosted Supabase state was not freshly inspected.** |
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

Stage B is complete on `main`:

1. pure competition kinds, lock resolver, context resolver and match-state resolver merged through PR #212;
2. deterministic fake-clock coverage merged with the foundation;
3. Home migration merged through PR #219;
4. Matches, Match Centre, entry-lock migration and `MatchTemporalState` retirement integrated through PR #226;
5. PR #226 passed build/typecheck, lint, full Vitest, dependency audit, Database parity, exact preview smoke, authenticated journeys, signup and password recovery;
6. PR #226 merged as `2648540dc001c50305f1effa526fc16e43dcdb26` and Netlify automatically published the exact commit;
7. superseded PRs #216, #221, #222, #223, #224 and #225 were closed with links to the merged integration.

### Active prerequisite — PR #228

PR #228 is deliberately outside the Stage B context stack and addresses controls that should be settled before adding competition-season records:

- derives production guard expectations from committed deployment authority;
- scopes `group_teams` reads through the selected tournament's groups;
- returns a real HTTP 404 for unknown SPA paths while preserving valid routes and assets;
- enforces the browser RPC allowlist against application calls and migration definitions;
- validates that the browser Supabase key is publishable and belongs to the expected project when its format carries a project reference;
- records module reachability, retires two verified dead files and adds TypeScript/SQL parity checks.

Exact head `86a02ab1e7f44cb42718dada13de94e66ea0dcd6` is mergeable and has passed CI, Database parity, exact Netlify preview smoke, authenticated browser journeys, signup and password recovery. It remains unmerged. Because merging to `main` automatically publishes Netlify and changes routing/environment guards, its integration requires an intentional owner decision.

### Next — Stage C competition-season schema

Stage C has **not started**. After the PR #228 integration decision, the next authorised engineering slice is competition-season schema design: scoping, deletion/anonymisation consequences, timezone authority, independent entries/standings/history and preservation of existing relationship safeguards. Any hosted schema mutation still requires the applicable approval and preflight process.

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
