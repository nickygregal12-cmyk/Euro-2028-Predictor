---
name: predictor-systematic-debugging
description: Use for reproducible bugs, failed journeys, flaky behaviour, unexplained regressions, or release blockers where root cause must be proven before a fix is written.
---

# Predictor systematic debugging adapter

Use this as the **process skill** for defects. It replaces guess-and-patch behaviour; do not stack a competing generic delivery process on the same task unless the scope changes from diagnosis into a separately planned feature.

1. Start from the exact failing behaviour and current shipping/branch state. Reproduce before editing.
2. Materialize the immutable upstream workflow with `npm run agent:skill -- systematic-debugging`, then read the printed `SKILL.md` and only the referenced **debugging technique files** needed for this defect.
3. Repository authorities, source and executable tests outrank the upstream skill. Graphify narrows cross-file flow; Serena narrows exact symbols/callers.
4. Trace the complete interaction/data path to the first incorrect assumption or state transition. Do not stop at the visible symptom.
5. Add the smallest regression that fails for the proven root cause, then fix it and exercise adjacent journeys where the blast radius warrants it.
6. The upstream Phase 4 references to separate Superpowers `test-driven-development` and `verification-before-completion` skills are **not additional skills to load here**. Map them to this repository's existing failing-regression requirement and fresh executable evidence-before-completion gate. The one-process-skill budget remains intact.
7. For player-facing UI defects, retain the repository requirement for real browser evidence on relevant phone/desktop journeys; green unit tests alone are not completion evidence.
8. Never weaken fail-closed environment, permission, provider, migration, scoring or settlement rules to make a regression pass.

The skill does not grant permission to scan the repository broadly; use the bounded task packet first.
