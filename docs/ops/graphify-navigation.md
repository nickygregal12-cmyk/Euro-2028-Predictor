# Graphify repository navigation

Graphify is an **optional code-navigation index**. Graphify does not define product behaviour, database contracts, hosted state, model authority or release readiness. It is **not a new documentation or RAG authority**.

## Use it for three questions

Use Graphify when you need to answer one of these before opening lots of files:

1. **Blast radius** — what depends on this component, hook, domain helper, RPC or model?
2. **Call/data flow** — what connects a user action to the service/domain/database layer?
3. **Cross-layer ownership** — which files/tests form this subsystem and where does it cross `src/`, `supabase/`, `scripts/` or `ai/`?

For an exact symbol/reference after you know the area, switch to Serena. For a one-file change, ordinary source search is usually faster.

## Pick the right graph

- **Merged code:** use the generated `graphify-navigation` branch. It is a replace-in-place snapshot, not a normal development branch and not stale branch clutter.
- **Open PR:** use that PR's **Graphify navigation graph** Actions artifact; the persistent branch follows `main`, not unmerged work.

Before trusting a snapshot, read its `README.md`. The recorded source SHA must match the code you are analysing. The snapshot may contain `graph.json`, optional `graph.html`, and an optional richer report.

**Do not load `graph.json` wholesale into an AI context.** Query it to reduce the source set, then inspect the returned source/tests.

## Preferred commands

The wrapper checks the pinned tool, graph integrity and snapshot freshness first:

```bash
bash scripts/agent-tools/graphify-query.sh query "what connects this UI to its RPC?"
bash scripts/agent-tools/graphify-query.sh path "ComponentName" "rpc_name"
bash scripts/agent-tools/graphify-query.sh explain "symbol_name"
```

For a downloaded PR artifact:

```bash
bash scripts/agent-tools/graphify-query.sh \
  --graph /path/to/graph.json \
  --source-sha PR_COMMIT_SHA \
  query "which layers does this change cross?"
```

Use `--allow-stale` only deliberately when the recorded graph source is still an ancestor of the code being examined.

## Stop rule

Graphify's job ends when it has produced a short source list or plausible path. Then:

1. open the actual source;
2. inspect the relevant executable tests and negative cases;
3. use the repository authority for product/rule/hosted claims;
4. record the graph source SHA and useful paths/symbols in PR navigation evidence when that helps review.

Generated traversal output is navigation evidence, not proof. Never make a Production, database, security, scoring, release or model-promotion claim from the graph alone.

## How the snapshot is built

`.github/workflows/graphify-navigation.yml` runs a structural, code-only scan on relevant PRs and `main` changes. SQL support keeps migrations represented. Successful `main` runs replace the `graphify-navigation` branch with the latest portable snapshot rather than adding generated megabytes to normal Git history.

The workflow is intentionally non-blocking: **never a release or product-CI gate**. If Graphify or a current graph is unavailable, continue with normal repository search. Do not stop work to install or regenerate it unless the task specifically benefits from the graph.

The supported version lives in `config/agent-tools.json`; install/bootstrap commands live in [`developer-toolchain.md`](developer-toolchain.md). Do not duplicate versions here.

## Optional semantic/deep graph

`scripts/agent-tools/graphify-deep-via-omniroute.sh` is an opt-in semantic pass through an operator-configured OmniRoute endpoint. It may consume model quota and transmit indexed repository content to the selected provider.

Use it only when structural relationships are insufficient. Inferred relationships are hypotheses, not stronger evidence than the structural graph. `.graphifyignore` excludes historical/credential/output paths, but ignore rules are defence in depth rather than permission to scan secrets.

Never scan `.env` files, Production backups, credential exports or unrelated directories.

## Integration boundaries

- Keep Graphify outside application/runtime dependencies.
- Do not run generic project installers that rewrite repository agent instructions.
- **Do not enable Graphify strict/always-on hooks as a repository default.**
- Do not make CI depend on it.
- The Predictor-specific operating skill is [`.agents/skills/predictor-graph-navigation/SKILL.md`](../../.agents/skills/predictor-graph-navigation/SKILL.md).

A successful Graphify integration makes an agent read **fewer** files before reaching verified source. If it increases the context dump, it is being used backwards.
