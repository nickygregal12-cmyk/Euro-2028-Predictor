---
name: predictor-graph-navigation
description: Use for broad cross-file architecture, dependency, call-flow and ownership questions in the Predictor repository. Start with Graphify, narrow with Serena when symbols matter, and verify every important conclusion against repository source and authorities.
---

# Predictor graph navigation

Use this skill when a task asks questions such as:

- what calls or depends on this function, hook, RPC, model or migration surface;
- how a user action travels through React/domain/Supabase layers;
- which files form one subsystem or cross a subsystem boundary;
- where an implementation and its tests/documentation connect;
- what may be affected by a proposed refactor.

## Authority boundary

A generated graph, semantic index or context pack is navigation—not repository truth.

- `NOW.md`, current-status when relevant, ADRs, product/design authorities, accepted requirements, migrations, machine contracts and executable tests keep their existing authority.
- Graphify `graph.json`, reports, inferred edges/community labels and Serena symbol results must never be cited as proof that a product rule, hosted state, database contract or release claim is true.
- An `INFERRED` Graphify edge is a hypothesis. An `EXTRACTED` edge or Serena reference is still an index of source; inspect the actual implementation before a high-impact change.
- For database/security/Production/model-promotion work, verify the real SQL, functions, tests and fresh hosted evidence directly.

## Tool split

Use the narrowest specialist rather than asking one tool to do everything:

- **Graphify** — broad repository structure, dependency/call-flow paths and cross-layer orientation.
- **Serena** — exact symbol definitions, callers, references and bounded symbol-level edits once the likely surface is known.
- **Context7** — current external-library/API documentation only; it does not explain Predictor architecture.
- **Repomix** — disposable bounded context export after the relevant surface is known; it is not a replacement for Graphify/Serena search.
- **dependency-cruiser** — executable architecture restriction after a dependency direction has already been decided; it is not a discovery tool.

## Preferred workflow

1. Read the current repository entrypoint/authority for the task first.
2. For merged code, prefer the latest snapshot on the `graphify-navigation` branch. For pull-request-specific work, prefer that PR's Graphify Actions artifact because the snapshot branch follows `main`.
3. Check snapshot freshness: `graphify-navigation/README.md` records the exact source SHA used to build the graph.
4. Use Graphify to narrow the likely implementation path.
5. If the question becomes symbol-specific, switch to Serena instead of repeatedly opening whole files.
6. Open the returned/referenced source and verify the actual control/data flow; inspect exact tests and negative cases.
7. For a refactor that can violate dependency direction, run `bash scripts/agent-tools/architecture-check.sh` before completion.
8. Generate a Repomix task pack only when a separate model/handoff genuinely benefits from one.
9. Record only source/evidence-backed findings in issues, PRs and durable documentation.

If Graphify/Serena is unavailable, continue with normal repository search. Do not block a task on an indexing tool.

## Graph freshness

`.github/workflows/graphify-navigation.yml` is the default graph builder. It runs a code-only structural scan on relevant PRs and pushes to `main`, and it can be started manually with `workflow_dispatch`.

- A PR Actions artifact represents that PR commit and is the best graph for branch-specific impact work.
- The `graphify-navigation` branch is a replace-in-place snapshot of the latest successful relevant build from `main`.
- Its `README.md` names the source SHA. If that SHA predates the code being discussed, treat the graph as stale and fall back to source/search until it is refreshed.

The workflow is intentionally non-blocking; graph freshness is never a release or product-CI gate.

## Semantic/deep Graphify

The automated graph is structural/code-only. It does not semantically flatten the documentation/history tree into one apparent authority.

The explicit deep lane is `scripts/agent-tools/graphify-deep-via-omniroute.sh`. It routes semantic extraction through an operator-configured OmniRoute Endpoint and is opt-in because it may consume model quota and transmit indexed repository content to the selected provider. `.graphifyignore` excludes historical evidence and credential/output paths by default.

A semantic/deep graph has **no additional authority**. Treat inferred relationships as hypotheses and verify them like any other graph result.

## Serena boundary

The tracked `.serena/project.yml` gives Serena the repository project/index configuration while persistent Serena memories are deliberately disabled. Long-lived project facts belong in the existing authorities/specs/PR record; optional local task memory belongs to Beads when explicitly initialised.

Serena is an editing/navigation mechanism, not permission to bypass tests or dependency rules. A precise symbol edit still needs the same review and evidence as a hand edit.

## Generated output

Normal application branches keep Graphify output and Repomix context packs ignored. The dedicated `graphify-navigation` branch may publish only portable Graphify navigation output plus a source-SHA freshness marker.

Caches, manifests, Serena index state, generated context packs, interpreter paths and detection sidecars stay disposable and are not promoted into documentation.

## Security/privacy

Graphify/Serena/Repomix sensitive-file filtering and repository ignore rules are defence in depth, not permission to scan arbitrary secret stores. Never point them at `.env` files, Production backups, credential exports or unrelated directories. Keep provider keys, OmniRoute keys and hosted secrets outside indexes/packs.

The structural Graphify GitHub workflow receives no Supabase/provider/OmniRoute/Production secrets.

Do not run a tool's generic project installer to replace/add repository authority. The Predictor-specific `AGENTS.md`/skills chain remains the integration point.

## What success looks like

The navigation layer should reduce context load and shorten discovery, then hand the task back to source/tests. It should not change implementation behaviour, add a runtime dependency, replace tests, become product authority or create another project-memory system.
