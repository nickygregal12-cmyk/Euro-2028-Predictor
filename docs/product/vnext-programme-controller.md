# vNext programme controller — Stages 8–15

**Status:** orchestration contract only. This file does not replace product, backend, deployment, scoring, privacy or route authorities.
**Machine state:** [`config/vnext-programme.json`](../../config/vnext-programme.json).
**Stable stage scopes:** [`vnext-stage-contracts.md`](vnext-stage-contracts.md).
**UI authority:** [`ui.md`](ui.md), the selected shell authority and each stage-specific authority created as work lands.
**Execution discipline:** root [`AGENTS.md`](../../AGENTS.md) and [`.agents/skills/predictor-context/SKILL.md`](../../.agents/skills/predictor-context/SKILL.md).

---

## Purpose

The vNext programme must be resumable across agent sessions. A session ending, a PR merging, a CI repair completing or one stage finishing is **not** the programme completion condition.

The programme is complete only when Stages 8 through 15 have satisfied their own current authorities, are merged where applicable, and the final programme audit is green.

This controller owns only:

- stage order;
- state-machine semantics;
- transition requirements;
- durable handoff behaviour;
- the explicit Production gate at Stage 14.

`vnext-stage-contracts.md` owns the stable answer to **what each stage is for, what it must deliver, and what it must not absorb**. Neither file may copy moving SHAs, contract numbers, hosted state or transient CI claims. Agents re-read those from their canonical current authorities.

## Stage sequence

| Stage | Mission | Stable contract |
| --- | --- | --- |
| 8 | Matches + Match Centre | current Stage 8 authority / accepted implementation brief |
| 9 | Leagues | `vnext-stage-contracts.md#stage-9--leagues` |
| 10 | Player Profiles + H2H | `vnext-stage-contracts.md#stage-10--player-profiles--h2h` |
| 11 | Last Man Standing | `vnext-stage-contracts.md#stage-11--last-man-standing` |
| 12 | Predictor Championship | `vnext-stage-contracts.md#stage-12--predictor-championship` |
| 13 | Supporting Surfaces | `vnext-stage-contracts.md#stage-13--supporting-surfaces` |
| 14 | Football Hub Production Cutover | `vnext-stage-contracts.md#stage-14--football-hub-production-cutover` |
| 15 | Euro 2028 vNext Adoption | `vnext-stage-contracts.md#stage-15--euro-2028-vnext-adoption` |

The stage contracts are stable programme scope, not frozen implementation prompts. Before starting each stage, use its contract as the binding mission/boundary/completion predicate, then derive the exact implementation plan from current `main`, current product authorities, executable tests and any newly merged backend capability.

An agent may not redefine a stage merely because a different interpretation would be easier. If current authority genuinely conflicts with a stage contract, treat that as a new-authority conflict and surface it explicitly.

## Standing review findings

A dated read-only review of the programme itself — its stage machinery, its lane
conventions and the executable gates that enforce them — is recorded at
[`../quality/audits/2026-08-19-vnext-programme-review.md`](../quality/audits/2026-08-19-vnext-programme-review.md).

It is **evidence at its own commit and decides nothing.** Current code,
executable tests and the canonical product, backend and deployment authorities
outrank it, as they outrank this file.

Its findings are assigned to the stage that owns them, so when deriving a
stage's implementation brief from current `main`, read the ones that name that
stage:

| Stage | Findings assigned to it |
| --- | --- |
| 12 | `TEST-003` — no stated rule for drawn geometry, and this stage draws a bracket |
| 13 | `DEC-016` the vNext light theme, `DEC-017` the vNext icon system, `CI-002` sharding the browser suite before four more surfaces reach it |
| 14 | `UX-005` — the theme collision arrives at this stage and this stage's contract excludes resolving it |
| 15 | `DOC-004` — the vNext primitives this stage must audit against are not enumerated anywhere |
| Any stage | `TEST-002` the duplicated and drifted surface checklist, `UX-006` the unmeasured vNext palette, `OPS-012` whether the vNext checks are required for merge |

**Live status for every one of those identifiers is in
[`../quality/risk-register.md`](../quality/risk-register.md) and
[`../quality/deferred-decisions.md`](../quality/deferred-decisions.md), never
here.** A status copied into this file is a status that is stale the moment the
register moves.

