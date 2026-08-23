---
name: predictor-compound-learning
description: Use after substantial completed work when a genuinely reusable lesson emerged that future agents could otherwise rediscover incorrectly. Capture the lesson in an existing authoritative/executable home or record nothing.
---

# Predictor compound learning

This is a **post-task process**, not a diary and not automatic permission to create documentation.

## Cheap compound check

After a substantial PR/fix, ask internally:

1. Did this work reveal a non-obvious pattern that is likely to recur?
2. Is the lesson supported by executable evidence or a durable authority rather than one agent's preference?
3. Is it already encoded by a test, ADR, product/ops authority, adapter, lint rule or source invariant?
4. Would recording it reduce future rediscovery/context cost?

If any answer is no, write nothing.

## Preferred homes

Use the narrowest existing durable home:

- **Regression/invariant** → executable test or fail-closed check.
- **Architecture/product decision** → existing governing ADR/product authority, following its normal change process.
- **Developer workflow/tool fact** → existing ops/tooling authority.
- **Agent behaviour** → existing adapter/routing rule; if a new skill/change is proposed, evaluate it with `predictor-skill-evaluator` before adoption.
- **Temporary branch/run fact** → PR/handoff evidence only, never a durable authority.

Do not create `LESSONS.md`, `MEMORY.md`, a catch-all knowledge base, or another specification tree. One fact gets one home.

## Staleness discipline

When touching an existing learned rule, verify it is still true in current source/tests. Consolidate or delete obsolete/duplicated guidance instead of appending another version. A lesson fully enforced by a clear executable test may need less narrative, not more.

The desired outcome is compounding engineering knowledge with **lower future context**, not accumulating prose.