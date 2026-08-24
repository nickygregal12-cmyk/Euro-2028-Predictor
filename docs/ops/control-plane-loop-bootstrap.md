# Control plane: Loop Bootstrap

Deterministic scheduling for autonomous repository work. The loop owns the
queue, the waiting, the attempt limits and the brakes; a model is dispatched for
one bounded task and returns evidence. It is not an authority: repository
records, executable tests and live GitHub state remain the truth, and this
holds only *scheduling* state.

## What it is for

A worker that waits — polling CI, re-reading unchanged pull-request state,
holding the programme in one long session — is spending reasoning on something
deterministic software does better. After a push the worker checkpoints and
stops; the ledger records what is being awaited and what wakes it.

## Where state lives

Outside the git tree, at `PREDICTOR_CONTROL_STATE_DIR` or
`~/.local/state/predictor-control/`:

| File | Holds |
| --- | --- |
| `run.json` | run id, mode, hard stop, emergency stop, PR budget, last progress |
| `tasks.json` | task records: status, dependencies, attempts, blocker, next action |
| `checkpoints.json` | per task: SHA, PR, work completed, evidence, what is awaited |
| `events.jsonl` | append-only state transitions and attempts |
| `lease.json` | the single writer lane |

State is disposable. It records what the loop did and observed; it never stores
a project fact that already has a home. Where one is needed, store the
authority path and re-read it — a copied value goes stale silently. Writes are
write-then-rename, and `assertNoSecrets` refuses any credential-shaped key.

## Commands

```bash
node scripts/control-plane/cli.mjs init --hard-stop <iso> [--mode ACTIVE] [--max-prs 8]
node scripts/control-plane/cli.mjs add <id> --objective <text> [--after a,b] \
                                           [--handler name] [--order n] [--mutating]
node scripts/control-plane/cli.mjs run [--max-ticks 50]
node scripts/control-plane/cli.mjs status
node scripts/control-plane/cli.mjs stop [--reason text]
node scripts/control-plane/cli.mjs resume
```

`init` is idempotent: an existing run is resumed, never replaced, so a restarted
process picks up its own checkpoints.

## Modes and brakes

`OBSERVE_ONLY` reconciles, classifies and records but dispatches no mutating
task. `ACTIVE` dispatches within the envelope. Mutation dispatch closes on any
of: emergency stop, `OBSERVE_ONLY`, the hard stop, or an exhausted PR budget —
read-only reconciliation stays open in every case so the ledger keeps
converging.

Per task: three attempts, two repeated *identical* failures, then `BLOCKED`.
Progress is evidence — a transition, a result, a classified diagnosis — not
elapsed time, so re-reading unchanged GitHub state does not reset the stall
detector.

## What the loop decides, and what it will not accept

`scripts/control-plane/policy.mjs` holds every verdict as a pure function. A
model asserting a pull request is ready is not an input and cannot become one.
Merge eligibility is computed from observed GitHub state, and fails closed:

- a required decider that never reported blocks the merge;
- a cancelled or skipped required check is a failure, not a pass;
- an unresolved, non-outdated review thread blocks a green pull request;
- base drift invalidates the evidence gathered against the old base;
- a head SHA that moved after triage refuses the merge (`mergeGuard`).

Failure classification is conservative. `FLAKY_TEST` is never inferred from a
failure alone — only from a prior green on that same SHA — and host or provider
limits are classified as such rather than as source defects.

## Task states

`QUEUED` `ELIGIBLE` `RUNNING` `CHECKPOINTING` `WAITING_CI` `WAITING_REVIEW`
`WAITING_EXTERNAL` `WAITING_PROVIDER` `WAITING_OWNER` `BLOCKED` `COMPLETED`
`CANCELLED`.

Only `COMPLETED` satisfies a dependency. A stage parked on the owner never
unblocks what genuinely needs it, so a blocked stage cannot be falsely
satisfied by a later task's impatience.

## Acceptance

`tests/scripts/controlPlaneLoopBootstrap.test.ts` is the executable contract:
three dependent tasks sequencing with no instruction to continue, Emergency
Stop preventing a further mutating dispatch, restart recovery from the
persisted checkpoint, attempt limits reaching `BLOCKED`, and `OBSERVE_ONLY`
holding a mutating task while read-only work still advances.

A product task must never modify the running loop engine or its safety policy.
Fix the loop through its own change, with these tests re-run, before restarting
a canary against it.
