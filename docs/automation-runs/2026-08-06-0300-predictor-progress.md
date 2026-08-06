# Predictor progress handover — 2026-08-06 03:00

## Completed

- Re-read the 01:00 handover and inspected current `main`, open PRs, exact-head CI, migration ledgers and the single active Netlify project.
- Verified PR #508 at exact head `3df8f9da362d596bde11607cde0c90bcaa24e6c5`:
  - GitHub CI passed.
  - Browser E2E passed.
  - No unresolved review threads.
  - Netlify deploy preview was ready on `euro28predictor`.
- Squash-merged PR #508 with expected-head protection.
- Merge commit: `7b5b6989a8a8d38dabd58c6a79e263ee4980a2da`.

## Resulting application change

PR #508 delivered UI-14 through UI-18, including:

- the signed-out public landing page behind the fail-closed `VITE_UI_PUBLIC_LANDING` flag;
- foundations adoption and regression guards;
- complete component-gallery state coverage;
- deploy-preview-only landing-page exposure;
- a Lighthouse command that works from a clean checkout.

Production exposure was not enabled. Merging the PR does not switch on the public landing page in the production build.

## Hosted state

- Repository: contract 119.
- Development Supabase `iouzoutneyjpugbbtdem`: contract 115, through `20260805110000_provider_poll_dispatch`.
- Pending in development: contracts 116–119.
- Production Supabase `vkfnsqdyhvtwyqkisxhk`: contract 63, unchanged.
- Active Netlify project: `euro28predictor`, site ID `c69da01a-4650-43db-a1d2-b78b7f8e198a`.
- Active production deploy `6a6bac566b6e440008d44e5b`: ready.
- Historic Netlify project was not inspected or used.

## Guarded rollout blocker

The development migration fast lane remains blocked before snapshot or apply because the configured Supavisor host recognises the project tenant but rejects the credential. The correct host is already in use. The surviving causes remain:

1. stale database password; or
2. an otherwise correct password containing reserved URI characters that were not percent-encoded.

No direct Supabase migration was applied because that would bypass repository preflight, snapshot, postflight and hosted-authority controls.

## PR #512

The 01:00 documentation PR became non-mergeable after PR #508 advanced `main`. This 03:00 handover contains its material findings plus the completed merge result, so #512 should be closed as superseded rather than force-restacked.

## Mutations

- GitHub: squash-merged PR #508.
- Supabase: no schema, data, migration or Edge Function mutation.
- Netlify: no configuration, preview trigger or production deployment mutation.
- Production: unchanged.

## Risks and blockers

1. Development trails the repository by four migrations.
2. The guarded rollout cannot proceed until `SUPABASE_DEV_DB_URL` is repaired.
3. The production deploy is ready but old; repository-controlled deployment remains the only permitted promotion path.
4. The public landing page remains intentionally disabled in production.

## Exact next action for 05:00

1. Merge this handover PR after its exact-head checks pass.
2. Recheck whether `SUPABASE_DEV_DB_URL` has been repaired.
3. If repaired, run the guarded development rollout from exact current `main`, apply contracts 116–119, verify the ledger and privileges, then merge the generated hosted-authority update after checks pass.
4. If still blocked, preserve the migration gate and take the next coherent non-contract slice from the current execution authority.
5. Do not enable the public landing page or deploy production unless a separate repository-controlled release change explicitly authorises it.

Production must remain at contract 63.
