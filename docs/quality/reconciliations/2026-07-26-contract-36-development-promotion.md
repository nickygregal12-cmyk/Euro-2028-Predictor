# Contract-36 development promotion and preview verification

**Date:** 26 July 2026  
**Repository:** `nickygregal12-cmyk/Euro-2028-Predictor`  
**Development Supabase:** `iouzoutneyjpugbbtdem`  
**Current Netlify project:** `euro28predictor`  
**Final-target boundary:** unchanged at contract 35

## Purpose

Record the deliberate promotion of the development database and all non-production Netlify contexts from contract 35 to contract 36, then prove an exact-head contract-36 deploy preview without changing the final-target database or production declaration.

## Pre-change position

Before the operation:

- repository `main` contained 36 canonical migrations and required contract 36;
- development Supabase migration history contained exactly versions 1–35;
- all development data was already compatible with migration 36;
- `dev`, `branch-deploy` and `deploy-preview` Netlify contexts declared contract 35;
- final-target Supabase and the Netlify `production` context remained at contract 35.

The project briefly appeared empty while its paused database was restoring. No write was attempted during that transient state. Inspection resumed only after the existing application schema, migration history and retained development rows were visible.

## Migration evidence

The canonical migration was:

- file: `supabase/migrations/20260725010000_authoritative_reference_integrity.sql`;
- version: `20260725010000`;
- name: `authoritative_reference_integrity`;
- canonical SQL MD5: `f6852376a28d3d60c06f9fb25424f9c1`;
- canonical SQL SHA-256: `fa784f19ddde905ec839fd68ebf34c0691261b519f04d598b06a5cd348f94cc6`.

Read-only preflight returned zero incompatible rows in all six relationship groups:

1. group-to-team assignments;
2. match group/home/away/winner references;
3. player-to-team references;
4. result revision-to-match references;
5. Golden Boot player selection;
6. score-event match/team references relative to entry tournament.

The connected Supabase migration action could not accept the repository timestamp as a caller-supplied version, and its tracked-migration invocation was blocked before SQL execution. The exact canonical migration SQL was therefore applied transactionally through the database query channel. The canonical `20260725010000` history row was recorded only after schema verification, with the exact repository SQL stored in `supabase_migrations.schema_migrations`.

This was not represented as a Supabase CLI dry run. Equivalent pending-set evidence was established from the canonical 1–35 history, the single repository migration 36, the six preflight checks and post-application exact-history verification.

## Post-migration verification

Development migration history now contains exactly 36 canonical versions:

- first: `20260719120000`;
- latest: `20260725010000`;
- latest name: `authoritative_reference_integrity`;
- stored SQL MD5: `f6852376a28d3d60c06f9fb25424f9c1`.

All six migration-36 functions were verified as:

- present in `predictor_internal`;
- `SECURITY DEFINER`;
- fixed to an empty search path;
- unavailable to `public`, `anon` and `authenticated`.

All six triggers were present, attached to the intended tables and enabled.

A rollback-only hosted behaviour suite proved:

- legal same-tournament writes still succeed;
- each of the six cross-tournament relationship classes is rejected;
- no temporary tournament, team, player, match, revision or score-event row remained after rollback.

## Netlify alignment

Only non-production contexts changed:

| Context | Supabase | Contract after change |
| --- | --- | ---: |
| `dev` | development `iouzoutneyjpugbbtdem` | 36 |
| `branch-deploy` | development `iouzoutneyjpugbbtdem` | 36 |
| `deploy-preview` | development `iouzoutneyjpugbbtdem` | 36 |
| `production` | final target `vkfnsqdyhvtwyqkisxhk` | **35, unchanged** |

No final-target SQL, environment variable, deploy pointer or retained data changed.

## Preview verification

PR #105 restored target-specific smoke contracts and exact-head preview proof:

- preview: `https://deploy-preview-105--euro28predictor.netlify.app`;
- application contract: 36;
- hosted contract: 36;
- Supabase project: `iouzoutneyjpugbbtdem`;
- exact PR head required;
- HTTP smoke passed;
- anonymous browser smoke passed;
- CI run 582 passed;
- Browser E2E run 271 passed after both jobs completed.

The smoke implementations now require `EURO28_SMOKE_EXPECTED_CONTRACT`. Preview workflows explicitly provide 36; the retained final-target smoke explicitly provides 35. This prevents a shared hardcoded contract from silently breaking one target while fixing another.

Because contract-36 `main` cannot deploy to the retained contract-35 final target, the production smoke workflow verifies the existing compatible 35/35 production release rather than waiting for an intentionally blocked exact `main` commit. Exact-head production verification must be restored as part of the separately approved final-target contract-36 promotion.

## Advisor observations

Migration-36 private functions were not reported as browser-executable. Existing advisor findings remain separate work:

- mutable search path on `public.enforce_joker_rules`;
- authenticated `SECURITY DEFINER` functions requiring continued allowlist review;
- leaked-password protection disabled;
- several unindexed foreign keys;
- unused-index notices that require representative-load evidence before removal.

No advisor finding was silently remediated in this workstream.

## Result

Development and all current non-production deployment contexts are verified at contract 36. The final target remains a compatible, controlled contract-35 application/database pair. The next database stage is final-target preparation only; any final-target write still requires explicit owner approval.
