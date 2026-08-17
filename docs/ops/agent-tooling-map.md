# Agent tooling map

Which tool answers which question. One row per responsibility, so a future agent
picks by the question it has rather than by which name it recognises.

This file routes. It owns no product rule, no contract position and no hosted
state, and it deliberately states no contract number.

## The map

| Question | Tool | Lane |
| --- | --- | --- |
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

## Boundaries

- Both MCP servers are **development-only**. They are declared in `.mcp.json`,
  which ships to no deployment, and they are absent from `package.json`, so
  neither can enter `dist/`.
- Chrome DevTools MCP drives a **local** browser against a **local** or
  **preview** origin. Pointing a profiling session at Production is a
  deliberate operator act, not a default.
- Neither server may be used to reach a paid football or odds provider. The
  quota rules in [`../../AGENTS.md`](../../AGENTS.md) apply to browser
  automation exactly as they apply to code.
