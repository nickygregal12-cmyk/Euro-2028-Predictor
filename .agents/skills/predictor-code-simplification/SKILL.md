---
name: predictor-code-simplification
description: Use for explicit simplification/cleanup/refactoring of recently changed code when behaviour is already correct and the goal is lower accidental complexity without changing outputs or product behaviour.
---

# Predictor code simplification adapter

Use this as a narrow **specialist** after correctness is established.

1. Work only from the routed source/tests and the current diff. Do not turn a local cleanup into a repository-wide refactor.
2. Materialize the immutable upstream agent with `npm run agent:skill -- code-simplifier` and read its printed entrypoint.
3. Preserve behaviour exactly. Product rules, public interfaces, data contracts, routing semantics and test expectations may not change merely to make code shorter.
4. Repository conventions override upstream example conventions. In particular, do not adopt an upstream preference for function syntax, imports, React patterns or error handling when current source/lint/tests establish another local convention.
5. Prefer clarity over cleverness: remove redundant branches/abstractions, reduce nesting, improve naming, and consolidate only when responsibilities remain obvious.
6. Run the focused tests that proved behaviour before simplification, then the relevant lint/type/architecture gates. A simplification that needs weakened tests is not a simplification.
7. If cleanup exposes a real bug or architectural/product decision, stop treating it as simplification and re-route the new task.

For ordinary implementation work this skill stays unloaded unless the task explicitly asks for simplification or the agent deliberately starts a separate post-green simplification pass.