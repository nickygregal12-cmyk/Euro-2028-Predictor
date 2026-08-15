# Euro 2028 / Prediction Hub Engineering Constitution

This constitution governs AI-assisted engineering workflow. It does not replace product ADRs, design authorities, migration contracts, AI Lab evidence, or hosted verification.

## I. Authority before implementation

Every material change begins by locating the repository authority that owns the behaviour. New planning artifacts may reference that authority but must not fork its moving facts.

## II. Specification before non-trivial code

Features, multi-file refactors, AI/model changes, migrations, and user journeys must have an observable completion predicate before implementation starts. Specifications describe the required outcome and boundaries; implementation plans describe how to reach it.

## III. Evidence over completion claims

Changed behaviour is not complete until the relevant tests, browser journeys, database checks, model evaluation, or hosted evidence have been observed. A passing narrow check is followed by the affected broader suite.

## IV. Fail closed at trust boundaries

Authentication, privacy, admin authority, prediction locks, model promotion, data provenance, deployment configuration, and provider budgets must fail closed. Convenience fallbacks may not weaken an existing trust boundary.

## V. Model changes require measured evidence

An implemented model, feature family, calibrator, ensemble member, or explanation technique is not automatically a better default. Adoption decisions follow the AI Lab's existing leakage-safe, out-of-time evidence and promotion authority.

## VI. Production and paid-provider effects are explicit

Plans must state whether they can migrate Production, write Production data, promote models, or consume paid provider calls. When none are required, the plan says so and the implementation must preserve that boundary.

## VII. Prefer reversible slices

Changes should be small enough to review, test, and roll back independently. New infrastructure and optional observability integrations start disabled or local-only unless activation is itself part of the accepted change.

## VIII. User experience is a tested surface

For player/admin journeys, semantic correctness and browser behaviour are both part of acceptance. Automated browser exploration supplements deterministic E2E tests; it does not replace them.

## Governance

`AGENTS.md` and domain-specific repository authorities remain binding. This constitution governs engineering process only. If it conflicts with an accepted product/security/model authority, the domain authority wins and this file should be updated rather than worked around.
