# Pending-write submission barrier

**Workstream:** `REL-003`  
**Date:** 24 July 2026  
**Repository branch:** `reliability/rel-003-submit-save-barrier`  
**Production environment:** unchanged

## Verdict

| Area | Result |
| --- | --- |
| Repository implementation | **Complete.** Manual submission flushes debounced score/bracket writes and waits for every prediction save key to settle. |
| Controller assurance | **Passed.** Tests cover multiple keys, coalesced latest values, retries, terminal errors, conflicts and reset cancellation. |
| Provider regression assurance | **Passed.** Tests prove immediate submit after the final score or bracket pick cannot call `submit_entry` before that write finishes. |
| Failure handling | **Passed.** Terminal save errors and version conflicts block submission with a clear message. |
| Production/browser verification | **Pending.** Production is still on the incompatible 20-migration database and has no authenticated browser E2E gate. |

`REL-003` is implemented and tested in the repository. It remains partially open until the compatible production release is restored and the real browser journey is verified.

## Original defect

`PredictionsProvider.submit()` previously called `submitEntry()` immediately.

At the same time:

- match scores were held behind a 600 ms debounce;
- bracket snapshots were held behind a separate 600 ms debounce;
- ties and Golden Boot writes could still be in flight or retrying through the shared save controller.

Pressing submit immediately after the final edit could therefore let the server validator observe an older database snapshot and reject an entry that looked complete in the browser.

## Implementation

### Save-controller settlement barrier

`createSaveController()` now exposes `waitForSettled()`.

The barrier resolves only when every known save key has reached a terminal state. It waits through:

- a current in-flight request;
- a coalesced newer value behind that request;
- automatic retry backoff;
- the next retry request.

Its result distinguishes:

- all saves completed successfully;
- one or more terminal save errors;
- one or more optimistic-concurrency conflicts;
- cancellation because the active entry/provider reset or unmounted.

Reset and disposal cancel outstanding barriers so submission cannot continue against an obsolete entry context.

### Provider submission order

`PredictionsProvider.submit()` now:

1. prevents duplicate submission attempts;
2. marks the submission barrier active;
3. converts every pending score debounce into an immediate controller write;
4. converts a pending bracket debounce into an immediate controller write;
5. awaits the controller settlement barrier;
6. blocks on cancellation, terminal errors or conflicts;
7. calls `submit_entry` only after every write has succeeded.

Tie and Golden Boot changes already enter the controller immediately and are therefore included automatically.

Edits made while submission is waiting bypass the debounce and join the same barrier immediately.

## Related timer hardening

The work also removes several stale-timer paths:

- match debounce entries are deleted when they fire;
- all score/bracket debounce timers are cancelled when the active entry changes;
- all debounce timers are cancelled on provider unmount;
- toggling a Joker cancels an older delayed score save before issuing the combined row immediately;
- clearing one side of a score cancels any older complete-score debounce, preventing stale values from being persisted later.

The last item does not implement `DATA-005` deletion of an already persisted complete prediction; it only prevents an unsent stale debounce from firing after the local prediction becomes incomplete.

## Executable evidence

### Controller tests

`tests/app/saveController.test.ts` proves:

- one key remains serialized and only its newest coalesced value is sent;
- a barrier waits for multiple keys and the newest pending value;
- retry exhaustion returns the failing key;
- version conflict returns the conflicted key without retry;
- reset cancels an outstanding barrier;
- late completion after reset/disposal cannot advance submission state.

### Provider tests

`tests/app/PredictionsProvider.submit.test.tsx` proves:

- pressing submit before the final score's 600 ms debounce expires starts the score save immediately;
- `submit_entry` is not called until that score save resolves;
- pressing submit before the final bracket snapshot's debounce expires starts bracket persistence immediately;
- `submit_entry` is not called until bracket persistence resolves;
- a flushed save that exhausts automatic retries prevents `submit_entry` entirely.

Application CI run #92 passed:

- install;
- TypeScript/build;
- lint;
- all tests;
- production dependency audit.

## Product behavior

The Review page already displays `submitting` as a loading state. During the barrier this now means the app is finishing the user's latest changes before submission, not merely waiting for the submission RPC.

Failure messages direct the user to:

- retry failed saves; or
- resolve an optimistic-concurrency conflict.

The server-side `submit_entry` validator remains authoritative for entry completeness and lock enforcement.

## Remaining closure evidence

After migrations 21–34 restore production compatibility, verify with an authenticated production owner account:

1. edit the final score and immediately confirm submission;
2. reload and verify the exact score persisted and the original submission timestamp was stamped/preserved;
3. edit the final bracket pick and immediately submit on a fresh controlled entry or safe pre-lock test account;
4. reload and verify the complete bracket persisted;
5. simulate a failed write and confirm submission is blocked with the save-error message;
6. simulate or create a version conflict and confirm submission is blocked until resolved;
7. confirm ties and Golden Boot changes made immediately before submission are also preserved.

A Playwright or equivalent authenticated browser journey should then become the durable closure gate.

## Environment boundary

No Supabase schema, hosted data, migration history, Netlify configuration or Auth setting was changed by this work.

Production still requires the separately approved migrations 21–34 compatibility rollout before this behavior can be considered production-verified.