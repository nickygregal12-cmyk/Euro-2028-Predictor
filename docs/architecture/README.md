# Architecture planning documents

This directory separates **programme planning** from **engineering planning**.

| Document | Role |
| --- | --- |
| [`programme-plan.md`](programme-plan.md) | Parent product programme: phases, parallel workstreams, discovery, design, instrumentation, go-to-market and failable product gates |
| [`multi-competition-hub-build-plan.md`](multi-competition-hub-build-plan.md) | Child engineering workstream: Stage A–L implementation sequence and engineering exit evidence |

Neither planning document overrides an ADR. Decisions are governed by [`../adr/README.md`](../adr/README.md), especially ADRs 0011–0018. Current implementation and hosted facts live in [`../quality/current-status.md`](../quality/current-status.md), and the repository's live execution order remains [`../roadmap.md`](../roadmap.md) until deliberately reconciled.

A cold reader should use the documents in this order:

1. programme plan for why, when and how the wider product work is gated;
2. engineering workstream for implementation sequence;
3. ADRs for binding decisions;
4. current status for what is actually true now.
