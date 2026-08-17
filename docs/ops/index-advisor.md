# Supabase Index Advisor runbook

Index Advisor is a diagnostic input, never an automatic schema authority. The migration directory, database-parity checks, pgTAP coverage and hosted contract rollout remain authoritative for every index change.

## Use it when

Use Index Advisor after a real query has been identified as slow or disproportionately expensive. Start with the exact SQL shape the application or RPC executes; do not ask it to invent indexes for an entire table speculatively.

In Supabase SQL Editor, verify the extension is available and run the candidate query through the advisor:

```sql
create extension if not exists index_advisor cascade;

select *
from index_advisor($query$
  -- Paste one representative SELECT here.
$query$);
```

The `create extension` statement is an explicit operator action. It is deliberately not placed in a migration by this integration and must not be run against Production merely to satisfy CI.

## Adoption gate

An advisor recommendation becomes a repository change only after all of the following are true:

1. `EXPLAIN (ANALYZE, BUFFERS)` or a safe equivalent demonstrates the original cost on representative data.
2. The proposed index is reviewed for write amplification, storage cost and overlap with existing indexes.
3. The same representative query is benchmarked with the candidate index.
4. The index is added through a normal timestamped Supabase migration.
5. Squawk, local database reset/lint, pgTAP and database-parity checks pass.
6. The normal Development/Production contract rollout is followed.

Do not copy every recommendation into the schema. PostgreSQL's planner may choose a different plan, and a redundant index can make writes and maintenance worse even when it looks plausible in isolation.

## Evidence to record

For any adopted index, record in the PR:

- query/RPC being improved;
- before/after plan or timing;
- tables and columns indexed;
- expected read benefit;
- expected write/storage cost;
- confirmation that an equivalent index did not already exist.
