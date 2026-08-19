---
name: predictor-context
description: Load the smallest authoritative repository context needed for a Predictor task and leave a durable evidence-based handoff without copying moving state.
---

# Predictor context discipline

Use this for broad audits, long-running work and handoffs. The goal is **progressive disclosure**, not a second documentation system.

## Load context in this order

1. `NOW.md` — moving-state index only.
2. Current `main`, branch ancestry and open PRs — overlap/ownership.
3. Root `AGENTS.md` — route to the one authority for the task.
4. The affected source and executable tests.
5. Dated audits/history only when the question actually needs historical evidence.

`docs/quality/current-status.md` is not universal startup context. Load it for detailed current implementation/hosted claims.

## Use Graphify to read less

For a broad dependency, call-flow or blast-radius question, use [the graph-navigation skill](../predictor-graph-navigation/SKILL.md) **before** opening a directory worth of files. A good Graphify pass should leave you with a short list of source paths/symbols to inspect.

Do not load `graph.json` wholesale. For merged code, use the fresh `graphify-navigation` snapshot; for a PR, use that PR's artifact. Verify important conclusions in source/tests.

For exact symbol callers/references after the area is known, Serena is narrower than another broad graph query. Context7 is only for current external-library/API documentation. Repomix is only for a bounded portable context slice after scope is known.

If none of those tools reduces the number of files you need to read, do not use it.

## One fact, one home

Never create a support file that restates a moving contract, hosted state, blocker, roadmap or product rule. Link to the canonical authority.

Tool indexes, generated graphs, Repomix packs, local memories and previous chats are not durable project truth. If a fact must survive another clone or reviewer, put it in its canonical repository/PR home.

## Evidence rule

Claims such as `implemented`, `hosted`, `green`, `promoted`, `Production` or `current model` must trace to merged source, executable evidence, a machine record, workflow result or fresh hosted observation.

**Existing repository authorities always outrank this skill** and every developer tool.

## Handoff

Persist only:

- objective/completion predicate;
- branch/PR and exact head;
- authorities consulted;
- changed files;
- tests/evidence and results;
- decisions;
- blockers;
- next executable action;
- explicit non-actions, especially Production/provider writes.

A handoff should let the next agent resume without loading the history that produced it.
