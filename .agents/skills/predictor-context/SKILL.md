---
name: predictor-context
description: Load the smallest authoritative repository context needed for a Football Prediction Hub task, preserve one-fact/one-home governance, and produce durable evidence-based handoffs without copying moving state into prompts.
---

# Predictor context discipline

Use this skill before broad repository work, long-running implementation, audits or handoffs.

The goal is **progressive disclosure**, not a second documentation system.

## Start small

1. Read `NOW.md` as the generated index of current moving facts. It decides nothing itself.
2. Inspect current `main`, the working branch/ancestry and open pull requests for overlap.
3. Use the task-routing table in root `AGENTS.md` and load only the authority for the task.
4. Read source and executable tests for the code path being changed.
5. Pull dated audits, investigations, reconciliations or old design/deployment narratives only when the task genuinely needs historical evidence.

`docs/quality/current-status.md` is **not universal startup context**. Load it when a hosted/deployment/current-implementation claim needs the detailed evidence it owns.

## Typical minimal context sets

- vNext component/layout: `docs/product/ui.md` + `src/vnext/AGENTS.md` + the local component/read-model/test.
- legacy production UI maintenance: `docs/design/README.md` + the one legacy design authority it routes to + local source/tests.
- migration: machine contract records + `docs/ops/ops-pending-migrations.md` + relevant database tests; current-status only for a hosted claim/action.
- provider enrichment: `docs/architecture/provider-enrichment-plan.md` + relevant provider source/tests.
- AI Lab: `.agents/skills/predictor-ai-lab-verifier/SKILL.md` + `ai/README.md` + governing ADR/source/tests; current-status only where hosted state matters.
- product/rule decision: `docs/adr/README.md` + named ADR; `docs/quality/accepted-requirements.md` only when accepted-but-unbuilt scope is relevant.

## Use developer tools only to narrow the missing context

The responsibility map is `docs/ops/agent-tooling-map.md`; do not preload every tool.

- **Graphify** — broad dependency/call-flow/cross-layer navigation. Treat graph edges as an index and verify important conclusions in source.
- **Serena** — exact symbols, callers, references and bounded symbol edits after the likely area is known.
- **Context7** — current documentation for an external library/API. It cannot answer Predictor product, scoring, database or hosted-state questions.
- **Repomix** — build a portable, bounded context slice after the task scope is known. Prefer the `core`, `vnext` or `backend` pack over a whole-repository pack.

A one-file fix normally needs none of these. A broad architecture audit might use Graphify first, Serena second, and Repomix only if a separate model/handoff needs the narrowed slice.

## One fact, one home

Do not create a new file that restates a moving contract number, hosted environment state, active blocker, roadmap, product rule or accepted-requirements inventory. Link to the canonical authority instead.

A task brief may include a snapshot needed to execute safely, but label it as a snapshot and name the source/ref that must be rechecked. Never promote the snapshot into a second authority.

Developer-tool state follows the same rule:

- Serena index/memory is not durable project truth; this repo disables persistent Serena memory by default.
- Repomix packs are ignored disposable transport.
- Beads, when explicitly initialised in stealth mode, is local execution memory only.
- Agent Mail messages/reservations coordinate concurrent work but do not replace branches, specs, PRs or review.

If a fact must survive another clone or reviewer, put it in its canonical repository/PR home.

## Context budget

- Index before authority; authority before history.
- Do not read a whole directory merely because the task touches one file inside it.
- Prefer links/paths/IDs over pasting raw tool output into durable prompts.
- Use Graphify/Serena to **reduce** file reads, not as a reason to dump more context into the model.
- Use Context7 only when an external API/version detail is genuinely needed.
- Use task-scoped Repomix packs instead of whole-repository export by default.
- Summarise a completed investigation phase before moving into implementation.
- Give parallel workers the smallest task-specific authority subset rather than a repository-wide narrative.
- Re-read moving authority immediately before a hosted, provider-cost or merge action.

## Evidence discipline

Claims such as `implemented`, `hosted`, `green`, `promoted`, `Production` or `current model` must trace to current code, executable evidence, a machine record, workflow result or fresh hosted observation. Planning prose, developer-tool output and previous chat summaries do not establish those states.

## Long-task handoff

Persist only:

- objective and exact completion predicate;
- branch/PR and exact head SHA;
- authorities consulted;
- files changed;
- tests/evidence run and results;
- decisions made;
- unresolved blockers;
- next executable action;
- explicit non-actions, especially Production/provider writes.

A tool-generated context pack or local memory can help prepare the handoff, but the durable record is the repository/PR handoff above.

## Boundary

This skill changes how agents load and preserve context. It changes no scoring, lock, membership, privacy, settlement, progression, deployment or model-promotion rule. Existing repository authorities always outrank this skill and every developer tool.
