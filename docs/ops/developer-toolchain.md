# Developer toolchain runbook

Use this file for **how to run the supported developer tools**. Architecture and responsibility live in [`../architecture/developer-operating-system.md`](../architecture/developer-operating-system.md); quick routing lives in [`agent-tooling-map.md`](agent-tooling-map.md).

Exact supported versions live only in [`../../config/agent-tools.json`](../../config/agent-tools.json). Commands below read that registry or use configuration that already pins the version; do not duplicate versions into prompts or handoffs.

## New or rebuilt Codespace

The repository devcontainer runs:

```bash
bash scripts/agent-tools/bootstrap.sh
```

That performs `npm ci` and provisions the **baseline developer CLIs** without starting any long-running service or creating any provider/task database:

- Graphify;
- OmniRoute CLI;
- Serena;
- GitHub Spec Kit CLI;
- ast-grep;
- Beads CLI;
- `uv`, used to keep Python tooling isolated.

The devcontainer also provides Node, Python and Rust so the optional semantic merge tools can be built when needed. Ports are forwarded for Vite, Storybook, OmniRoute and optional Agent Mail; forwarding a port does not start the process.

The supported environment sets `BD_DISABLE_METRICS=1` and `DOLT_DISABLE_EVENT_FLUSH=1`. Beads command metrics and its underlying Dolt event flush are therefore disabled by default in a Predictor Codespace and in the repository Beads/bootstrap helpers. Local task memory should not create an implicit outbound telemetry path.

For an existing Codespace created before this toolchain landed, rebuild/recreate it so the devcontainer features and bootstrap run from current `main`.

Verify the environment at any time:

```bash
bash scripts/agent-tools/doctor.sh
```

## Normal agent workflow

Do not start by launching every tool. Start with root `AGENTS.md` and the task authority, then choose only what answers the question.

### Cross-file architecture — Graphify

Normal structural graph:

```bash
graphify extract . --code-only --no-cluster
```

For merged code, the dedicated `graphify-navigation` branch contains the latest published structural snapshot. For branch-specific work, prefer the matching Actions artifact.

Query the portable graph through the repository's pinned, freshness-checking
entrypoint:

```bash
bash scripts/agent-tools/graphify-query.sh query "which files form this flow?"
```

Pass a downloaded PR graph with `--graph PATH --source-sha PR_COMMIT_SHA`.

Deep semantic Graphify is deliberately opt-in and can consume model allowance/send indexed content to the configured provider:

```bash
export OMNIROUTE_API_KEY='YOUR_ENDPOINT_KEY'
export GRAPHIFY_OMNIROUTE_MODEL='YOUR_MODEL_OR_COMBO'
bash scripts/agent-tools/graphify-deep-via-omniroute.sh
```

Full details: [`graphify-navigation.md`](graphify-navigation.md) and [`omniroute-agent-routing.md`](omniroute-agent-routing.md).

### Symbol-level navigation/editing — Serena

The repository MCP configuration starts Serena for compatible coding clients from the repository working directory. The tracked project file is `.serena/project.yml`.

The shared repository MCP entry deliberately uses Serena's generic coding/IDE context rather than assuming every agent is Codex or Claude Code:

```bash
serena start-mcp-server --project-from-cwd --context=ide --open-web-dashboard=false
```

A client can use its own Serena-specific setup locally without editing the repository-wide MCP configuration—for example `serena setup codex` for Codex, or Serena's `claude-code` context when configuring Claude Code. The repository config stays client-neutral.

Serena memories are intentionally disabled for this repo. Use repository authorities/specs for durable facts and Beads only for optional local execution memory.

Useful Serena questions are symbol-oriented: find a definition, find referencing symbols, inspect a class/function body or change a bounded symbol. Use Graphify first when the question is broad architecture rather than a symbol.

To verify the tracked Serena project and TypeScript language-server path:

```bash
serena project health-check .
```

