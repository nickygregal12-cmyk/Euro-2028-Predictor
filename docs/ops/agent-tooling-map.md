# Agent tooling map

Which tool answers which question. One row per responsibility, so a future agent picks by the question it has rather than by which name it recognises.

This file **routes only**. The architecture and authority model lives in [`../architecture/developer-operating-system.md`](../architecture/developer-operating-system.md); exact commands live in [`developer-toolchain.md`](developer-toolchain.md). This file owns no product rule, contract position or hosted state.

## Development / AI work

| Question | Primary tool | Lane |
| --- | --- | --- |
| I only have a task prompt; what small repo context should I load? | **`npm run agent:route -- "TASK"`** | bounded orientation |
| What repository authority should I read? | root **`AGENTS.md` → `NOW.md` → task authority** | authority |
| Which dependency/call-flow/cross-layer path should I inspect? | **Graphify** | navigation |
| Which exact symbol/reference/caller should I inspect or edit? | **Serena** | semantic code intelligence |
| What does the current external library documentation say? | **Context7** | external documentation |
| How do I package a bounded code/context slice for an AI handoff? | **Repomix** | disposable context transport |
| How should non-trivial work move from outcome to tasks? | **Predictor spec-driven delivery**, optionally executed with **Spec Kit** | planning |
| What local work/dependency should this agent remember next? | **Beads**, stealth/local only | execution memory |
| How do concurrent agents reserve/hand off work? | **MCP Agent Mail**, only when concurrency justifies a service | coordination |
| How do I search/refactor syntax rather than strings? | **ast-grep** | structural editing |
| Does the source dependency direction still obey repository architecture? | **dependency-cruiser** | blocking architecture CI |
| Can a difficult source conflict be syntax-merged? | **Weave** preferred / **Mergiraf** alternative | optional clone-local merge aid |
| Which configured model/provider should a compatible coding CLI use? | **OmniRoute** | optional developer infrastructure |

Do not chain all of these automatically. Start with authority, then use only the specialist that answers the missing question.

## UI / quality / runtime diagnosis

| Question | Primary tool | Lane |
| --- | --- | --- |
| Does the journey work—navigation, forms, responsive behaviour, accessibility interaction? | **Playwright MCP** / `npm run test:e2e*` | development |
| Did a curated UI surface move visually without approval? | **Playwright visual contracts** | blocking visual CI |
| Do I want an extra Storybook screenshot/export pass? | **Lost Pixel OSS** | optional review only |
| Which React component is rendering unnecessarily? | **React Scan** | manual development diagnosis |
| Why is the browser slow/noisy/broken—console, network, trace, rendering, Core Web Vitals? | **Chrome DevTools MCP** | development diagnosis |
| Does the page meet the performance budget? | **Lighthouse CI** | CI |
| Is deterministic behaviour correct? | **Vitest** | CI/development |
| Do important invariants survive broad input space? | **fast-check** | domain verification |
| Would a plausible mutation escape the tests? | **Stryker** | test-strength verification |
| What broke at runtime for a real user? | **Sentry** | product runtime |

Playwright and Chrome DevTools are deliberately different: Playwright proves **what the user can do**; DevTools diagnoses **why the browser behaves as it does**. A trace is not a passing journey test, and a green journey is not evidence that the page is fast.

## Data / operations / security

| Question | Primary tool | Lane |
| --- | --- | --- |
| Is offline research reproducible? | **DVC** | offline research |
| What does historical analytical data say? | **DuckDB** | offline analytics |
| What are players doing? | **PostHog** | product runtime analytics |
| What is the business/operational picture? | **Metabase** | internal operations |
| Is the supply chain/workflow estate/secret hygiene sound? | CodeQL, Betterleaks, Dependency Review, Harden-Runner, Squawk, zizmor, actionlint, Renovate | CI |
| Can a running deployment actually be attacked? | **Strix** | controlled manual security assessment |
| Deliver a player notification | **Novu**, behind the notification boundary | product capability |

