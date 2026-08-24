# Developer operating system

This document defines how repository authorities and developer tools fit together. It is deliberately about **architecture and responsibility**, not installation commands or current hosted state.

Operational commands live in [`../ops/developer-toolchain.md`](../ops/developer-toolchain.md). Current product, database and hosted facts keep their existing canonical homes.

## Goal

Make a long-running, GitHub-first, AI-assisted project easier to change **without making the toolchain another source of truth**.

The useful developer loop is:

1. load the smallest authoritative context;
2. navigate the implementation efficiently;
3. plan non-trivial work against that authority;
4. edit at the safest available structural level;
5. enforce architecture before behaviour is reviewed;
6. verify behaviour, visuals, accessibility and performance with the right specialist;
7. coordinate concurrent agents without hiding work from Git/GitHub;
8. preserve only durable facts in their canonical repository home.

No tool below can establish a product rule, database contract, hosted state, provider result, model-promotion verdict or release claim merely because it generated an answer.

## Authority is above tooling

The order is intentional:

```text
repository authority + current source/tests
                |
                v
       navigation / retrieval
                |
                v
       planning / coordination
                |
                v
          structural editing
                |
                v
      executable verification
                |
                v
       GitHub review + merge
```

For this repository, authority starts at root [`../../AGENTS.md`](../../AGENTS.md), the generated index [`../../NOW.md`](../../NOW.md), the task-scoped ADR/product/architecture/operations authority, exact source, executable tests and—only when a claim needs it—fresh hosted evidence.

Generated graphs, retrieved documentation, memories, context packs, agent messages, visual reports and profiler output are **tools or evidence**, never a promotion into authority.

## Layer 1 — know what is true and what to inspect

| Question | Primary mechanism | Boundary |
| --- | --- | --- |
| What does this repository currently say is authoritative for the task? | `AGENTS.md` → `NOW.md` → task-scoped authority | read first; no tool substitutes for it |
| Which code/dependency/cross-layer path is likely involved? | **Graphify** | navigation index; verify important edges in source |
| Which symbol, reference, implementation or caller should be edited? | **Serena** | semantic retrieval/editing; its index/memory is not authority |
| What does the current external library API say? | **Context7** | external docs only; never use it to infer Predictor product rules |
| How do I hand a bounded implementation slice to an AI/model? | **Repomix** | task-scoped pack; security check on; generated packs are disposable |

These tools are complementary rather than competing search engines:

- Graphify starts broad and answers **where does this flow go?**
- Serena narrows to symbols and answers **what exact code owns this and who calls it?**
- Context7 leaves the repository and answers **what does this external dependency's current documentation say?**
- Repomix packages an already-bounded slice when a model/handoff needs a portable context window.

A routine one-file fix does not need all four. Progressive disclosure remains the rule.

## Layer 2 — decide and coordinate before editing

The canonical delivery method is the repository skill [`../../.agents/skills/predictor-spec-driven-delivery/SKILL.md`](../../.agents/skills/predictor-spec-driven-delivery/SKILL.md).

| Need | Tool | Rule |
| --- | --- | --- |
| specify/plan/tasks for non-trivial work | **Predictor spec-driven delivery** | canonical repository workflow |
| command-line spec workflow in a compatible agent | **GitHub Spec Kit** | execution adapter only; do not initialise a competing constitution/authority tree |
| local task/dependency memory across agent turns | **Beads** | optional local `--stealth` memory with outbound metrics disabled; GitHub/specs remain durable collaboration record |
| several coding agents need to avoid collisions | **MCP Agent Mail** | optional coordination service; messages/reservations do not replace branches, commits or review |

### Why Spec Kit is an adapter, not the root

This repository already has ADRs, accepted requirements, product authorities, scoped `AGENTS.md` files and a specification workflow. Running a generic project initializer over those would create two places that can claim to decide the same thing.

Use Spec Kit's useful verbs—clarify, specify, plan, tasks, analyze, implement—inside the Predictor authority model. Do **not** run an initializer that rewrites `AGENTS.md`, adds a competing constitution or silently promotes generated planning text over existing decisions.

### Why Beads stays local

