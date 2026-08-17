# Graphify repository navigation

## Status

Optional developer/agent navigation tooling. Graphify does not define product behaviour, database contracts, model authority, hosted state or release status.

The default project workflow is now **online-first**: GitHub Actions builds a structural Graphify graph from the repository and publishes a replace-in-place snapshot to the dedicated `graphify-navigation` branch. Pull requests also receive a downloadable graph artifact. Local use remains supported but is not required.

## Why use it here

The Predictor repository spans React UI, domain logic, Supabase migrations/functions, provider ingestion, browser tests, scripts and a separate Python AI Lab. Broad architecture questions can otherwise require opening many files before the relevant path is clear.

Graphify builds a persistent knowledge graph from source relationships. For code it uses tree-sitter structural extraction, so the useful first application in this repository is **code navigation**, not a new documentation or RAG authority.

Useful examples:

- trace a UI control to the domain function and Supabase RPC it eventually reaches;
- identify callers/dependants before refactoring a shared hook or domain helper;
- map AI Lab model/training/prediction modules before changing an interface;
- find cross-layer coupling between `src/`, `supabase/`, `scripts/` and tests;
- narrow the likely blast radius of a change before source review.

## Online generation

`.github/workflows/graphify-navigation.yml` is the normal path for this repository.

It runs on relevant pull requests, on relevant pushes to `main`, and on manual `workflow_dispatch`. The workflow:

1. installs a pinned Graphify release with the `[sql]` extra;
2. runs a structural, code-only scan with no clustering or semantic LLM pass;
3. verifies that `graphify-out/graph.json` was produced;
4. attempts the deterministic HTML export as a best-effort convenience;
5. uploads the shareable outputs as a GitHub Actions artifact for online inspection;
6. after successful runs on `main`, force-refreshes the dedicated `graphify-navigation` snapshot branch with only the portable outputs.

The structural build needs no model API key. `[sql]` is required so `supabase/migrations/**.sql` is included rather than silently omitted.

The workflow is deliberately non-blocking. A Graphify failure must not make product CI, release readiness or database evidence fail; the graph is an optional navigation index.

### Why a separate branch

Graphify output can reach many megabytes on this repository. Committing a regenerated graph into `main` after every source change would permanently grow normal Git history even though only the latest graph matters.

The `graphify-navigation` branch is therefore a **replace-in-place snapshot branch**. Each successful `main` build force-replaces that branch with one fresh snapshot, so the portable graph stays online without bloating application history.

Normal branches continue to ignore `graphify-out/` entirely.

### Published snapshot contents

The `graphify-navigation` branch can contain:

- `graph.json` — the primary agent-readable graph;
- `graph.html` — interactive visualization when export succeeds;
- `GRAPH_REPORT.md` — only when a future/manual richer Graphify run creates it;
- `README.md` — identifies the exact source repository commit used for the snapshot.

The automated workflow currently uses `--code-only --no-cluster`, so `graph.json` is the guaranteed output. It does not add semantic extraction over the documentation corpus and does not require an LLM backend.

Caches, manifests, interpreter paths, detection sidecars and other Graphify internals are never published to the snapshot branch.

## Manual online refresh

When the graph needs refreshing without a source push, run the **Graphify navigation graph** workflow from GitHub Actions using `workflow_dispatch` on `main`. That keeps the workflow browser/cloud based; no local checkout is required.

Pull requests receive a Graphify Actions artifact for the PR commit. Use that graph for branch-specific navigation before merge. After relevant changes land on `main`, the workflow refreshes the `graphify-navigation` branch to the new source SHA.

## Using the graph online

For merged code, browse or fetch files from the repository's `graphify-navigation` branch. Its `README.md` records the source SHA the graph represents.

For pull-request work, prefer the artifact from that PR's **Graphify navigation graph** workflow because the persistent snapshot branch follows `main`, not the unmerged PR.

If an online coding environment can execute Graphify, it may download/fetch the snapshot and use normal commands such as `graphify query`, `graphify path` and `graphify explain`. If it cannot execute the CLI, `graph.json` is still a portable architecture index whose nodes and edges point back to source files.

## Optional local use

Local use is still allowed when convenient, but it is no longer the default requirement. Keep Graphify outside the application dependency graph:

```sh
uv tool install "graphifyy[sql]"
graphify extract . --code-only --no-cluster
```

Do not add Graphify to application runtime dependencies, Netlify builds or Supabase functions.

Do **not** run `graphify claude install`, `graphify codex install` or another host-wide Graphify installer as a repository default. Those commands can append always-on instructions/hooks; this repository keeps its narrower rules in `predictor-graph-navigation` instead.

## Predictor operating rules

1. Read the repository authority for the task before using graph results.
2. Prefer the structural code graph for routine architecture work. The repository's docs contain both current authorities and intentionally dated evidence; do not flatten those distinctions into one semantic index by default.
3. Treat Graphify's `EXTRACTED` edges as navigation evidence and `INFERRED` edges as hypotheses. Verify important paths in source.
4. Use `query`, `path` and `explain` to reduce the set of files an agent needs to load when a Graphify-capable environment is available.
5. Check graph freshness before impact analysis. For a PR, prefer that PR's Actions artifact; for merged work, compare the `graphify-navigation/README.md` source SHA with `main`.
6. Never make a Production, database, model-promotion or security claim from the generated graph alone.

If Graphify or a current graph is unavailable, continue with normal repository search. Do not block a task on installation or graph generation.

## Sensitive data

Graphify has built-in sensitive-file detection for common environment, credential and key files, and its default scanner skips common generated/dependency directories. That is useful defence in depth, but the Predictor still applies the stricter rule: do not scan secret stores, `.env` files, Production backups, provider credential exports or unrelated directories.

The GitHub workflow uses the checked-out repository only and performs a code-only structural pass. It does not receive Supabase, provider or production secrets.

## Hooks / strict mode

Do **not** enable Graphify strict/always-on hooks as a repository default in this phase. The online graph should improve navigation without becoming part of the development control plane or blocking ordinary source reads.

If measured use consistently reduces navigation cost without hiding negative cases, a later change can consider a bounded MCP/host integration.

## Relationship to project skills

`.agents/skills/predictor-graph-navigation/SKILL.md` defines how agents should use a graph in this repository. It intentionally wraps Graphify in Predictor-specific authority and security boundaries rather than vendoring Graphify's full host skill into the repository.
