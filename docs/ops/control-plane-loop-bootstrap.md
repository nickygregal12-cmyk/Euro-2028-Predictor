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

## External waiting is not programme latency

A task entering `WAITING_CI`, `WAITING_REVIEW`, `WAITING_EXTERNAL` or
`WAITING_PROVIDER` checkpoints, records what it awaits, releases its worker, and
the queue is rescanned immediately. Independent, dependency-valid work runs
during the wait; a dependant of the parked task stays blocked, because waiting is
not completion.

Selection prefers what most improves throughput: an explicit `priority`, then how
many open tasks this one unblocks (transitively), then `order`, then id. That is
what stops one branch's thirty-minute CI run from setting the pace of everything
behind it.

`IDLE` and external waiting are deliberately different outcomes, and only `IDLE`
feeds the stall detector. A programme parked on CI with nothing else runnable is
healthy; counting it as no-progress escalated a correct thirty-minute wait to
`BLOCKED` in forty minutes, which is the opposite of what the brake is for. The
loop reports `WAITING_EXTERNAL` there instead, and `IDLE` only when nothing is
runnable *and* nothing is awaited.

The same rule decides a single pull request. `routeFromBlockers` reads actionable
blockers — a red check, a reviewer's changes-requested, a drifted base — before
waiting ones, so a branch that is both awaiting CI and carrying a review is
routed to the review. Waiting is what the loop does when there is nothing it can
do, and choosing the slower of two true answers is the same mistake at a smaller
scale.

A run whose verdict was reached against a commit that is no longer the head is
classified `SUPERSEDED`: a newer push replaced it, so it is neither a failure nor
an attempt, and it spends no attempt and no stall credit. The SHA decides that,
not the conclusion — a gate reporting under `always()` reads a cancelled
dependency and concludes *failure*, on the same dead commit and from the same
push, so keying on `cancelled` recognised one replaced run and sent the other to
repair. The cost of reading it from the SHA is that a required context which
never posts again is waited on rather than repaired; that is `DOC-001`, and it
blocks the merge under either reading. Triage restates it as a
check still owed on the current head and lets routing decide from there. It does
*not* short-circuit the verdict — an earlier version did, and a reviewer's
changes-requested, a drifted base and an unmergeable branch all disappeared
behind a push while the pull request sat watching CI it was no longer waiting
for. The merge verdict is left alone either way: cancelled evidence is not a
pass.

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

## Which identity acts, and how much it may hold

`config/control-plane-identity.json` records the lanes autonomous work runs as,
and `scripts/control-plane/identity.mjs` decides what each may do. Authority is
a **function of identity**, not a separate grant, so a task, a prompt or a model
cannot widen it:

| Identity class | Meaning | Authority ceiling |
| --- | --- | --- |
| `UNPROVISIONED` | no credential, deliberately | `NONE` |
| `OWNER_ATTRIBUTED` | the owner's own account | `REPOSITORY_WRITE` |
| `MACHINE` | a distinct non-owner actor | `DEPLOYMENT_EXECUTOR` |

Three lanes exist. `verification` reads (`READ_ONLY`), `repository` pushes task
branches and opens pull requests (`REPOSITORY_WRITE`), and `deployment` — the
future trusted Production/migration executor — is `UNPROVISIONED` and holds
nothing.

Each lane names the credential it is proved from as **data the verifier
consumes** — `{ kind: 'env', name }` or `{ kind: 'command', argv }` — and is
resolved from that source alone. There is no ambient fallback, because a
fallback is how a command comes to state a conclusion about one identity while
holding another: the first version described the repository lane's source in a
string nothing read, then resolved it from an ambient `GITHUB_TOKEN`, and
reported both lanes `PROVED` on a host with no `gh` at all — one credential
verified twice, reported as two lanes.

`MACHINE` is not a label the record may award itself. A lane claiming it must
name an actor no lane records as owner-attributed, and lanes declared distinct
must name different actor ids — both checked **offline, from the record**, since
the offline half is the one CI runs and a constraint enforced only live is one
the merge gate cannot apply. `authorityForLane` re-checks the whole record's
coherence before answering, because it may be handed a record that never passed
a gate.

