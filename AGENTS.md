# Agent operating rules

This repository is a multi-competition football prediction platform. Euro 2028 is a recoverable tournament baseline, not a default assumption for new platform work.

## Start here

Before editing:

1. Read [`NOW.md`](NOW.md). It is the small generated index of current moving facts.
2. Inspect the current branch, current `main`, and open pull requests for overlap.
3. Identify the task category below and load only the authority needed for that task.
4. Use [`.agents/skills/predictor-context/SKILL.md`](.agents/skills/predictor-context/SKILL.md) for broad audits, long-running work, or handoffs.
5. For non-trivial multi-file delivery, use [`.agents/skills/predictor-spec-driven-delivery/SKILL.md`](.agents/skills/predictor-spec-driven-delivery/SKILL.md) after the task authority is known.

Do **not** preload the whole documentation tree or launch every developer tool. Historical audits, reconciliations, rollout narratives and old implementation summaries are evidence on demand, not default context.

## Task routing

| Task | Read next |
| --- | --- |
| vNext UI / frontend | [`docs/product/ui.md`](docs/product/ui.md), then local scoped instructions such as [`src/vnext/AGENTS.md`](src/vnext/AGENTS.md) |
| vNext multi-stage programme / resume Stages 8–15 | [`.agents/skills/vnext-programme-runner/SKILL.md`](.agents/skills/vnext-programme-runner/SKILL.md), then [`docs/product/vnext-programme-controller.md`](docs/product/vnext-programme-controller.md) and [`config/vnext-programme.json`](config/vnext-programme.json) |
| Current production UI maintenance | [`docs/design/README.md`](docs/design/README.md), then only the named legacy design authority needed for the surface |
| Product behaviour / game rules | [`docs/adr/README.md`](docs/adr/README.md) and the governing ADR; use [`docs/quality/accepted-requirements.md`](docs/quality/accepted-requirements.md) for accepted-but-unbuilt scope |
| Database / migrations | machine contract records under `config/`, [`docs/ops/ops-pending-migrations.md`](docs/ops/ops-pending-migrations.md), and the relevant migration/database tests; load current hosted status only when the task needs it |
| Football providers / enrichment | [`docs/architecture/provider-enrichment-plan.md`](docs/architecture/provider-enrichment-plan.md) and the relevant provider code/tests |
| AI Lab / models / betting evidence | [`.agents/skills/predictor-ai-lab-verifier/SKILL.md`](.agents/skills/predictor-ai-lab-verifier/SKILL.md), [`ai/README.md`](ai/README.md), and ADR 0029; load hosted status only for a hosted claim or action |
| Deployment / hosted contract work | [`docs/quality/current-status.md`](docs/quality/current-status.md), the exact machine contract records, and the relevant operations runbook |
| Architecture / programme work | [`docs/architecture/README.md`](docs/architecture/README.md), then the named workstream only |
| Developer/AI tooling architecture | [`docs/architecture/developer-operating-system.md`](docs/architecture/developer-operating-system.md); commands live in [`docs/ops/developer-toolchain.md`](docs/ops/developer-toolchain.md) |
| Historical / regression archaeology | [`docs/history/README.md`](docs/history/README.md) and the specific dated evidence needed to answer the question |
| Choosing a specialist tool | [`docs/ops/agent-tooling-map.md`](docs/ops/agent-tooling-map.md), which routes by question rather than tool name |

## Tool sequence

Repository authority comes first. Tools reduce search/rework; they do not decide truth.

1. **Orient:** use Graphify for broad dependency/call-flow questions, Serena for exact symbols/references and Context7 only for current external-library documentation.
2. **Bound context:** use Repomix only when a model/handoff needs a portable task slice; generated packs are disposable.
3. **Plan:** use the Predictor spec-driven workflow for non-trivial work. Spec Kit is an execution adapter, not a competing constitution. Beads is optional local/stealth execution memory; MCP Agent Mail is optional coordination for genuinely concurrent agents.
4. **Change safely:** prefer ast-grep for syntax-aware mass search/refactor. Use semantic merge tools only clone-locally when ordinary Git conflicts justify them.
5. **Enforce/verify:** run the relevant dependency-cruiser architecture contract and exact tests. Playwright proves journeys; Playwright visual contracts hold approved pixels; React Scan/Chrome DevTools diagnose performance rather than establish behaviour.

The full responsibility/lifecycle model is [`docs/architecture/developer-operating-system.md`](docs/architecture/developer-operating-system.md).

## Invariants

- Current code, executable tests and the canonical task authority override historical summaries and developer-tool output.
- Do not infer or invent scoring, lock, membership, reveal, settlement, progression or game rules.
- Do not invent migration, repository-contract or hosted-contract state. Read the machine records and, when relevant, fresh hosted evidence.
- Do not mutate or deploy Production without explicit authority for that exact action and target.
- Do not cross Supabase/Netlify environments or treat a repository state as proof of a hosted state.
- Provider enrichment is provisional product data. It never becomes official result, scoring or settlement authority by convenience.
- Do not consume paid provider APIs unless the task explicitly requires and authorises the call.
- A planning document, previous chat, old branch, generated graph/context pack, local agent memory or repeated historical narrative is not implementation evidence.
- Keep unrelated product areas unchanged. Presentation work may not silently alter backend rules.
- The current production UI is protected from broad cosmetic redesign. New visual exploration belongs to vNext unless the task explicitly authorises legacy redesign work.
- Developer tooling stays outside application/runtime dependencies unless a separate product decision explicitly requires it there.
- A tool being configured or installed does not mean its service is running, authenticated or allowed to reach Production/providers.

## Documentation discipline

Use **one fact, one home**. Link to moving state instead of copying it into prompts, routers, tool memories or subsystem docs.

`NOW.md` is generated. Run `npm run generate:now` only when its machine inputs or accepted-requirement inputs change; otherwise leave it alone.

Developer-tool versions live in `config/agent-tools.json`; responsibilities live in `docs/architecture/developer-operating-system.md`; exact commands live in `docs/ops/developer-toolchain.md`. Do not duplicate those facts across skills.

## Documentation-impact closeout

When implementation, schema, routes, hosted configuration or operating state changes, finish with either the canonical authority updated or an explicit **No documentation impact** with the reason. Do not rewrite dated audits, investigations or rollout evidence to make them look current.

## Long-task handoff

Keep durable handoffs compact:

- objective and completion predicate;
- branch/PR and exact head;
- authorities consulted;
- files changed;
- tests/evidence and results;
- decisions made;
- blockers;
- next executable action;
- explicit non-actions such as no Production mutation or no provider call.

Tool-generated context/memory may help prepare this handoff, but the durable handoff itself belongs in the repository/PR workflow, not solely inside Serena, Beads or Agent Mail.
