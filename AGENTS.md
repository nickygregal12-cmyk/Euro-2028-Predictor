# Agent operating rules

This repository is a multi-competition football prediction platform. Euro 2028 is a recoverable tournament baseline, not the default assumption for new platform work.

## Start here

Before editing:

1. Read [`NOW.md`](NOW.md). It is the generated index of current moving facts.
2. Check current `main`, your branch ancestry, and open PRs for overlap.
3. Route the task using the table below and load only that authority plus the source/tests you need.
4. If the exact implementation file/symbol is not already known, use Graphify to **narrow the likely source/test surface before broad source browsing**. Skip it for an explicitly bounded one-file/symbol task.
5. For non-trivial multi-file delivery, use [`.agents/skills/predictor-spec-driven-delivery/SKILL.md`](.agents/skills/predictor-spec-driven-delivery/SKILL.md).

Do **not** preload the documentation tree. Dated audits, rollout narratives, old TODOs and generated tool output are evidence on demand, not startup context.

## Task routing

| Task | Read next |
| --- | --- |
| vNext UI / frontend | [`docs/product/ui.md`](docs/product/ui.md), then [`src/vnext/AGENTS.md`](src/vnext/AGENTS.md) |
| vNext multi-stage programme / resume Stages 8–15 | [`.agents/skills/vnext-programme-runner/SKILL.md`](.agents/skills/vnext-programme-runner/SKILL.md), [`docs/product/vnext-programme-controller.md`](docs/product/vnext-programme-controller.md), [`config/vnext-programme.json`](config/vnext-programme.json) |
| Product/game rule | [`docs/adr/README.md`](docs/adr/README.md) + governing ADR; accepted gaps live in [`docs/quality/accepted-requirements.md`](docs/quality/accepted-requirements.md) |
| Database / migration | machine records under `config/`, [`docs/ops/ops-pending-migrations.md`](docs/ops/ops-pending-migrations.md), relevant SQL/tests |
| Deployment / hosted claim | [`docs/quality/current-status.md`](docs/quality/current-status.md) + exact machine record/runbook |
| AI Lab | [`.agents/skills/predictor-ai-lab-verifier/SKILL.md`](.agents/skills/predictor-ai-lab-verifier/SKILL.md), [`ai/README.md`](ai/README.md), governing ADR/source/tests |
| Provider/enrichment | [`docs/architecture/provider-enrichment-plan.md`](docs/architecture/provider-enrichment-plan.md) + relevant source/tests |
| Legacy production UI maintenance | [`docs/design/README.md`](docs/design/README.md) + the one routed legacy authority |
| Architecture | [`docs/architecture/README.md`](docs/architecture/README.md) + named workstream |
| Historical archaeology | [`docs/history/README.md`](docs/history/README.md) + the specific dated evidence |
| Developer/AI tooling | [`docs/ops/agent-tooling-map.md`](docs/ops/agent-tooling-map.md); exact commands live in [`docs/ops/developer-toolchain.md`](docs/ops/developer-toolchain.md) |

## Graphify fast path

Use Graphify when the implementation surface is not already exact, or when a task may cross files/layers. Its job is to answer **where to look** for blast radius, dependency/call flow and cross-layer ownership before source files consume the context window. Do not use it to decide product rules or hosted truth.

For merged code, the `graphify-navigation` branch is a generated replace-in-place snapshot. Its `README.md` records both the source commit and a fingerprint of the inputs that affect the graph; an unrelated `main` commit does not make a still-current graph stale. For unmerged work, prefer that PR's Graphify Actions artifact.

```bash
bash scripts/agent-tools/graphify-query.sh query "what connects this UI to its RPC?"
bash scripts/agent-tools/graphify-query.sh path "ComponentName" "rpc_name"
bash scripts/agent-tools/graphify-query.sh explain "symbol_name"
bash scripts/agent-tools/graphify-query.sh affected "symbol_or_file"
bash scripts/agent-tools/graphify-query.sh god-nodes --top 10
```

Routine `query` output is capped at about 1200 tokens by the wrapper unless you pass an explicit `--budget`. **Do not load `graph.json` wholesale into context.** Query it to shortlist files/symbols, switch to Serena when exact symbol references matter, then open the real source and executable tests. If Graphify is unavailable or its indexed inputs are genuinely stale, use normal repository search and continue. See [`docs/ops/graphify-navigation.md`](docs/ops/graphify-navigation.md).

## Non-negotiable invariants

- Current code, executable tests and the canonical task authority override historical summaries, previous chats and tool output.
- Never invent scoring, lock, membership, reveal, settlement, progression or game rules.
- Never infer repository/hosted contract state; read the machine records and fresh hosted evidence when needed.
- Do not mutate or deploy Production without explicit authority for that exact action and target.
- Do not cross Supabase/Netlify environments or treat repository state as hosted proof.
- Provider enrichment never becomes official result/scoring truth by convenience.
- Do not consume paid provider APIs unless explicitly required and authorised.
- Keep unrelated product areas unchanged. Presentation work cannot silently move backend rules.
- Developer tooling stays outside application/runtime dependencies.

## Documentation-impact closeout

Before handoff, update the one live authority affected by the change, or state **No documentation impact**. If contract/hosted records or accepted-requirement status moved, run `npm run generate:now` plus the relevant authority/freshness checks. Never rewrite dated audits, investigations or rollout evidence to make history look current.

## Documentation discipline

Use **one fact, one home**. `NOW.md` is generated; do not hand-edit moving values into routers or support docs. `MASTER-TODO.md` is the active work index, not a history dump. Dated evidence remains dated evidence and is never rewritten to look current.

For broad audits/handoffs, [`.agents/skills/predictor-context/SKILL.md`](.agents/skills/predictor-context/SKILL.md) defines the context budget. Persist only objective, exact head/PR, authorities, changed files, tests/evidence, decisions, blockers, next action and explicit non-actions.