The dedicated tooling smoke workflow runs that health check as part of integration validation. The tracked project schema is also guarded in tests so a future Serena update cannot silently revive an obsolete configuration key.

### Current external library docs — Context7

Context7 is configured as an on-demand MCP server through `.mcp.json`; it is not installed into `package.json`.

Use it when implementation depends on the current public API of React, Vite, Supabase, TanStack Query or another external library. It is not a source for Predictor scoring/product/database decisions.

A public-doc session requires no repository credential. If an optional Context7 API key is used for higher/private limits, store it in the coding client/Codespaces secret environment, never Git.

### Bounded AI context — Repomix

Create a compressed task pack:

```bash
bash scripts/agent-tools/context-pack.sh core
bash scripts/agent-tools/context-pack.sh vnext
bash scripts/agent-tools/context-pack.sh backend
```

`all` exists for a deliberate broad audit:

```bash
bash scripts/agent-tools/context-pack.sh all
```

Outputs go to `.artifacts/context/` and are ignored. The config uses Git ignores, explicit sensitive/history exclusions and Repomix's security check. A context pack is disposable transport, not documentation.

Repomix is also available as an on-demand MCP server through `.mcp.json`.

### OpenCode MCP capability setup

`opencode.json` is OpenCode's MCP authority; OpenCode does not consume
`.mcp.json`. The latter stays local-only for Claude-compatible clients. All MCP
prefixes are denied at project scope and only the tracked specialist agents
enable their bounded surfaces.

Validate the deterministic configuration without network access:

```bash
bash scripts/agent-tools/mcp-readiness.sh --config-only
```

After quitting/restarting OpenCode, authenticate each OAuth server explicitly:

```bash
opencode mcp auth supabase-dev
opencode mcp auth supabase-prod
opencode mcp auth netlify
opencode mcp auth sentry
opencode mcp auth posthog
opencode mcp list
```

On a remote host, forward the localhost callback port printed by OpenCode over
SSH for the browser flow, then restart OpenCode. GitHub is different: rerun the
cloud installer after `gh auth login`; it captures `gh auth token` without
printing it and preserves unknown protected env keys. Never paste a token into a
prompt.

The explicit connectivity smoke performs MCP initialization/tool listing only:

```bash
bash scripts/agent-tools/mcp-readiness.sh --connectivity
# or
bash scripts/agent-tools/cloud-conductor-doctor.sh --mcp
```

It invokes zero provider tools. `AUTH=REQUIRED` means complete OAuth;
`UNAVAILABLE=YES` (including provider 5xx) is not evidence of bad credentials.
CI runs config-only mode and requires no OAuth browser flow.

The Netlify remote is primary. For a transient 5xx, inspect the prepared manual
fallback without starting it:

```bash
bash scripts/agent-tools/netlify-mcp-fallback.sh
```

There is no automatic failover. If explicitly started, the client must continue
to allowlist only `netlify-deploy-services-reader`; never expose environment,
secret or deploy-trigger tools.

## Planning and execution memory

### Predictor spec-driven workflow + GitHub Spec Kit

For non-trivial work, follow `.agents/skills/predictor-spec-driven-delivery/SKILL.md` first.

The `specify` CLI is provisioned so compatible agents can use Spec Kit's workflow commands. **Do not run `specify init` over this repository** unless a future explicit architecture decision replaces the existing authority model. The repo already owns its ADRs, scoped instructions, product authorities and specs.

Treat Spec Kit as a way to execute clarify/specify/plan/tasks/analyze/implement, with the Predictor authorities above it.

### Beads local execution memory

The CLI is provisioned but no Beads database is created automatically. Its release archive is downloaded from the exact supported GitHub release and verified against the release SHA-256 checksum before `bd` is installed.

Initialise only when a longer task genuinely benefits from local dependency-aware memory:

```bash
bash scripts/agent-tools/beads-init.sh
```

The script uses Beads stealth mode. `.beads/` remains ignored; it does not modify the repository authority tree. The helper also explicitly exports the Beads/Dolt telemetry opt-outs, so the local-memory path stays local even outside a Codespace whose `remoteEnv` already supplies them.

