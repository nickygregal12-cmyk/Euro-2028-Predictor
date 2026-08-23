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

`config/agent-skills.json` classifies skills by role. Normally load at most one navigation skill, one process skill, one domain skill, one narrow specialist and one repository review skill. The independent-model `critic` is a separate high-stakes pass, not default startup context.

The user should not have to name skills. Use natural-language routing from `agent:route`, and let **specific intent outrank broad “improve” wording**:

- broad player-facing `improve this`, `make this better`, `take this to the next level` work can select `predictor-product-opportunity-scout` plus `predictor-football-experience-critic` so Claude finds the strongest real player-value gap before defaulting to cosmetics;
- `finish`, `complete`, or `make this release ready` can select `predictor-release-journey-closer`;
- explicit loading/empty/error/locked/live/settled/edge-state work can select `predictor-player-state-matrix`;
- scoring/points/rank/lock/reveal/membership/result/settlement/progression visibility work can select `predictor-competitive-integrity`;
- migration/hosted-contract/environment/rollout/site-variant/Production-promotion work can select `predictor-environment-contract-guardian`;
- idea/option exploration can select product brainstorming;
- defects select systematic debugging;
- design/performance/component/database work selects its existing domain specialist;
- explicit post-green cleanup selects code simplification;
- agent-skill changes select the evaluator;
- high-stakes pressure-testing can select the independent critic.

Do not load any of these merely because they exist. A precise request such as `improve rendering performance`, `fix this bug`, `redesign this page`, `improve the spacing`, or `polish this animation` should stay on that precise route rather than invoking product opportunity discovery.

For broad investigations or handoffs use [`.agents/skills/predictor-context/SKILL.md`](.agents/skills/predictor-context/SKILL.md). For AI Lab verification use [`.agents/skills/predictor-ai-lab-verifier/SKILL.md`](.agents/skills/predictor-ai-lab-verifier/SKILL.md). For non-trivial multi-file delivery use the process skill selected by the task packet, normally [`predictor-spec-driven-delivery`](.agents/skills/predictor-spec-driven-delivery/SKILL.md).

After substantial completed work, apply the cheap compound check from `AGENTS.md`. Only load `predictor-compound-learning` when a durable reusable lesson actually emerged; prefer an executable check or existing authority over new prose.

## Context discipline

Use progressive disclosure: current index → task packet → exact authority → exact source/tests → historical evidence only if needed.

Keep handoffs evidence-based and compact. Never turn a snapshot of a moving contract, hosted state, blocker or rollout into a second authority.
