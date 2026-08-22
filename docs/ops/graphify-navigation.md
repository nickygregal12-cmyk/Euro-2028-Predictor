# Graphify repository navigation

Graphify is an **optional code-navigation index**. Graphify does not define product behaviour, database contracts, hosted state, model authority or release readiness. It is **not a new documentation or RAG authority**.

## Default question: do I already know the exact source surface?

If the task already names the exact file/symbol and is genuinely bounded, open it directly. Otherwise query Graphify **before broad source browsing** so the first code reads are likely to be the right ones.

Use it especially for:

1. **Orientation** — which source/tests probably own this user-visible defect or feature?
2. **Blast radius** — what depends on this component, hook, domain helper, RPC or model?
3. **Call/data flow** — what connects a user action to the service/domain/database layer?
4. **Cross-layer ownership** — which files/tests form this subsystem and where does it cross `src/`, `supabase/`, `scripts/` or `ai/`?
5. **Refactor impact** — which reverse dependencies should be checked before changing a symbol/file?

For an exact symbol/reference after you know the area, switch to Serena. For a known one-file change, ordinary source search is usually faster.

## Pick the right graph

- **Merged code:** use the generated `graphify-navigation` branch. It is a replace-in-place snapshot, not a normal development branch and not stale branch clutter.
- **Open PR:** use that PR's **Graphify navigation graph** Actions artifact; the persistent branch follows `main`, not unmerged work.

The persistent snapshot records two different identities:

- **source commit** — where the graph was built;
- **input fingerprint** — SHA-256 over the tracked files/configuration that can affect this structural graph.

The wrapper compares the **input fingerprint**, not merely the repository head SHA. A documentation or unrelated workflow commit can therefore move `main` without making an otherwise identical code graph unusable. If indexed source/configuration changes, the fingerprint changes and the wrapper refuses the snapshot unless `--allow-stale` is chosen deliberately.

Snapshots created before this fingerprint existed retain the older exact-source-SHA safety behaviour until refreshed.

**Do not load `graph.json` wholesale into an AI context.** Query it to reduce the source set, then inspect the returned source/tests.

## Preferred commands

The wrapper checks the pinned tool, graph integrity and snapshot freshness first:

```bash
# routine orientation: wrapper defaults to a ~1200-token result
bash scripts/agent-tools/graphify-query.sh query "what connects this UI to its RPC?"

# trace between known concepts
bash scripts/agent-tools/graphify-query.sh path "ComponentName" "rpc_name"

# inspect one known node
bash scripts/agent-tools/graphify-query.sh explain "symbol_name"

# reverse impact before a change
bash scripts/agent-tools/graphify-query.sh affected "symbol_or_file"

# architecture/audit use only
bash scripts/agent-tools/graphify-query.sh god-nodes --top 10
```

`query` receives `--budget 1200` unless an explicit budget is supplied. Increase it only when the first bounded traversal is genuinely truncated or insufficient; repeated low-signal traversals cost more context than opening the shortlisted source.

For a downloaded PR artifact:

```bash
bash scripts/agent-tools/graphify-query.sh \
  --graph /path/to/graph.json \
  --source-sha PR_COMMIT_SHA \
  query "which layers does this change cross?"
```

Use `--allow-stale` only deliberately when an older graph is still useful for orientation. It never upgrades stale navigation into evidence.

## Stop rule

Graphify's job ends when it has produced a short source list, plausible path or useful impact set. Then:

1. open the actual source;
2. use Serena for exact definitions/callers when useful instead of repeatedly opening whole files;
3. inspect the relevant executable tests and negative cases;
4. use the repository authority for product/rule/hosted claims;
5. record the graph source SHA and useful paths/symbols in PR navigation evidence when that helps review.

Generated traversal output is navigation evidence, not proof. Never make a Production, database, security, scoring, release or model-promotion claim from the graph alone.

## Input fingerprint

`scripts/agent-tools/graphify-input-fingerprint.mjs` hashes Git object IDs plus paths for the tracked input set used to decide Graphify freshness. It includes the application/code/test/config roots, package/TypeScript metadata, ignore rules and the Graphify workflow itself. It deliberately does **not** include arbitrary Markdown/history or unrelated workflow files.

This solves the common false-stale case where `main` advances for an operations/documentation change while every structural graph input stays byte-identical.

The workflow writes the fingerprint into both the Actions summary and the persistent snapshot `README.md`. `tests/scripts/graphifyUsage.test.ts` creates a temporary Git repository and proves that an unrelated workflow-only commit preserves the fingerprint while a `src/**` change invalidates it.

## How the snapshot is built

`.github/workflows/graphify-navigation.yml` runs a structural, code-only scan on relevant PRs and `main` changes. SQL support keeps migrations represented. Successful `main` runs replace the `graphify-navigation` branch with the latest portable snapshot rather than adding generated megabytes to normal Git history.

The workflow is intentionally non-blocking: **never a release or product-CI gate**. If Graphify or a current graph is unavailable, continue with normal repository search. Do not stop work solely to install or regenerate it.

The supported version lives in `config/agent-tools.json`; install/bootstrap commands live in [`developer-toolchain.md`](developer-toolchain.md). Do not duplicate versions here.

## Optional semantic/deep graph

`scripts/agent-tools/graphify-deep-via-omniroute.sh` is an opt-in semantic pass through an operator-configured OmniRoute endpoint. It may consume model quota and transmit indexed repository content to the selected provider.

Use it only when structural relationships are insufficient. Inferred relationships are hypotheses, not stronger evidence than the structural graph. `.graphifyignore` excludes historical/credential/output paths, but ignore rules are defence in depth rather than permission to scan secrets.

Never scan `.env` files, Production backups, credential exports or unrelated directories.

## Integration boundaries

- Keep Graphify outside application/runtime dependencies.
- Do not run generic project installers that rewrite repository agent instructions.
- **Do not enable Graphify strict/always-on hooks as a repository default.** Query-first routing gives the benefit without intercepting every file read.
- Do not make CI depend on it.
- The Predictor-specific operating skill is [`.agents/skills/predictor-graph-navigation/SKILL.md`](../../.agents/skills/predictor-graph-navigation/SKILL.md).

A successful Graphify integration makes an agent read **fewer** files before reaching verified source. If it increases the context dump, it is being used backwards.
