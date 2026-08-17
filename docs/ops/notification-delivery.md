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
NotificationEvent          src/services/notifications/notificationEvents.ts
        ↓  pure mapping, no network, no clock
NotificationPayload        src/services/notifications/notificationPayload.ts
        ↓  provider-neutral interface
NotificationService        src/services/notifications/notificationService.ts
        ↓  one implementation
Novu adapter               src/services/notifications/novuAdapter.ts
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

## Switching it on

Nothing here is a hosted action, and none of it is done.

1. Provision a Novu environment and create the nineteen workflows named in
   `notificationPayload.ts`. Until a workflow exists, triggering it returns a
   provider error and the boundary reports `provider-error`.
2. Put `NOVU_API_KEY` in the server-side secret store of whichever runtime
   emits events. Never in a committed file, never with a `VITE_` prefix.
3. Set `NOTIFICATIONS_DELIVERY=enabled` for that runtime **only**. Leave it
   unset everywhere else — previews and CI included.
4. Wire emission at the points that own each fact. This is the deliberately
   unbuilt half: no caller emits events yet, because the emitting sites are
   settlement, lock and progression paths whose authority is not this layer's
   to assume.

Persisted per-player notification preferences would need schema. That is **not**
included here and must not be added casually: inspect the existing profile and
preference tables first, reuse them if they fit, and only then consider a
migration under the repository's contract-number authority.
