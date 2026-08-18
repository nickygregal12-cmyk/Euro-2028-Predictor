# OmniRoute agent routing

## Status

Optional **developer infrastructure only**. OmniRoute is a coding-agent/model gateway; it is not part of the Predictor web application, Netlify build, Supabase runtime, football-provider pipeline, AI Lab inference runtime, or production dependency graph.

The repository pins the supported development-tool version in [`../../config/agent-tools.json`](../../config/agent-tools.json). A GitHub Codespace provisions that version through [`../../scripts/agent-tools/bootstrap.sh`](../../scripts/agent-tools/bootstrap.sh), but deliberately does **not** start the gateway, connect a provider, create an inference key, or send a model request.

## Why use it here

The Predictor is developed heavily through AI coding tools. OmniRoute gives compatible coding CLIs one OpenAI-compatible endpoint with provider/model selection and fallback routing. That can reduce per-tool configuration and make an online coding session less dependent on one model/provider being available.

It solves a different problem from Graphify:

- **Graphify** narrows *what in this repository should be inspected*.
- **OmniRoute** controls *which configured model/provider handles a compatible AI request*.

Neither tool is repository authority. Code, tests and the Predictor authority chain remain decisive.

## Fastest online path: GitHub Codespaces

Create/open a Codespace for this repository. `.devcontainer/devcontainer.json` installs the repository's Node/Python toolchain and runs the agent-tool bootstrap once when the container is created.

Check the installation:

```bash
omniroute --version
omniroute doctor --no-liveness
graphify --help
```

The bootstrap installs OmniRoute under `~/.local` and Graphify in an isolated Python environment under `~/.local/share/predictor-agent-tools`. It does not add either package to `package.json`, the production bundle or Supabase.

## First-time OmniRoute setup

From the Codespace terminal:

```bash
omniroute setup
omniroute --no-open
```

GitHub forwards port `20128`; open the forwarded **OmniRoute dashboard/API** port in the browser.

Then in OmniRoute:

1. connect at least one AI provider under **Providers**;
2. create an inference API key under **Endpoints**;
3. optionally create a **Combo** for the fallback chain you want coding tools to use.

Prefer provider API-key connections for the first online setup. Some upstream OAuth flows use fixed loopback callbacks and need extra tunnelling when OmniRoute itself runs remotely.

Never commit provider credentials, OmniRoute management tokens, endpoint inference keys, exported provider sessions, or generated `.env` files. Use the Codespace/user secret store or enter the credential directly in OmniRoute.

## Point a coding CLI at OmniRoute

After OmniRoute is running and has an Endpoint inference key, make that key available to the shell without writing it to the repository:

```bash
export OMNIROUTE_API_KEY='...'
```

For Codex CLI:

```bash
omniroute setup-codex
# or launch without writing a Codex profile:
omniroute launch-codex
```

For Claude Code:

```bash
omniroute setup-claude
```

OmniRoute also has setup commands for other compatible tools. Keep each tool's generated user-level configuration outside this repository.

This ChatGPT-to-GitHub connector is separate infrastructure; checking OmniRoute into the Predictor repository does not redirect this chat's model traffic through it.

## Persistent remote OmniRoute

A Codespace is convenient but is still a development environment. If OmniRoute becomes a shared/persistent personal gateway, run it as a separate service and leave only these Predictor instructions in the repo.

A local coding environment can connect to a remote instance with:

```bash
omniroute connect https://YOUR-OMNIROUTE-HOST
omniroute contexts current
```

Or configure a tool directly against a remote server with the relevant `setup-* --remote ...` command. Keep the remote management credential and inference key outside Git.

Do **not** vendor the OmniRoute source repository, add it as a git submodule, or deploy it inside the Predictor Netlify/Supabase application.

## Use OmniRoute as Graphify's semantic backend

The default GitHub Graphify workflow remains structural/code-only and needs no model/API credential.

For an intentional deeper pass over current docs plus code, the repository provides:

```bash
export OMNIROUTE_API_KEY='...'
export GRAPHIFY_OMNIROUTE_MODEL='YOUR-OMNIROUTE-MODEL-OR-COMBO'
bash scripts/agent-tools/graphify-deep-via-omniroute.sh
```

The helper points Graphify's OpenAI-compatible backend at `http://localhost:20128/v1` by default. Override it only when the gateway is elsewhere:

```bash
export OMNIROUTE_BASE_URL='https://YOUR-OMNIROUTE-HOST/v1'
```

This is deliberately **opt-in** because semantic extraction can consume model quota and can transmit repository documentation/content to whichever provider OmniRoute selects. `.graphifyignore` excludes historical evidence, local credentials and generated output by default, but an operator must still choose a provider appropriate for the material being analysed.

A semantic Graphify result remains navigation evidence only. It never becomes product, database, hosted-state, security or release authority.

## Stop/restart

Stop the foreground gateway with `Ctrl-C`. Start it again with:

```bash
omniroute --no-open
```

If configuration becomes unhealthy, diagnose before changing repository files:

```bash
omniroute status
omniroute doctor
```

Provider configuration belongs to OmniRoute's user/runtime data, not the Predictor repo.
