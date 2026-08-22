---
name: predictor-graph-navigation
description: Use when the exact implementation surface is not already known, or when a Predictor task may span files/layers. Start with a bounded Graphify query to shortlist source/tests, use affected/path for impact and call-flow, narrow with Serena when symbols matter, and verify important conclusions against repository source and authorities.
---

# Predictor graph navigation

Use this skill before broad source browsing when a task asks questions such as:

- where a user-visible defect or feature is actually implemented;
- what calls or depends on this function, hook, RPC, model or migration surface;
- how a user action travels through React/domain/Supabase layers;
- which files form one subsystem or cross a subsystem boundary;
- where an implementation and its tests/documentation connect;
- what may be affected by a proposed refactor.

Skip Graphify when the task already identifies the exact file/symbol and is genuinely bounded. The goal is fewer source reads, not mandatory ceremony.

## Authority boundary

A generated graph, semantic index or context pack is navigation—not repository truth.

- `NOW.md`, current-status when relevant, ADRs, product/design authorities, accepted requirements, migrations, machine contracts and executable tests keep their existing authority.
- Graphify `graph.json`, reports, inferred edges/community labels and Serena symbol results must never be cited as proof that a product rule, hosted state, database contract or release claim is true.
- An `INFERRED` Graphify edge is a hypothesis. An `EXTRACTED` edge or Serena reference is still an index of source; inspect the actual implementation before a high-impact change.
- For database/security/Production/model-promotion work, verify the real SQL, functions, tests and fresh hosted evidence directly.

## Tool split

Use the narrowest specialist rather than asking one tool to do everything:

- **Graphify `query`** — bounded first-pass orientation when the likely implementation surface is unknown.
- **Graphify `path`** — trace between two known concepts/layers.
- **Graphify `affected`** — reverse impact before refactors or cross-file changes.
- **Graphify `explain`** — inspect one known graph node.
- **Graphify `god-nodes`** — architecture/audit use only; not routine task startup.
- **Serena** — exact symbol definitions, callers, references and bounded symbol-level edits once the likely surface is known.
- **Context7** — current external-library/API documentation only; it does not explain Predictor architecture.
- **Repomix** — disposable bounded context export after the relevant surface is known; it is not a replacement for Graphify/Serena search.
- **dependency-cruiser** — executable architecture restriction after a dependency direction has already been decided; it is not a discovery tool.

## Preferred workflow

1. Read the current repository entrypoint and identify the smallest task authority class; do not preload the documentation tree.
2. If the implementation surface is not exact, run `bash scripts/agent-tools/graphify-query.sh query "QUESTION"`. The wrapper defaults routine query output to about 1200 tokens; increase `--budget` only if the bounded result is genuinely insufficient.
3. For merged code, use the latest persistent `graphify-navigation` snapshot. For pull-request-specific work, prefer that PR's Graphify Actions artifact because the snapshot branch follows `main`.
4. Trust freshness by the snapshot's **input fingerprint**. The source commit may differ from current `main` when only files outside the indexed input set changed. Pre-fingerprint snapshots retain the older exact-SHA fallback.
5. Use `path` for a known end-to-end chain or `affected` before changing a shared symbol/file. Do not keep firing broad queries once the likely area is known.
6. If the question becomes symbol-specific, switch to Serena instead of repeatedly opening whole files.
7. Open the returned/referenced source and verify the actual control/data flow; inspect exact tests and negative cases.
8. For a refactor that can violate dependency direction, run `bash scripts/agent-tools/architecture-check.sh` before completion.
9. Generate a Repomix task pack only when a separate model/handoff genuinely benefits from one.
10. Record only source/evidence-backed findings in issues, PRs and durable documentation.

If Graphify/Serena is unavailable, continue with normal repository search. Do not block a task on an indexing tool.

## Graph freshness

`.github/workflows/graphify-navigation.yml` is the default graph builder. It runs a code-only structural scan on relevant PRs and `main` changes, and it can be started manually with `workflow_dispatch`.

- A PR Actions artifact is the best graph for branch-specific impact work.
- The `graphify-navigation` branch is a replace-in-place snapshot of the latest successful relevant build from `main`.
- Its `README.md` names the source commit and `sha256:` input fingerprint.
- `scripts/agent-tools/graphify-input-fingerprint.mjs` hashes the tracked graph-input paths. An unrelated documentation/operations workflow commit does not invalidate the graph; a source/configuration change in the indexed set does.
- Use `--allow-stale` only deliberately when an older ancestor graph remains useful for orientation. It never turns stale navigation into evidence.

The workflow is intentionally non-blocking; graph freshness is never a release or product-CI gate.

## Semantic/deep Graphify

The automated graph is structural/code-only. It does not semantically flatten the documentation/history tree into one apparent authority.

The explicit deep lane is `scripts/agent-tools/graphify-deep-via-omniroute.sh`. It routes semantic extraction through an operator-configured OmniRoute Endpoint and is opt-in because it may consume model quota and transmit indexed repository content to the selected provider. `.graphifyignore` excludes historical evidence and credential/output paths by default.

A semantic/deep graph has **no additional authority**. Treat inferred relationships as hypotheses and verify them like any other graph result.

## Serena boundary

The tracked `.serena/project.yml` gives Serena the repository project/index configuration while persistent Serena memories are deliberately disabled. Long-lived project facts belong in the existing authorities/specs/PR record; optional local task memory belongs to Beads when explicitly initialised.

Serena is an editing/navigation mechanism, not permission to bypass tests or dependency rules. A precise symbol edit still needs the same review and evidence as a hand edit.

## Generated output

Normal application branches keep Graphify output and Repomix context packs ignored. The dedicated `graphify-navigation` branch may publish only portable Graphify navigation output plus source/fingerprint freshness metadata.

Caches, manifests, Serena index state, generated context packs, interpreter paths and detection sidecars stay disposable and are not promoted into documentation.

## Security/privacy

Graphify/Serena/Repomix sensitive-file filtering and repository ignore rules are defence in depth, not permission to scan arbitrary secret stores. Never point them at `.env` files, Production backups, credential exports or unrelated directories. Keep provider keys, OmniRoute keys and hosted secrets outside indexes/packs.

The structural Graphify GitHub workflow receives no Supabase/provider/OmniRoute/Production secrets.

Do not run a tool's generic project installer to replace/add repository authority. The Predictor-specific `AGENTS.md`/skills chain remains the integration point.

## What success looks like

The navigation layer should reduce context load and shorten discovery, then hand the task back to source/tests. It should not change implementation behaviour, add a runtime dependency, replace tests, become product authority or create another project-memory system.
