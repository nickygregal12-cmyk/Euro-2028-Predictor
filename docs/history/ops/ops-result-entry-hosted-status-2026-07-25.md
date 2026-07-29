# Result-lifecycle hosted status — 25 July 2026

> **Archived 29 July 2026** by the documentation consolidation. This is the dated hosted-status snapshot extracted from `docs/ops-result-entry.md`, which was split so that its live service-role/SQL reference could stay in the ops area without carrying a superseded environment snapshot alongside it. The section below is reproduced verbatim.
>
> Superseded for hosted facts by [`current-status.md`](../../quality/current-status.md) and, for the migration chain, [`ops-pending-migrations.md`](../../ops-pending-migrations.md). The live runbook remains at [`ops-result-entry.md`](../../ops-result-entry.md). Retained as dated operator evidence; the contract and migration figures below are a 25 July 2026 snapshot and are not current.

## Hosted status — 25 July 2026

| Environment | Result-lifecycle position |
| --- | --- |
| Development `iouzoutneyjpugbbtdem` | Migrations 28–32 are applied and verified. Confirm/correct/clear, immutable revisions, serialized scoring and winner propagation are available. |
| Production `vkfnsqdyhvtwyqkisxhk` | Migrations 28–32 are applied within the exact 35-version chain. The 63-check verifier and rollback-only service-role confirm/clear smoke passed. No real result, revision, score event or rank-history row is currently stored. |
