# ADR 0030 — Verified selected models auto-activate

**Status:** Accepted  
**Date:** 2026-08-15  
**Owner decision:** the best evidence-selected model must provide the live AI Lab predictions without a routine manual promotion step.

## Context

The AI Lab intentionally separates model research from model lifecycle. Research may train many families and configurations, but `ai/challenger_policy.py` admits exactly one selected configuration per supported league from the reproduced evaluation evidence.

The previous operational design stopped those selected rows at `challenger` even after the guarded training path had proved coverage provenance, immutable artefact identity, training-data identity, semantic bundle identity and the reference-prediction oracle. A competition administrator then had to repeat nine manual `Make current` actions before the selected models could forecast. That extra click gate did not add new model evidence, could leave Production partially promoted, and on 15 August 2026 did exactly that: seven selected leagues were current while two remained challengers, preventing the intended all-league activation sequence.

## Decision

The verified selected-model set is the normal lifecycle authority.

1. Training still creates selected rows as `challenger`. An incomplete training run must never displace a known working current model.
2. Activation is all-or-nothing across the nine admitted leagues. The candidate version must contain exactly one policy-conforming row for every league.
3. Before any lifecycle write, every selected row must re-pass the durable evidence checks: policy identity, requested feature groups, effective coverage provenance, immutable artefact SHA, normalized training-data fingerprint, semantic bundle fingerprint and reference-prediction oracle.
4. Only after all nine pass does one transaction retire superseded current rows and mark the complete selected version `current`.
5. The transaction must prove its postcondition: nine current models, all nine from the selected version, no selected challenger left.
6. A successful activation immediately regenerates fixture reconciliation, forecasts, free fixture-price evidence and value recommendations so downstream surfaces such as Bet Builder do not wait for a later schedule.
7. Automatic activation does **not** call the paid Odds API. Paid collection keeps its own budgeted schedule and explicit bounded dispatch authority.
8. A zero-BET result is valid. Auto-activation guarantees the selected model supplies the forecast; it does not relax the value, freshness, uncertainty or data-confidence gates merely to populate Bet Builder.

## Consequences

- Routine browser promotion is no longer required to put the evidence-selected winner into service.
- A partial league-by-league current set is no longer an accepted end state of normal model selection.
- The deterministic research admission policy remains separate from training implementation: arbitrary challengers, newest timestamps and experimental families do not become current merely because they exist.
- Existing privileged recovery/administrative database authority may remain available for exceptional rollback or incident response, but it is not the normal selection mechanism and must not be used to bypass the verified selected-set checks.
- Historical materialisation records that describe the old human-promotion boundary remain historical evidence; they are not current operating authority after this ADR.

## Supersession

This decision supersedes only the **routine human/admin promotion requirement** described by earlier AI Lab planning and by the model-promotion portion of ADR 0028. It does not weaken the evidence gates, the one-current-model-per-league invariant, the real-bookmaker betting rules, or any publication/accuracy threshold.
