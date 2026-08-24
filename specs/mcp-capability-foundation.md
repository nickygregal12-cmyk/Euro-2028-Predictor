# MCP capability foundation

## Problem and outcome

The persistent OpenCode workspace has specialist agents but no tracked MCP
inventory or capability gates. Operators need reproducible local and hosted MCP
connections whose schemas are unavailable by default and are exposed only to
the agent role that needs them.

## Scope

- Track the five local and six remote OpenCode MCP servers named by the task.
- Keep Claude's `.mcp.json` local-only and align every local package pin with
  `config/agent-tools.json`.
- Deny every MCP prefix at project scope, then grant narrow role-specific MCP
  tools. The Ox critic receives none.
- Prepare protected GitHub-token and OAuth setup without committing secrets.
- Add non-mutating configuration/readiness checks, provider-state vocabulary,
  a Netlify read-only fallback, Serena stability, and the Claude updater guard.
- Update the live developer-tooling/runbook authorities.

## Out of scope

- Authenticating OAuth providers during CI or claiming that they are connected.
- Invoking any external MCP tool, deploying, changing hosted configuration, or
  mutating Supabase, Netlify, GitHub, Sentry, PostHog, Production, secrets, paid
  providers, or player data.
- Giving Claude hosted MCP credentials or changing application dependencies.

## Governing authorities

- `AGENTS.md` and `NOW.md`
- `docs/ops/agent-tooling-map.md`
- `docs/architecture/developer-operating-system.md`
- `docs/ops/developer-toolchain.md`
- `docs/ops/persistent-cloud-conductor.md`
- The exact OpenCode version and developer-tool pins in
  `config/agent-tools.json`

## Acceptance scenarios

1. OpenCode 1.18.19 loads the tracked config with the exact required inventory,
   local commands, remote security parameters, and no literal credential.
2. All MCP prefixes are disabled globally. Builder alone can expose
   `supabase-dev_*`; Visual QA exposes only browser MCPs; Release Verifier gets
   bounded read-only hosted evidence; Critic gets no MCP tools.
3. Reinstalling the cloud service preserves unknown protected environment keys,
   can source a GitHub MCP token through `gh auth token` without printing it,
   and leaves OAuth credentials in OpenCode's external auth store.
4. Default doctor/readiness checks are local and non-mutating. Explicit MCP
   connectivity performs only protocol initialization/tool listing with bounded
   timeouts and reports configured, authentication, connection, and upstream
   unavailable states without printing credentials.
5. Netlify 5xx is reported as unavailable, not bad authentication, and its
   prepared fallback is exact-versioned, manual, and read-only.
6. Pinned Serena health-check leaves `.serena/project.yml` byte-stable, and CI
   fails if it rewrites the tracked normalization.
7. Optional Claude install merges `DISABLE_AUTOUPDATER=1` into user settings,
   the bridge exports it, and version drift remains visible/fail-closed.
8. Deterministic tests prove all security, parity, gating, and non-mutation
   boundaries without credentials or OAuth browser interaction.

## Security and environment constraints

Production is read-only evidence only and remains separately identified from
Development. No hosted or player state may change. PostHog is server-side
read-only, token-optimized, feature-filtered, and excludes AI observability and
Replay Vision. Sentry exposes only its read-only inspect skill and excludes Seer;
triage and its write-capable tools are not enabled. GitHub is server-side read-only
and keeps writes behind existing `git`/`gh` approvals. Netlify model context never
includes environment-secret or deploy-trigger tools.

## Completion predicate

Focused and broader relevant tests pass; exact OpenCode config validation passes
under 1.18.19; shell/config/documentation/architecture checks pass; Serena is
clean after health-check; the intended diff is committed on the task branch;
OAuth and live connectivity are explicitly reported as unproven unless actually
completed by the operator.
