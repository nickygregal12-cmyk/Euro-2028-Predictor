# Batch B opened — contracts 138 and 139 — 9 August 2026

| Field | Value |
| --- | --- |
| Status | Dated handover at the commit it was written against |
| Purpose | Record what the first batch-B change contains, what it deliberately leaves alone, and what remains after it |
| Pull request | [#616](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/616) |
| Preceded by | [`2026-08-09-batch-a-contracts-135-136-handover.md`](2026-08-09-batch-a-contracts-135-136-handover.md) |
| Does not authorise | Any production movement, or any hosted claim not separately evidenced |

---

## Why these two, and why together

Both are bounded reads over things that already exist and nothing can see. That
is the same defect shape this repository has now corrected at contracts 86, 98,
116, 118, 120 and 128 — an authority is built, and no browser-reachable function
can reach it. These are the seventh and eighth instances.

They were batched because the fixed cost of a contract here is the nine-document
sweep and the registry pins, not the SQL. Two reads sharing one sweep is
materially cheaper than two sweeps, and they share a shape closely enough that a
reviewer reads them once.

## Contract 138 — the administrator review queues

**Measured before it was built.** Seven append-only review queues existed:

| Contract | Queue | What it holds |
| --- | --- | --- |
| 117 | `season_fixture_revisions` | kickoffs a provider moved |
| 123 | `round_window_refresh_conflicts` | window refreshes refused |
| 125 | `season_fixture_result_revisions` | every official result change |
| 132 | `provider_fixture_proposals` | calendars awaiting approval |
| 135 | `provider_result_refusals` | results the platform declined |
| 135 | `provider_status_observations` | status tokens we cannot read |
| 135 | `provider_response_consumption` | what the driver did with each response |

Of the 75 contracted browser RPCs, the only functions naming any of them were
contract 132's two **decision** functions, which write. So an administrator could
approve a calendar they could not see, and could not see the other six at all.

Contract 135 sharpened this, which is why it came first in batch B: **it refuses
silently by design**. A result declined because an administrator owns the fixture,
or because a status token has never been measured, was recorded and then
invisible.

### It writes as well, deliberately

Contracts 117 and 123 both carry `reviewed_at`, with the same comment — *"Null
until an administrator has looked. Unreviewed rows are the queue."* Nothing has
ever set it.

A read alone would therefore have shipped the same half-thing this contract
exists to remove. Two properties make the write safe:

- **it is not a decision.** Acknowledging a refusal does not apply the result the
  provider was refused. Contract 132's proposals are readable and deliberately
  *not* acknowledgeable, because approve/reject is their lifecycle and a second
  way to mark them handled creates two answers to "is this decided?";
- **it cannot rewrite history.** Acknowledging an already-reviewed item leaves
  `reviewed_at` at its first value, so *when a human first looked* cannot be moved
  by looking again.

Who acknowledged what is recorded once, uniformly, in its own relation — which
also gives contracts 117 and 123 an actor they never had, without altering either
table.

## Contract 139 — the season fixtures read

Closes the `MASTER-TODO` Stage D item carried since the owner's amendment of
5 August 2026.

**Why it had no implementation:** a season had no fixtures read at all.
`get_season_matchweek_card` returns one round to one entrant, requires an entry,
carries that entrant's predictions and cannot span rounds — which is exactly what
a rescheduled match requires.

**Why a date window rather than a matchweek.** Taking a matchweek reintroduces
the defect. A fixture postponed out of matchweek 5 keeps
`competition_round_id = 5` — that is the amendment, and it is deliberate — so a
by-round query returns it under a September heading however the rows are sorted
afterwards. The round travels as a **label**, and `190_season_fixtures_read.sql`
builds the case deliberately, because a by-round implementation passes every
other assertion in that file.

It is football, not entry: no prediction, no Joker, no points, so it needs no
membership check beyond being signed in. The confirmed `result` and contract
135's provisional `live` block stay in two separate fields, because merging them
discards the distinction the ingestion boundary exists to preserve.

## What the registries cost, and why that is worth recording

Six pinned inventories had to move, and every one of them caught something a
reviewer would have had to notice by hand:

- the RPC allowlist and `080_function_privileges.sql` — three new browser RPCs;
- the internal-relation list — one new internal table;
- **both** `auth.users` foreign-key matrices — one new `actor_id`;
- the Stage C coverage manifest — two new `p_tournament_id` signatures;
- the Stage C1 overlay positive control — 65 to 67.

None of that is friction to be reduced. A new admin RPC and a new actor foreign
key are precisely what those pins exist to surface.

## What remains after this

| Slot | Item |
| --- | --- |
| 140 | Championship tie settlement driver — `settle_season_cup_tie` still has no caller, so a season Championship tie cannot resolve |
| 141 | LMS withdrawal eligibility read — `leave_competition_game` refuses once a score event exists and nothing exposes that, so a Leave control cannot honestly predict itself |
| 142 | Championship multi-group shape — seeding, draw and bracket, which every public hundred-entrant field takes |
| — | The enrichment lane (team profiles, lineups, events, statistics, availability) and the derived form/H2H work, all as inventoried on 9 August |

## Still outstanding, and not this branch's to fix

Pull request #602 claims contract 135, which has been taken since contracts 135,
136 and 137 merged. It needs renumbering to the next free number, which is 140
once this merges. Its migration has never been applied to any environment, so
renaming remains available to it.
