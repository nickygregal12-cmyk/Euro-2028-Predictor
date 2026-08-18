# Agent tooling map

Which tool answers which question. One row per responsibility, so a future agent
picks by the question it has rather than by which name it recognises.

This file routes. It owns no product rule, no contract position and no hosted
state, and it deliberately states no contract number.

## The map

| Question | Tool | Lane |
| --- | --- | --- |
| Which code, dependency, call-flow or cross-layer path should I inspect before editing? | **Graphify** | development navigation |
| Which configured AI model/provider should a compatible coding CLI use, including fallback routing? | **OmniRoute** | developer infrastructure |
| Does the journey work? Navigation, forms, responsive behaviour, accessibility interaction | **Playwright MCP** / `npm run test:e2e*` | development |
| Why is it slow, noisy or broken in the browser? Console, network, traces, Core Web Vitals | **Chrome DevTools MCP** | development |
| Is this research reproducible? | **DVC** | offline research |
| What does the history actually say? Analytical SQL over snapshots | **DuckDB** | offline research |
| What are players doing? | **PostHog** | product runtime |
| What is the business/operational picture? Ad-hoc BI over Supabase | **Metabase** | internal operations |
| What broke at runtime for a real user? | **Sentry** | product runtime |
| Is the supply chain, workflow estate or secret hygiene sound? | CodeQL, Betterleaks, Dependency Review, Harden-Runner, Squawk, zizmor, actionlint, Renovate | CI |
| Can a running deployment actually be attacked? | **Strix** | controlled, manual |
| Tell a player something happened | **Novu**, behind the notification boundary | product capability |

Each capability's own authority carries its detail; this table only routes.

| Capability | Authority |
| --- | --- |
| Repository graph navigation | [`graphify-navigation.md`](graphify-navigation.md) |
| Coding-model/provider routing | [`omniroute-agent-routing.md`](omniroute-agent-routing.md) |
| Offline analytical SQL | [`offline-analytics.md`](offline-analytics.md) |
| Notification delivery | [`notification-delivery.md`](notification-delivery.md) |
| Internal BI | [`metabase-analytics.md`](metabase-analytics.md) |
| Dynamic security assessment | [`strix-security-assessment.md`](strix-security-assessment.md) |
| CI and supply-chain tooling | [`final-engineering-tooling.md`](final-engineering-tooling.md) |

## What is configured versus what is running

Stated here because "we added Novu" and "notifications send" are different
claims, and the gap between them is where a reader gets misled.

| Capability | State |
| --- | --- |
| Graphify | online structural GitHub workflow + snapshot configured; Codespaces CLI provisioned; optional deep semantic run is manual only |
| OmniRoute | Codespaces CLI provisioned; **no provider, endpoint key or gateway process is created by the repository** |
| Playwright MCP, Chrome DevTools MCP | configured; usable now, development-only |
| DuckDB offline analytics | implemented and tested against a committed snapshot |
| Novu notification boundary | implemented and tested; **no credential, no emitter, nothing sends** |
| Metabase | views, role and container config defined; **not applied anywhere, not deployed** |
| Strix | workflow defined; **inert until an owner provisions `STRIX_LLM_API_KEY`** |

Graphify and OmniRoute are deliberately outside the application dependency graph.
Their supported development-tool versions live in
[`../../config/agent-tools.json`](../../config/agent-tools.json), and a Codespace
can provision them through
[`../../scripts/agent-tools/bootstrap.sh`](../../scripts/agent-tools/bootstrap.sh).
Neither is evidence about a deployment, database contract, model promotion or
product rule.

## The two browser MCP servers are not interchangeable

Both are configured in [`../../.mcp.json`](../../.mcp.json) and both are
development-only. Neither is reachable from application code and neither
contributes a byte to a production bundle —
`tests/scripts/mcpServerConfiguration.test.ts` holds that.

**Playwright MCP is the journey tool.** It drives the product: navigate, fill,
click, assert, resize, check focus order and accessible names. It is the one to
reach for when the question is *does this work*. It also remains the tool the
committed E2E suites are written against, so anything proven with it can be
promoted into a spec.

**Chrome DevTools MCP is the diagnosis tool.** It answers *why*: performance
traces, network requests and their timing, console messages, source-mapped
runtime errors, rendering and layout cost, and the browser's own performance
insights. It is the one to reach for when a journey passes but is slow, or when
something fails in a way the DOM does not explain.

The failure mode this split exists to prevent is using a journey driver to guess
at performance, or a profiler to assert product behaviour. A trace is not a
passing test, and a green journey is not evidence that a page is fast.

Chrome DevTools MCP is pinned rather than floating. A profiler that changes
under you produces measurements that cannot be compared with last week's, and an
uncontrolled `@latest` in a checked-in configuration is a dependency nobody
reviewed.

### It needs a Chrome binary, and will not find one in every environment

The server launches **Google Chrome stable** by default, from the platform's
usual install location. A container or CI runner that has only Playwright's
Chromium — which is this repository's normal browser provisioning — fails at the
first tool call with `Could not find Google Chrome executable for channel
'stable'`. The MCP server itself starts fine, so the failure arrives later than
you expect and looks like a tool bug rather than a missing dependency.

Point it at the browser that is actually there:

```bash
npx chrome-devtools-mcp@1.7.0 \
  --executablePath "$PLAYWRIGHT_BROWSERS_PATH"/chromium-*/chrome-linux/chrome \
  --headless --isolated
```

That override is deliberately **not** in `.mcp.json`: the path is specific to a
container, and hard-coding it would break the ordinary case of a developer with
Chrome installed. `--isolated` is worth adding when you do override, so a
profiling session uses a throwaway profile rather than your own.

### Both of its telemetry defaults are off, on purpose

The server ships with two outbound paths to Google, both **on** by default, and
`.mcp.json` disables both:

| Flag | Default | What it sends |
| --- | --- | --- |
| `--usageStatistics` | on | tool usage data |
| `--performanceCrux` | on | **the URLs from performance traces**, to the CrUX API |

The second is the one that matters. Profiling a slow page means profiling a real
URL, and this product's URLs carry invite codes and player identifiers — which
is precisely the defect *"Stop telemetry URLs carrying invite codes and
identifiers"* was landed to fix. A profiler transmitting the URL by default
would reintroduce it through tooling rather than through application code.

Neither default fails anything when left on, which is why
`tests/scripts/mcpServerConfiguration.test.ts` pins them rather than a comment.

## Boundaries

- Graphify is a navigation/indexing aid. Important conclusions still require the
  source, tests and governing repository authority.
- OmniRoute is an optional developer gateway. Provider/model choice through it
  must not become a hidden application, AI Lab or production dependency.
- Both MCP browser servers are **development-only**. They are declared in
  `.mcp.json`, which ships to no deployment, and they are absent from
  `package.json`, so neither can enter `dist/`.
- Chrome DevTools MCP drives a **local** browser against a **local** or
  **preview** origin. Pointing a profiling session at Production is a deliberate
  operator act, not a default.
- Developer tools may not be used to reach a paid football or odds provider
  unless that exact provider call is explicitly authorised. The quota rules in
  [`../../AGENTS.md`](../../AGENTS.md) apply to automation exactly as they apply
  to code.
