# Notification delivery

How the platform tells a player something happened. Provider-neutral by
construction, with Novu as the first adapter behind it.

This document describes a **capability that is implemented and not switched
on**. No Novu account is configured, no credential exists in this repository,
and nothing sends. That is the intended state until an owner provisions the
service deliberately.

## The boundary

```text
domain fact (lock passed, matchweek settled, entrant eliminated)
        ↓  emitted by whatever owns that fact
NotificationEvent          supabase/functions/_shared/notifications/notificationEvents.ts
        ↓  pure mapping, no network, no clock
NotificationPayload        supabase/functions/_shared/notifications/notificationPayload.ts
        ↓  provider-neutral interface
NotificationService        supabase/functions/_shared/notifications/notificationService.ts
        ↓  one implementation
Novu adapter               supabase/functions/_shared/notifications/novuAdapter.ts
```

Application code depends on `NotificationService`. It must not import the
adapter, and it must not learn that Novu exists. Swapping provider means adding
a sibling file to `novuAdapter.ts`, not editing the application.

### What this layer may not do

It **reports** domain facts and never **derives** them. An `lms.eliminated`
event is sent because the progression authority eliminated somebody; it is not
evidence that anyone was eliminated, and nothing may treat it as such. The same
holds for locks, scoring, settlement, reveal, membership and provider data —
see [`../../AGENTS.md`](../../AGENTS.md).

`null` means unavailable and is carried through as `null`. A notification that
renders an unknown value as `0` is stating something the domain did not.
`results.matchweek_points` carries an explicit `basis` of `awarded` or
`provisional` for the same reason: a provisional total presented as final is a
wrong answer rather than a rounding difference.

## Event taxonomy

Nineteen kinds in five categories, each mapped to its own workflow identifier.

| Category | Kinds |
| --- | --- |
| `predictions` | window closing, entries outstanding, locked, matchweek opened |
| `leagues` | invitation received, rank changed, overtaken, rival moved |
| `social` | followed-player activity, head-to-head moved |
| `last-man-standing` | round opened, selection confirmed, survived, eliminated, next round available |
| `results` | matchweek points, exact score, rank movement, competition milestone |

Adding a kind without classifying it, or without giving it a workflow, fails to
compile — both maps are total over the union.

## Safety properties, and where each is held

| Property | Held by |
| --- | --- |
| A credential alone does not send; `NOTIFICATIONS_DELIVERY=enabled` is also required | `resolveNotificationConfiguration` |
| The secret cannot reach the browser bundle — no `VITE_` name, no `import.meta.env` read | `notificationBoundary.test.ts` |
| The adapter refuses to be constructed where a DOM exists | `novuAdapter.ts` |
| A malformed event never reaches the provider | `notificationService.ts` |
| Delivery failure never propagates into the emitting operation | `createNotificationService` |
| A retry cannot duplicate a notification | per-fact `transactionId` |
| No accidental send from a test | MSW with `onUnhandledRequest: 'error'` |
| vNext, Storybook, the design system and every component stay uncoupled | `notificationBoundary.test.ts` |
| No provider SDK enters the bundle | `notificationBoundary.test.ts` |

The adapter uses `fetch` against Novu's HTTP API rather than an SDK. One
authenticated POST does not justify putting a package one careless import away
from a measured production bundle.

## The reminder delivery ledger already exists — this is its other half

**Read this before building anything that schedules, retries or records a
notification.** That work is done, in the database, and duplicating it is the
obvious mistake to make from here.

`public.reminder_deliveries` (contracts 163 and 172, `DFA-012`) is a complete
delivery ledger with a scheduler, retry accounting and an audit trail. What it
has never had is a provider — [`../roadmap.md`](../roadmap.md) records it as
"no provider is chosen and nothing sends". This boundary is that missing half.

The split is clean, and neither side should grow the other's job:

| Concern | Owner |
| --- | --- |
| when a reminder is due, claiming it, retrying, abandoning, stall reclamation | `reminder_deliveries` and its functions |
| what a domain event means, and how it becomes a provider payload | this boundary |
| actually sending | the Novu adapter |

The seam is already shaped for it:

```text
public.claim_due_reminders(p_limit, p_dry_run)   -- rows that are due
        v
NotificationService.deliver(event)               -- this boundary
        v
public.record_reminder_result(
    p_id, p_sent, p_provider, p_provider_message_id, p_error)
```

