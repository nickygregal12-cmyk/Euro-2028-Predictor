# Authentication recovery browser E2E

**Date:** 24 July 2026  
**Issue:** #52  
**Pull request:** #61  
**Branch:** `agent/add-auth-recovery-e2e`  
**Finding:** `TEST-001`  
**Status:** Repository/disposable-development browser evidence complete; hosted and remaining-journey evidence open

## Purpose

Extend the existing authenticated Browser E2E gate through the public account lifecycle without using hosted Supabase, real SMTP, production data or Netlify configuration.

## Permanent implementation

- a separate Playwright configuration runs on loopback port 4174 with development auto-login explicitly disabled;
- local Supabase requires confirmation email and allows only the two loopback E2E application origins;
- the workflow exports the local Mailpit URL and runs the original authenticated suite before the isolated auth suite;
- a guarded Mailpit helper refuses non-HTTP, non-loopback or non-54324 targets, reads stored messages through the v1 API and filters the exact recipient address;
- the desktop lifecycle covers signup, confirmation email, first-use welcome, sign-out, password login, reset request, recovery email, password replacement, old-password rejection and new-password login;
- the mobile project covers the signed-out login, signup and reset surfaces;
- executable repository tests protect the local-only target, separate auto-login policy, local confirmation configuration and expected lifecycle assertions.

## Validation evidence

Functional head `840c2e1982acb75f7a5446fe1fdad6f9f0a68f18` passed:

- **CI run 30125343793:** install, Git-less environment proof, guarded build, lint, complete Vitest suite and production dependency audit;
- **Database parity run 30125343795:** disposable Supabase startup, all 35 migrations, database lint, every pgTAP suite and TypeScript/PostgreSQL parity;
- **Browser E2E run 30125343872:** migrations/seed rebuild, local environment export, every established authenticated journey, complete signup/recovery lifecycle, phone-width auth smoke, diagnostics upload and no-backup teardown.

## Defects exposed while building the gate

1. The auth-only Playwright command originally repeated the existing account global setup. The isolated auth suite now creates only its own account and tournament prerequisite.
2. Mailpit stored recipients use the `Address` field rather than the send API's `Email` field. The helper now matches the stored schema while retaining an `Email` fallback.
3. Password labels also label their show/hide buttons. Tests now use exact textbox-role locators.
4. Success panels use accessible `status` semantics rather than error `alert` semantics. Assertions now match the rendered contract.

## Evidence boundary

This batch materially improves `TEST-001`; it does not close it. Remaining work includes private-league invitation/join, result administration, keyboard/browser accessibility and compatible-production smoke journeys. Production remains at database contract 20 and blocked by recovery evidence.

No hosted database, migration, deployment-contract value, scoring rule, real email service or production data was changed.
