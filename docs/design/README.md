# Legacy/current production UI design index

The deployed UI is now the **legacy/current production UI**. It remains supported, but broad cosmetic redesign is not the default workstream. New visual exploration belongs to vNext unless a task explicitly authorises redesign of a legacy surface.

For new frontend direction, start with [`../product/ui.md`](../product/ui.md). Do not load this design history for ordinary vNext component work.

## Use this folder only for legacy production UI work

| Document | Use it when |
| --- | --- |
| [`ui-finalisation.md`](ui-finalisation.md) | Maintaining a signed-in weekly-product surface whose current production presentation or delivery state depends on the accepted 10 August direction |
| [`hub-architecture-and-modernisation-plan.md`](hub-architecture-and-modernisation-plan.md) | You need the detailed legacy target architecture, information architecture, state model or older page/journey rationale |
| [`ui-modernisation-execution.md`](ui-modernisation-execution.md) | You are investigating how the legacy modernisation work was intended to be delivered or why a legacy implementation choice exists |
| [`hub-landing-prototype.html`](hub-landing-prototype.html) | You need the retained executable landing/Hub prototype reference |
| [`../design-system.md`](../design-system.md) | You are changing a component that remains governed by the existing production design-system rules |

These documents are deliberately retained. They contain useful implementation/design history and evidence, but their long contract and rollout narratives are not a current-state index and should not be preloaded for unrelated work.

## Authority boundaries

- Current moving repository/hosted state comes from [`../../NOW.md`](../../NOW.md) and, when a hosted claim is actually needed, [`../quality/current-status.md`](../quality/current-status.md).
- Product and game decisions come from [`../adr/README.md`](../adr/README.md) and executable authorities, not from presentation prose.
- Accepted-but-unbuilt requirements live in [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md).
- vNext presentation direction lives in [`../product/ui.md`](../product/ui.md).

Presentation documents cannot alter scoring, locks, membership, reveal, settlement, progression, provider truth or authentication authority. Where a legacy design document restates one of those rules, the governing ADR/code/tests win.

## Historical snapshot

The pre-vNext version of this index, including its historical merged-contract narrative, is preserved verbatim at [`../history/context-reset-2026-08-16/design-README.pre-reset.txt`](../history/context-reset-2026-08-16/design-README.pre-reset.txt). It is evidence from the point before the context reset, not current authority.
