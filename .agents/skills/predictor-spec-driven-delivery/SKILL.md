---
name: predictor-spec-driven-delivery
description: Deliver non-trivial Predictor work through a spec-first, test-first, evidence-backed workflow that can use Spec Kit, local task memory and multi-agent coordination without creating a second source of repository truth.
---

# Predictor spec-driven delivery

Use this skill for non-trivial feature work, refactors, AI Lab changes, migrations, or UI journeys that span more than one file. For a one-line fix, use judgement; do not create ceremony for its own sake.

## 1. Load authority before inventing a spec

1. Run the `predictor-context` discipline first.
2. Read `NOW.md` only as an index, then read the authority for the domain being changed.
3. Check current `main`, relevant open PRs, and the exact branch head before editing.
4. Never copy moving contract numbers, hosted state, product rules, or model-selection verdicts into a new spec. Link to the authoritative file instead.

Use Graphify/Serena only when they reduce the search needed to find the implementation path. Use Context7 only for an external library API/version question. None of those tools decides the spec.

## 2. Specify the outcome before implementation

For work larger than a small fix, write or update a feature spec under `specs/` before code. The spec must state:

- problem and user/operator outcome;
- in-scope and explicitly out-of-scope behaviour;
- governing repository authorities;
- acceptance scenarios written as observable behaviour;
- privacy/security/model-authority constraints;
- migration/provider/Production effects, including `none` when none are allowed;
- completion predicate.

The spec describes **what and why**. Do not bury implementation choices in it.

## 3. Plan from the spec

Create a short implementation plan that names:

- exact surfaces expected to change;
- data/API boundaries;
- test strategy, including the failing test or evidence that comes first;
- architecture-contract impact, including whether dependency-cruiser should catch an illegal direction;
- rollout order and rollback boundary;
- risks and assumptions that must be falsified.

Prefer the smallest design that satisfies the accepted behaviour. YAGNI and DRY apply, but repository authorities outrank generic methodology.

## 4. Break the plan into verifiable tasks

Tasks should be small enough that each one has a clear before/after check. Every task must identify the test, command, query, browser journey, architecture check or hosted evidence that proves it complete.

Parallelise only independent work. Two agents must not edit the same authority, migration, generated file or tightly coupled source surface concurrently.

When local execution memory helps, Beads may track the task graph in **stealth/local mode**. The committed spec/PR remains the durable work record; a future clone must not need `.beads/` to understand what was decided.

When two or more agents genuinely work concurrently, MCP Agent Mail may carry file reservations and handoffs. A reservation is coordination—not authority, a merge, or permission to ignore the other branch's diff.

## 5. Test first where behaviour changes

Use RED -> GREEN -> REFACTOR for deterministic code whenever practical:

1. add or identify the failing test/evidence;
2. observe the failure for the intended reason;
3. make the minimum implementation change;
4. re-run the narrow test;
5. run the broader affected suite;
6. refactor only while green.

For migrations and hosted integrations, the equivalent RED evidence is an explicit precondition or failing verification query. Never manufacture a Production failure merely to satisfy TDD.

For broad structural refactors, prefer ast-grep or Serena symbol operations over repository-wide regex when they make the edit mechanically safer. Review the resulting Git diff exactly as if it were hand-written.

## 6. Enforce architecture before broad review

Run the repository architecture contract when relevant:

```bash
bash scripts/agent-tools/architecture-check.sh
```

A passing dependency graph proves only the encoded import/dependency rules. It does not prove product behaviour, privacy, database semantics or UI quality.

If a new architectural boundary is required, first establish that decision in the correct repository authority; then encode the mechanical restriction. Do not let a convenient dependency-cruiser rule silently invent architecture.

## 7. Review in separate passes

Before declaring completion, review separately for:

1. **spec compliance** — every acceptance scenario and boundary is satisfied;
2. **code quality and safety** — no duplicated authority, hidden fallback, leakage, privacy regression, stale generated surface, dependency inversion or unbounded provider call was introduced;
3. **experience evidence where relevant** — Playwright for journeys/accessibility, Playwright visual contracts for approved pixels, React Scan/Chrome DevTools for diagnosis rather than behavioural proof.

Semantic merge tools may help resolve a conflict clone-locally, but their output receives the same review/test treatment as a manual merge.

## 8. Evidence before completion

A completion statement must include the exact evidence actually observed: tests, architecture workflow, browser journeys, visual contract, migration contract checks, model reports, or hosted reads as appropriate.

Do not say "green", "deployed", "promoted", "Production", or "working end-to-end" from code inspection, local agent memory or tool-generated summaries alone.

## 9. Spec Kit interoperability

The repository provisions the GitHub Spec Kit CLI as an **execution adapter**. Compatible agents may use its clarify/specify/plan/tasks/analyze/implement workflow while preserving every authority rule above.

**Do not run `specify init` over this repository as routine setup.** The Predictor already has its own root/scoped `AGENTS.md`, ADR/product authorities, specs and governance. An initializer that adds a second constitution/authority tree would make the repository less coherent rather than more structured.

If another planning/TDD harness such as Superpowers is available, use its useful execution disciplines in the same subordinate way.

The external tools strengthen execution; they never replace `AGENTS.md`, ADRs, design authorities, migration contracts, AI Lab admission evidence, executable tests or current hosted verification.
