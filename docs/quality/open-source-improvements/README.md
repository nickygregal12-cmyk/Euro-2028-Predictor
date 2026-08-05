# Open-source improvement plan

Status: implementation plan

Scope: repository, application and quality tooling only. This folder does not authorise a database migration, hosted change, provider request, production write or deployment.

Reviewed against the repository at `eba71a59a9c8e0fc0a4c6b345537a9f8cec47576` on 5 August 2026.

## Purpose

The Predictor already has strong foundations: React, TypeScript, Vite, Vitest, Playwright, pgTAP, Supabase, Sentry, a bundle budget, a component preview, `flag-icons`, Lucide and Framer Motion. The aim is not to replace those systems or accumulate overlapping packages. It is to close specific remaining gaps with a small set of maintained open-source tools and to formalise the best parts of the current stack.

Only recommended work is recorded in this folder.

## Approved improvement set

| Area | Approved system or change | Intended result |
| --- | --- | --- |
| Test structure | Better Specs principles adapted to Vitest and Playwright | Clearer, behaviour-led tests without importing Ruby-specific conventions |
| Combinatorial correctness | `fast-check` and `@fast-check/vitest` | Generate edge cases for scoring, tiebreaks, entrant counts and state transitions |
| Test strength | StrykerJS, limited to critical pure-domain modules | Detect assertions that pass even when scoring logic is deliberately broken |
| API simulation | Mock Service Worker (`msw`) | Reusable network-level scenarios across integration tests and local UI development |
| Dead-code control | Knip | Detect unused files, exports, types and dependencies as the repository grows |
| Runtime quality | Lighthouse CI | Prevent performance, accessibility, best-practice and SEO regressions on key routes |
| Visual regression | Existing Playwright screenshot assertions against the existing component preview | Protect approved component states without adding another component-workshop system |
| Interface consistency | Existing Lucide package plus Predictor-specific custom icons | One generic icon language across production and premium surfaces |
| National flags | Existing `flag-icons` integration, corrected and generated | Accurate 4:3 rendering, complete coverage and no silent missing flags |
| Motion | Existing Framer Motion plus CSS transitions | A restrained, accessible shared motion policy |
| Dependency updates | Renovate | Controlled, grouped dependency PRs with major updates held for review |
| Dependency admission | GitHub Dependency Review Action | Block newly introduced vulnerable or disallowed dependencies in PRs |
| Workflow security | OpenSSF Scorecard | Identify risky GitHub Actions and repository supply-chain practices |
| Software inventory | `npm sbom --sbom-format=cyclonedx` | Reproducible dependency inventory without another runtime dependency |
| Deadline-load readiness | Grafana k6 | Verify prediction reads and submissions under realistic lock-time bursts |

## Governing rules

1. Adopt tools only where they close a named gap.
2. Prefer a narrow first slice over a repository-wide rollout.
3. New checks begin as report-only unless their signal is already stable.
4. A check becomes blocking only after false positives and runtime are understood.
5. No tool may weaken current database, scoring, lock, RLS, deployment or hosted-environment gates.
6. Do not expose Supabase service-role credentials, provider keys or real user data to fixtures, browser mocks, Lighthouse runs or load tests.
7. Pin GitHub Actions to full commit SHAs once the workflow is proven.
8. Keep generated reports and temporary test output out of version control unless they are deliberate audit artefacts.

## Documents in this folder

- [`01-current-stack-improvements.md`](01-current-stack-improvements.md) — changes to existing icons, flags, motion, component preview and test conventions.
- [`02-testing-and-correctness.md`](02-testing-and-correctness.md) — property testing, mutation testing and network-level mocks.
- [`03-performance-and-launch-readiness.md`](03-performance-and-launch-readiness.md) — Lighthouse, visual regression and k6.
- [`04-dependency-and-supply-chain.md`](04-dependency-and-supply-chain.md) — Knip, Renovate, dependency review, Scorecard and SBOM generation.
- [`05-implementation-sequence.md`](05-implementation-sequence.md) — PR order, acceptance criteria and verification.
- [`source-register.md`](source-register.md) — official upstream projects and intended use boundaries.

## Completion definition

This plan is complete only when the implemented checks are documented in the normal repository authority layer, have stable scripts or workflows, pass on a clean checkout, and do not duplicate an existing control.