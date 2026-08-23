# Player-value and reliability programme controller

**Status:** orchestration contract only. It owns stage order, state-machine semantics and transition requirements. It owns no product rule, no scoring rule, no hosted state and no contract position.
**Machine state:** [`config/player-value-programme.json`](../../config/player-value-programme.json).
**Executable gate:** [`tests/documentation/playerValueProgrammeController.test.ts`](../../tests/documentation/playerValueProgrammeController.test.ts).
**Execution discipline:** root [`AGENTS.md`](../../AGENTS.md).

---

## Purpose

The programme delivers nine bounded player-value and reliability capabilities, one merged pull request per stage. It must be resumable: a session ending, a pull request opening, or CI running is not a stopping point, and none of them is completion.

This controller exists because a multi-session programme accumulates two specific lies if nothing prevents them.

The first is a stage recorded as done with nothing on `main` behind it. The next agent reads the record as fact and removes the work from the queue; the work does not exist. So `complete` is not a word an agent may simply write here. It is a claim with a shape, and the shape is checked.

The second is two branches claiming one migration identity. That has happened in this repository before, and it is why Stage 0 exists at all. Claims are therefore recorded against exact pull-request heads, and the repository's own position is never copied into this record — it is read from [`config/deployment-contract.json`](../../config/deployment-contract.json) and the next free number is derived from it.

## Stage states

| State | Means |
| --- | --- |
| `not_started` | No branch, no pull request, no evidence. |
| `in_progress` | A branch exists and the work is being built. At most one stage may be here. |
| `blocked` | Progress needs something outside this session's authority. The blocker must be named. A blocked stage MAY also record a merged pull request, for the case a stage ships most of itself and then stops: without that, a stage that delivered two thirds and one that delivered nothing would read the same. A recorded merge has to be as answerable as a complete one, so it needs the pull request, the exact head and the acceptance evidence alongside it. |
| `ready` | Built and evidenced on an exact head, awaiting merge. |
| `complete` | Merged, and the merge commit is on `main`. |

Legal transitions are `not_started → in_progress`, `in_progress ⇄ blocked`, `in_progress → ready`, `ready → complete`, and `ready → in_progress` when review sends work back. A stage may not reach `complete` before every stage it depends on is `complete`.

`blocked` is not a weakening of `complete`. A blocked stage records what it merged; it does not thereby claim to be finished, and the completion predicate still counts only stages that are `complete` with a merge behind them. A blocked stage's unblocking work becomes a later bounded pull request, and only then may it move on.

## Why a stage cannot record its own merge

A pull request cannot contain its own merge commit — the commit does not exist until after the write. So the stage that a pull request delivers is recorded `in_progress` or `ready` inside that pull request, and it is flipped to `complete`, with its merge commit and acceptance evidence, by **the next stage's** pull request. The final stage's completion is recorded by the closing pull request of the programme.

This is the same reason [`NOW.md`](../../NOW.md) prints a `git rev-parse` command instead of a hash.

## What this record must never hold

- A contract number, a migration count, or any hosted position. Those live in the machine records and are read fresh.
- A commit hash inside prose. Hashes belong in the `headSha` and `mergedSha` fields, where their meaning is unambiguous.
- A product, scoring, lock, membership or settlement rule. Reliability and programme instrumentation never becomes game authority.

The executable gate enforces each of these against the real file, and against deliberately broken states, so the validator's own shape is known rather than assumed.

## Merge discipline

A stage merges on **exact head** green. Green is never inferred from local runs, from a stale check, or from a different commit. Migration-bearing branches stay serial: one open branch per contract number, recorded in the runway before the migration is written.

Do not weaken a gate to make the programme progress. If an inherited failure blocks a stage, repair it in its own narrow pull request rather than lowering the threshold in the stage's.

## Safety boundary

Production migrations, contract promotion, Production player data and paid provider consumption are outside this programme's authority. Development and preview environments may be used through the existing contract safeguards. A stage that needs Production action records that action as a `blocked` state with the exact step named, and delivers everything behind it.
