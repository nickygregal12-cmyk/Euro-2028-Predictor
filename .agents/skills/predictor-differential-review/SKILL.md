---
name: predictor-differential-review
description: Use as an additional review pass for security- or contract-sensitive diffs such as auth, RLS/RPC, permissions, secrets/env handling, providers, admin, migrations, scoring, settlement, or large cross-layer refactors.
---

# Predictor differential-review adapter

This is a **conditional review skill**, not a routine PR ceremony.

Use it when the changed surface includes auth, RLS/RPC, permissions, secrets/environment handling, provider boundaries, admin capabilities, migrations, scoring/settlement, security controls, or a large cross-layer refactor with meaningful blast radius. Do not load it for ordinary copy, styling or small isolated presentation changes.

1. First establish the exact base/head diff and repository authorities. Review the work product, not the implementation session history.
2. Materialize the pinned external reviewer with `npm run agent:skill -- differential-review`, then read the printed `SKILL.md` and only the references needed for this diff.
3. The upstream material is CC BY-SA 4.0 and stays in ignored local cache; do not copy it into repository documentation or product code. The Predictor adapter itself owns the repository-specific routing rules.
4. Treat upstream `allowed-tools` names as capability descriptions, not a requirement for Claude-specific primitives. Use the coding client's available read/search/git/shell equivalents. If no dedicated `adversarial-modeler` subagent exists, perform that adversarial phase directly rather than skipping it or installing another framework.
5. The upstream instruction to always create a markdown report does **not** mean a tracked repository document. Put disposable review output under ignored `.artifacts/` when a file helps the review, or report the findings directly in the PR/chat. Commit a durable report only when the current repository authority or user explicitly requires one.
6. Do not pull in the upstream `audit-context-building` or `issue-writer` integrations merely because they are mentioned. The Predictor task packet, Graphify/Serena and current authorities already provide the bounded context path.
7. Use git history/blame only where it explains intent or security invariants. Do not let historical code outrank current contracts.
8. Challenge findings against executable source/tests and current authorities before reporting them. Distinguish a real regression from a deliberate contract change.
9. Report blast radius, missing regression coverage and concrete evidence. A review finding is not proof until the affected path has been traced and, where practical, reproduced/tested.

This skill does not replace the repository's existing CodeQL, dependency, security, migration or browser gates.
