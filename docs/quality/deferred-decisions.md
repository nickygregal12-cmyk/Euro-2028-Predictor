# Deferred decision register

This register records decisions deliberately postponed because of timing, missing authoritative information or unresolved architecture. It is not a general backlog. Normal implementation tasks belong in GitHub Issues and product sequencing belongs in the existing roadmap and build TODO.

| ID | Decision or deferred item | Context | Reason deferred | Dependency | Decision owner | Review trigger | Status | Last reviewed |
| -- | ------------------------- | ------- | --------------- | ---------- | -------------- | -------------- | ------ | ------------- |
| — | No quality-governance decisions recorded during setup | — | — | — | — | — | — | — |

## Register rules

- Use this file only when a real decision has been intentionally postponed.
- Normal fixes, feature work and audit remediation belong in GitHub Issues.
- Do not duplicate items already governed by [`../roadmap.md`](../roadmap.md), [`../build-todo.md`](../build-todo.md) or another approved decision source; link to them instead when a quality review depends on the decision.
- Every item must state why it cannot or should not be decided now.
- Every item must have a concrete review trigger, such as an official fixture release, architecture approval, capacity test, security review or pre-release gate.
- Deferred items must not disappear without a recorded decision.
- Completed, rejected or superseded decisions remain in the table for traceability.
- Record the accountable decision owner or approving role.
- A deferred decision must not be presented as implemented behaviour.

## Suggested statuses

- Deferred
- Under review
- Decided
- Rejected
- Superseded