`DeliveryOutcome` maps onto that call directly: `delivered` is `p_sent`, and a
refusal's `reason` is what belongs in `p_error`.

Two things to get right when wiring it, both of which look like duplication and
are not:

- **There are two idempotency mechanisms and they guard different things.** The
  ledger's `unique (user_id, action_key, reminder_kind)` stops the same
  reminder being *scheduled* twice. This boundary's `transactionId` stops the
  same fact being *sent* twice when a claim is retried after an ambiguous
  failure. Removing either does not simplify anything.
- **`dry_run` defaults to true on the ledger, and `NOTIFICATIONS_DELIVERY`
  defaults to off here.** Both must be turned off deliberately. That is two
  switches on purpose, not an oversight to tidy away.

`DeliveryOutcome` now carries `providerMessageId` — Novu's own transaction id,
read from the trigger response — which is what `p_provider_message_id` records.
It is deliberately distinct from this boundary's `transactionId`: one traces
the run in Novu's activity feed, the other is our idempotency key.

Nothing above is wired. `DFA-012` and `SITE-007` are **not** closed by this
change: no provider is configured, no claim loop calls this boundary, and
nothing sends.

## Every event, classified — 20 August 2026

**Nineteen kinds exist. Two can be delivered.** A taxonomy is a list of things
somebody could be told; it is not a list of things this platform can currently
tell anybody, and the gap between those two is where a notifications programme
usually goes wrong — a preference screen offering nineteen switches, seventeen
of which do nothing.

The classification is derived from what actually emits. `player_action_items`
constrains its `action_type` to six values, `reminder_deliveries` constrains
its `reminder_kind` to `deadline` and `final_call`, and
`notification-dispatch/reminderEvents.ts` names ONE supported action type. That
chain, not the taxonomy, is what decides.

| Kind | State | Why |
| --- | --- | --- |
| `prediction.window_closing` | **deliverable** | `reminder_kind = 'deadline'` on `matchweek_predictions_due`, mapped and tested. |
| `prediction.entries_outstanding` | **deliverable** | `reminder_kind = 'final_call'` on the same action type. |
| `league.invitation_received` | server event exists, not wired | `league_invitation` is a generated action item; the dispatch loop refuses it as `unsupported-action-type`. |
| `lms.round_opened` | server event exists, not wired | `lms_pick_due` is generated; same refusal. Which of the LMS kinds it should become is a product question, not a mapping one. |
| `results.matchweek_points` | server event exists, not wired | `matchweek_settled` is generated; same refusal. Its `basis` must carry `awarded` vs `provisional`, which is why a plausible mapping is not good enough. |
| `results.rank_movement` | server event exists, not wired | `game_consequence` is generated and covers more than rank movement; splitting it needs evidence about what a player should be told. |
| `results.competition_milestone` | server event exists, not wired | Same action type, same question. |
| `prediction.locked` | blocked — no emitter | Nothing schedules a reminder for a lock that has already passed, and a lock is not an action item. |
| `matchweek.opened` | blocked — no emitter | The matchweek opening generates no action item and no reminder row. |
| `lms.selection_confirmed` | blocked — no emitter | `save_lms_selection` writes the pick; nothing emits a fact about it. |
| `lms.survived` | blocked — no emitter | Settlement writes the outcome; no reminder or event is produced from it. |
| `lms.eliminated` | blocked — no emitter | As above. |
| `lms.next_round_available` | blocked — no emitter | As above. |
| `league.rank_changed` | blocked — no emitter | Movement is computed on read (contract 150), not emitted. |
| `league.overtaken` | blocked — no emitter | As above, and it needs a per-player before/after nothing currently stores. |
| `league.rival_moved` | blocked — no emitter | As above. |
| `results.exact_score` | blocked — no emitter | Settlement stores the fact; nothing emits it per player. |
| `social.head_to_head_moved` | future | Contract 192 supplies a rivalry READ; there is no movement event and no schedule for one. |
| `social.followed_player_activity` | **future, and blocked at the product layer** | Following another player is genuinely unimplemented — `PROF-002`. `get_my_preferences` returns pinned rivals as bare ids with no name and no season ref, so there is no list to notify about. |

