# Live leaderboard over Supabase Realtime

Standings change while a player is looking at them, without a manual refresh.

## Why this shape

[`docs/adr/0008-live-updates.md`](../docs/adr/0008-live-updates.md) already decided
the shape and this specification does not reopen it:

- a **narrow live-results channel** that *invalidates* match, standings and
  leaderboard queries;
- payloads carry **only fields already readable by the caller**, and never
  become an alternative write path;
- invalidation happens **after authoritative database changes**, never from a
  score the browser worked out for itself;
- the feature **stays guarded until hosted operational evidence exists**.

The ADR explicitly rejected subscribing to broad user-owned or scoring tables on
privacy, complexity and fan-out grounds. `docs/design-system.md` adds the
matching product decision from the 2026-07-22 walkthrough: **match-window-aware
refresh + refetch-on-focus**, and **live scores are display-only with
admin-confirmed results**.

## The signal

`public.matches` and nothing else.

It is the right table on three counts. It carries the authoritative result
lifecycle (`result_state` reaching `confirmed` or `corrected`) that recomputes
every standing downstream. It is tournament reference data, not user-owned and
not a scoring table, so it is not one of the surfaces the ADR rejected. And its
policy is already

```sql
create policy "matches readable" on matches
  for select to authenticated using (true);
```

so every authenticated subscriber can already read every row it would carry —
the payload rule is satisfied by construction rather than by care.

**The subscriber reads no payload at all.** `subscribeToMatchResultChanges`
forwards a bare "something changed" signal and discards the record. That is the
structural guarantee that this channel cannot become a second source of match
truth: there is no value flowing through it to be believed. The refreshed
numbers come from `get_leaderboard`, which is where they already came from.

Default replica identity is kept deliberately. Old-row images are not needed to
say "refetch", and not broadcasting them is less exposure for free.

## What is built

1. **Contract 218** adds `public.matches` to the `supabase_realtime`
   publication. One table, one statement.
2. **`src/services/supabase/liveResults.ts`** — the only module in the
   repository permitted to open a channel, keeping the architecture rule that
   nothing outside `src/services/supabase/` touches the client.
3. **`src/app/providers/LiveResultsProvider.tsx`** — owns the single
   subscription and publishes a monotonic `resultsVersion`. Consumers depend on
   the number, not on the transport.
4. **Two concrete consumers**: the standings list and Home's own-standing card.

## Rules the implementation must keep

**Fail closed.** `VITE_LIVE_UPDATES_ENABLED` must be exactly `'true'`. Unset,
misspelled or absent means no channel is opened at all — the product behaves
precisely as it does today. This is the ADR's "guarded until hosted operational
evidence exists", expressed the way this repository already expresses hosted
capability flags.

**One channel, not one per component.** The provider subscribes once. Six
components each opening a socket is the fan-out the ADR rejected, and this
repository has a 2.6M-request incident on record behind that concern.

**Coalesce.** A confirmed result updates several rows. Every change inside a
short window advances the version once, so a burst costs one refetch.

**Tear down.** On unmount, on sign-out, and when the flag is off. A channel that
outlives its provider is a leak that reconnects forever.

**A live refresh is a background refresh.** It must not blank a list that is
already on screen, must not turn a transient failure into an error screen over
good data, and must not re-run the "scroll to your row" effect. A live update
that yanks the viewport is worse than no live update.

**Do not silently rewrite a deep list.** `get_leaderboard` clamps a page to 100
rows. When a player has paged past that, one bounded request cannot rebuild
their view consistently, and stitching a fresh head onto stale tail pages under
a moving ranking shows duplicates and gaps. Past 100 loaded rows the list holds
still. Their own standing still updates on Home.

## Deliberately not in this stage

- **The bounded polling fallback.** ADR 0008 says a fallback *may* refresh the
  caller's standing while matches are live; it is permission, not a
  requirement. Realtime lands first and the ADR keeps the whole feature guarded
  until hosted evidence exists, so there is nothing yet for a fallback to fall
  back from. Channel errors are handled by not retrying in a loop.
- **The circuit breaker** named in `AUD-25`, which belongs with the polling it
  would break.
- **The other three leaderboard readers** (`ProfilePage`, `H2HPage`,
  `LeaguePage`). Once the provider exists each is a one-line addition, and
  proving the pattern on two surfaces first is what keeps this stage bounded.

## Acceptance

- With the flag unset, no channel is opened and no behaviour changes.
- With the flag on, a change to `public.matches` advances the version once per
  burst and both consumers refetch from the server.
- The standings list refreshes without a loading flash, without an error screen
  over good data, and without re-scrolling the viewport.
- A list deeper than 100 rows is left alone.
- Unmount and sign-out remove the channel.
- No consumer reads a realtime payload; the numbers come from
  `get_leaderboard`.
