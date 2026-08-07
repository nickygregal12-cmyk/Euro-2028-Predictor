# Predictor progress handover — 2026-08-07 01:00

## Scope

Continued from the latest repository and hosted state using GitHub, Supabase and the single active Netlify site `euro28predictor`. The historic `euro28-predictor-dev` Netlify site was not inspected or used.

## Fresh state

- GitHub `main`: `e95082f2ffa5b32aa804d9471c4f04268a565bf0` (`Make global navigation competition-aware (#544)`).
- Repository contract on `main`: 125 through `20260806160000_season_fixture_result_entry.sql`.
- Development Supabase `iouzoutneyjpugbbtdem`: 125 applied migrations through `20260806160000_season_fixture_result_entry`.
- Production Supabase `vkfnsqdyhvtwyqkisxhk`: 63 applied migrations, unchanged.
- Active Netlify site: `euro28predictor`, site ID `c69da01a-4650-43db-a1d2-b78b7f8e198a`; current production deploy `6a6bac566b6e440008d44e5b` is `ready`.

## Authority drift identified

`NOW.md` on `main` still reports Development at contract 122 with contracts 123–125 pending. Fresh direct Supabase migration history proves Development is already at 125. PR #541 contains the hosted-record correction plus contracts 126–131, so the stale generated authority must not be separately hand-edited.

## Open PR triage

### PR #541 — contracts 126–131

- Open, ready for review, mergeable.
- Exact head: `50f102a22f139b476f0247fa48e01883a39ebcf6`.
- Contains the Development-125 hosted record plus six additive contracts: rejoin-before-start, season competition bootstrap, season league standings, season head-to-head, season prediction consensus and period-standing display names.
- Local branch verification recorded in the PR: oxlint, TypeScript, full Vitest, additive checker and deployment-contract checks pass.
- Hard blocker: no GitHub Actions workflow run exists for the current exact head, so database parity and pgTAP suites 179–183 remain unverified. Earlier branch runs were affected by GitHub Actions service-unavailable failures. The active Netlify deploy preview checks on the exact head are successful.
- Action: did not merge or apply contracts 126–131 while exact-head database CI is absent.

### PR #543 — non-migration audit repairs

- Open, mergeable, exact head `9ae0796b72fbe32b1e71c553061cde44b054fb88`.
- CodeQL, deploy-preview smoke and other checks are green, but Browser E2E attempt 1 failed in the authenticated journeys.
- Downloaded the uploaded Playwright diagnostics. Failures were in existing route-accessibility, bracket-conflict and submission journeys rather than the fatal-recovery/Dependabot/CodeQL files changed by the PR. This is consistent with an E2E/flakiness or integration failure rather than a demonstrated defect in the PR's changed code, but the gate still stands.
- Re-ran the failed authenticated-browser job only. Attempt 2 is in progress at handover time. No merge was performed while it is unresolved.

### PR #545 — production contract-gap assessment

- Open draft, mergeable, exact head `730e2b16662e658e95b949d3ce566e1466b4bbd4`.
- Keeps Production at 63 and proposes rehearsal batches only. No production promotion was authorised or performed in this session.

## Supabase / platform note

Supabase's current breaking-change feed was checked before database work. The relevant new hosted-platform change is extension-version pinning: from 5 August 2026 explicit extension versions are ignored in favour of the platform default. No extension DDL was executed in this session.

## Mutations performed

- Re-ran the failed GitHub Actions authenticated-browser job for PR #543.
- Created this handover branch and report.
- No Supabase schema/data/migration mutation.
- No Edge Function deployment.
- No Netlify configuration or production deployment mutation.
- No production change.

## Exact next action for 03:00

1. Recheck PR #543 Browser E2E attempt 2. If the exact-head required checks are all green, squash-merge #543 under expected-head protection.
2. Recheck whether GitHub Actions has finally dispatched exact-head CI for PR #541. Do not merge contracts 126–131 until database parity and pgTAP have run successfully on `50f102a22f139b476f0247fa48e01883a39ebcf6` (or a newer exact head).
3. Once #541 is fully green, merge it first, then run the guarded Development rollout for contracts 126–131, verify the hosted ledger and privilege boundaries directly, and merge the generated hosted-authority update.
4. Keep Production at contract 63; PR #545 remains rehearsal/backup work only unless a separate production-changing instruction is given.
