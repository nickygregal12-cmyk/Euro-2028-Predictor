---
name: predictor-graph-navigation
description: Use for broad cross-file architecture, dependency, call-flow and ownership questions in the Predictor repository. Prefer a fresh Graphify code graph when available, but verify every important conclusion against repository source and authorities.
---

# Predictor graph navigation

Use this skill when a task asks questions such as:

- what calls or depends on this function, hook, RPC, model or migration surface;
- how a user action travels through React/domain/Supabase layers;
- which files form one subsystem or cross a subsystem boundary;
- where an implementation and its tests/documentation connect;
- what may be affected by a proposed refactor.

## Authority boundary

A generated graph is a navigation/indexing aid, not repository truth.

- `NOW.md`, current-status, ADRs, design authorities, accepted requirements, migrations, machine contracts and executable tests keep their existing authority.
- `graphify-out/graph.json`, `GRAPH_REPORT.md`, inferred edges and community labels must never be cited as proof that a product rule, hosted state, database contract or release claim is true.
- An `INFERRED` Graphify edge is a hypothesis to inspect in source. An `EXTRACTED` edge is still only an index of source and must be checked at the relevant file/line before making a high-impact change.
- For database/security/Production/model-promotion work, verify the real SQL, functions, tests and hosted evidence directly.

## Preferred workflow

1. Read the current repository entrypoint/authority for the task first.
2. If a current local Graphify graph exists, query it before opening a large number of files.
3. Use `graphify query`, `graphify path` or `graphify explain` to narrow the likely implementation path.
4. Open the returned source files and verify the actual control/data flow.
5. Use native search/tests to look for negative cases the graph may not surface.
6. Record only source-backed findings in issues, PRs and durable documentation.

If Graphify is unavailable, continue with normal repository search. Do not block a task on installation.

## Scope Graphify carefully

For this repository, prefer structural/code scans of the implementation surfaces that matter to the task rather than automatically sending the entire documentation corpus through a semantic pass. Typical code roots include `src/`, `ai/`, `supabase/`, `scripts/`, `tests/` and relevant `config/` files.

The repository's documentation authority system already gives agents a safer way to read current decisions. A semantic graph over all historical audits and evidence can surface useful connections, but it can also mix current authority with dated evidence. Only build/use that broader graph deliberately.

## Generated output

`graphify-out/` is disposable local cache/output. Do not commit it and do not make CI depend on it.

Incremental rebuilds are preferred after the first graph. If the graph may predate the branch or relevant edits, refresh it before relying on it for navigation.

## Security/privacy

Graphify contains its own sensitive-file filtering, but that is defence in depth, not permission to scan arbitrary secret stores. Never point it at `.env` files, Production backups, credential exports or unrelated local directories. Keep provider keys and hosted secrets outside the graph.

## What success looks like

Graphify should reduce context load and shorten architecture discovery. It should not change implementation behaviour, add a runtime dependency, replace tests, or create another project-memory authority.
