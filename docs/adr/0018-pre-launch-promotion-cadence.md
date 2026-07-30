# ADR 0018 — Pre-launch promotion cadence

- **Status:** Accepted direction — activation requires owner verification
- **Date:** 29 July 2026

## Context

Production promotion is currently milestone-only. Each promotion carries a fresh verified backup, a dry run, preflight verification, explicit owner approval, full post-rollout verification and a dated reconciliation note. That sequence was designed when production was the Euro 2028 launch target and was expected to hold real user entries.

Two things have changed.

**The launch target moved.** Under ADR 0011 the platform launches for the 2027/28 season in August 2027, with Euro 2028 following as one competition among several. Repository evidence records a small controlled production baseline, including an account and an Original Predictor entry. Whether that data is disposable and whether this cadence may activate is **REQUIRES OWNER VERIFICATION**; until then, the existing promotion controls remain in force.

**The change rate is about to rise sharply.** The multi-competition build adds competition kinds, season scoping, three game variants and two leagues. Applying a milestone gate to every schema change in that programme would impose significant delay for no risk reduction, which `docs/quality/README.md` and the project's engineering rules both prohibit — heavyweight controls that provide no meaningful risk reduction are explicitly out of scope.

The existing guidance already anticipates proportionality: `CLAUDE.md` states that ordinary development does not require production backup, production smoke or a new reconciliation document, while production-sensitive changes retain stronger checks. This record makes the proposed pre-launch cadence explicit and gives it an unambiguous end condition.

## Decision

**Once the owner verifies that the pre-launch conditions are met, development and production databases move together on merge during that period.** A merged migration is applied to development, verified, and applied to production in the same session. No backup, no dry run, no preflight, no reconciliation note, no separate approval for additive routine schema work.

**Every control that detects error is retained. Only controls that protect data are suspended.**

Retained without change:

- the deployment-contract prebuild gate, which compares the declared contract against the hosted database and fails closed;
- append-only migrations — the chain is never rewritten, squashed or reordered;
- the migration timestamp ordering guard;
- the SQL-versus-TypeScript scoring parity harness;
- database and RLS integration tests, and Browser E2E, as merge gates;
- the canonical applied-state query, re-run against both databases after every apply;
- audit trails, immutable result revisions and administrator authorisation;
- the prohibition on any development-to-production or simulation-to-production write path.

Suspended for the period:

- fresh verified backup before each promotion;
- dry run and preflight verification;
- per-promotion owner approval;
- dated reconciliation notes for routine schema work.

**The period ends at whichever comes first:**

1. **A real user creates an entry in production**, or any data exists that a rebuild would not reproduce — whether the current controlled baseline already meets this condition is **REQUIRES OWNER VERIFICATION**; or
2. **the 2027/28 launch window opens**, defined as the point at which public signup is enabled.

**On expiry the full sequence returns permanently and is not negotiable.** It is recorded here, in advance, precisely so that it is not renegotiated under delivery pressure at the moment it becomes necessary.

**Two exceptions apply throughout the period:**

- Any work touching the **Euro 2028 baseline tag** retains full backup discipline. The tag's value is that it is a recoverable clean reference point; a reference that cannot be restored is not one.
- Any **destructive operation** — reset, drop, data repair, privilege revocation with no forward migration — retains explicit owner approval regardless of period. Speed applies to additive schema change, not to demolition.

## Consequences

- Schema work proceeds at merge cadence rather than at milestone cadence, which is the pace the multi-competition programme requires.
- Production and development stop diverging. The recurring reconciliation problem — production at one contract, development at another, documents describing a third — largely disappears, because there is no window in which they differ.
- **`docs/quality/current-status.md`, `AGENTS.md`, `CLAUDE.md` and `docs/roadmap.md` must state the period and its end conditions.** A future reader finding relaxed promotion practice with no recorded authority would reasonably treat it as a control failure.
- The end conditions are objective and observable, not judgement calls. Either an entry exists or it does not; either signup is open or it is not.
- **Restoring the full sequence requires rehearsal, not just re-reading it.** The July 2026 recovery rehearsal proved the restore path; after twelve months of disuse it needs re-proving before it is relied upon. That rehearsal belongs in Stage J.
- `DEC-*` decisions and risk-register entries premised on milestone-only promotion need reviewing against this record.
- Backup tooling and runbooks are retained and unchanged. They are unused during the period, not deleted — `DOC-004` records what happens when a control document is removed as cleanup.

## Rejected alternatives

- **Retaining milestone-only promotion throughout.** Rejected: it protects a database containing nothing, at material cost to a programme with a fixed August 2027 deadline. It is the definition of process providing no risk reduction.
- **Suspending the deployment-contract gate along with the ceremony.** Rejected. The gate is the cheapest control in the project and has already caught a live application/database mismatch (`OPS-006`). It costs nothing per migration and it is the thing that makes the relaxed cadence safe rather than reckless.
- **Consolidating or squashing the migration chain to reduce its length.** Rejected: repository evidence records the full chain as applied in both hosted projects (**REQUIRES OWNER VERIFICATION**), the deployment contract counts it, and disaster recovery depends on replay. A consolidated migration never applied in that form has never been tested by the path that would restore it.
- **Relaxing the rules with no stated end condition.** Rejected as the most likely failure mode. Temporary relaxations without an expiry become permanent, and the moment when discipline is most needed is the moment when reinstating it is least convenient.
- **Ending the period at a date rather than at a condition.** Rejected: a date can arrive before real data does, or long after. The risk is created by users and data, so the condition should be users and data.
