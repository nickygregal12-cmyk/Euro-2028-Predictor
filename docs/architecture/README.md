# Architecture planning documents

This directory separates **programme planning** from **engineering planning** and focused product/data workstreams.

| Document | Role |
| --- | --- |
| [`phase-0-world-cup-evidence.md`](phase-0-world-cup-evidence.md) | **The only user evidence the programme holds.** Owner observation of a live World Cup predictor, ~60 users, through a full tournament. Where it contradicts a planning assumption the evidence wins and the assumption is corrected |
| [`programme-plan.md`](programme-plan.md) | Parent product programme: phases, parallel workstreams, discovery, design, instrumentation, go-to-market and failable product gates |
| [`multi-competition-hub-build-plan.md`](multi-competition-hub-build-plan.md) | Child engineering workstream: Stage A–L implementation sequence and engineering exit evidence |
| [`provider-enrichment-plan.md`](provider-enrichment-plan.md) | **P1 post-provider-foundation data/product workstream:** what football reference, team/player, kit, lineup, event and statistics data to measure, store/cache or derive; preserves the separate protected result/scoring authority |
| [`stage-c1-c2-governance.md`](stage-c1-c2-governance.md) | Retained Stage C split authority: C1 competition-season foundation has landed; C2 profile ownership/account erasure remains blocked by issue #272 |
| [`stage-c1-contract-classification.md`](stage-c1-contract-classification.md) | Executable classification of all 49 Stage C/C2-before-state assertions: 40 C1, zero authorised C2 after-state and nine shared-before-state |
| [`stage-c1-schema-overlay.md`](stage-c1-schema-overlay.md) | **C1 implementation authority:** relation, function, RLS, migration-order and evidence dispositions that separate the combined design from blocked C2 work |
| [`stage-c-competition-season-schema.md`](stage-c-competition-season-schema.md) | Approved combined Stage C design record, retained as reasoning and overlaid for implementation by the C1/C2 governance and C1 schema overlay |
| [`stage-c-schema-coverage.md`](stage-c-schema-coverage.md) | Exhaustive original object/function inventory; current C1/C2 implementation disposition is in the schema overlay |
| [`stage-c-tournament-id-compatibility.md`](stage-c-tournament-id-compatibility.md) | Exact pre-migration inventory of the retained physical `public.*.tournament_id` compatibility surface |
| [`stage-c-trigger-bindings.md`](stage-c-trigger-bindings.md) | Current effective inventory of every non-internal trigger binding on a `public` table, kept in lockstep with the executable parser/coverage guard |
| [`stage-c-euro-preservation-oracle.md`](stage-c-euro-preservation-oracle.md) | `CS-012` structural seed oracle plus the required same-database UUID/count/score/access preservation rehearsal |

Neither planning document overrides an ADR. Decisions are governed by the current index at [`../adr/README.md`](../adr/README.md), including later amendments to the original Stage A set. Current implementation and hosted facts live in [`../quality/current-status.md`](../quality/current-status.md), and the repository's execution order lives in [`../roadmap.md`](../roadmap.md).

A cold reader should use the documents in this order:

0. [`phase-0-world-cup-evidence.md`](phase-0-world-cup-evidence.md) first, because it is observation rather than reasoning. Several planning statements downstream of it are corrections *made because of it*, and they read as arbitrary without it;
1. programme plan for why, when and how the wider product work is gated;
2. engineering workstream for implementation sequence;
3. [`provider-enrichment-plan.md`](provider-enrichment-plan.md) when working on football-data enrichment, Match Centre data or provider-backed team/player information;
4. ADRs for binding decisions;
5. the Stage C governance amendment, assertion classification and C1 schema overlay when touching that retained boundary;
6. the original combined Stage C design/coverage and their detailed inventories for historical/schema reasoning;
7. current status for what is actually true now.
