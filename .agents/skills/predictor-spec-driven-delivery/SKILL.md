---
name: predictor-spec-driven-delivery
description: Deliver non-trivial Predictor work through a spec-first, test-first, evidence-backed workflow that combines the useful parts of Spec Kit and Superpowers without creating a second source of repository truth.
---

# Predictor spec-driven delivery

Use this skill for non-trivial feature work, refactors, AI Lab changes, migrations, or UI journeys that span more than one file. For a one-line fix, use judgement; do not create ceremony for its own sake.

## 1. Load authority before inventing a spec

1. Run the `predictor-context` discipline first.
2. Read `NOW.md` only as an index, then read the authority for the domain being changed.
3. Check current `main`, relevant open PRs, and the exact branch head before editing.
4. Never copy moving contract numbers, hosted state, product rules, or model-selection verdicts into a new spec. Link to the authoritative file instead.

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
- rollout order and rollback boundary;
- risks and assumptions that must be falsified.

Prefer the smallest design that satisfies the accepted behaviour. YAGNI and DRY apply, but repository authorities outrank generic methodology.

## 4. Break the plan into verifiable tasks

Tasks should be small enough that each one has a clear before/after check. Every task must identify the test, command, query, browser journey, or hosted evidence that proves it complete.

Parallelise only independent work. Two agents must not edit the same authority, migration, or generated file concurrently.

## 5. Test first where behaviour changes

Use RED -> GREEN -> REFACTOR for deterministic code whenever practical:

1. add or identify the failing test/evidence;
2. observe the failure for the intended reason;
3. make the minimum implementation change;
4. re-run the narrow test;
5. run the broader affected suite;
6. refactor only while green.

For migrations and hosted integrations, the equivalent RED evidence is an explicit precondition or failing verification query. Never manufacture a Production failure merely to satisfy TDD.

## 6. Review in two passes

Before declaring completion, review separately for:

1. **spec compliance** — every acceptance scenario and boundary is satisfied;
2. **code quality and safety** — no duplicated authority, hidden fallback, leakage, privacy regression, stale generated surface, or unbounded provider call was introduced.

Use Playwright/browser verification for user journeys where static tests cannot prove the experience.

## 7. Evidence before completion

A completion statement must include the exact evidence actually observed: tests, workflow runs, browser journeys, migration contract checks, model reports, or hosted reads as appropriate.

Do not say "green", "deployed", "promoted", "Production", or "working end-to-end" from code inspection alone.

## 8. Spec Kit and Superpowers interoperability

This repository keeps the workflow vendor-neutral. If the active coding harness has GitHub Spec Kit installed, use its constitution/specify/plan/tasks/analyze/implement commands while preserving the authority rules above. If it has Superpowers installed, use its planning, TDD, systematic debugging, review, and verification skills in the same order.

The external tools strengthen execution; they never replace `AGENTS.md`, ADRs, design authorities, migration contracts, AI Lab admission evidence, or current hosted verification.