**One generated action type has no kind at all.**
`cup_penalty_number_due` is a real action item the Championship produces and the
taxonomy has nowhere to put it. That is a gap in the taxonomy rather than in the
wiring, and it is named here rather than papered over by mapping it to something
adjacent.

### What this means for the interface, and it is a restraint

The vNext Account surface offers ONE notification preference — reminder emails,
which is the only thing the ledger schedules — and it will keep offering exactly
one until a second kind is genuinely deliverable.
`tests/vnext/notificationPreferences.test.tsx` holds that: a switch for a
category the backend cannot honour is a promise the product cannot keep, and the
player who turns it on has no way to discover that nothing happened.

The three layers stay separate and none of them stands in for another:

| Layer | Where it is | State |
| --- | --- | --- |
| In-app attention | `player_action_items`, drawn by the vNext shell's attention band and Home | **live**, and independent of any of the above |
| Email reminders | `reminder_deliveries` → this boundary → Novu | implemented end to end, **switched off** |
| Browser/device push | — | **does not exist.** No service worker, no push subscription, no VAPID key, no storage for one. It is not offered, because offering it would be the interface inventing a channel. |

## Switching it on

Nothing here is a hosted action, and none of it is done.

1. Create the nineteen workflows in the Novu environment. Get the list from
   the source rather than by reading it off:

   ```bash
   npm run notifications:workflows          # identifiers, categories, payload vars
   npm run notifications:workflows -- --json
   ```

   **A missing workflow does not fail loudly, and this is the trap.** Novu
   answers **2xx** for a trigger it accepted and then declined to act on — the
   workflow is absent, disabled, or has no channel steps — with a `status` of
   `trigger_not_active`, `no_workflow_steps_defined`,
   `no_workflow_active_steps_defined`, `invalid_recipients`, `no_tenant_found`
   or `error`. Reading the HTTP status alone would record a delivery for a
   notification nobody received, and the ledger would then mark it `sent` and
   never retry.

   The adapter reads the body and reports those as
   `provider-not-processed:<status>`, which is the string to look for when a
   notification does not arrive.
2. Put `NOVU_API_KEY` in the server-side secret store of whichever runtime
   emits events. Never in a committed file, never with a `VITE_` prefix.
3. Set `NOTIFICATIONS_DELIVERY=enabled` for that runtime **only**. Leave it
   unset everywhere else — previews and CI included.
4. Deploy `supabase/functions/notification-dispatch` and set its secrets. This
   is the send loop: it claims due reminders, maps them, delivers them and
   records the result. **It is written and tested but has never been
   deployed.** Its secrets are `notification_dispatch` (the caller key —
   underscored, because Supabase rejects a hyphen in a secret name),
   `NOVU_API_KEY`, `NOTIFICATIONS_DELIVERY` and optionally
   `NOVU_API_ORIGIN` / `NOTIFICATIONS_ENVIRONMENT`.
5. Schedule it, the same way contract 172 schedules the reminder scheduler.

### What the dispatch loop will and will not send

Scope is **deadline reminders only**, because that is what the ledger actually
schedules. `reminder_kind` `deadline` becomes `prediction.window_closing` and
`final_call` becomes `prediction.entries_outstanding`, both for action type
`matchweek_predictions_due`.

`lms_pick_due`, `cup_penalty_number_due`, `matchweek_settled`,
`game_consequence` and `league_invitation` all have plausible-looking homes in
the taxonomy and **none is wired**. Each needs its own evidence about what the
notification should say, and a plausible mapping is still a guess about what to
tell a player. They are recorded in the ledger as
`unsupported-action-type:<type>` rather than skipped silently.

Nothing is invented. Where the action item carries no usable `matchweek`, or a
final call has no outstanding count to state, the row is refused with a reason
rather than sent with a guess — a reminder naming the wrong matchweek is worse
than one that did not go out, because the second gets retried and the first
gets believed.

Three independent switches must all be open before anything sends: the caller
key, the ledger's own `dry_run` on the row, and `NOTIFICATIONS_DELIVERY` on the
deployment.

Persisted per-player notification preferences would need schema. That is **not**
included here and must not be added casually: inspect the existing profile and
preference tables first, reuse them if they fit, and only then consider a
migration under the repository's contract-number authority.