A finding is **not** a stage contract. It cannot add scope to a stage, it never
outranks that stage's minimum completion predicate in
[`vnext-stage-contracts.md`](vnext-stage-contracts.md), and a stage that
deliberately does not take one is not blocked by it — it records the decision and
continues. Treat a finding as a known defect to weigh while deriving the brief,
and a later review as the thing that confirms or contradicts it.

## Allowed states

`not_started` → `in_progress` → `review` → `correction` → `merged`

A stage may also become `blocked` when a genuinely load-bearing dependency cannot be resolved from repository authority.

A blocker in one optional or independent sub-area is not permission to abandon the programme. Finish every safe independent part, record the exact blocker and continue other eligible work when dependencies allow it.

## Stage transition rule

A stage may become `merged` only when all of the following are true:

1. its stable completion predicate in `vnext-stage-contracts.md` (or the current accepted Stage 8 authority) is satisfied;
2. required local validation is green;
3. exact-head required CI is green;
4. independent review, or a fresh review pass isolated from implementation intent, has no unresolved Blocker or Important finding;
5. the branch is reconciled with current `main` without silently overriding a newer authority;
6. the PR is merged and the merge is verified on `main`;
7. the machine state is advanced only after that verification.

Then immediately re-read current `main` and begin the next eligible stage. Do not stop merely because a PR or stage completes.

## PR loop

For each stage:

1. fetch current `main` and inspect open PR overlap;
2. read the stable stage contract, then current scoped product/backend authority;
3. implement the smallest reviewable slice that advances the stage completion predicate;
4. run focused and repository-required gates;
5. push/update the stage PR;
6. inspect exact-head CI;
7. fix stage-caused failures at their root;
8. if a required failure is inherited from `main`, create a separate narrow baseline-repair PR, merge it, reconcile the stage branch and rerun exact-head CI;
9. perform an independent-style review pass;
10. correct only concrete Blocker/Important findings and re-review the delta;
11. merge only when the whole stage predicate is satisfied;
12. verify the merge on `main`, update programme state and continue.

Do not weaken a gate to make the loop progress.

## Main-movement rule

Whenever `main` changes under an active stage, classify incoming changes:

- **A — unrelated:** reconcile and continue;
- **B — overlapping but mechanically compatible:** reconcile, rerun affected evidence and continue;
- **C — conflicting authority:** stop that stage, record the exact authority conflict and do not guess.

A/B movement is normal and is not a reason to restart a stage from scratch.

## Review independence

Prefer a separate reviewer/subagent when available. If one is not available, start a fresh review pass that reads authority, diff and executable evidence without relying on the implementation narrative as proof.

Implementation intent is not acceptance evidence.

## Durable handoff

Before a session boundary, preserve only what a fresh agent needs to resume safely:

- current stage and state;
- branch/PR and exact head when one exists;
- completion predicate;
- authorities consulted;
- tests/evidence and results;
- decisions made;
- blockers;
- next executable action;
- explicit non-actions, especially Production/provider writes.

Do not turn handoff text into a second moving project-status authority. Current repository state must be re-read on resume.

## Stage 14 — explicit Production gate

`config/vnext-programme.json.productionCutoverAuthorized` defaults to `false`.

An agent may autonomously complete all pre-cutover engineering, validation, routing, rollback and readiness work, but it must **not mutate Production merely because Stage 14 is next**.

The actual Production switch requires explicit authority for that action and target. Until then, Stage 14 may reach a verified ready-for-cutover state but cannot claim the Production cutover itself is complete.

Never change the flag as a substitute for human authority.

## Final programme audit

After Stage 15 implementation is otherwise complete, run a final audit across the current authorities and route-migration obligations. The programme completion predicate requires:

- every stable Stage 8–15 completion predicate accounted for;
- required CI green on the final programme head(s);
- no unresolved Blocker/Important review finding;
- Production state reported truthfully;
- no legacy route/surface silently orphaned;
- no vNext presentation workaround compensating for an unfinished scoring, lock, reveal, privacy or settlement authority.

Only then may the programme be reported complete.
