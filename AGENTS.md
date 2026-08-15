# Agent operating rules

This repository is a multi-competition football prediction platform. Euro 2028 is a recoverable tournament baseline, not a default assumption for new platform work.

## Start here

Before editing:

1. Read [`NOW.md`](NOW.md). It is the small generated index of current moving facts.
2. Inspect the current branch, current `main`, and open pull requests for overlap.
3. Identify the task category below and load only the authority needed for that task.
4. Use [`.agents/skills/predictor-context/SKILL.md`](.agents/skills/predictor-context/SKILL.md) for broad audits, long-running work, or handoffs.

Do **not** preload the whole documentation tree. Historical audits, reconciliations, rollout narratives and old implementation summaries are evidence on demand, not default context.

## Task routing

| Task | Read next |
| --- | --- |
| vNext UI / frontend | [`docs/product/ui.md`](docs/product/ui.md), then local scoped instructions such as [`src/vnext/AGENTS.md`](src/vnext/AGENTS.md) |
| Current production UI maintenance | [`docs/design/README.md`](docs/design/README.md), then only the named legacy design authority needed for the surface |
| Product behaviour / game rules | [`docs/adr/README.md`](docs/adr/README.md) and the governing ADR; use [`docs/quality/accepted-requirements.md`](docs/quality/accepted-requirements.md) for accepted-but-unbuilt scope |
| Database / migrations | machine contract records under `config/`, [`docs/ops/ops-pending-migrations.md`](docs/ops/ops-pending-migrations.md), and the relevant migration/database tests; load current hosted status only when the task needs it |
| Football providers / enrichment | [`docs/architecture/provider-enrichment-plan.md`](docs/architecture/provider-enrichment-plan.md) and the relevant provider code/tests |
| AI Lab / models / betting evidence | [`.agents/skills/predictor-ai-lab-verifier/SKILL.md`](.agents/skills/predictor-ai-lab-verifier/SKILL.md), [`ai/README.md`](ai/README.md), and ADR 0029; load hosted status only for a hosted claim or action |
| Deployment / hosted contract work | [`docs/quality/current-status.md`](docs/quality/current-status.md), the exact machine contract records, and the relevant operations runbook |
| Architecture / programme work | [`docs/architecture/README.md`](docs/architecture/README.md), then the named workstream only |
| Historical / regression archaeology | [`docs/history/README.md`](docs/history/README.md) and the specific dated evidence needed to answer the question |

## Invariants

- Current code, executable tests and the canonical task authority override historical summaries.
- Do not infer or invent scoring, lock, membership, reveal, settlement, progression or game rules.
- Do not invent migration, repository-contract or hosted-contract state. Read the machine records and, when relevant, fresh hosted evidence.
- Do not mutate or deploy Production without explicit authority for that exact action and target.
- Do not cross Supabase/Netlify environments or treat a repository state as proof of a hosted state.
- Provider enrichment is provisional product data. It never becomes official result, scoring or settlement authority by convenience.
- Do not consume paid provider APIs unless the task explicitly requires and authorises the call.
- A planning document, previous chat, old branch or repeated historical narrative is not implementation evidence.
- Keep unrelated product areas unchanged. Presentation work may not silently alter backend rules.
- The current production UI is protected from broad cosmetic redesign. New visual exploration belongs to vNext unless the task explicitly authorises legacy redesign work.

## Documentation discipline

Use **one fact, one home**. Link to moving state instead of copying it into prompts, routers or subsystem docs.

When implementation, schema, routes, hosted configuration or operating state changes, close the documentation impact in the authority that owns that fact. Never rewrite dated evidence to make it look current.

`NOW.md` is generated. Run `npm run generate:now` only when its machine inputs or accepted-requirement inputs change; otherwise leave it alone.

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
