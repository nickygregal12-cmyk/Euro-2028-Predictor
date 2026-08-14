---
name: predictor-ai-lab-verifier
description: Verify AI Lab model, artefact, prediction and betting changes with independent reproducibility gates, immutable evidence, real-bookmaker boundaries and human-controlled promotion.
---

# Predictor AI Lab verifier

Use this skill for AI Lab training, artefact materialisation, promotion, prediction, recommendation and betting-evidence changes.

## Principle

A model is not safe because training completed or a file loads. The thing that ships must be demonstrably the thing that was evaluated, serialised and subsequently scored.

Treat the AI Lab as a gated evidence pipeline:

1. **data gate** — canonical identities, ordered training evidence and feature schema are known;
2. **model gate** — evaluation is out-of-time and final fit is separate from evaluation;
3. **artefact gate** — stored bytes have an exact SHA-256 and semantic provenance;
4. **reload gate** — freshly reloaded bytes reproduce recorded reference outputs;
5. **prediction gate** — scoring uses the artefact's own feature order and current identity authority;
6. **betting gate** — actionable evidence uses real non-aggregate bookmaker prices only;
7. **promotion gate** — model promotion remains an explicit human/admin authority action;
8. **hosted gate** — Production claims require fresh target-specific evidence.

## Reproducibility primitives

`ai/reproducibility.py` owns repository-local helpers for:

- deterministic ordered training-data SHA-256;
- semantic bundle-contract SHA-256;
- a small self-contained reference scoring manifest;
- refusal when a loaded bundle no longer reproduces recorded raw/calibrated probabilities.

The byte-level artefact SHA and the semantic/data fingerprints are complementary. Do not replace one with the other.

## Independent verification

For material model changes, prefer a fresh-context verifier or a separate test phase from the implementation agent. The verifier should attempt to falsify the change, especially by checking:

- feature removal/reordering;
- changed canonical team identity;
- changed calibration semantics;
- evaluation/final-fit leakage;
- model row versus artefact provenance disagreement;
- synthetic MAX/AVG/unknown bookmaker paths becoming actionable;
- quarantined forecasts re-entering evidence;
- a loaded artefact producing probabilities different from its recorded reference gate.

Agreement between implementation agents is not evidence. Executable gates are.

## Promotion and hosted boundaries

An agent may prepare a challenger, evidence, tests and a PR. It may not reinterpret a green test as authority to promote a model or mutate Production. Follow the existing admin authority, operator runbooks, machine contracts and explicit user approval requirements.

## Durable evidence

For every promoted model, the evidence trail should be able to answer:

- exact artefact SHA-256;
- ordered training-data fingerprint;
- semantic bundle-contract fingerprint;
- feature list/version/groups;
- training through date and training row count;
- validation/holdout evidence;
- calibration method;
- reference-gate manifest identity and result;
- model row/status and promotion authority;
- real bookmaker snapshot/recommendation evidence used after promotion.

## Boundaries

This skill does not redefine the AI Lab's statistical admission criteria, bookmaker allowlist, bankroll rules, contract state or promotion authority. Those remain owned by the current code, migrations, ADRs and executable tests.