Beads is useful for dependency-aware execution memory and “what is ready next?” It is not needed as a second issue tracker or a second accepted-requirements database. The supported setup is stealth/local so `.beads/` is ignored and a clone can throw it away without losing project truth. The supported Codespace and Beads helpers also disable Beads command metrics and Dolt event flushing, so using local execution memory does not introduce an implicit telemetry path.

### Why Agent Mail is opt-in

A single agent gains little from another daemon. It becomes useful when two or more agents genuinely work concurrently and need file reservations, threaded handoffs or explicit ownership boundaries. Git remains the final concurrency and merge authority.

## Layer 3 — change code structurally and keep dependency direction executable

| Need | Tool | Rule |
| --- | --- | --- |
| structural search or codemod | **ast-grep** | prefer syntax-aware matching to repository-wide regex replacement |
| enforce allowed dependency direction | **dependency-cruiser** | blocking architecture contract for proven rules |
| difficult syntax-level merge conflict | **Weave** preferred / **Mergiraf** alternative | optional, clone-local merge driver; never enable both |

### dependency-cruiser is the executable architecture layer

Documentation can explain why a boundary exists; CI should hold the boundary where it can be expressed mechanically.

The contract in [`../../.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs) protects rules that are both intentional and verified against the current source graph:

- only `App.tsx` may register `src/dev` previews, where the existing routes are lazy and guarded by `import.meta.env.DEV`; every other shipped source surface stays independent of the dev harness;
- domain logic stays free of UI/query/hosted-data frameworks;
- vNext presentation cannot reach application services/features except through `vnext/integration`;
- vNext does not inherit the legacy visual design system;
- source cannot import the test suites;
- unresolved **relative source imports** fail, while npm/package availability remains owned by `npm ci` and the application build;
- dependency cycles are blocking; the source graph was verified cycle-free before that rule was promoted from observation to enforcement.

The wrapper also fails closed if dependency-cruiser analyses zero modules or reports any error-severity violation, so a missing compiler/resolver cannot produce a trustworthy-looking green gate.

Do not encode speculative architecture just because dependency-cruiser makes it easy to write a rule. A new restriction needs a real repository decision first.

### ast-grep is a mechanism, not an autofix authority

Use it to locate or transform syntax reliably. Review the resulting Git diff and run the exact affected tests. A structural match can still be semantically wrong.

### semantic merge tools are local assistance

Weave and Mergiraf are intentionally not tracked as a repository-wide Git merge driver. An agent/developer may enable one for a clone when concurrent work creates a difficult conflict. Standard Git conflict review remains the fallback, and a successful automatic merge still requires the normal test/CI evidence.

## Layer 4 — verify the right property with the right tool

| Property | Primary tool |
| --- | --- |
| deterministic logic | Vitest / domain tests |
| input-space properties | fast-check |
| test strength | Stryker mutation testing |
| user journey / navigation / responsive interaction | Playwright |
| accessibility interaction | Playwright + axe |
| visual regression | **Playwright visual contracts** |
| component review | Storybook |
| unnecessary React renders | **React Scan**, manual diagnostic |
| console/network/rendering/Core Web Vitals diagnosis | Chrome DevTools MCP |
| page performance budget | Lighthouse CI |
| production error | Sentry |

### Visual authority: Playwright stays canonical

The repository already has runner-generated, reviewed, deterministic Playwright screenshot baselines. They are the blocking visual regression contract.

**Lost Pixel OSS is supported only as an optional visual review/export adapter.** Its hosted/managed product is being sunset, so the repository does not make a disappearing service part of the release path. A Lost Pixel image does not replace the reviewed Playwright baseline.

### React Scan stays outside the runtime bundle

React Scan is valuable during a performance investigation, but permanent application instrumentation would turn a diagnostic into product code. The supported path launches it manually against a development/preview URL.

## Layer 5 — route AI providers without coupling the product

**OmniRoute** is optional developer infrastructure for compatible coding clients and model-backed developer tools. It does not route application AI Lab traffic unless a separately authorised application change explicitly does so, and it does not affect ChatGPT's GitHub connector.

Graphify's optional deep/semantic mode may use an operator-configured OmniRoute endpoint. The default structural Graphify workflow remains local/code-only and consumes no model quota.

## Installation/runtime classes

The canonical versions and lifecycle classifications live in [`../../config/agent-tools.json`](../../config/agent-tools.json).

| Class | Meaning | Examples |
| --- | --- | --- |
| bootstrap | provisioned in a new/rebuilt Codespace, no service started | Graphify, Serena, Spec Kit CLI, ast-grep, Beads CLI |
| bootstrap-manual-service | CLI is ready, service/provider configuration remains explicit | OmniRoute |
| on-demand | exact pinned package is invoked only when needed | Context7 MCP, Repomix, dependency-cruiser |
| manual diagnostic | launched for an investigation, never bundled into the app | React Scan |
| optional adapter/service | heavier/stateful capability installed or started only deliberately | Lost Pixel OSS, MCP Agent Mail, Weave, Mergiraf |
| role-gated remote MCP | configured connection whose schemas are root-denied and selectively enabled per agent | Supabase, GitHub, Netlify, Sentry, PostHog |

The distinction is load-bearing. “Supported by the repo” does not mean “every process starts in every Codespace.”

## Keeping tool versions current without floating them

Every entry in [`../../config/agent-tools.json`](../../config/agent-tools.json) declares both its exact supported version and the package/tag datasource Renovate should use to discover updates. [`../../renovate.json`](../../renovate.json) has one JSONata custom manager over that registry rather than a separate update rule for every tool.

Developer-tool updates are intentionally more conservative than ordinary patch dev-dependency updates:

- Renovate must wait through the configured release-age soak before proposing them;
- developer-tool PRs never auto-merge;
- the tooling smoke resolves or installs the exact proposed versions and validates the integration shape;
- architecture and normal repository CI still run before merge.

This matters for AI/developer infrastructure because a newly published tool can change repository-reading, code-editing or coordination behaviour even when its version bump looks small. Central pinning is only durable if discovery is automated and adoption remains reviewed.

## Credentials and data movement

- No developer tool receives Production, Supabase or paid-provider credentials by default.
- OpenCode owns its MCP inventory in `opencode.json`; `.mcp.json` remains a
  local-only Claude-compatible inventory. Every MCP prefix is disabled at root,
  with the smallest required per-agent grants. Connection is not authority to
  invoke a tool.
- Hosted OAuth remains in OpenCode's user auth store. The one header-backed
  GitHub token is obtained host-side from `gh`, stored in the mode-0600 cloud
  environment file, and used only against GitHub's read-only endpoint/toolsets.
- Keep `.env`, credential exports, backups and secret material outside Graphify, Serena and Repomix indexes/packs.
- Context7 needs no key for basic public-doc use; any optional key remains a user/Codespaces secret.
- OmniRoute provider credentials and Endpoint keys remain outside Git.
- Beads task memory is local/ignored and the supported environment disables both Beads command metrics and Dolt event flushing.
- Agent Mail binds to localhost in the repository launcher. A Codespaces forwarded port should remain private; public exposure requires real bearer authentication first.
- Deep model-backed Graphify may transmit indexed repository content to the selected model provider; it is explicitly opt-in.

## Documentation ownership

Use **one fact, one home**:

- architecture/responsibilities: this file;
- exact install/run commands: [`../ops/developer-toolchain.md`](../ops/developer-toolchain.md);
- quick “which tool?” routing: [`../ops/agent-tooling-map.md`](../ops/agent-tooling-map.md);
- current moving product/repository facts: existing machine records / `NOW.md` / current-status as routed by root `AGENTS.md`;
- product decisions: ADR/product authorities;
- historical evidence: history/evidence directories on demand.

Do not duplicate package versions into these docs; `config/agent-tools.json` owns them. Do not copy current contract or hosted-state numbers here.

## Completion standard for tooling changes

A developer-tool integration is complete only when:

1. its role and authority boundary are unambiguous;
2. its supported version is pinned centrally **and its update datasource is declared**;
3. bootstrap/on-demand/optional lifecycle is explicit;
4. secrets, telemetry and generated state have a safe location/default;
5. a smoke/config test proves the integration shape;
6. any new architectural restriction is executable in CI where practical;
7. application/runtime dependency graphs remain clean unless the tool genuinely belongs in the product;
8. documentation points to one canonical home rather than copying the same instructions across skills.
