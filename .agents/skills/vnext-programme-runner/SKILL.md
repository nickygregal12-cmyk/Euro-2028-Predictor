---
name: vnext-programme-runner
description: Resume and execute the vNext frontend programme across Stages 8–15 using durable stage contracts, a stage state machine, exact-head CI, review/correction loops, baseline repairs and explicit Production safety gates.
---

# vNext programme runner

Use this skill when asked to continue, resume, loop through or finish the remaining vNext programme rather than complete only one isolated stage.

## Authority boundary

This skill is orchestration, not product authority.

Before changing code:

1. read root `AGENTS.md` and `NOW.md`;
2. read `config/vnext-programme.json`;
3. read `docs/product/vnext-programme-controller.md`;
4. read the current stage in `docs/product/vnext-stage-contracts.md` (Stage 8 uses its current accepted Stage 8 authority until it lands);
5. read `docs/product/ui.md`, `src/vnext/AGENTS.md` and the current stage's scoped authority;
6. inspect current `main`, current branch/PR and overlapping open PRs;
7. inspect executable source/tests for the surface being changed.

The controller also carries **standing review findings**, assigned per stage and
recorded in full at `docs/quality/audits/2026-08-19-vnext-programme-review.md`.
Read the ones naming the current stage while deriving its brief; their live
status is in `docs/quality/risk-register.md` and
`docs/quality/deferred-decisions.md`, never in the runner or the controller. A
finding is a known defect to weigh, never a stage contract — it adds no scope,
does not outrank a stage's completion predicate, and does not block a stage that
records a decision not to take it.

Current code, tests and canonical product/backend/deployment authorities always outrank this runner. The stable stage contract defines the stage's mission, boundaries and minimum completion predicate; current authorities determine how that contract is implemented now.

## Completion predicate

Do not stop merely because:

- one PR was opened;
- one PR was merged;
- one stage was implemented;
- CI was repaired;
- a corrective pass was completed;
- a review report was produced.

The programme completion predicate is the one recorded in `config/vnext-programme.json` and interpreted by `docs/product/vnext-programme-controller.md` plus the stage completion predicates in `docs/product/vnext-stage-contracts.md`.

After every completed stage, re-read current `main`, advance durable state only after verifying the merge, and continue with the next eligible stage.

## Resume algorithm

At the beginning of every run:

1. fetch current `main`;
2. read the machine state;
3. verify that its claimed last merged stage is consistent with repository history/authority;
4. identify the current stage and load its stable stage contract;
5. inspect open PRs and identify any active stage PR;
6. if machine state is stale, repair the state based on evidence before doing product work;
7. derive the next executable action from the earliest stage whose stable completion predicate is not genuinely complete.

Never trust a previous chat's SHA, CI result, contract number or hosted-state claim without re-reading current evidence.

## Stage loop

For the current stage, repeat until its whole completion predicate is satisfied:

1. load the stable stage contract;
2. load only the current stage-specific authority needed for the next slice, plus any standing review finding assigned to this stage;
3. implement a reviewable slice that advances the contract;
4. run focused validation;
5. run required repository gates appropriate to the delta;
6. push/update the PR;
7. inspect exact-head CI;
8. classify failures and fix them according to the failure loop below;
9. perform an independent-style review pass against the stable contract and current authority;
10. correct Blocker/Important findings narrowly;
11. re-review the corrective delta;
12. reconcile current `main` immediately before merge;
13. merge only when required checks and the whole stage acceptance conditions are satisfied;
14. verify the merge SHA on `main`;
15. update `config/vnext-programme.json` so the completed stage is `merged` and the next stage becomes `in_progress`;
16. continue immediately into the next stage.

A large stage may use multiple PRs. Do not mark the stage `merged` merely because one sub-PR merged.

## Failure loop

For every required red check, classify it:

### Stage-caused

Fix the root cause on the stage branch, rerun focused evidence, then rerun exact-head CI.

### Inherited from current main

Do not contaminate the feature PR with unrelated repairs.

Create a narrow baseline-repair branch/PR from current `main`, fix only the baseline defect, prove it independently, merge it, reconcile the active stage branch and rerun the stage's exact-head evidence.

### Infrastructure/report-only

