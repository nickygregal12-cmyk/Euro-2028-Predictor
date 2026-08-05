# ADR 0024 — Development environment operating model

- **Status:** Implemented for the current pre-cohort development operating model
- **Date:** 3 August 2026
- **Amends:** the proportionate-checks intent already stated in `AGENTS.md` and `CLAUDE.md`, by making it operational. It does **not** amend any scoring, privacy, permission or production-safety decision, and nothing here relaxes a control that protects production data.

> **Implementation evidence — 5 August 2026.** Non-production contract mismatch reporting, the guarded additive fast lane, deterministic seed contract, proportionate CI/browser/database gates and separate production controls are all active. The closed-cohort trigger changes future operating requirements when it occurs; it is not an unimplemented part of the present model.

## Context

The repository's written operating rules already say ordinary documentation, styling and isolated UI work should use proportionate checks, and that full backup, preflight and approval belong to production-risk operations. **In practice the controls drifted past that intent**, and every development change began paying production-grade ceremony.

The clearest case is a circular gate. `scripts/validate-deployment-contract.mjs` failed any Netlify build whose target database contract differed from the application's. A pull request that advances the schema therefore **could not** obtain a green hosted preview before merging, because the development database can only reach the new contract *after* the migration lands. PR #371 (contract 66) accumulated dozens of red preview checks for this reason alone — a gate that cannot be satisfied teaches everyone to ignore a whole class of red check, which is worse than having no check.

The facts that make the ceremony disproportionate are specific and current:

- public signup is closed;
- the owner is the only user;
- hosted development data is test data;
- the domestic product has not launched;
- production is separately frozen at contract 63 with deploys paused.

**Development is replaceable engineering infrastructure, not a live customer database.** Production is not, and nothing below changes that.

## Decision

### Development data is disposable until a closed external cohort begins

The development Supabase project may be reset, reseeded or rebuilt as ordinary engineering work. A lightweight snapshot before a destructive operation is sufficient; the full encrypted-backup and managed-schema restore rehearsal is **not** required for development.

**This decision expires** the moment a closed external cohort holds data in development — at that point development carries other people's data and returns to the guarded regime. The expiry is a condition, not a date, and whoever opens the cohort owns re-tightening it.

### Production remains frozen and fully guarded

Unchanged and non-negotiable: full backup, preflight, explicit action-specific owner approval, exact-origin smoke and dated evidence before any production write. Production stays at contract 63 with deploys paused until an intentional release milestone. **No item in this record applies to production.**

### Additive development migrations use a fast lane

For an additive, non-destructive development migration:

```
CI → zero-to-current rebuild → populated previous→current transition
   → relevant pgTAP/parity → merge → apply to development → targeted hosted smoke
```

A destructive or irreversible development migration keeps the fuller process, snapshot included. "Additive" means no drop, no destructive rewrite and no data loss on the transition path — a claim the populated transition test must actually demonstrate, not one an author asserts.

### Preview contract mismatch is informational, not a required failure

**Implemented in this change.** When a non-production Netlify context's database contract **trails** the application's, the build proceeds and reports `hosted database preview unavailable until the development rollout applies it`. Static and seeded routes stay previewable; exact database-backed smoke runs after the development rollout.

Two boundaries are deliberate and tested:

- **production is never waved through** — a production mismatch still fails, and the carve-out is scoped by a named constant so it cannot be widened by an innocent edit to a comparison;
- **a database *ahead* of the application still fails everywhere**, including non-production. Ahead is not a pre-rollout state: it means the target holds migrations this build does not know about, which is a genuine mismatch.

### Browser regression is targeted, with full runs at boundaries

Full authenticated Browser E2E runs for shell-wide, auth-wide, schema and database-contract changes, and at milestone boundaries. Focused journeys serve focused changes — a Match Predictor change runs the Match Predictor journey, not every Euro tournament journey. A pure-domain or documentation change runs neither.

Contract 66 is correctly broad enough to justify the full suite. A scoring helper is not.

### Work is batched into coherent units

One pure-domain pull request per coherent game capability; one persistence migration per coherent contract; one vertical-slice pull request tying persistence, services and interface together; small hotfix pull requests only for genuinely isolated defects.

Splitting one coherent stage across many micro-pull-requests produced constant rebasing, repeated test-floor edits, CI repetition and document drift, and a seventy-commit dependency branch — slower and riskier than a coherent tested batch, not safer.

### Development is deterministically reseedable

Development seed data must provide deterministic seed users, deterministic game memberships, seeded rehearsal fixtures for the supported competitions, admin and ordinary-player accounts, and a one-command reset-and-republish.

This is not housekeeping. The contract-66 browser failures — 33 specs across every authenticated surface — are consistent with the schema moving the membership authority while the browser fixtures did not move with it. Deterministic seeds that travel with the schema are the control that prevents that class of failure.

## What does not change

These stay exactly as they are, and this record must not be cited to weaken any of them:

- TypeScript and production build; zero-warning lint;
- pure-domain and scoring tests;
- RLS, grants and `search_path` guards;
- full migration rebuild and the populated previous→current transition;
- TypeScript/PostgreSQL parity for scoring and settlement;
- targeted authenticated browser journeys for changed user flows;
- full production backup, preflight and explicit approval before any production write;
- C2 account deletion and retention work remains legally blocked under issue #272 and entirely separate.

## Consequences

- A schema-advancing pull request can now go green before merge, so red checks recover their meaning.
- The development rollout becomes routine engineering rather than an owner-gated ceremony, while production promotion stays a deliberate milestone.
- Faster development cadence depends on the seed work above actually being done; without it, the reduced ceremony removes a safety net that deterministic seeds were meant to replace.
- The disposability decision is time-limited by the cohort condition and must be revisited then, not silently inherited.

## Rejected alternatives

- **Leaving the contract gate as a hard failure.** Rejected: it is unsatisfiable before merge for the exact changes it claims to protect, and an unsatisfiable gate trains people to ignore red checks.
- **Waving through any contract mismatch, including production or ahead-of-application.** Rejected: those are real mismatches. The carve-out is narrow, named and tested precisely so it cannot drift into them.
- **Ephemeral Supabase database per schema-changing pull request.** The better long-term answer and explicitly the eventual target, but heavier than this stage needs; post-merge development rollout is sufficient now.
- **Applying the same relaxation to production.** Rejected outright. Production carries the only data that is not reproducible, and the frozen-and-guarded posture is what makes relaxing development safe.
