# First-party product events

Four events, named and owned by this product, emitted at the moments that
actually decide whether it is working.

## The gap this closes

`src/services/analytics/productAnalytics.ts` already wrapped PostHog, with
autocapture deliberately disabled so that "events stay intentional and
reviewable". It was measured before anything was designed: **both
`initProductAnalytics` and `captureProductEvent` had zero callers anywhere in
`src/`**. The client was never initialised and the application emitted nothing
at all.

So this stage is not "add analytics". The transport was already chosen and
already restrained. What was missing is the part that makes it first-party: a
vocabulary the product defines, and the calls that emit it.

## The vocabulary

| Event | Properties | Why it exists |
| --- | --- | --- |
| `entry_submitted` | none | The act the whole product exists for, and the denominator every other number is read against. |
| `invite_opened` | `signedIn` | Paired with `league_joined`, the only way to see whether invitations convert. |
| `league_joined` | none | Acquisition completed. |
| `reminders_changed` | `enabled` | Retention, in one boolean. |

## Two rules, both structural

**No free strings.** Every property is a boolean, a bounded number or a closed
literal union. There is deliberately nowhere to put a display name, an email, a
league name, or — the one that would actually matter — an **invite code**, which
contracts 152/158/159 treat as a guessable bearer token. `joinLeague` already
refuses to report the code on its failure path; this extends the same rule to
the success path by making the property impossible rather than forbidden.

A property that cannot hold a secret cannot leak one, and that survives a
future contributor who has not read this document.

**Nothing comes back.** `recordProductEvent` returns `void` and is not `async`.
The programme's binding constraint is that reliability and analytics
instrumentation never becomes result, scoring, lock, membership or
model-selection authority, and the cheapest way to guarantee that is to give
callers no value to be tempted by. An `await` would additionally let a caller
sequence a player's action behind an analytics request; there is nothing to
await.

## Where each one is emitted, and why there

Three of the four are emitted **inside the service function that performs the
act**, not at the component that calls it:

- `submitEntry` has one caller today; `joinLeague` and `updateReminderEmails`
  have two each.
- Counting at the act means no future path can be added that forgets to count.
  Analytics that misses half the joins is worse than no analytics, because it
  produces a confidently wrong number rather than an obviously absent one.
- Each fires only **after** the server said yes. An attempt that failed is not a
  submission.

`invite_opened` is the exception, because arriving at an invitation is not a
service call. It fires once per landing, as soon as the landing resolves either
way — including when the visitor has no session, which is the branch most likely
to be lost and the one that would be hidden by counting only after sign-up.

## Startup

`initProductAnalytics()` is called from `main.tsx`, fire-and-forget, and is
deliberately not awaited before the first render. With no key configured it
returns immediately and the PostHog chunk is never requested. Either way a
player waits for nothing.

## What it costs, measured

Giving the wrapper its first callers puts `posthog-js` into the module graph,
where it had never been. Built in isolated worktrees:

| | entry chunk | all JS | files |
| --- | --- | --- | --- |
| before | 85.7 KB gz | 480.6 KB gz | 154 |
| after | 85.7 KB gz | 558.8 KB gz | 156 |

**+78 KB gz, all of it one vendor chunk, and the entry chunk does not move.**
No player downloads a byte more than yesterday: the chunk is reached through a
dynamic import that is only awaited when `VITE_POSTHOG_KEY` is set, and no
environment sets one — so it is emitted and never fetched.

That took the repository's compressed `all JS` budget over, and the budget was
raised to 573 with the measurement recorded in
`scripts/check-bundle-budget.mjs` and an explicit ratchet exception. Making the
import lazier was tried first and does not help: Rollup emits a chunk for every
dynamic-import specifier in the graph whether or not the call site survives
dead-code elimination, so the file count rose and the total did not move.

Removing the four call sites returns the build to 480.6 exactly.

## Deliberately not in this stage

- **A dashboard.** The programme forbids a generic dashboard framework, and
  PostHog already has one.
- **Identifying players.** No `identify` call, no user properties. The events
  answer product questions, not "who".
- **More events.** Four moments, each with a stated question behind it. A
  vocabulary grows by someone needing an answer, not by instrumenting
  everything reachable.

## Acceptance

- With no key configured, nothing is requested and no event is sent.
- Each of the four events fires exactly once, at its moment, after success.
- No event carries a free string, and none can be made to carry an invite code.
- `recordProductEvent` returns nothing and cannot throw or reject.
- A failing analytics endpoint does not fail or delay any player action.
