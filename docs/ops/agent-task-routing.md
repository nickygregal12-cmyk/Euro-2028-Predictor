# Agent task routing

This repository uses **progressive disclosure** rather than asking a coding agent to read the project before it can start.

The normal orientation command is:

```bash
npm run agent:route -- "THE TASK"
```

The command is navigation infrastructure, not a decision authority. It combines a bounded Graphify query with deterministic path/task metadata in `config/agent-routing.json`, then applies the skill-role budget in `config/agent-skills.json`.

A normal task packet should answer only:

- which implementation/test paths are most likely relevant;
- which canonical authority or authorities should be opened next;
- which small set of Agent Skills should be loaded;
- whether Graphify was used and, for a PR artifact, which source SHA it represents.

It does **not** decide product behaviour, scoring, permissions, settlement, database state, hosted state or release readiness.

## Normal flow

```text
simple task
  -> bounded Graphify orientation
  -> tracked source/test shortlist
  -> deterministic route match
  -> exact authority + skill budget
  -> source/tests
  -> Serena for exact symbols when useful
  -> executable verification
```

If the exact tracked implementation file is already known, pass it directly and avoid unnecessary graph work:

```bash
npm run agent:route -- --path src/vnext/leagues/VNextLeagues.tsx \
  "Fix player-row navigation"
```

For an existing unmerged PR, use that PR's downloaded Graphify artifact when branch-specific traversal matters:

```bash
npm run agent:route -- \
  --graph /path/to/graph.json \
  --source-sha PR_COMMIT_SHA \
  "Continue the release-blocker fixes"
```

`--graph` and `--source-sha` are a pair: the router refuses one without the other so a branch graph cannot silently lose the commit identity it represents. If a PR graph is not available, the merged-main snapshot can still orient the baseline architecture, but conclusions about the branch delta must come from the real branch source/tests.

If Graphify is unavailable or genuinely stale, the packet says so and the agent falls back to bounded repository search. Do not block delivery on an indexing tool.

## Context and skill budgets

`config/agent-routing.json` caps the candidate paths and authorities returned by the initial packet. `config/agent-skills.json` normally permits at most one skill from each role:

- navigation;
- process;
- domain;
- review.

Installed does not mean loaded. A task should not carry several competing planning, debugging or review workflows simply because they are available in the repository.

When multiple routes suggest skills in the same role, the higher-priority route wins and the packet records the suppressed skill rather than silently loading both.

## Acceptance benchmark

The context-routing contract is held by a small, network-free representative benchmark:

```bash
npm run agent:bench
npm run agent:bench -- --check
```

`config/agent-context-benchmarks.json` contains the simple prompts and their expected deterministic fallback. The benchmark deliberately disables Graphify: obvious task/domain intent must still classify sensibly if the graph is unavailable, while a symbol-only prompt such as `Refactor MatchCard` must stay unclassified rather than guess which subsystem owns it. In normal use that ambiguous case proceeds through the Graphify fast path.

The benchmark also holds these first-orientation ceilings:

- Graphify query budget at or below **1,200 tokens**;
- no more than **8 candidate source/test paths** in the initial packet;
- no more than **3 authorities** in the initial packet;
- no more than **3 selected specialist/process/review skills** for the representative prompts;
- a deterministic no-graph JSON packet below **8 KiB**.

These are context-efficiency guards, not reasons to hide genuinely required authority. If a real task needs broader context, expand deliberately after the first packet rather than raising the global ceilings to make one exceptional task convenient.

The normal CI test suite and Agent tooling smoke both execute the benchmark. A routing/skill change that causes a representative prompt to over-route therefore fails before it can silently turn progressive disclosure back into repository preloading.

## Pinned specialist skills

Specialist external guidance is split into two layers so it remains useful without becoming permanent startup context:

1. a small Predictor adapter in `.agents/skills/` owns the repository-specific trigger and safety boundary;
2. `config/agent-skill-sources.json` pins the upstream source to an exact repository commit and licence.

When a routed adapter tells the agent to load its upstream guidance, materialize exactly that source:

```bash
npm run agent:skill -- frontend-design
npm run agent:skill -- systematic-debugging
npm run agent:skill -- react-best-practices
npm run agent:skill -- composition-patterns
npm run agent:skill -- supabase-postgres-best-practices
npm run agent:skill -- differential-review
```

The command prints the local entrypoint. Materialized bytes live under ignored `.agent-cache/skills/`; they are reproducible reference material, not repository authority. A cached copy is reused only when its stamped repository, commit and path still match the pinned registry.

Useful maintenance commands are:

```bash
npm run agent:skill -- list
npm run agent:skill -- check
```

`check` is network-free and validates the catalogue structure/pins. The Agent Skills validation workflow additionally proves that routed sources can be fetched at their exact commit. Do not replace the exact-pin path with an installer command that follows a moving branch or cached latest version.

The normal routed set is deliberately small:

| Situation | Specialist |
| --- | --- |
| New/materially reshaped UI or deliberate visual polish | `predictor-frontend-design` |
| Reproducible bug, failed journey, release blocker or regression | `predictor-systematic-debugging` |
| Measured React rerender/bundle/async/rendering problem | `predictor-react-best-practices` |
| Brittle/prop-heavy reusable component API | `predictor-composition-patterns` |
| Postgres/Supabase query, schema, RLS, locking or migration implementation | `predictor-postgres-best-practices` |
| Security/contract-sensitive diff with meaningful blast radius | `predictor-differential-review` |

`web-design-guidelines`, `insecure-defaults` and `react-view-transitions` remain catalogue-only. They are not registered for normal automatic routing; use them only when a task explicitly needs that additional review/architecture lens.

Vercel's React guidance includes a large compiled `AGENTS.md`. Do **not** preload it. Read the upstream `SKILL.md` and only the individual referenced rule files needed for the measured issue. The Predictor adapter also excludes Next.js-only assumptions because this application is React + Vite.

## vNext

`src/vnext/AGENTS.md` is intentionally a compact universal router. Detailed Matches, Leagues, player-profile, Last Man Standing and Championship rules live in their dedicated product authorities and are loaded only when the task enters that surface.

Do not grow the scoped router back into a combined copy of all vNext product documents. The test suite holds a size ceiling so this remains progressive disclosure rather than another context dump.

## Ownership boundaries

- `NOW.md`: generated current-fact index.
- `AGENTS.md` / `CLAUDE.md`: startup and safety routing.
- `config/agent-routing.json`: task/path -> pointer metadata only.
- `config/agent-skills.json`: project skill role/load metadata only.
- `config/agent-skill-sources.json`: immutable external source/commit/licence metadata only.
- `config/agent-context-benchmarks.json`: representative navigation acceptance cases and context ceilings only.
- `.agents/skills/*/SKILL.md`: actual Predictor skill/adaptor instructions.
- `.agent-cache/skills/`: ignored upstream reference bytes, never authority.
- product/ADR/ops authorities: the rules and decisions themselves.
- Graphify/Serena: navigation evidence only.

Use one fact, one home. Do not copy moving contract state, product rules or hosted facts into routing configuration.
