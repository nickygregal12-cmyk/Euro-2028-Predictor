# CLAUDE.md — repository router

Claude Code should use this file as a router, not as a project diary.

## Session start

1. Read [`NOW.md`](NOW.md) for current moving facts.
2. Read [`AGENTS.md`](AGENTS.md) for canonical safety and authority rules.
3. Inspect current `main`, branch ancestry and open pull requests before editing.
4. If the exact implementation file/symbol is not already known, use the Graphify fast path: run `npm run agent:route -- "THE TASK"` before broad source browsing.
5. Load only the authorities, skill(s), candidate source and tests returned by that task packet. If the task already names an exact tracked file/symbol, skip unnecessary Graphify ceremony and use the local route directly.

Do not preload old contract histories, deployment narratives, design chronicles or unrelated subsystem documentation. Pull historical evidence only when the task is historical, investigative or regression-focused.

## Working style

- Follow the routes in `AGENTS.md`; do not duplicate their moving facts here.
- `agent:route` is navigation, not a second planning model. It uses bounded Graphify output plus deterministic repository metadata to choose a working set.
- Treat Graphify as orientation, not truth: use its result to choose files, switch to Serena for exact symbols when useful, then verify against source/tests.
- For vNext frontend work, read [`docs/product/ui.md`](docs/product/ui.md), the compact [`src/vnext/AGENTS.md`](src/vnext/AGENTS.md), and only the one surface authority returned by the task packet.
- For current production UI maintenance, use [`docs/design/README.md`](docs/design/README.md) to choose the smallest relevant legacy authority.
- Use Storybook, browser tooling and targeted interaction/accessibility tests when UI behaviour or presentation changes.
- Use the repository's existing database, model and deployment gates for those task classes; do not replace them with narrative confidence.
- Do not creatively alter unrelated journeys, rules or product areas while solving a local task.
- Current code/tests and the canonical task authority win over repeated summaries from older prompts or documents.

## Skill discipline

`config/agent-skills.json` classifies skills by role. Normally load at most one navigation skill, one process skill, one domain skill and one review skill. A task should not load several competing planning/debugging/review workflows just because they are installed.

For broad investigations or handoffs use [`.agents/skills/predictor-context/SKILL.md`](.agents/skills/predictor-context/SKILL.md). For AI Lab verification use [`.agents/skills/predictor-ai-lab-verifier/SKILL.md`](.agents/skills/predictor-ai-lab-verifier/SKILL.md). For non-trivial multi-file delivery use the process skill selected by the task packet, normally [`predictor-spec-driven-delivery`](.agents/skills/predictor-spec-driven-delivery/SKILL.md).

## Context discipline

Use progressive disclosure: current index → task packet → exact authority → exact source/tests → historical evidence only if needed.

Keep handoffs evidence-based and compact. Never turn a snapshot of a moving contract, hosted state, blocker or rollout into a second authority.
