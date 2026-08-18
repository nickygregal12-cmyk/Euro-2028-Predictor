# Architecture workstream index

Do not read this whole directory for a routine task. Start with [`../../NOW.md`](../../NOW.md), then open only the architecture document that owns the workstream you are changing.

ADRs remain the decision authority. Current implementation/hosted facts live outside this directory and should be loaded only when the task needs them.

## Route by task

| Workstream | Start here |
| --- | --- |
| Developer/AI tool responsibilities, context flow, coordination and architecture enforcement | [`developer-operating-system.md`](developer-operating-system.md); exact commands live in [`../ops/developer-toolchain.md`](../ops/developer-toolchain.md) |
| Football-provider enrichment, team/player data, kits, lineups, events or match statistics | [`provider-enrichment-plan.md`](provider-enrichment-plan.md) |
| Provider capability evidence | [`provider-enrichment-capability-audit.md`](provider-enrichment-capability-audit.md) only when the question actually needs the recorded capability audit |
| Competition-season / retained Stage C schema work | [`stage-c1-c2-governance.md`](stage-c1-c2-governance.md), then [`stage-c1-schema-overlay.md`](stage-c1-schema-overlay.md) or the exact inventory named by that authority |
| Weekly Hub information architecture | [`hub-information-architecture.md`](hub-information-architecture.md) |
| Acquisition / public-site architecture | [`acquisition-target-architecture.md`](acquisition-target-architecture.md) |
| Euro publication lifecycle | [`euro-publication-lifecycle.md`](euro-publication-lifecycle.md) |
| Programme-level sequencing or stage exit reasoning | [`programme-plan.md`](programme-plan.md) and, only where engineering-stage detail is required, [`multi-competition-hub-build-plan.md`](multi-competition-hub-build-plan.md) |
| Historical World Cup evidence | [`phase-0-world-cup-evidence.md`](phase-0-world-cup-evidence.md) only when product/programme reasoning needs that evidence |

## Boundaries

- Product/rule decisions: [`../adr/README.md`](../adr/README.md).
- Current moving state or hosted claims: [`../../NOW.md`](../../NOW.md) first, then [`../quality/current-status.md`](../quality/current-status.md) only when detail is required.
- Execution order: [`../roadmap.md`](../roadmap.md).
- Accepted-but-unbuilt scope: [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md).
- New frontend/vNext product direction: [`../product/ui.md`](../product/ui.md), not the architecture programme history.
- Developer-tool commands and lifecycle: [`../ops/developer-toolchain.md`](../ops/developer-toolchain.md); do not copy those instructions into product architecture.

Planning documents never override an ADR, current code or executable tests. Developer-tool output is navigation/evidence rather than authority. Historical design/schema reasoning remains useful evidence, but it should not become default context for an unrelated task.
