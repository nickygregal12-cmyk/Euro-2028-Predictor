# Architecture decision records

Decision records for platform-level directions derived from the 27 July 2026 acquisition technical audit. The series deliberately starts at **0003** — designations 0001 and 0002 were never issued; do not create records under those numbers.

## Status vocabulary

- **Accepted direction** — agreed target; no or partial implementation exists.
- **Accepted direction — partially implemented** — part of the decision has shipped; the status line names what exists and what remains.
- **Implemented** — the decision is fully realised in merged code/migrations; the status line cites the evidence.
- **Superseded** — replaced by a later decision; the record is retained for traceability.

Update a record's status line when merged work changes its truth — an ADR describing shipped behaviour as future intent is a documentation defect. The records themselves are otherwise stable; substantive changes to a decision get a new ADR, not a rewrite.

## Index

| ADR | Decision | Status |
| --- | --- | --- |
| [0003](0003-asynchronous-incremental-scoring.md) | Asynchronous incremental scoring | Accepted direction — first capacity evidence (28 July 2026) shows full recompute at ~354 ms for 250 entries; not currently justified at the operating caps (see `DEC-009`) |
| [0004](0004-maintained-entry-standings.md) | Maintained entry standings | Accepted direction — table unbuilt; the pagination/current-user consequences shipped independently at contract 43 |
| [0005](0005-background-jobs.md) | Background jobs | Partially implemented — `pg_cron` auto-submit shipped (contract 41); remaining jobs and the Edge Functions half unbuilt |
| [0006](0006-admin-authorisation-and-audit.md) | Administrator authorisation and audit | Implemented (contracts 37–40) |
| [0007](0007-reference-data-caching.md) | Reference-data caching | Accepted direction — unimplemented |
| [0008](0008-live-updates.md) | Live result and standing updates | Accepted direction — unimplemented |
| [0009](0009-product-analytics.md) | Privacy-conscious product analytics | Accepted direction — unimplemented |
