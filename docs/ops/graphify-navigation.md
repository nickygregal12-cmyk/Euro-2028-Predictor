# Graphify repository navigation

## Status

Optional developer/agent navigation tooling. Graphify does not define product
behaviour, database contracts, model authority, hosted state or release status.

The default project workflow is **online-first**: GitHub Actions builds a
structural Graphify graph from the repository and publishes a replace-in-place
snapshot to the dedicated `graphify-navigation` branch. Pull requests also
receive a downloadable graph artifact and a readable Actions run summary.

A GitHub Codespace also provisions the pinned Graphify CLI, so an online coding
session can query/build the graph without installing tooling on a personal
machine. Local use remains supported but is not required.

The supported tool version is owned once in
[`../../config/agent-tools.json`](../../config/agent-tools.json).

## Why use it here

The Predictor repository spans React UI, domain logic, Supabase
migrations/functions, provider ingestion, browser tests, scripts and a separate
Python AI Lab. Broad architecture questions can otherwise require opening many
files before the relevant path is clear.

Graphify builds a persistent knowledge graph from source relationships. For
code it uses structural extraction, so the useful default in this repository is
**code navigation**, not a new documentation or RAG authority.

Useful examples:

- trace a UI control to the domain function and Supabase RPC it eventually
  reaches;
- identify callers/dependants before refactoring a shared hook or domain helper;
- map AI Lab model/training/prediction modules before changing an interface;
- find cross-layer coupling between `src/`, `supabase/`, `scripts/` and tests;
- narrow the likely blast radius of a change before source review.

## Online generation

`.github/workflows/graphify-navigation.yml` is the normal zero-credential path.

It runs on relevant pull requests, on relevant pushes to `main`, and on manual
`workflow_dispatch`. The workflow:

1. reads the Graphify pin from `config/agent-tools.json`;
2. installs Graphify with SQL support;
3. runs a structural, code-only scan with no clustering or semantic LLM pass;
4. verifies that `graphify-out/graph.json` was produced;
5. writes the source SHA, tool version and graph status into the GitHub Actions
   run summary;
6. attempts the deterministic HTML export as a best-effort convenience;
7. uploads the shareable outputs as a GitHub Actions artifact;
8. after successful runs on `main`, force-refreshes the dedicated
   `graphify-navigation` snapshot branch with only portable outputs.

The structural build needs no model API key. The `[sql]` extra is installed so
`supabase/migrations/**.sql` can be represented rather than silently dropping a
critical architecture surface.

The workflow is deliberately non-blocking. A Graphify failure must not make
product CI, release readiness or database evidence fail; the graph is an
optional navigation index.

### Why a separate branch

Graphify output can reach many megabytes on this repository. Committing a
regenerated graph into `main` after every source change would permanently grow
normal Git history even though only the latest graph matters.

The `graphify-navigation` branch is therefore a **replace-in-place snapshot
branch**. Each successful relevant `main` build force-replaces that branch with
one fresh snapshot, so the portable graph stays online without bloating
application history.

Normal branches continue to ignore `graphify-out/` entirely.

### Published snapshot contents

The `graphify-navigation` branch can contain:

- `graph.json` — the primary agent-readable graph;
- `graph.html` — interactive visualization when export succeeds;
- `GRAPH_REPORT.md` — only when a richer/manual run creates it;
- `README.md` — identifies the exact source repository commit and Graphify
  version used for the snapshot.

The automated workflow uses `--code-only --no-cluster`, so `graph.json` is the
guaranteed output. It does not add semantic extraction over the documentation
corpus and does not require an LLM backend.

Caches, manifests, interpreter paths, detection sidecars and other Graphify
internals are never published to the snapshot branch.

## GitHub Codespaces

`.devcontainer/devcontainer.json` gives an online coding session the repository's
Node/Python toolchain and then runs
[`../../scripts/agent-tools/bootstrap.sh`](../../scripts/agent-tools/bootstrap.sh).
The bootstrap installs the exact Graphify version from `config/agent-tools.json`
in an isolated user environment with SQL and OpenAI-compatible backend support.
It does **not** run Graphify's host/project installer and therefore does not
rewrite `AGENTS.md`, install a strict read hook, or replace this repository's
Predictor-specific graph skill.

In a Codespace:

```bash
graphify --help
graphify extract . --code-only --no-cluster
```

For normal work, prefer the already-built PR artifact or merged snapshot instead
of regenerating the entire repository merely because the CLI is available.

## Manual online refresh

When the structural graph needs refreshing without a source push, run the
**Graphify navigation graph** workflow from GitHub Actions using
`workflow_dispatch` on `main`. No local checkout is required.

Pull requests receive a Graphify Actions artifact for the PR commit. Use that
graph for branch-specific navigation before merge. After relevant changes land
on `main`, the workflow refreshes the `graphify-navigation` branch to the new
source SHA.

## Using the graph online

For merged code, browse or fetch files from the repository's
`graphify-navigation` branch. Its `README.md` records the source SHA the graph
represents.

