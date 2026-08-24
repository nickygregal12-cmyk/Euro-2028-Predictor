# Notification delivery

How the platform tells a player something happened. Provider-neutral by
construction, with Novu as the first adapter behind it.

This document describes a **capability that is implemented, scheduled, and not
switched on**. Contract 216 gave the send loop its first caller; no Novu account
is configured, no credential exists in this repository or in any hosted
environment, and nothing sends. That is the intended state until an owner
provisions the service deliberately.

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

### The dispatch run ledger, and why it is not a second delivery ledger

Contract 216 adds `predictor_internal.reminder_dispatch_runs`. It records
INVOCATIONS, not deliveries, and the distinction is the reason it exists.

`reminder_deliveries` answers "what happened to this reminder". It cannot answer
"did the sender run at all", and for the deployment gate it cannot answer at
all: when `NOTIFICATIONS_DELIVERY` is unset the Edge Function refuses **before**
it claims anything — deliberately, so an unauthorised deployment cannot move
rows into `sending` and then decline to send them. Correct, and it leaves the
delivery ledger with nothing to show. A silent correct refusal and a dead cron
job are the same picture without a run row.

Each firing opens a row and the sender closes it, on every path it can reach
including both of its own refusals. Three properties are worth knowing:

- **An unclosed run is evidence, not a bug.** It means the request went and the
  answer did not come back: an unreachable endpoint, a rejected caller key, or a
  sender that died mid-batch. `unreported_over_ten_minutes` is the number to
  watch, and the delivery ledger can never show it.
- **The 401 path stays silent on purpose.** An unauthorised caller must not be
  able to write to the run ledger, so a run posted with a wrong key is left open
  rather than closed with an explanation the database cannot trust.
- **A closed run cannot be reopened.** A replayed callback is refused, for the
  same reason `record_reminder_result` refuses a row that is not in flight.

It stores counts and an outcome token. Never a user, an action key, an address,
or a provider's message about a person — the same line contract 172 drew.

### The dry-run gate could not refuse, and now can

Stated here because this document asserted the opposite. Above:
"`dry_run` defaults to true on the ledger, and `NOTIFICATIONS_DELIVERY` defaults
to off here. Both must be turned off deliberately. That is two switches on
purpose." One of the two was being cleared by the other's caller.

`claim_due_reminders` set `dry_run = p_dry_run` on the row it claimed and
returned that NEW value. The dispatch loop claims with `p_dry_run: false` and
then asks `sendingIsPermitted(row)` whether the row allows sending — about a
value the same statement had just overwritten. The answer was always yes.

Contract 216 makes the claim **tighten only**: a sender may force a dry run on a
live row and may never talk a dry row into being live. The ledger keeps the last
word about a row it scheduled, and the two switches are two switches again.

This cost nothing until now only because nothing had ever invoked the sender.

## The second channel — web push (contract 217)

Email is not the only way to reach a player, and it is the one that is still
blocked: `SITE-007` records the transactional sender as waiting on the brand
decision, so no environment carries a provider credential. Web push needs no
provider account and no such decision. The browser hands the application an
endpoint, this deployment signs a request to it with a key pair it generated
itself, and the push service delivers ciphertext it cannot read.

**One reminder is still one row.** `channel` is a column on
`public.reminder_deliveries`, not a second row, so contract 163's
`(user_id, action_key, reminder_kind)` key is untouched and a player with both
channels available is told once. The claim stamps it:

| the player has | scheduled? | channel at claim |
| --- | --- | --- |
| `reminder_emails` on, no device | yes | `email` |
| `reminder_emails` off, a device | yes | `push` |
| both | yes | `push` |
| neither | **no row at all** | — |
| emails off, and the device is later pruned | already scheduled | **not claimed** |

That last row is the one that is easy to get wrong, and this contract's first
draft did. A player with emails off is scheduled because they have a device; if
that device is later disowned by the push service, a claim that simply fell
through to `email` would send them the one thing they switched off — and the
withdrawal sweep cannot catch it, because by then the row is `failed` and
retrying rather than `pending`. The claim therefore requires a channel the
player actually accepts, and a row with neither is left for the sweep to
withdraw.

**The subscription is the opt-in.** There is no `reminder_push` boolean beside
`reminder_emails`: a row in `public.push_subscriptions` exists only because a
player granted a browser permission, so it already records the consent. Turning
push off deletes the endpoint and the keys, which is the same "we cannot reach
you" that contract 163 chose for email.

**A dead endpoint falls back to email by itself.** The channel is recomputed on
every claim rather than fixed at scheduling. A push service answering 404 or 410
means the subscription is gone for good; the sender prunes it through
`public.prune_push_subscription`, records the attempt as failed, and contract
163's retry policy schedules another — which finds no device and chooses email.
Nothing else answers 404 or 410, and no other status deletes anything: a push
service having a bad ten minutes must not opt a player out of a channel they
chose.

**What may be stored as an endpoint.** The column is written from a browser and
read by a service-role function that POSTs to it, so an `https://` check alone
would let any signed-in player aim the sender at an internal address. The
request is blind, POST-only and once per reminder — the ceiling is low, but low
is not none. Both the schema and `sendWebPush` refuse an address literal, a host
with no dot, and the `.local` / `.internal` / `.lan` / `.home` / `.corp`
suffixes, and the sender does not follow redirects.

It is deliberately **not** an origin allow-list. Push endpoints live on Google's,
Mozilla's, Microsoft's and Apple's services and on self-hosted ones, and a list
of hostnames would silently stop working for a browser nobody anticipated. What
is refused is the shape that can never be a public push service; the suites
check the real four are still accepted.