Typical local use:

```bash
bd prime
bd ready
bd show <id>
bd remember "short implementation insight"
```

A fact needed by another clone or future reviewer belongs in the actual spec/authority/PR—not only Beads.

### MCP Agent Mail for real concurrent work

Do not install/start this for a single agent.

One-time install in a Codespace/clone:

```bash
bash scripts/agent-tools/install-agent-mail.sh
```

Start deliberately:

```bash
bash scripts/agent-tools/agent-mail.sh
```

The repository launcher binds localhost and uses the optional forwarded port shown by Codespaces. Keep the forwarded port **private**. The local unauthenticated mode is acceptable only behind that localhost/private boundary; configure bearer authentication before any public/remote exposure.

Agent Mail is for file reservations, messages and handoffs. A reservation is not permission to overwrite another branch, and a message is not a merge or product decision.

## Structural change tools

### ast-grep

The baseline bootstrap installs the current pinned `ast-grep` CLI. Use it for syntax-aware search/refactor where regex would be fragile.

Examples:

```bash
ast-grep run --pattern 'console.log($A)' --lang ts src
ast-grep run --pattern 'useEffect($A, $B)' --lang tsx src
```

Before applying a rewrite broadly, inspect matches first. Review the Git diff and run affected tests afterwards.

### dependency-cruiser architecture contract

Run locally:

```bash
bash scripts/agent-tools/architecture-check.sh
```

CI runs the same central-versioned command on every pull request and merge-queue
candidate before the application build. The always-present `CI / Required merge
gate` job fails unless the complete CI job, including this non-zero graph check,
succeeds. This makes it suitable for one required branch rule without the
missing-check ambiguity of the retired path-scoped workflow.

The config is `.dependency-cruiser.cjs`. It is fail-closed: analysing zero modules or reporting an error-severity architecture violation fails the command. Circular dependencies are blocking. Add a new blocking rule only after the repository architecture actually decides that boundary.

### Weave and Mergiraf

These are optional because most merges should remain ordinary Git merges.

Install both exact supported engines:

```bash
bash scripts/agent-tools/install-merge-tools.sh
```

Choose **one** for the current clone:

```bash
bash scripts/agent-tools/configure-merge-driver.sh weave
# or
bash scripts/agent-tools/configure-merge-driver.sh mergiraf
```

Disable the Predictor semantic merge driver:

```bash
bash scripts/agent-tools/configure-merge-driver.sh off
```

Configuration is clone-local (`.git/config` / `.git/info/attributes`) and is not committed. Weave is the preferred first trial; Mergiraf remains an alternative/fallback for supported syntax. An auto-resolved conflict still needs normal diff review and CI.

## UI and output quality

### What to run before pushing a vNext presentation change

A directory-scoped test run is not the gate. `npx vitest run tests/vnext` looks
like thorough local coverage and silently skips the design-system ratchets in
`tests/design-system/` — `foundationAdoption.test.ts` reads every stylesheet in
the repository and fails a `font-size` set from a literal rather than the
`--fs-*` scale. A new vNext component stylesheet is exactly the change that trips
it, and exactly the change whose author is least likely to be running that
directory.

Storybook is a separate gate again, in its own workflow
(`.github/workflows/storybook.yml`), and `npm test` does not cover it. Its build
runs the application's Vite config, so an application-only plugin that is not
filtered in `.storybook/main.ts` fails the workbench build without touching a
single test.

So the local gate for a vNext UI change is:

```bash
npm test                      # the WHOLE suite, not one directory
npm run build:storybook       # the workbench build, separate workflow
npm run test:storybook        # Storybook render + a11y
npm run lint && npm run lint:css
npx tsc -b
bash scripts/agent-tools/architecture-check.sh
npm run check:dead-code
```

Add `npm run check:documentation-authorities` and `npm run check:now` when a
contract record or an accepted-requirement status moved.