For pull-request work, prefer the artifact from that PR's **Graphify navigation
graph** workflow because the persistent snapshot branch follows `main`, not the
unmerged PR.

If an online coding environment can execute Graphify, use `graphify query`,
`graphify path` or `graphify explain` to narrow the likely implementation path.
If it cannot execute the CLI, `graph.json` is still a portable architecture
index whose nodes and edges point back to source files.

Use the repository wrapper so the tool version, graph integrity and snapshot
freshness are checked before querying:

```bash
bash scripts/agent-tools/graphify-query.sh query "what connects the UI to this RPC?"
bash scripts/agent-tools/graphify-query.sh path "ComponentName" "rpc_name"
bash scripts/agent-tools/graphify-query.sh explain "symbol_name"
```

The default fetches `origin/main` and `origin/graphify-navigation`, rejects a
snapshot that is not built from the current `origin/main`, verifies non-empty
nodes and edges, and invokes the exact Graphify version in
`config/agent-tools.json`. An older snapshot can be used only with the explicit
`--allow-stale` flag and only when its source remains an ancestor of main.

For a downloaded PR artifact, preserve its source SHA explicitly:

```bash
bash scripts/agent-tools/graphify-query.sh \
  --graph /path/to/graph.json \
  --source-sha PR_COMMIT_SHA \
  query "which layers does this change cross?"
```

Record that source SHA and the useful paths/symbols in the pull request's
Navigation evidence section. Do not paste generated traversal output as proof;
open and verify the returned source.

## Optional deep semantic pass through OmniRoute

The repo also supports a deliberate richer pass using OmniRoute as Graphify's
OpenAI-compatible backend. This is **not** the default workflow because it can
consume model quota and transmit current repository documentation/content to the
provider selected by OmniRoute.

Read [`omniroute-agent-routing.md`](omniroute-agent-routing.md), start/configure
OmniRoute, then set an Endpoint inference key and the model/Combo to use:

```bash
export OMNIROUTE_API_KEY='...'
export GRAPHIFY_OMNIROUTE_MODEL='YOUR-OMNIROUTE-MODEL-OR-COMBO'
bash scripts/agent-tools/graphify-deep-via-omniroute.sh
```

The helper routes Graphify's headless `--backend openai --mode deep` extraction
to OmniRoute's `/v1` endpoint. `.graphifyignore` excludes `docs/history/`, local
credential patterns and disposable outputs before that semantic pass. The
repository's normal `.gitignore` exclusions continue to apply as well.

Do not treat a deep semantic graph as stronger evidence than the structural one.
Its inferred relationships are useful hypotheses for source inspection, not
project truth.

## Optional local use

Local use is still allowed when convenient, but it is no longer the default
requirement. Keep Graphify outside the application dependency graph:

```bash
uv tool install "graphifyy[sql,openai]"
graphify extract . --code-only --no-cluster
```

Do not add Graphify to application runtime dependencies, Netlify builds or
Supabase functions.

Do **not** run `graphify install --project`, `graphify claude install --project`,
`graphify codex install --project` or another project-scoped Graphify installer
as a repository default. Those commands can add generic agent instructions;
this repository keeps narrower rules in `predictor-graph-navigation` and its
existing `AGENTS.md` authority chain.

## Predictor operating rules

1. Read the repository authority for the task before using graph results.
2. Prefer the structural code graph for routine architecture work. The docs
   contain both current authorities and intentionally dated evidence; do not
   flatten those distinctions into one semantic index by default.
3. Treat Graphify's `EXTRACTED` edges as navigation evidence and `INFERRED`
   edges as hypotheses. Verify important paths in source.
4. Use `query`, `path` and `explain` to reduce the set of files an agent needs to
   load when a Graphify-capable environment is available.
5. Check graph freshness before impact analysis. For a PR, prefer that PR's
   Actions artifact; for merged work, compare the
   `graphify-navigation/README.md` source SHA with `main`.
6. Never make a Production, database, model-promotion or security claim from the
   generated graph alone.

If Graphify or a current graph is unavailable, continue with normal repository
search. Do not block a task on installation or graph generation.

## Sensitive data

Graphify has built-in sensitive-file filtering and honors repository ignore
rules, but that is defence in depth, not permission to scan secret stores. The
Predictor applies the stricter rule: do not scan `.env` files, Production
backups, provider credential exports or unrelated directories.

`.graphifyignore` provides a second explicit boundary for deep scans. The GitHub
workflow itself performs a code-only structural pass and receives no Supabase,
provider, OmniRoute or Production credential.

## Hooks / strict mode

Do **not** enable Graphify strict/always-on hooks as a repository default in this
phase. The online graph should improve navigation without becoming part of the
development control plane or blocking ordinary source reads.

If measured use consistently reduces navigation cost without hiding negative
cases, a later change can consider a bounded MCP/host integration.

## Relationship to project skills

`.agents/skills/predictor-graph-navigation/SKILL.md` defines how agents should use
a graph in this repository. It intentionally wraps Graphify in
Predictor-specific authority and security boundaries rather than vendoring
Graphify's generic host skill into the repository.
