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

### The ledger, and what the files could not do

`control-plane.sqlite` holds the same records transactionally.
`ControlPlaneLedger` is a drop-in for `ControlPlaneStore` — same methods, same
return shapes — and `tests/scripts/controlPlaneLedger.test.ts` runs **one
conformance suite against both**, so "drop-in" is measured rather than asserted.
It has already earned that: three divergences showed up as failures, including a
ledger that stored `evidence` on the task record when the files deliberately
keep it in the event log alone.

The files are disposable, `cat`-able and need no dependency, and all three
survive. What they cannot do is land two facts at once:

- every mutation is read-modify-write over a **whole table**, so two writers
  interleaving lose one update and the loser leaves no trace;
- `transition` writes `tasks.json` and *then* appends to `events.jsonl`, so a
  crash between them leaves a task that moved with no record of moving — or a
  record of a move that did not happen;
- the lease exists to serialise writers and nothing acquires it, which is why
  the first point is not hypothetical.

Each is one transaction away from impossible. `BEGIN IMMEDIATE` takes the write
lock up front, so two writers serialise at the start rather than discovering the
conflict at commit with work already done on a stale read, and every event is
written **inside** its caller's transaction.

The difference is measured, not argued: under the same injected disk-full fault,
the ledger leaves the task where it was, and the files move the task and lose
the record.

`node:sqlite` ships with the Node pinned in `.nvmrc`, so this costs no
dependency, no native build and no audit surface — the same reason the files
avoided one. Node marks it **experimental** and warns on load; the mitigation is
that pin, which means the API cannot move without a deliberate Node bump and
these tests running against it. A stable API would be better and a native
dependency would be worse. It is loaded on first use rather than at import,
because the Vite version behind Vitest does not yet know `node:sqlite` is a
built-in and tries to bundle it — which broke every test that merely reaches
the control plane, including ones that never open a ledger. That is a tooling
gap to revisit, not a design choice: a static import is strictly better.

Rows are documents, not columns. A task's shape belongs to `policy.mjs`;
`sort_order` and `status` are extracted only because the ledger itself orders
and filters on them, so a new task field is a change in one place rather than a
migration.

## Commands

```bash
node scripts/control-plane/cli.mjs init --hard-stop <iso> [--mode ACTIVE] [--max-prs 8]
node scripts/control-plane/cli.mjs add <id> --objective <text> [--after a,b] \
                                           [--handler name] [--order n] [--mutating]
node scripts/control-plane/cli.mjs run [--max-ticks 50]
node scripts/control-plane/cli.mjs supervise [--max-passes 1000]
node scripts/control-plane/cli.mjs status
node scripts/control-plane/cli.mjs stop [--reason text]
node scripts/control-plane/cli.mjs resume
```

`init` is idempotent: an existing run is resumed, never replaced, so a restarted
process picks up its own checkpoints.

## The loop that keeps running

`run` is a **batch**: it ticks until nothing can be advanced this pass, prints,
and exits. That is right for a person at a terminal and wrong for a programme,
because almost every stop it reports is temporary — `WAITING_EXTERNAL` means CI
is running, `IDLE` means nothing is runnable *right now*, and both become
runnable again with nobody typing anything. A batch loop turns every external
wait into a wait for a human.

`supervise` runs passes until a reason that is actually a reason: the run is
complete, the hard stop is reached, or someone pulled the brake. Between passes
it waits by *why* it stopped — a minute on CI, two on idle, five on the owner,
because looking again does not summon anyone. It ships with `readOnlyHandlers`,
for the reason `run` does: a supervisor started to watch a programme must not be
able to push.

**It holds the writer lane.** `state.mjs` has had a lease since Loop Bootstrap
and nothing had ever acquired it — said plainly when the ledger landed, since an
unheld lease is why concurrent read-modify-write was not hypothetical. The
supervisor takes it before the first tick, renews it **before** each wait rather
than after, and releases it on the way out. Renewing after would ask one lease
to cover the pass *and* the wait together, which a long observation pass plus a
long wait does not fit inside; renewing before only ever has to cover the wait.
A second supervisor against the same state stands down rather than interleaving.

