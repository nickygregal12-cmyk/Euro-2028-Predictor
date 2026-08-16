# Graphify repository navigation

## Status

Optional local developer/agent tooling only. Graphify does not define product behaviour, database contracts, model authority, hosted state or release status.

## Why use it here

The Predictor repository spans React UI, domain logic, Supabase migrations/functions, provider ingestion, browser tests, scripts and a separate Python AI Lab. Broad architecture questions can otherwise require opening many files before the relevant path is clear.

Graphify builds a persistent knowledge graph from source relationships. For code it uses tree-sitter structural extraction locally, so the useful first application in this repository is **code navigation**, not a new documentation or RAG authority.

Useful examples:

- trace a UI control to the domain function and Supabase RPC it eventually reaches;
- identify callers/dependants before refactoring a shared hook or domain helper;
- map AI Lab model/training/prediction modules before changing an interface;
- find cross-layer coupling between `src/`, `supabase/`, `scripts/` and tests;
- narrow the likely blast radius of a change before source review.

## Installation

Keep Graphify outside the application dependency graph. A developer may install the CLI in an isolated Python tool environment and use its normal `graphify` command locally:

```sh
uv tool install "graphifyy[sql]"
```

Include the `[sql]` extra. Without it `tree_sitter_sql` is missing and every `supabase/migrations/**.sql` file is silently dropped from the graph — the extraction still succeeds, it just omits one of the surfaces this repository most needs to navigate.

Do not add Graphify to application runtime dependencies, Netlify builds, Supabase functions or required CI. The repository must remain fully buildable/testable without it.

Do **not** run `graphify claude install`. It writes a Graphify section into `CLAUDE.md` and registers a `PreToolUse` hook, which is exactly the always-on repository default this document declines below. The same applies to `graphify codex install` and the other `*/install` variants that append to `AGENTS.md`; this repository's Graphify guidance lives in `predictor-graph-navigation` instead.

Build a graph with a local structural scan, which needs no API key:

```sh
graphify extract . --code-only --no-cluster
```

Clustering and community labels call an LLM backend; neither is needed for the navigation workflows below. Use `--force` to bypass the incremental manifest gate after a refactor that deletes code.

## Predictor operating rules

1. Read the repository authority for the task before using graph results.
2. Prefer code-focused scans for routine architecture work. The repository's docs contain both current authorities and intentionally dated evidence; semantic extraction across all of them is optional and must not flatten those distinctions.
3. Treat Graphify's `EXTRACTED` edges as navigation evidence and `INFERRED` edges as hypotheses. Verify important paths in source.
4. Use `query`, `path` and `explain` to reduce the set of files an agent needs to load.
5. Refresh incrementally after meaningful branch changes before using the graph for impact analysis.
6. Never make a Production, database, model-promotion or security claim from the generated graph alone.

## Generated files

Graphify's normal output lives under `graphify-out/` and includes `graph.json`, the incremental `manifest.json` and a `cache/` directory; a clustered run also writes `GRAPH_REPORT.md` and visualization files. Expect it to reach tens of megabytes on this repository. This directory is local disposable output and is gitignored.

Do not promote graph output into the repository authority system. If a graph query discovers a real architectural fact worth preserving, record that fact in the existing correct home and cite the source implementation/decision that proves it.

## Sensitive data

Graphify has built-in sensitive-file detection for common environment, credential and key files, and its default scanner skips common generated/dependency directories. That is useful defence in depth, but the Predictor still applies the stricter rule: do not scan secret stores, `.env` files, Production backups, provider credential exports or unrelated local directories.

## Hooks / strict mode

Do **not** enable Graphify strict/always-on hooks as a repository default in this phase. They can be useful personally, but a repository-wide hook that redirects source reads would make an optional navigation tool part of the development control plane before we have measured whether it improves this codebase.

First prove value through normal optional use. If it consistently reduces navigation cost without hiding negative cases, a later change can consider a bounded hook for specific agent hosts.

## Relationship to project skills

`.agents/skills/predictor-graph-navigation/SKILL.md` defines how agents should use a graph in this repository. It intentionally wraps Graphify in Predictor-specific authority and security boundaries rather than vendoring Graphify's own full skill into the repository.
