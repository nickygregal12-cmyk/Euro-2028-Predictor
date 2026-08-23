# Ox Alpha cloud development

## Status

Optional **developer infrastructure only**. Ox Alpha runs through OpenCode and OpenRouter in a GitHub Codespace. It is not part of the Predictor web application, Netlify build, Supabase runtime, AI Lab runtime or production dependency graph.

The supported OpenCode version lives only in [`../../config/agent-tools.json`](../../config/agent-tools.json). The Codespace bootstrap installs that exact version under `~/.local`; it does not configure an OpenRouter credential or make a model request.

## Why this lane exists

The repository already supports Claude Code, ChatGPT/GitHub work and independent-model review. Ox Alpha adds a separate long-context coding runtime without adding another repository authority.

All agents use the same authority chain:

1. [`../../AGENTS.md`](../../AGENTS.md);
2. [`../../NOW.md`](../../NOW.md);
3. `npm run agent:route -- "TASK"` when the exact implementation surface is unknown;
4. the returned product/architecture authority, source and tests;
5. repository-native checks and pull-request review.

Ox Alpha may implement, investigate or review. It never becomes product, scoring, database, hosted-state or release authority.

## Required secret

Create a personal OpenRouter API key and store it in GitHub as a **Codespaces secret** named:

```text
OPENROUTER_API_KEY
```

Do not use an Actions secret for this developer session and do not commit the key to `.env`, OpenCode configuration, documentation or shell history.

The repository's `devcontainer.json` lists this as a recommended personal secret, so **Code → Codespaces → New with options** can prompt for it. For an existing Codespace, add/update the Codespaces secret, grant this repository access, then stop and restart the Codespace so the environment receives it.

## First use

From a Codespace created or rebuilt from current `main`:

```bash
bash scripts/agent-tools/doctor.sh
```

You should see OpenCode as `READY` and the Ox Alpha key as `READY` once the secret is present.

Launch the repository-pinned Ox Alpha lane with:

```bash
bash scripts/agent-tools/ox-alpha.sh
```

The launcher selects:

```text
openrouter/stealth/ox-alpha
```

OpenCode natively uses the `OPENROUTER_API_KEY` environment variable for its OpenRouter provider. The helper never writes the key to disk.

Do **not** run OpenCode `/init` in this repository. The Predictor already has a canonical root `AGENTS.md`; generating a replacement instruction file would create a competing authority.

## Recommended division of work

Use the models as independent workers rather than asking all of them to rewrite the same files at once.

- **Claude Code** — primary implementation and larger staged programmes when it is the chosen implementer.
- **ChatGPT/GitHub** — architecture, research, repository audits, PR operations and independent review where useful.
- **Ox Alpha/OpenCode** — long-context investigation, bounded implementation, debugging and independent review.
- **Tests/CI/authorities** — final arbiter. A model agreeing with another model is not release evidence.

For concurrent implementation, use separate branches/PRs. Do not let Claude Code and OpenCode edit the same working tree concurrently. MCP Agent Mail is available only when genuine concurrent coordination justifies starting it; normal branches and PRs remain the default coordination boundary.

## A good Ox Alpha task

Give Ox Alpha the outcome, not the whole documentation tree. For example:

```text
Read AGENTS.md and NOW.md first.
Check current main, this branch and open PRs for overlap.
Run npm run agent:route -- "<task>" if the exact source is not already known.
Use only the returned authorities, skills, source and tests you need.
Implement the bounded task on a dedicated branch.
Run the relevant repository checks and create a PR.
Do not mutate Production, Supabase Production, Netlify Production or paid provider state.
Do not invent product/game/database rules.
```

A large model context window is headroom, not permission to preload the repository. Graphify, Serena, Repomix and the task router still exist to keep context small and authoritative.

## Independent-review lane

Ox Alpha is a valid candidate for the repository's `predictor-second-opinion` process when the primary implementer used a genuinely different model/runtime. Keep that pass read-only and diff-bounded. Reconcile every finding against source, tests and canonical authorities before acting on it.

Do not treat two agents routed through the same underlying model as independent simply because they run in different terminals.

## Security boundary

Treat OpenRouter and the selected model provider as an external inference boundary. Do not expose:

- Supabase service-role keys or production database credentials;
- Netlify, Sentry or GitHub management tokens;
- football/odds provider secrets;
- private `.env` values;
- Production player data or exported personal data;
- credentials returned by another connected tool.

Repository code, public documentation, bounded PR diffs, tests and non-sensitive generated context packs are the intended inputs.

Do not enable blanket auto-approval merely to make an autonomous run easier. The repository's production/environment rules remain in force even if the coding agent can technically execute a command.

## Direct OpenCode commands

The helper is the normal path. For diagnosis, these commands are also useful:

```bash
opencode --version
opencode models openrouter --refresh
opencode --model openrouter/stealth/ox-alpha
```

Model availability is external and can change. If Ox Alpha disappears from OpenRouter, fail visibly and use another explicitly chosen independent reviewer rather than silently pretending the same model is still in use.

## OmniRoute relationship

OmniRoute remains the repository's optional general coding-model/provider gateway. The initial Ox Alpha lane deliberately connects OpenCode directly to OpenRouter because it is simpler, keeps the credential scope obvious and avoids adding a required gateway process.

If a future architecture decision routes OpenCode through OmniRoute, keep provider credentials and generated user configuration outside this repository and preserve the same authority/security boundaries.