**It reconciles what a crash left behind.** A task is marked `RUNNING` before its
handler is called, and if the process dies in between, that mark outlives it.
`RUNNING` is neither terminal nor waiting, so the scheduler is perfectly happy to
select it again — free for a read, and for a mutation a second push, a second
commit, or a second pull request, because nothing in the state can say what the
dead process managed to do first.

So an interrupted read is re-queued and an interrupted **mutation is parked for
the owner**. "Did something happen out there" is a question the loop cannot
answer from its own state, which is what `WAITING_OWNER` is for. It parks one
task, not the programme; everything independent keeps moving.

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

**And something has to say whose failure it is.** `classifyFailure` has two
branches nothing could reach:

```
if (signal.redOnBase) return 'INHERITED_FAILURE'
if (signal.previouslyGreenOnSameSha) return 'FLAKY_TEST'
```

`triagePullRequest` takes both as lists, both default to `[]`, and no caller
ever supplied either — so a failure the base branch already had was classified
as the branch's own, and `FLAKY_TEST` had never once been produced. A policy
branch that cannot fire is a policy that does not exist.
`scripts/control-plane/experience.mjs` supplies both, and both used to be *task
fields*: a record could declare a failure inherited or flaky and the classifier
would agree, which is the editable-data escape hatch the authority policy
refuses for the same reason. They come from the observation now, and from
nowhere else.

**"Flake" is a claim about one commit.** The only evidence for it is that the
same commit already passed the check — not that it passes elsewhere, not that it
looks unrelated, and not that a re-run went green afterwards, because a check
that failed and was re-run green has no failure left to classify. So the case is
narrow and stays narrow: an earlier run on this exact SHA succeeded and the
current one did not. Two runs of a name prove nothing by themselves — measured
against real data, a `paths:`-filtered workflow reported `skipped` twice on one
commit.

The full run history is fetched **separately** from the latest-per-name set.
`normalisePullRequest` keys checks by name and takes the last it sees, so
handing it every run for a commit would let an older attempt silently become the
verdict. The latest set decides; the history is evidence about that set.

When the base cannot be read, the failure is treated as this branch's. Assuming
the base was red would let a real regression through as `INHERITED_FAILURE`;
not knowing must never become the convenient answer.

Nothing here is written down or carried forward in prose. Both answers are
re-derived from the commits they are about, at the moment they are needed —
experience that is re-derived cannot go stale, and experience nobody wrote down
cannot be quietly edited into something more convenient.

**Something has to be able to release it.** `delivery.push` parks with
`nextAction: 'a watcher supplies check evidence for this head'`, and a parked
task nothing can release is not a checkpoint, it is a dead end.
`scripts/control-plane/observe.mjs` is that reader. It fetches, and only
fetches: `github.mjs` opens by saying the verdict must not depend on how the
caller reached GitHub, so observation produces the raw payload
`normalisePullRequest` already expects and takes no part in deciding anything.

Every request is a GET, the method is not a parameter, and the repository comes
from the tracked identity record rather than from a caller — the same pin the
push wrapper uses, for the same reason. The pull request number and the commit
SHA both reach a URL path, so both are checked as what they claim to be rather
than trusted as strings. The head is read back **from the pull request** rather
than accepted from the caller: asking for a head someone else supplied is how a
green check ends up vouching for a commit it never measured, which is the
fail-open `decideCanaryMerge` already exists to catch.

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
| `branch.create`, `commit.create`, `branch.push` | `REPOSITORY_WRITE`, on a task branch |
| `pr.create`, `pr.update` | `REPOSITORY_WRITE`, on a task branch |
| `ci.read`, `review.read`, `repository.read` | `READ_ONLY` |

An operation marked `requiresTaskBranch` is **denied when no branch is
supplied**, not allowed — otherwise a constraint is satisfied by omitting the
thing it constrains. The first version of this record carried those rules as
prose that the decision function never received, which is the failure this stage
exists to end.

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