### Authoritative visual regression — Playwright

The repository's blocking visual contract remains the Playwright screenshot workflow:

- `.github/workflows/visual-contracts.yml`;
- `playwright.visual.config.ts`;
- reviewed baselines under `e2e/visual-baselines/`.

Do not replace those baselines with screenshots generated on a different machine/tool. Deliberate baseline changes are rendered on the comparison runner and reviewed in the PR.

### Lost Pixel OSS — optional compatibility/review

Lost Pixel's managed service is not a dependency of this repository. The OSS engine is retained only as an optional Storybook screenshot/review path:

```bash
bash scripts/agent-tools/lost-pixel-review.sh
```

It builds deterministic Storybook and runs the exact pinned OSS engine in generate-only/non-blocking mode. Use it as another view of the UI, not as release proof.

### React Scan — manual React rendering diagnosis

Run the app/preview first, then:

```bash
bash scripts/agent-tools/react-scan.sh
```

Or point it at another local/preview URL:

```bash
bash scripts/agent-tools/react-scan.sh http://127.0.0.1:4173
```

React Scan is diagnosis-only and intentionally absent from application dependencies/bundles. Use Chrome DevTools MCP for network, console, trace and browser-level performance questions; use Lighthouse CI for the page-performance gate.

### Cross-engine browser smoke — Playwright

The normal authenticated suite stays Chromium-first. Its canonical
`weekly-navigation.spec.ts` floor also runs in desktop Firefox and WebKit from
the same `playwright.config.ts`, against the same disposable local Supabase:

```bash
npm run test:e2e -- weekly-navigation.spec.ts
```

This is deliberately a six-test compatibility smoke (three journeys in two
extra engines), not a second full-suite or visual-baseline authority.

## Documentation link integrity

The scheduled and Markdown-scoped `Documentation link integrity` workflow uses
checksum-verified Lychee 0.24.2 against only tracked Markdown. It runs offline
and includes local anchor validation, so a renamed file or heading fails without
sending the repository's extracted URLs to third-party hosts. External URL
availability is deliberately not implicit; enabling it is a separate disclosure
and reliability decision.

## OmniRoute

The CLI is provisioned, but providers, endpoint keys and the process remain operator-owned.

One-time setup and service start:

```bash
omniroute setup
omniroute --no-open
```

Open the private forwarded OmniRoute port in Codespaces, connect the desired providers, create an Endpoint inference key and optionally create a fallback Combo.

Compatible clients can then be configured through OmniRoute commands such as:

```bash
omniroute setup-codex
omniroute launch-codex
omniroute setup-claude
```

Provider credentials and endpoint keys stay in user/Codespaces secrets. OmniRoute is developer infrastructure, not Predictor application routing.

## What is intentionally not automatic

The bootstrap does **not**:

- start OmniRoute;
- create/configure provider credentials;
- initialise Beads;
- install/start MCP Agent Mail;
- install or enable semantic merge drivers;
- run model-backed Graphify;
- run React Scan or Lost Pixel;
- make a Codespaces port public;
- change Supabase/Netlify/Production;
- consume football/odds provider quota.
- authenticate MCP OAuth providers or invoke any hosted MCP tool.

That keeps a fresh Codespace useful without turning it into a collection of hidden daemons or state stores.

## Troubleshooting

Start with:

```bash
bash scripts/agent-tools/doctor.sh
```

Then re-run the bounded bootstrap if a baseline CLI is missing:

```bash
bash scripts/agent-tools/bootstrap.sh
```

For an MCP tool, verify the client is reading repository `.mcp.json` and that `${HOME}/.local/bin` is on `PATH`. For Serena specifically, `serena project health-check .` verifies the tracked project configuration and language-server path. For Codespaces created before this configuration, rebuild the container rather than manually reproducing its features one by one.

Do not “fix” a missing developer tool by adding it to production `dependencies`. The supported lifecycle is part of the architecture.