## Canonical detail

| Capability | Authority / runbook |
| --- | --- |
| Bounded task/context routing | [`agent-task-routing.md`](agent-task-routing.md) |
| Developer tool architecture and authority boundary | [`../architecture/developer-operating-system.md`](../architecture/developer-operating-system.md) |
| Install/run/activate developer tools | [`developer-toolchain.md`](developer-toolchain.md) |
| Repository graph navigation | [`graphify-navigation.md`](graphify-navigation.md) |
| Coding-model/provider routing | [`omniroute-agent-routing.md`](omniroute-agent-routing.md) |
| Offline analytical SQL | [`offline-analytics.md`](offline-analytics.md) |
| Notification delivery | [`notification-delivery.md`](notification-delivery.md) |
| Internal BI | [`metabase-analytics.md`](metabase-analytics.md) |
| Dynamic security assessment | [`strix-security-assessment.md`](strix-security-assessment.md) |
| CI and supply-chain tooling | [`final-engineering-tooling.md`](final-engineering-tooling.md) |

## Configured does not mean running

| Capability | Repository state |
| --- | --- |
| Graphify | structural GitHub workflow/snapshot + Codespaces CLI; deep semantic run manual only |
| Serena | Codespaces CLI + MCP/project config; no persistent memory authority |
| Context7 | pinned on-demand MCP; optional key is user-owned |
| Repomix | pinned on-demand MCP + bounded pack scripts; outputs ignored |
| OmniRoute | CLI provisioned; **no provider, endpoint key or gateway process created automatically** |
| Spec Kit | CLI provisioned as adapter; no generic project initializer/constitution applied |
| ast-grep | CLI provisioned; no automatic repository-wide rewrite |
| Beads | CLI provisioned; database is absent until an operator explicitly initialises stealth mode |
| dependency-cruiser | configuration + CI architecture contract |
| MCP Agent Mail | optional installer/launcher; absent and stopped by default |
| Weave / Mergiraf | optional installer; neither merge driver is enabled by default |
| Playwright / Chrome DevTools MCP | configured, development-only |
| Playwright visual contracts | blocking curated baseline workflow |
| Lost Pixel OSS | optional generate-only adapter; managed service is not a repository dependency |
| React Scan | manual URL-based diagnosis; not in the product bundle |
| DuckDB offline analytics | implemented/tested against committed snapshot |
| Novu notification boundary | implemented/tested; **no credential/emitter, nothing sends by configuration alone** |
| Metabase | views/role/container config defined; **not deployed by configuration alone** |
| Strix | workflow defined; inert until its operator secret is provisioned |

The exact supported developer-tool versions live in [`../../config/agent-tools.json`](../../config/agent-tools.json). Do not copy those numbers into future prompts or planning documents.

## Browser MCP privacy boundary

Both browser MCP servers are development-only and live in `.mcp.json`, outside application dependencies.

Chrome DevTools telemetry is disabled in the checked-in configuration because profiling a URL can expose route values such as invite codes or player identifiers to an external telemetry endpoint. When a container has Playwright Chromium but no normal Google Chrome installation, point Chrome DevTools MCP at the available browser explicitly for that environment rather than hard-coding a container path into the repository config.

Neither browser tool should be pointed at Production as an accidental default. Developer tools may not consume a paid football/odds provider merely because a browser can reach a page that would trigger it; the quota/environment rules in root `AGENTS.md` still apply.

## Boundaries

- Developer-tool output is navigation/evidence, not product, database or hosted authority.
- Developer packages belong outside application dependencies unless a separate product decision genuinely needs one at runtime.
- Generated local state—context packs, Serena index state, Beads stealth DB, screenshots/reports—does not become durable documentation by existing.
- No tool is permission to weaken Production/Supabase/provider safety rules.
- Concurrent-agent coordination supplements Git branches/PRs; it never bypasses review or merge evidence.