`owner-branch.sh`, `owner-commit.sh`, `owner-task-push.sh` and `owner-pr.sh`
under `scripts/agent-tools/` are the enforcing edge, and the Builder's own
permissions deny the direct `git commit`, `git push`, branch-creating and
`gh pr` forms so that the wrappers are the way through. A gate a worker may
decline to call is not a gate: without that routing the policy would be
advisory, which is the state this stage exists to leave. The read-only and
navigating git forms are untouched — the denials are narrower than the allows
they override. Each asks the policy before
acting, passing the branch it is standing on, and each forwards only an
allowlist of option names. The push wrapper takes no arguments at all, so force
and target selection are unavailable rather than rejected.

**The repository is pinned, not just the ref.** Review found both wrappers
constrained what was written and left *where* open: the push wrapper passed the
remote name `origin` without reading `remote.origin.pushurl`, and `gh` resolved
its target from an inherited `GH_REPO` while the wrapper reported that it had
fixed base and head. Both now resolve the expected `owner/repo` from the
identity record and refuse anything else — every effective push URL is checked,
more than one push URL is refused, and the pull-request wrapper names the
repository in the REST path with `GH_REPO` and `GH_HOST` both cleared.

**The pull-request wrapper speaks REST, not `gh pr create`.** The first live
canary run failed there three times on the same thing: `gh pr create` opens with
a GraphQL `RepositoryInfo` preamble, and a host whose egress serves only a
pinned set of GitHub operations answers it `HTTP 403` before any of the
wrapper's own checks mean anything. The REST pull-request endpoints take base
and head as fields and need no preamble, so the wrapper asks for exactly the
call it wants. `update` looks the number up from the open pull request for the
branch it is standing on rather than accepting one, and refuses a lookup that
does not answer with a number.

The option list narrowed in the same change: `--label`, `--assignee` and
`--milestone` were named once and used by nothing, and each is a separate REST
call against a different endpoint. An allowlist entry kept "in case" is what an
allowlist exists to prevent, so they are refused now the way anything unnamed
is.

URL rewrites need no separate refusal: `git remote get-url --push --all` reports
the URL *after* expanding both `insteadOf` and `pushInsteadOf`, so a rule
retargeting `github.com` arrives at that check as the other host. An earlier
blanket refusal of any rewrite was removed — it stopped the wrapper pushing at
all wherever the ordinary SSH-to-HTTPS rewrite is configured, which is how
proxied and CI checkouts normally look, and a gate that refuses correct work is
still a broken gate.

## The delivery canary

`scripts/control-plane/delivery.mjs` holds the mutating handlers, and they are
**not** registered by `cli.mjs`. `readOnlyHandlers` says why: shipping a handler
that can push would mean any `run` could push, including one started to look at
status. A caller that wants mutation registers these deliberately.

What the canary demonstrates is not that an agent can open a pull request. It is
the loop: the scheduler picks the task, a bounded worker does one thing, and at
the push the worker **checkpoints and exits** rather than sitting on CI. The
interesting moment is the one where nothing is running — the push returns
`WAITING_CI`, its dependants stay blocked because waiting is not completion, and
independent work proceeds instead of queueing behind a half-hour CI run.

Four gates decide each mutating step, and a model is none of them:

| | Decided by |
| --- | --- |
| may this task run at all | the scheduler — dependencies, priority, attempts |
| may mutation be dispatched | `mutationDispatchAllowed` — mode, brakes, budget |
| is this a target the wrapper serves | the wrapper — branch, repository, options |
| may this identity perform it | the authority policy against the identity lane |

Each handler asks the policy itself before shelling out, even though the wrapper
asks again. The duplicate answer is deliberate: a handler invoked from anywhere
other than a wrapper still cannot act, and the refusal arrives as a `POLICY`
failure the loop can classify rather than an exit code it cannot.

`decideCanaryMerge` computes merge eligibility from observed GitHub state alone.
By the time it runs, the worker that pushed is gone — a required check that
never reported is refused rather than read as a pass, and a head that moved
after the evidence was gathered refuses too.

**Evidence belongs to the commit it ran against, and to no other.** Comparing
only the pull request's head misses a required check that succeeded on an
earlier commit: measured, not supposed — three required checks green on an older
SHA, a newer head, merge allowed with no blockers at all. Each required check's
own run SHA is now compared against the expected head, and a check whose
provenance cannot be read is unproven rather than given the benefit of the doubt.

