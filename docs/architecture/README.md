# Architecture planning documents

This directory separates **programme planning** from **engineering planning**.

| Document | Role |
| --- | --- |
| [`programme-plan.md`](programme-plan.md) | Parent product programme: phases, parallel workstreams, discovery, design, instrumentation, go-to-market and failable product gates |
| [`multi-competition-hub-build-plan.md`](multi-competition-hub-build-plan.md) | Child engineering workstream: Stage A–L implementation sequence and engineering exit evidence |
| [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md) | Approved Stage C design contract for competition-season identity, rounds, locks, scoping, deletion/anonymisation, timezone authority and migration evidence |
| [`stage-c-schema-coverage.md`](stage-c-schema-coverage.md) | Exhaustive current-table, view, function, trigger, RLS, grant, RPC and compiler-control manifest for Stage C implementation |
| [`stage-c-tournament-id-compatibility.md`](stage-c-tournament-id-compatibility.md) | Exact pre-migration inventory of the retained physical `public.*.tournament_id` compatibility surface |
| [`stage-c-trigger-bindings.md`](stage-c-trigger-bindings.md) | Exact pre-migration inventory of every effective non-internal trigger binding on a `public` table |

Neither planning document overrides an ADR. Decisions are governed by [`../adr/README.md`](../adr/README.md), especially ADRs 0011–0018. Current implementation and hosted facts live in [`../quality/current-status.md`](../quality/current-status.md), and the repository's execution order lives in [`../roadmap.md`](../roadmap.md).

A cold reader should use the documents in this order:

1. programme plan for why, when and how the wider product work is gated;
2. engineering workstream for implementation sequence;
3. ADRs for binding decisions;
4. Stage-specific design and coverage documents before implementation;
5. current status for what is actually true now.
