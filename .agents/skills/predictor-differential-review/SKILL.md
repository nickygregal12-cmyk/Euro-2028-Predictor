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
4. Use git history/blame only where it explains intent or security invariants. Do not let historical code outrank current contracts.
5. Challenge findings against executable source/tests and current authorities before reporting them. Distinguish a real regression from a deliberate contract change.
6. Report blast radius, missing regression coverage and concrete evidence. A review finding is not proof until the affected path has been traced and, where practical, reproduced/tested.

This skill does not replace the repository's existing CodeQL, dependency, security, migration or browser gates.
