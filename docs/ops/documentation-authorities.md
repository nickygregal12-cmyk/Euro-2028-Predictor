# Documentation authority and context loading

**Authority:** `config/documentation-authorities.json` is the classification manifest. `scripts/check-documentation-authorities.mjs` enforces it, and the tests under `tests/scripts/` verify the controls.

This process exists to support **progressive disclosure**: a small universal entrypoint, task-specific authorities, and dated evidence only when a task actually needs history.

## Core rules

1. **One fact, one home.** A moving contract, hosted state, blocker, product rule or delivery state is maintained by its canonical authority; other files link to it.
2. **Current state before history.** `NOW.md` is the generated current-state index. Historical evidence is not default context.
3. **Evidence over narrative.** Merged code, executable tests, machine records and fresh hosted evidence outrank planning prose and previous chat summaries.
4. **Do not rewrite history.** Dated audits, investigations, reconciliations and operator records remain true to their recorded point in time.
5. **Sweep only what genuinely moves with every migration.** A sweep requirement on an unrelated router or design document trains meaningless edits and duplicated contract prose.

## Classifications

| Kind | Meaning |
| --- | --- |
| `live` | Describes current moving state. If it names contracts, the newest must be current. Use `sweep: true` only when every new migration genuinely requires revisiting it. |
| `dispositions` | A live register that may name the contract resolving an item, but does not claim the repository is currently at that contract. |
| `reference` | Stable decision, procedure, subsystem or design reference. It may name the contract that built something, but it is not a current-state ledger. |
| `structural` | Held in step by a stronger executable/structural check rather than contract-number freshness. |
| evidence directory | Dated historical evidence. It is exempt from freshness because changing it to look current would destroy its value. |
| out of scope | A tracked Markdown file governed by a stronger or different control, with an explicit reason. |

Every tracked Markdown file must resolve to one of those states. There is no unclassified fourth state.

## Current context architecture

- `NOW.md` is generated from machine-readable sources and checked by `npm run check:now`; nobody hand-maintains its moving values.
- `AGENTS.md` and `CLAUDE.md` are stable routers. They are references, not migration sweeps and not homes for moving contract state.
- `docs/product/ui.md` is the small vNext presentation direction.
- `docs/design/README.md` is a legacy/current-production UI index. The large legacy design documents are references and are not migration sweeps.
- `docs/quality/current-status.md` remains the detailed live implementation/hosted authority and is loaded when a task needs that detail.
- `docs/ops/ops-pending-migrations.md` and the machine contract records remain the migration/hosted lane.
- `docs/history/` and the existing dated evidence directories remain historical evidence.

This means a database migration no longer has to touch root agent routers or an unrelated UI design authority merely to satisfy documentation policy.

## Agent-readable safeguards

These stable safeguard IDs are part of the repository governance contract. The reset may shorten the surrounding explanation, but it must not silently discard the requirements or their identifiers.

| ID | Requirement | Enforcement |
| --- | --- | --- |
| `DOC-AI-001` | Every important fact has **one authoritative home**. Supporting files may link to it; they must not restate a moving fact. | `tests/scripts/documentationDuplication.test.ts` enforces the verbatim half; restating a fact in different words remains convention. |
| `DOC-AI-002` | Every active authority declares its authority class, status, scope, exclusions, last verification date, supersession position and implementation evidence where that control block applies. | Convention. |
| `DOC-AI-003` | **No planning statement may be described as implemented without merged code, a migration, an executable test or verified hosted evidence**, named. | Convention; `tests/scripts/adrStatusFreshness.test.ts` enforces the ADR-status half. |
| `DOC-AI-004` | **No open pull request or branch is repository truth.** Proposed work is labelled proposed, and concurrent ownership is checked before editing a file. | Convention. |
| `DOC-AI-005` | **No material statement disappears during cleanup.** It is retained, moved with a traceable link, superseded explicitly, rejected with a recorded reason, or deferred with a stable identifier. | Convention; reconciliations should state the disposition of material statements they move. |
| `DOC-AI-006` | Dated audits, investigations, reconciliations, automation reports and historical roadmaps **remain historical evidence** and are not rewritten to resemble current truth. | `evidenceDirectories` in the manifest; the manifest tests keep evidence separate from live authorities. |
| `DOC-AI-007` | Contract numbers, hosted-state values and moving commit facts belong **only** in the live-status and machine-readable authorities. | `scripts/check-documentation-authorities.mjs` freshness/classification rules and generated `NOW.md`. |
| `DOC-AI-008` | Accepted but unimplemented decisions appear in a planning authority with **a stable identifier and acceptance evidence**. | [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md) is the register. |
| `DOC-AI-009` | Documentation cleanup reduces **duplicated authority**, never product scope or a deferred requirement. | Convention; `DOC-AI-005` is the preservation rule. |
| `DOC-AI-010` | An external audit or reference document supplied for a reconciliation **is not committed** as a second repository authority. Its supported facts are integrated into their existing authorities. | Convention. |

## Adding a document

- One special file: add it to `authorities` with `kind`, `sweep` and `why`.
- A directory whose files share a classification: add the prefix to `authorityDirectories`.
- Dated evidence: place it under an `evidenceDirectories` prefix.
- Use `outOfScope` only when a stronger/different control exists and record why.

Exact-path classifications win over directory classifications. Otherwise the longest matching prefix wins.

## Validation

```bash
npm run check:documentation-authorities
npm run check:now
```

On pull requests the documentation checker also receives base/head and verifies migration sweep obligations. A documentation-only context change must not weaken those gates; it should make the set of swept documents better match the facts that actually move.

## Historical rationale

The pre-reset version of this procedure contains the detailed measurements and cleanup chronology that led to these controls. It is preserved verbatim at [`../history/context-reset-2026-08-16/documentation-authorities.pre-reset.txt`](../history/context-reset-2026-08-16/documentation-authorities.pre-reset.txt) and should be read only when that history is relevant.
