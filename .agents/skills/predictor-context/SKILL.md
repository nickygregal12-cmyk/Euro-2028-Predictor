---
name: predictor-context
description: Load the smallest authoritative repository context needed for a Football Prediction Hub task, preserve one-fact/one-home governance, and produce durable evidence-based handoffs without copying moving state into prompts.
---

# Predictor context discipline

Use this skill before broad repository work, long-running implementation, audits, or handoffs.

## Purpose

The repository already has authoritative homes for current state, decisions, accepted work, design, operations, migrations and executable behaviour. Agent quality gets worse when those facts are copied into large prompts or repeated across `AGENTS.md`, `CLAUDE.md`, issue bodies and handoff notes.

The goal is therefore **progressive disclosure**, not a second documentation system.

## Start with the index, then load by task

1. Read `NOW.md` as a generated index, never as a decision authority.
2. Read `docs/quality/current-status.md` for current implementation/hosted truth.
3. Read only the governing authority needed for the task:
   - product/rule decision: `docs/adr/README.md` and the named ADR;
   - accepted-but-unbuilt work: `docs/quality/accepted-requirements.md`;
   - delivery sequence: `docs/roadmap.md` and `MASTER-TODO.md` only where needed;
   - UI/UX: `docs/design/README.md` and the relevant design authority;
   - migration/hosted work: `docs/ops/ops-pending-migrations.md` plus machine contract records;
   - AI Lab: `docs/adr/0029-private-ai-football-lab.md`, current status, and `ai/` tests/code.
4. Inspect current `main`, open PRs and branch ancestry before editing.
5. Pull historical audits only to answer a historical question or trace a decision. Do not load them by default.

## One fact, one home

Do not create a new file that restates a moving contract number, hosted environment state, roadmap, product rule or accepted-requirements inventory. Point to its existing authority instead.

A task brief may contain a **snapshot** needed to execute safely, but label it as a snapshot and include the source/ref that must be rechecked. Never turn the snapshot into a new authority.

## Long task handoff

When a task spans sessions, persist a compact handoff with these fields:

- objective and exact completion predicate;
- branch/PR and exact head SHA;
- authorities read;
- files changed;
- tests/evidence run and their result;
- decisions made;
- unresolved blockers;
- next executable action;
- actions explicitly not taken, especially Production/provider writes.

Prefer file paths, PR numbers, workflow-run IDs and exact commands over narrative history.

## Context budget rules

- Load current state before history.
- Load the relevant authority before an audit that paraphrases it.
- Keep raw tool output out of durable prompts when a path/ref can retrieve it again.
- Summarise completed investigation phases before moving into implementation.
- For parallel agents, give each worker the task-specific authority subset rather than the whole repository narrative.
- Re-read a moving authority after a long pause or immediately before a hosted/merge action.

## Evidence discipline

A statement such as "implemented", "hosted", "green", "promoted" or "Production" must trace to current code, a machine record, a workflow result or fresh hosted evidence. Planning prose and previous chat summaries do not establish those states.

## Boundaries

This skill changes how agents load and preserve context. It changes no scoring, lock, membership, privacy, settlement, progression, deployment or model-promotion rule. Existing repository authorities always outrank this skill.