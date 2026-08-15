---
name: predictor-ai-lab-verifier
description: Verify AI Lab model, artefact, prediction and betting changes with independent reproducibility gates, immutable evidence, real-bookmaker boundaries and verified selected-winner activation.
---

# Predictor AI Lab verifier

Use this skill for AI Lab training, artefact materialisation, selected-winner activation, prediction, recommendation and betting-evidence changes.

## Principle

A model is not safe because training completed or a file loads. The thing that ships must be demonstrably the thing that was evaluated, serialised and subsequently scored.

Treat the AI Lab as a gated evidence pipeline:

1. **data gate** — canonical identities, ordered training evidence and feature schema are known;
2. **model gate** — evaluation is out-of-time and final fit is separate from evaluation;
3. **artefact gate** — stored bytes have an exact SHA-256 and semantic provenance;
4. **reload gate** — freshly reloaded bytes reproduce recorded reference outputs;
5. **selection gate** — exactly one evidence-selected configuration per supported league matches the admitted policy;
6. **activation gate** — only a complete all-league selected set that passed the preceding gates may atomically become current;
7. **prediction gate** — scoring uses the artefact's own feature order and current identity authority;
8. **betting gate** — actionable evidence uses real non-aggregate bookmaker prices only;
9. **hosted gate** — Production claims require fresh target-specific evidence.

## Reproducibility primitives

`ai/reproducibility.py` owns repository-local helpers for:

- deterministic ordered training-data SHA-256;
- semantic bundle-contract SHA-256;
- a small self-contained reference scoring manifest;
- refusal when a loaded bundle no longer reproduces recorded raw/calibrated probabilities.

The byte-level artefact SHA and the semantic/data fingerprints are complementary. Do not replace one with the other.

The admitted weekly/manual selected-challenger path runs through `ai/train_verified.py`. That wrapper captures the exact final-fit frame used by `train.py`, embeds the reproducibility evidence into the bundle, reloads the augmented bytes, verifies the fingerprints/reference gate, recalculates the byte SHA and only then delegates to the existing atomic model+artefact insert. Treat raw `train.py` as the lower-level training implementation, not as evidence that this guarded materialisation path ran.

Under ADR 0030, `ai/activate_selected_models.py` owns the normal lifecycle crossing. Training still materialises challengers first. The activator must re-prove the complete nine-league selected policy, stored artefact identity, coverage provenance, training-data fingerprint, semantic bundle fingerprint and reference oracle before any selected row is made current. It then retires superseded currents and activates the selected set in one transaction with an exact nine-current/zero-selected-challenger postcondition.

## Independent verification

For material model changes, prefer a fresh-context verifier or a separate test phase from the implementation agent. The verifier should attempt to falsify the change, especially by checking:

- feature removal/reordering;
- changed canonical team identity;
- changed calibration semantics;
- evaluation/final-fit leakage;
- model row versus artefact provenance disagreement;
- synthetic MAX/AVG/unknown bookmaker paths becoming actionable;
- quarantined forecasts re-entering evidence;
- a loaded artefact producing probabilities different from its recorded reference gate;
- a selected-challenger command bypassing `train_verified.py`;
- a partial selected version becoming current;
- an arbitrary/newest challenger being mistaken for the evidence-selected policy winner.

Agreement between implementation agents is not evidence. Executable gates are.

## Activation and hosted boundaries

The normal selected-model activation is automatic after the complete verified selected set passes the repository gates. Do not reintroduce a routine browser/admin click as a second model-selection authority.

An agent may not use direct status writes, an arbitrary challenger, a green training command alone, or a lower in-sample number as permission to activate a model. Follow `ai/challenger_policy.py`, `ai/activate_selected_models.py`, ADR 0030, the machine contracts and hosted target checks. Exceptional rollback/recovery remains a separate operator authority and must not be confused with normal model selection.

## Durable evidence

For every current selected model, the evidence trail should be able to answer:

- exact artefact SHA-256;
- ordered training-data fingerprint;
- semantic bundle-contract fingerprint;
- feature list/version/groups;
- training through date and training row count;
- validation/holdout evidence;
- calibration method;
- reference-gate manifest identity and result;
- model row/status and selected-policy authority;
- real bookmaker snapshot/recommendation evidence used after activation.

## Boundaries

This skill does not redefine the AI Lab's statistical admission criteria, bookmaker allowlist, bankroll rules or contract state. The normal activation authority is ADR 0030 plus the current selected-policy/activator code and executable tests; exceptional recovery remains operator-controlled.