**What this record admits.** There is no distinct machine account today. Both
provisioned lanes resolve to the owner's own GitHub user, proved live on 25
August 2026 as `nickygregal12-cmyk#289518917`. That is attributable — every
autonomous action lands in the audit record under a real account — but it is not
a separate executor identity, and saying so is the point. The consequence is
mechanical: `OWNER_ATTRIBUTED` ceilings at `REPOSITORY_WRITE`, so no lane can be
handed `DEPLOYMENT_EXECUTOR` until a genuinely distinct `MACHINE` actor exists
and is recorded. Raising the number in the file does not raise the ceiling —
`authorityForLane` re-derives it from the identity class and the record fails
its own coherence check.

```bash
npm run check:machine-identity          # the record is coherent; no network
node scripts/check-machine-identity.mjs --live   # each lane resolves to its recorded actor
```

The offline half runs in CI, on the pull request that would raise a ceiling. The
live half catches what a clone cannot see: a credential rotated to another
account, or a lane recorded as having none that has acquired one. An unresolved
provisioned lane is a failure, never a pass — an identity that cannot be proved
is exactly the case this gate exists for. Neither half prints a credential; they
report only the login, numeric id and account type it resolved to.

Provisioning is deliberately not automated. Creating a machine account or
installation credential is an owner action in GitHub settings, and a control
plane that could mint its own executor identity would not be constrained by one.

## What autonomous repository work may do

`config/pre-live-owner-authority.json` names the operations, and
`scripts/control-plane/authority.mjs` decides them. Granted today, each
subject to the acting identity lane holding the level it needs:

| Operation | Needs |
| --- | --- |
| `branch.create`, `commit.create`, `branch.push` | `REPOSITORY_WRITE` |
| `pr.create`, `pr.update` | `REPOSITORY_WRITE` |
| `ci.read`, `review.read`, `repository.read` | `READ_ONLY` |

```bash
npm run check:owner-authority              # report and validate the policy
node scripts/check-pre-live-owner-authority.mjs branch.push   # decide one operation
```

Two properties carry the safety, and both are structural rather than stated.

**It is an allowlist.** An operation the policy does not name is denied because
it is not named. The superseded #1041 enumerated forbidden `git` and `gh`
invocations instead, which grants everything nobody thought to forbid — and that
set is open-ended: a new flag, a new subcommand, a shell construct reaching the
same effect.

**The refusals are code.** `ALWAYS_DENIED` lives in `authority.mjs`, not in the
record, so editing the record cannot remove or reword one: direct push to a
protected branch, force-push, branch-protection and ruleset edits, merge,
Production mutation, secret mutation, arbitrary hosted writes, and any widening
of what a model may do. They are checked *before* the acting identity is
consulted at all, so no identity reaches past them. A control plane whose
forbidden set lives in data it can write is not constrained by it.

Authority is not decided here either. This policy says which level an operation
needs; whether the lane holds it is the identity record above. So no single file
can unlock an operation — and `DEPLOYMENT_EXECUTOR` is not requirable in this
mode at all, because Production work belongs to a later stage and a distinct
machine actor, not to a larger value in a config file.

`scripts/agent-tools/owner-task-push.sh` and `owner-pr.sh` are the enforcing
edge. Each asks the policy before acting. The push wrapper takes no arguments,
so force and target selection are unavailable rather than rejected, and it
assembles `origin <branch>` from the branch the repository is on. The
pull-request wrapper fixes base and head and forwards only an allowlist of
option names.

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

It also carries the external-wait canary: a task parks on CI and is never
dispatched again, independent work proceeds unprompted, its dependant stays
blocked, a long wait reports `WAITING_EXTERNAL` rather than accruing no-progress
cycles, a true stall still escalates, and the parked task resumes only when a
watcher supplies fresh external evidence.

A product task must never modify the running loop engine or its safety policy.
Fix the loop through its own change, with these tests re-run, before restarting
a canary against it.
