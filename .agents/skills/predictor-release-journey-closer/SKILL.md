---
name: predictor-release-journey-closer
description: Use when the user asks to finish, complete, make release-ready, or properly close a player journey whose pieces may already exist across UI, services, routes, tests, flags, and accepted requirements.
---

# Predictor release journey closer

Use this as the **process skill for proving a capability is genuinely finished**, not merely implemented somewhere.

## Build the closure map first

For the routed capability, trace only the states that actually exist:

1. entry and discovery;
2. eligibility/preconditions;
3. primary action and validation;
4. authoritative write or read boundary;
5. authoritative reread / observable success;
6. refusal and recoverable failure;
7. refresh/reload persistence where state is durable;
8. deep-link, logical parent, Back/return and adjacent navigation;
9. phone, desktop, keyboard, accessibility and reduced motion where UI is involved;
10. feature/site flags and rollout-safe fallback;
11. executable acceptance evidence;
12. accepted-requirement / live-authority closeout when the evidence genuinely satisfies it.

A component, RPC or unit test existing is not evidence that the journey is complete.

## Delivery rules

- Reproduce the actual incomplete seam before changing code.
- Prefer the smallest missing boundary over rebuilding working layers.
- Keep server-owned product rules on the server and use authoritative rereads after writes where the existing architecture requires them.
- Do not claim release readiness while a required browser/permission/environment proof is absent.
- If closure exposes multiple unrelated defects, rank them and keep the PR coherent rather than turning one journey into a repo-wide sweep.
- Hosted Development or Production mutation still requires the repository's normal authority; this skill cannot promote or deploy by itself.

Finish with a short closure ledger: proven complete, deliberately out of scope, blocked by external/owner action, and the exact executable evidence used.