Verify the repository's actual gating semantics. Do not call a required failure report-only merely because it is inconvenient, and do not weaken workflows or tests to progress the stage.

## Main-movement loop

Whenever `main` advances during an active stage, classify the delta:

- A — unrelated: reconcile and continue;
- B — overlapping but mechanically compatible: reconcile, rerun affected evidence and continue;
- C — conflicting/new authority: stop that stage and report the exact authority conflict rather than inventing a resolution.

Do not restart accepted architecture merely because main moved.

## Review loop

Prefer a separate reviewer/subagent when the environment supports it.

The review pass must:

- read the stable stage contract and current authority first;
- review actual diff/source/tests rather than the implementer's prose;
- distinguish Blocker, Important and Minor findings;
- avoid reopening already accepted decisions without a concrete new defect;
- require narrow corrections for Blocker/Important findings;
- re-review only the corrective delta unless the correction genuinely changes architecture.

If no separate reviewer is available, start a fresh review pass and deliberately ignore implementation intent as evidence.

## Blocker loop

A blocker in an optional or independent part of a stage is not permission to abandon the programme.

When blocked:

1. state the exact consumer and missing authority;
2. compare the blocker with the stable stage minimum predicate — distinguish required from optional;
3. finish every independent part safely possible;
4. use an existing parallel backend/tooling lane if one owns the missing authority;
5. continue another eligible slice/stage only when doing so does not violate stage dependencies;
6. return to the blocker when the dependency lands.

Only a load-bearing authority conflict, an unmet required stage predicate or explicit Production gate may halt progression completely.

## Stage contracts are stable; implementation briefs are derived

`docs/product/vnext-stage-contracts.md` is the stable answer to what Stages 9–15 mean. Do not reinterpret a stage from its short name alone.

The contracts freeze:

- mission;
- owned surface/job;
- explicit non-scope;
- minimum completion predicate;
- transition intent.

They deliberately do **not** freeze current RPC names, SHAs, hosted contract numbers, provider capability or exact component structure.

At each transition, derive the exact implementation brief by combining the stable contract with current:

- `main`;
- accepted vNext product authorities;
- route-migration matrix;
- backend contracts that have actually merged;
- current tests and connected presentation sources;
- unresolved accepted requirements relevant to that stage.

Do not silently change the stable mission because current implementation makes another scope easier. If a newer explicit authority conflicts with the stage contract, classify that as a main-movement/authority conflict and surface it.

## Stage 14 Production safety

Do not mutate Production unless there is explicit authority for the exact cutover action and target.

`productionCutoverAuthorized` is a machine guard, not authority by itself. Never flip it to make the loop continue.

Without explicit Production authority, complete all safe pre-cutover engineering and report the cutover gate precisely.

## State update rules

Allowed stage statuses are:

- `not_started`
- `in_progress`
- `review`
- `correction`
- `blocked`
- `merged`

Preserve sequential truth:

- stages before `currentStage` must be `merged`;
- `currentStage` is the only non-terminal active stage;
- later stages remain `not_started` unless the controller explicitly permits safe parallel preparation;
- PR numbers are references, not proof of merge;
- do not persist volatile CI results, SHAs or hosted contract numbers in the machine state unless the schema is deliberately extended under review.

## Durable session handoff

Before any session boundary, leave a compact handoff containing:

- current stage/state;
- branch/PR and exact head if present;
- stable completion predicate still outstanding;
- authorities consulted;
- files changed;
- tests/evidence and results;
- decisions made;
- blockers;
- next executable action;
- explicit non-actions.

A fresh agent must still re-read repository state on resume.

## Final audit

After the final stage is otherwise complete, execute the final programme audit defined by the controller. Do not declare the programme complete while a required stage predicate, route obligation, Blocker/Important finding, required CI failure or truthful Production-state requirement remains unresolved.

## Short invocation

A future session can be started with:

> Run the vNext programme runner. Resume from current repository state, load the stable contract for the current stage, and continue executing, validating, reviewing, correcting and merging the next eligible work until the programme completion predicate is met or a genuinely non-resolvable authority/Production-safety blocker is reached. Do not stop merely because a PR, stage, CI repair or corrective pass completes. Persist a durable handoff before any session boundary.
