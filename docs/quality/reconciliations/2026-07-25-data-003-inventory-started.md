# DATA-003 reference-integrity inventory started

**Date:** 25 July 2026  
**Issue:** #72  
**Branch:** `agent/data-003-reference-integrity`

## Scope

This stage inventories tournament-owned tables, reference paths and mutation boundaries before any migration SQL is written.

The inventory must distinguish:

- invariants enforced by composite foreign keys or checks;
- invariants enforced only by triggers or RPCs;
- invariants enforced only in application code;
- relationships that remain intentionally mutable for authorised correction workflows;
- genuine cross-tournament or cross-reference gaps requiring database enforcement.

## Safety boundary

No production changes, hosted configuration changes, scoring changes or isolated migration deployment are authorised by this stage. Any eventual migration must rebuild from migration 1 and pass database lint, pgTAP, TypeScript/PostgreSQL parity and the established browser gate before production consideration.