**The gate cannot vouch for a change to itself.** The handlers run the wrappers
from the working tree, so a delivery that edited `owner-task-push.sh` or the
authority policy would be gated by its own edit. `ENFORCEMENT_SURFACE` names
those files and every mutating step refuses while any of them differs from
`origin/main` — the last state that went through review and the required gates.
A change to the gate goes through review, not through automation.

A wrapper's authority refusal exits **3**, distinct from a validation (1) or
usage (2) failure, so the loop classifies it `POLICY_DENIAL`. A denial is not a
defect, and retrying one only spends attempts on a decision that will never
change. Every other wrapper failure goes through `classifyFailure` rather than
being stamped with one word — the live run is why: an unrecoverable `HTTP 403`
carried a class that meant nothing, and all three attempts were spent on it in
under a second. It reads as `AUTH_REQUIRED` now, which is both true and
actionable.

### Running it

`scripts/control-plane/canary.mjs` is what registers those handlers and starts
the run, and starting it is the only thing an owner does:

```
node scripts/control-plane/canary.mjs \
  --branch <namespace>/<name> --title <text> --body-file <path> \
  --hard-stop <ISO> --independent '["npx","vitest","run","<a bounded test path>"]'
```

The run opens in `ACTIVE` mode with `maxPullRequests: 1`, so the budget brake
stops a second delivery even if the graph asked for one.

**The acceptance is the shape of the decision log, not the pull request.** A
pull request opened by an agent proves an agent can call `gh`, which was never
in doubt. What has to hold is: every task was chosen by the scheduler in
dependency order with nothing prompting it; the push returned `WAITING_CI` and
the worker exited; the task depending on the push was never dispatched;
independent work ran while the push waited; and the run ended `WAITING_EXTERNAL`
— parked, not finished, and not idle.

**Why the pull request does not depend on the push.** `delivery.push` never
reaches `COMPLETED` by design, so nothing may depend on its status and still
run. But a pull request for a branch that was never pushed describes a head that
is not on the remote. The gate is therefore the push's **checkpoint** rather
than its status: parked work still leaves durable evidence behind, and that
evidence is what the next task reads — the same mechanism a restarted control
plane uses to pick a run back up.

`delivery.merge` has no handler at all. It depends on the push, so the engine
must never reach it; if it ever did, the missing handler surfaces as
`NO_HANDLER` rather than merging something quietly.

Staging is its own task, and it refuses the enforcement surface one step earlier
than `delivery.mjs` does — at the moment the file list is known, rather than
after a branch already exists. Two edges asking the same question is the pattern
the wrappers already use.

## Task states

`QUEUED` `ELIGIBLE` `RUNNING` `CHECKPOINTING` `WAITING_CI` `WAITING_REVIEW`
`WAITING_EXTERNAL` `WAITING_PROVIDER` `WAITING_OWNER` `BLOCKED` `COMPLETED`
`CANCELLED`.

Only `COMPLETED` satisfies a dependency. A stage parked on the owner never
unblocks what genuinely needs it, so a blocked stage cannot be falsely
satisfied by a later task's impatience.

`BLOCKED` is terminal for its own task and for nothing else. A `run` pass used
to stop on it, and the first live canary showed what that costs: one task
exhausted its attempts against an environment restriction, the pass ended
there, and the independent work behind it in the queue never ran — the failure
mode the external wait exists to prevent, arriving through the other door.

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

`tests/scripts/deliveryCanaryRunner.test.ts` covers the runner: one start
driving stage, branch, commit, push and pull request in order; the push parking
while independent work completes; `delivery.merge` never dispatched; the run
ending `WAITING_EXTERNAL`; and the refusals — an empty index, a staged
enforcement file, a pull request with no push checkpoint, and a checkpoint for
another branch.

**A note for whoever runs this next.** `ciTestDiscoveryFloor` and
`typescriptProjectCoverage` both compare runtime discovery against
`git ls-files`, so both fail while the tree holds a new file that has not been
committed yet — which is exactly the window between staging and committing that
an autonomous delivery works in. They are behaving correctly; the failure means
"not committed", not "broken".

A product task must never modify the running loop engine or its safety policy.
Fix the loop through its own change, with these tests re-run, before restarting
a canary against it.
