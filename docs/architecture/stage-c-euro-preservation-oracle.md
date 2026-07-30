# Stage C — Euro 2028 preservation oracle

**Status:** Pre-migration contract; no Stage C schema implementation exists.  
**Baseline:** `main` at `47fffc392390678dfe3bd07ada591d6596882e6f`.  
**Safeguard:** `CS-012`  
**Parent design:** [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md)

## Purpose

Stage C must generalise the database without rebuilding Euro 2028 as a different
tournament. This oracle separates the evidence into two layers because the committed
seed can prove the full natural-key structure but cannot prove current row UUIDs.

### Layer 1 — repository structural oracle

`tests/database-parity/stageCEuroSeedPreservation.test.ts` parses
`supabase/seed.sql` and pins:

- tournament name, year, start date and end date;
- groups `A`–`F`;
- placeholder team slots `Team A1` through `Team F4`;
- all 36 group fixtures, including match reference, group, matchday, source slots,
  date and venue;
- all 15 knockout fixtures, including round, source graph, date and venue;
- the 8/4/2/1 knockout-round distribution;
- 51 unique fixture references in total;
- two fixtures per group and matchday;
- one occurrence of every unordered pair of the four slots in each group.

The canonical parsed payload has SHA-256:

`9047e1e86aebb0ee0da7d461fc7beb479c723a77922a8378e3e8d11e6816c00e`

The digest is not a substitute for the readable assertions above. It makes any
otherwise subtle date, source, venue or ordering change an explicit review event.

### Layer 2 — migration rehearsal identity oracle

The current seed inserts natural keys and lets PostgreSQL generate UUIDs. A fresh
zero-to-current rebuild therefore creates a valid equivalent tournament but cannot
prove that a Stage C migration preserved the UUIDs already stored in an existing
database.

Before applying the Stage C migration on disposable infrastructure, capture and
compare before/after values from the **same database** for at least:

- the Euro tournament UUID;
- all group, team, group-team and match UUIDs;
- every entry, league, membership, prediction and score-event UUID;
- all result, revision, third-place-resolution and Bonus Games identifiers;
- row counts and parent/child relationships;
- total points, rank order and RLS-visible rows by role.

The migration rehearsal must fail on any unexpected UUID, count, relationship,
score, rank or access-boundary change. A fresh rebuild alone does not discharge this
requirement.

## Change rules

1. An official tournament data update must change the readable assertions and digest
   deliberately in the same PR, with its source and effective date recorded.
2. Stage C schema work may add season metadata and round authority, but it must not
   change the committed Euro fixture graph as a side effect.
3. Replacing placeholder teams after the official draw is a separately sourced Euro
   data update, not evidence that the preservation guard was wrong.
4. Introducing deterministic seed UUIDs later requires an explicit compatibility
   decision; it must not rewrite UUIDs already stored in hosted databases.
5. This oracle does not assume the outcome of data-protection issue #272 and does not
   authorise SQL, a migration or a hosted schema operation.
