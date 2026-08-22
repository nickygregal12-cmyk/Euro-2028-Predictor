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

## vNext

`src/vnext/AGENTS.md` is intentionally a compact universal router. Detailed Matches, Leagues, player-profile, Last Man Standing and Championship rules live in their dedicated product authorities and are loaded only when the task enters that surface.

Do not grow the scoped router back into a combined copy of all vNext product documents. The test suite holds a size ceiling so this remains progressive disclosure rather than another context dump.

## Ownership boundaries

- `NOW.md`: generated current-fact index.
- `AGENTS.md` / `CLAUDE.md`: startup and safety routing.
- `config/agent-routing.json`: task/path -> pointer metadata only.
- `config/agent-skills.json`: skill role/load metadata only.
- `.agents/skills/*/SKILL.md`: actual skill instructions.
- product/ADR/ops authorities: the rules and decisions themselves.
- Graphify/Serena: navigation evidence only.

Use one fact, one home. Do not copy moving contract state, product rules or hosted facts into routing configuration.