**What a lock screen may show.** `supabase/functions/_shared/push/pushPayload.ts`
owns the wording, and it carries no prediction, pick, score, rank, league, name
or address — a push notification is rendered by the operating system in front of
whoever is in the room, and contract 151's whole pre-lock privacy boundary would
be undone by one helpful notification. It states no time of day either: nothing
in that path knows the player's timezone, and a deadline rendered in the wrong
one is specific, credible and wrong.

### Generating the key pair

VAPID keys are a P-256 pair this deployment owns. They identify the sender to a
push service and are not a provider account, so there is nothing to sign up for:

```bash
node -e "const c=require('node:crypto');
const {privateKey}=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const j=privateKey.export({format:'jwk'});
console.log('VAPID_PUBLIC_KEY =',Buffer.concat([Buffer.of(4),
  Buffer.from(j.x,'base64url'),Buffer.from(j.y,'base64url')]).toString('base64url'));
console.log('VAPID_PRIVATE_KEY=',j.d)"
```

The public key is assembled from the JWK coordinates rather than sliced out of
a DER export at a fixed byte offset. Both produce the same 65 bytes today; only
one of them stays correct if a key format ever changes.

The public half is public by design — every subscribing browser receives it, and
a push service uses it to check a signature. The private half is a credential and
belongs only in the Edge Function's secret store.

### Account push preference

The vNext Account surface offers push for the one reminder the delivery ledger
actually schedules. The subscription row remains the opt-in: turning the switch
on stores this browser's endpoint and encryption keys through
`save_push_subscription`, while turning it off deletes that own row before
releasing the browser subscription. Signing out follows the same order while the
old authenticated session still exists; if that own-row deletion fails, the
session remains available so the player can retry. No second preference boolean
exists.

An existing browser subscription is reused only when its application-server key
matches this deployment's configured public key byte for byte. A rotated key
deletes the old own row before releasing that local subscription, then creates
and stores the replacement; the old endpoint is never reported as current.
When storing a newly created subscription returns an error, Account verifies its
own row before rolling local state back: a present row confirms success, a
confirmed absence is safe to release, and an unavailable verification preserves
the local subscription while surfacing failure. A pre-existing matching
subscription is never released merely because storing it returned an error.

The switch appears only when the deployment supplies `VITE_VAPID_PUBLIC_KEY`,
the browser implements the Push API, the page is not an iOS browser tab that
must first be added to the Home Screen, and permission has not been denied. The
Account surface explains each unavailable state, including a failed capability
read, rather than drawing a switch that cannot work. Push capability acquisition
does not hold profile, history or the other Account reads open, and a failed
worker registration terminates as unavailable rather than waiting indefinitely.
Saving confirms only that the preference persisted; it never claims a reminder
was sent or delivered.

`src/services/supabase/database.types.ts` and its metadata are the unchanged
generated Development contract-218 artefacts. They include contract 217's
`push_subscriptions` table and `save_push_subscription` RPC, which is why the
browser integration remains typed rather than bypassing the application
Supabase boundary.

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
   records the result. Its secrets are `notification_dispatch` (the caller key —
   underscored, because Supabase rejects a hyphen in a secret name),
   `NOVU_API_KEY`, `NOTIFICATIONS_DELIVERY` and optionally
   `NOVU_API_ORIGIN` / `NOTIFICATIONS_ENVIRONMENT`.

   For the push channel it also reads `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
   and `VAPID_SUBJECT` (a `mailto:` or an https origin a push service can
   contact). **All three or none** — a pair without a subject is refused by some
   push services and accepted by others, which is the worst combination to
   debug. The subject is validated as a whole rather than by its prefix: the
   bare string `mailto:`, which is what a half-filled variable produces, is
   refused here rather than signed into every JWT and refused by the push
   service where only its logs would say so. From contract 217 the deployment gate asks for `NOTIFICATIONS_DELIVERY`
   **and at least one** of the two senders, so a deployment with VAPID keys and
   no email provider is a working deployment.
5. **Scheduling is done.** Contract 216 installs `player-reminder-dispatch`,
   which runs `select public.dispatch_due_reminders();` every five minutes. It
   needs two vault secrets to reach anything, created the same way contract 155
   creates the provider-poll pair:

   ```sql
   select vault.create_secret(
     'https://<project-ref>.supabase.co/functions/v1/notification-dispatch',
     'notification_dispatch_function_url');
   select vault.create_secret('<the caller key>', 'notification_dispatch_caller_key');
   ```

   The URL must be `https://`; an `http://` one is refused rather than used, so
   the caller key cannot go out in clear text. Until both exist the job records a
   `not-configured` refusal every five minutes and posts nothing.
6. **Reminders will still not send after all of the above**, and that is the
   design rather than a missed step. Every row is scheduled with `dry_run` true,
   because `player-reminder-schedule` is deliberately scheduled with no
   arguments so its default applies, and contract 172's pgTAP suite **fails the
   build** if any scheduled command turns it off. Making delivery live is a
   deliberate change to that contract and its assertion — an owner decision,
   recorded as such, not a configuration flip.

   The consequence of leaving it dry with a live sender is worth stating: each
   reminder is claimed, refused as `ledger-dry-run`, retried under the existing
   backoff and finally recorded `abandoned`. That is a dry run exercising the
   whole machine, and it is what the run ledger and the health panel will show.

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
