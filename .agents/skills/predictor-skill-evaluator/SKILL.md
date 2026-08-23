---
name: predictor-skill-evaluator
description: Use when adding, changing, benchmarking, or questioning an agent skill/routing rule and the task needs evidence that the skill improves repository outcomes or triggering rather than merely sounding useful.
---

# Predictor skill evaluator adapter

Use this as the agent-tooling **domain skill** for skill efficacy.

1. Repository agent architecture is authoritative. Read the routed agent-tooling docs/config/tests before materializing external guidance.
2. Materialize Anthropic's immutable Skill Creator with `npm run agent:skill -- skill-creator`; use its evaluation/benchmark ideas, not its default filesystem conventions when they conflict with this repo.
3. Prefer controlled comparisons: the same representative prompt and authority/context packet **with** the candidate skill versus the baseline/previous skill. Compare correctness, root-cause quality, scope discipline, evidence, token/context cost and trigger accuracy.
4. Reuse `config/agent-context-benchmarks.json`, `agent:route`, existing tests and ignored temporary artefacts. Do not create a parallel permanent eval/spec hierarchy just because upstream examples do.
5. Add realistic positive and negative routing cases. A skill is not successful if it helps one prompt but starts triggering on unrelated work.
6. Do not auto-promote a generated observation into a tracked skill. New/changed skills require evidence, repository review, immutable source/licence checks where external, and green benchmark/tests.
7. Prefer improving an existing adapter/route over adding another overlapping general-purpose skill.
8. Keep subjective evaluation honest: use human/browser review for design quality and objective assertions for deterministic behaviour. Do not manufacture numeric scores for inherently subjective output.

The goal is a smaller set of demonstrably useful skills, not maximum skill count.