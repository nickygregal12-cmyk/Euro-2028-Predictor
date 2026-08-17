---
name: predictor-graph-navigation
description: Use for broad cross-file architecture, dependency, call-flow and ownership questions in the Predictor repository. Prefer the current Graphify code graph when available, but verify every important conclusion against repository source and authorities.
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
2. Check for the committed `graphify-out/graph.json`. For pull-request-specific work, prefer that PR's **Graphify navigation graph** Actions artifact when it is newer than the committed `main` graph.
3. In an environment with the Graphify CLI, use `graphify query`, `graphify path` or `graphify explain` to narrow the likely implementation path. In an online environment without the CLI, use the portable `graph.json` as an architecture index and follow its source references.
4. Open the returned/referenced source files and verify the actual control/data flow.
5. Use native repository search and tests to look for negative cases the graph may not surface.
6. Record only source-backed findings in issues, PRs and durable documentation.

If Graphify or a current graph is unavailable, continue with normal repository search. Do not block a task on installation or graph generation.

## Graph freshness

`.github/workflows/graphify-navigation.yml` is the default graph builder. It runs a code-only structural scan on relevant PRs and pushes to `main`, and it can be started manually with `workflow_dispatch`.

- A PR Actions artifact represents that PR commit and is the best graph for branch-specific impact work.
- The committed `graphify-out/graph.json` represents the latest successful relevant build on `main`.
- If the graph clearly predates the code being discussed, treat it as stale and fall back to source/search until it is refreshed.

The workflow is intentionally non-blocking; graph freshness is never a release or product-CI gate.

## Scope Graphify carefully

The automated graph is structural/code-only. It covers implementation surfaces such as `src/`, `ai/`, `supabase/`, `scripts/`, tests and relevant configuration without automatically semantically indexing the repository's documentation history.

The documentation authority system already gives agents a safer way to read current decisions. A semantic graph over all historical audits and evidence can surface useful connections, but it can also mix current authority with dated evidence. Only build/use that broader graph deliberately.

## Generated output

Portable navigation outputs may be versioned:

- `graphify-out/graph.json` — primary machine-readable graph;
- `graphify-out/graph.html` — optional interactive export;
- `graphify-out/GRAPH_REPORT.md` — optional richer-run report.

All other Graphify output remains disposable and gitignored, including caches, manifests, interpreter paths and detection sidecars.

## Security/privacy

Graphify contains its own sensitive-file filtering, but that is defence in depth, not permission to scan arbitrary secret stores. Never point it at `.env` files, Production backups, credential exports or unrelated directories. Keep provider keys and hosted secrets outside the graph.

The repository workflow performs a code-only structural scan and does not receive Supabase, provider or Production secrets.

## What success looks like

Graphify should reduce context load and shorten architecture discovery for online and local agents. It should not change implementation behaviour, add a runtime dependency, replace tests, become a release gate, or create another project-memory authority.
