# Predictor progress handover — 2026-08-06 01:00

## Scope and targets

- Repository: `nickygregal12-cmyk/Euro-2028-Predictor`
- Supabase development: `iouzoutneyjpugbbtdem`
- Supabase production: `vkfnsqdyhvtwyqkisxhk`
- Active Netlify site only: `euro28predictor` (`c69da01a-4650-43db-a1d2-b78b7f8e198a`)
- Historic `euro28-predictor-dev` was not inspected or used.

## Fresh state

- `main`: `dcb9c2b6eb634b312bf2bc6b403e8117ee2586fb`
- Repository deployment contract: 119 migrations.
- Development Supabase: 115 migrations through `20260805110000_provider_poll_dispatch`.
- Production Supabase: 63 migrations, unchanged.
- Active Netlify production deploy: `6a6bac566b6e440008d44e5b`, state `ready`.
- Open PR queue: PR #508 only.

## Hosted rollout blocker

Development is four contracts behind the repository: 116–119 remain pending. The guarded development fast lane is blocked before snapshot or migration application because `SUPABASE_DEV_DB_URL` is rejected by the correct Supavisor cluster. The probe recorded on main proves `aws-1-eu-west-2` recognises the tenant and rejects the credential, while the sibling cluster does not know the project. No direct Supabase migration was applied because that would bypass the repository-controlled preflight, postflight and authority update.

The owner action already recorded in `docs/ops/ops-pending-migrations.md` is to re-copy the Session pooler URI into `SUPABASE_DEV_DB_URL`, percent-encoding any reserved password character. Production remains deliberately at contract 63.

## PR #508 — public landing and foundation adoption

PR #508 is non-database UI work and remains mergeable, ready for review, with no unresolved review threads.

Exact head: `f81b0a751d3bed45b1f45ade08772539175d056a`.

Verified during this session:

- active-site Netlify deploy preview is ready;
- deploy-preview smoke passed;
- build passed;
- compressed bundle budget passed;
- lint passed;
- documentation authority check passed;
- migration timestamp validation passed;
- domain coverage thresholds passed;
- no unresolved review threads.

At the final inspection, the main CI test step and authenticated Browser E2E journeys were still running. The PR was not merged because the exact-head required checks had not completed. The landing page flag defaults off, so merge alone would not expose it publicly.

## Mutations

- No Supabase mutation.
- No Edge Function deployment.
- No Netlify configuration or production deployment mutation.
- No production mutation.
- Created this handover branch and report only.

## Risks

1. Repository-to-development drift is now four migrations. Do not apply contracts 116–119 directly through the Supabase connector; repair the guarded workflow credential and use the repository rollout.
2. `SUPABASE_DEV_DB_URL` may contain a stale password or an unencoded reserved character. The host must not be changed.
3. PR #508 is a large presentation slice (49 files). It is mergeable and well evidenced, but exact-head CI and Browser E2E must finish before merge.
4. The public landing feature remains disabled by default until `VITE_UI_PUBLIC_LANDING` is intentionally enabled in an active-site build.

## Exact next action for 03:00

1. Recheck PR #508 at exact head `f81b0a751d3bed45b1f45ade08772539175d056a`.
2. If CI, Browser E2E and the active `euro28predictor` preview are all green, squash-merge with expected-head protection.
3. Merge this handover PR after its checks pass.
4. Re-read `docs/ops/ops-pending-migrations.md` and check whether `SUPABASE_DEV_DB_URL` has been repaired. If it has, run the guarded development fast lane from exact current `main` to apply contracts 116–119, then verify the hosted ledger and generated authority update. If it has not, do not bypass the gate.
5. Once contract numbering is uncontended and development rollout is either completed or explicitly still blocked, take the next coherent non-racing slice. PR #508 identifies the next database boundary as a bounded competition-season read for production route registration; do not start it while another migration session is in flight.
