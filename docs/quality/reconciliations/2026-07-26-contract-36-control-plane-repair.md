# Contract-36 repository control-plane repair

**Date:** 26 July 2026  
**Repository:** `nickygregal12-cmyk/Euro-2028-Predictor`  
**Base commit:** `f57543c1b2945091f734842024df9a3970635943`  
**Scope:** Documentation and repository operating authority only

## Purpose

PR #101 correctly reconciled the headline repository position after migration 36 merged, but several active authority documents still contained contract-35 instructions or described migration 36 and PR #76 as draft/unmerged.

Those contradictions could cause a coding agent to:

- preserve contract 35 in repository authority after `main` moved to 36;
- treat migration 36 as outside repository authority;
- continue waiting for PR #101 or issue #72 after both were complete;
- target the legacy `euro28-predictor-dev` World Cup deployment for current previews;
- weaken or misinterpret the deployment-contract gate;
- claim hosted contract-36 evidence that does not yet exist.

This repair establishes one consistent operating position across the current authority set.

## Verified facts carried forward

- Repository `main` contains exactly 36 migrations.
- Migration `20260725010000_authoritative_reference_integrity.sql` merged through PR #76.
- `config/deployment-contract.json` requires contract 36 and 36 migrations.
- CI, Database parity and Browser E2E passed on the final PR #76 head.
- PR #101 is merged.
- Issue #72 (`DATA-003`) is closed as repository implementation complete.
- Disposable/local Supabase is verified through migration 36.
- Development Supabase `iouzoutneyjpugbbtdem` is last verified at contract 35.
- Final-target Supabase `vkfnsqdyhvtwyqkisxhk` is last verified at contract 35.
- The Netlify context historically named `production` is the controlled final-target environment and is not supporting a live Euro 2028 tournament.
- The accepted final-target contract-35 evidence remains valid until superseded by dated contract-36 hosted evidence.
- `euro28-predictor-dev.netlify.app` is a legacy deployment from `worldcup2026/euro28-development` and is not a current preview target.

## Documents reconciled

- `AGENTS.md`
- `CLAUDE.md`
- `docs/quality/current-status.md`
- `docs/quality/risk-register.md`
- `docs/quality/feature-baseline.md`
- `docs/build-todo.md`
- `docs/roadmap.md`

## Resulting work order

1. Complete this control-plane repair.
2. Inspect development Supabase read-only.
3. Require a dry run showing only migration 36.
4. Apply and verify migration 36 in development.
5. Update development preview/branch/dev declarations to contract 36.
6. Restore exact-head contract-36 deploy-preview smoke on the current `euro28predictor` Netlify project.
7. Prepare the final-target contract-36 upgrade separately and require explicit owner approval before any write.
8. Continue the server-authorized administrator/result-management workstream.
9. Repair authoritative knockout winner/method/extra-time/penalty consumption in Match Centre and H2H.

## Boundaries

This repair:

- does not change application code;
- does not change scoring;
- does not change `config/deployment-contract.json`;
- does not apply migration 36 to a hosted database;
- does not change Netlify environment variables or deployment configuration;
- does not modify the legacy World Cup repository, Netlify site or Supabase project;
- does not claim either hosted database is at contract 36;
- does not make draft PR #102 a complete administrator implementation.

## Acceptance

The control plane is reconciled when current authority documents consistently state:

- repository contract 36;
- hosted development and final target last verified at 35;
- migration 36 merged and repository-authoritative;
- PR #101 merged and issue #72 closed;
- development-first hosted upgrade order;
- exact-head preview smoke belongs to the current `euro28predictor` Netlify project;
- the legacy `euro28-predictor-dev` site remains outside this workstream;
- final-target writes require separate explicit approval and evidence.
