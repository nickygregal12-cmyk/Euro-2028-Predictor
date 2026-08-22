# CLAUDE.md — repository router

Claude Code should use this file as a router, not as a project diary.

## Session start

1. Read [`NOW.md`](NOW.md) for current moving facts.
2. Read [`AGENTS.md`](AGENTS.md) for the canonical task-routing and safety rules.
3. Inspect current `main`, branch ancestry and open pull requests before editing.
4. Load only the authority for the task you are actually doing. Prefer a scoped/local `AGENTS.md` or `CLAUDE.md` when one exists in the subsystem.
5. If the exact implementation file/symbol is not already known, use the Graphify fast path in `AGENTS.md` to shortlist source/tests before opening the codebase broadly.

Do not preload old contract histories, deployment narratives, design chronicles or unrelated subsystem documentation. Pull historical evidence only when the task is historical, investigative or regression-focused.

## Working style

- Follow the task routes in `AGENTS.md`; do not duplicate their moving facts here.
- Treat Graphify as orientation, not truth: use its bounded result to choose files, switch to Serena for exact symbols when useful, then verify against source/tests.
- For vNext frontend work, start with [`docs/product/ui.md`](docs/product/ui.md) and the smallest relevant vNext authority routed by [`src/vnext/AGENTS.md`](src/vnext/AGENTS.md), not the legacy design history.
- For current production UI maintenance, use [`docs/design/README.md`](docs/design/README.md) to choose the smallest relevant legacy authority.
- Use Storybook, browser tooling and targeted interaction/accessibility tests when UI behaviour or presentation changes.
- Use the repository's existing database, model and deployment gates for those task classes; do not replace them with narrative confidence.
- Do not creatively alter unrelated journeys, rules or product areas while solving a local task.
- Current code/tests and the canonical task authority win over repeated summaries from older prompts or documents.

## Context discipline

Use progressive disclosure: index → task authority/navigation shortlist → exact source/tests → historical evidence only if needed.

For broad investigations or long tasks, use [`.agents/skills/predictor-context/SKILL.md`](.agents/skills/predictor-context/SKILL.md). For AI Lab verification use [`.agents/skills/predictor-ai-lab-verifier/SKILL.md`](.agents/skills/predictor-ai-lab-verifier/SKILL.md).

Keep handoffs evidence-based and compact. Never turn a snapshot of a moving contract, hosted state, blocker or rollout into a second authority.
