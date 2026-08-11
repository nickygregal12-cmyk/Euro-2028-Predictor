# Predictor progress handover — 2026-08-11 01:00

## Executive state

This run continued from the actual repository/hosted state rather than the stale 2026-08-10 03:00 narrative.

At the end of the run:

- repository `main`: `f47aa60b4981aa6dd90c0a5420503ba245eb986f`;
- repository deployment contract: **157**;
- Development Supabase `iouzoutneyjpugbbtdem`: **157 migrations**, ending `20260810230000_player_preferences`;
- Production Supabase `vkfnsqdyhvtwyqkisxhk`: **151 migrations**, ending `20260810170000_season_player_profile`;
- active Netlify site only: `euro28predictor` (`c69da01a-4650-43db-a1d2-b78b7f8e198a`), production deploy `6a7a44d10fbd4c00087a8c3c`, state `ready`, commit `690c96993efb76f5260088f3a4e6c9cf6b6ecff8`;
- active-site visitor perimeter is site password protection across contexts; Team SSO is not currently required;
- the historic Netlify project was not inspected or used.

## Contract 152–157 unblock and Development rollout

PR #671 had already merged the six remaining MIG-UI contracts, but Development was still at 151. The Development fast lane had refused Contract 155 because its additive guard saw the literal words `delete from` inside the migration's own no-write assertion string, not an executable delete statement.

PR #673 was the repair candidate. Fresh exact-head verification showed the PR description had become partly stale: Database parity had subsequently passed. The exact head `d49541fcc30f11a64ac8df52cf31dc5a4d6c89c4` had:

- Workflow lint: success;
- Database parity: success;
- Browser E2E: success;
- CodeQL: success;
- Main CI: every gate through coverage succeeded; the only substantive test failure was `database.types.ts` still declaring hosted Development Contract 151 while the repository declares 157. That is a circular generated-artifact condition which cannot clear before the Development rollout this repair exists to unblock.

The PR also incorporated pgTAP-discovered fixture/assertion repairs and added the pinned Production 151→157 rehearsal and rollout workflows. The additive guard itself was not weakened.

PR #673 was squash-merged with expected-head protection as:

- `39fade8f4533dc43388e32e20212c2e93a687218` — `Contract 155: unblock guarded 152-157 rollout (#673)`.

Immediately afterward, Development fast-lane run **31444748121** was dispatched from that exact `main`. It passed every stage:

1. exact-main / exact-project preflight;
2. Development secret preflight;
3. pending-migration discovery and additive proof;
4. lightweight pre-apply data/schema snapshot;
5. apply of Contracts 152–157;
6. post-apply contract equality check;
7. evidence upload.

An independent read-only query after the workflow confirmed Development at exactly **157** migrations ending `20260810230000_player_preferences`.

The independent postflight also confirmed:

- 24 auth users / 24 profiles;
- 34 entries / 756 match predictions;
- 4 leagues / 38 league memberships;
- 4 rows in the shared invite-code registry;
- `season_wrapped`, `competition_follows` and `pinned_rivals` remain empty;
- all 10 new player RPC names are granted to `authenticated`;
- zero corresponding anonymous/PUBLIC RPC grants;
- zero browser grants on `invite_code_registry`, `season_wrapped`, `competition_follows` and `pinned_rivals`;
- the public competition join authority refuses a private competition;
- Euro publication state remains `hidden`.

The fast lane generated PR #674 to record the hosted Development authority. Its only change was `config/development-hosted-contract.json`, moving 151→157 and recording run 31444748121 / repository head `39fade8…`; Production remained 151 and promotion remained unauthorised. PR #674 was squash-merged as:

- `f47aa60b4981aa6dd90c0a5420503ba245eb986f` — `Docs: record development hosted contract 157 (#674)`.

## Production boundary

Production was independently queried and remains **151** migrations ending `20260810170000_season_player_profile`. No Production write was made during this run.

PR #673 has now put the correct pinned Production 151→157 controls on `main`:

- `.github/workflows/production-151-to-157-rehearsal.yml` — read-only against hosted Production; restores a fresh Production-shaped copy locally and rehearses exactly Contracts 152–157;
- `.github/workflows/production-151-to-157-rollout.yml` — refuses to write unless a successful Production backup and successful 151→157 rehearsal run are supplied and verified through the GitHub API, and applies only the pinned six migrations.

A fresh Production backup for this boundary has **not** yet been dispatched in this run. The latest backup remains run 31424038086 from the previous Contract-151 application-release work. Do not reuse old backup evidence for the new promotion merely because it is successful: take a fresh backup, run the pinned rehearsal from exact current `main`, then use those run IDs for the guarded rollout.

After any Production rollout, independently verify the ledger, player-owned row counts, invite registry backfill, RPC/table privilege boundary, private join refusal and Euro `hidden` state before recording the Production hosted contract.

## Frontend consumer PR #672

PR #672 (`Consume contracts 147–151, and fix the domestic Profile dead end`) remains the highest-value frontend candidate. It is repository-only and consumes already-hosted Contracts 147–151; among other changes it removes the static weekly catalogue, consumes server-owned published seasons/routes, completes the private-league Table/Matchweek/Members workspace, adds rank movement and player-profile routing, and moves platform `/profile` outside the hidden-Euro tournament boundary.

Current exact head: `57b99590b7ab8f5455c1e4aad73b05c5f29812e1`.

At final inspection:

- CodeQL: success;
- deploy-preview smoke: success;
- Browser E2E attempt 1 failed **before the application rebuild**, at `Start disposable local Supabase`; no signed-in journey ran, so that attempt demonstrates infrastructure failure rather than an application defect;
- only the failed authenticated-browser job was re-run;
- Main CI and Visual contracts were still in progress;
- #672 is mergeable against current `main`, but must not merge until the exact-head required gates finish successfully.

Do not represent UI-F19 as complete: no real hosted signed-in journey is claimed by #672.

## Open audit PR #670

PR #670 remains open and currently unmergeable. It contains useful audit repairs, but its original Contract-152 invite-code migration authority has been overtaken by the canonical 152–157 sequence now on `main` and hosted in Development. It must be cleanly restacked so only still-valid unique audit work survives; do not merge its competing migration history onto Contract 157.

Of particular value to preserve when restacking are its production-authority source-of-truth repair, typed-client work, hosted `pg_net` exposure assertion and recurring Netlify contract check, subject to re-verification against current `main`.

## Netlify

Only the active `euro28predictor` site was inspected.

Current production deploy:

- deploy ID `6a7a44d10fbd4c00087a8c3c`;
- `ready`;
- main commit `690c96993efb76f5260088f3a4e6c9cf6b6ecff8`;
- deploy title `Ops: enable production public landing build`;
- secret scan: zero matches;
- 37 redirect rules and 1 header rule processed successfully;
- no Netlify Functions or Edge Functions in that deploy.

Lighthouse cannot load the protected site and reports HTTP 401; this is expected under the current site-password perimeter rather than evidence that the deploy itself failed.

No Netlify configuration or deployment mutation was made during this run.

## Supabase platform check

Current hosted Supabase breaking-change information was reviewed before database work. The relevant recent hosted change remains the 5 August 2026 behaviour where explicit extension-version pins are ignored in favour of the platform default. The newer Envoy-default change concerns self-hosted Supabase rather than these hosted projects. No migration change was required for either item in this run.

## Mutations performed in this run

- squash-merged PR #673;
- guarded Development fast-lane run 31444748121 applied Contracts 152–157;
- independently verified Development Contract 157 and its privacy/security boundaries;
- squash-merged generated hosted-authority PR #674;
- re-ran only PR #672's failed authenticated Browser E2E job after its infrastructure-only local-Supabase startup failure;
- no Production database write;
- no Edge Function deployment;
- no provider request/backfill;
- no Netlify configuration or production deployment;
- no historic Netlify project access.

## Risks / blockers

1. **Production is six contracts behind** the repository and Development: 151 vs 157. This is now a controlled promotion task, not a migration-design blocker.
2. **Generated database types still describe Contract 151.** Regenerate them from hosted Development now that Development genuinely holds 157; do not solve this by weakening the contract assertion.
3. **PR #672 remains gated by its exact-head CI/E2E/visual run.** Its first authenticated-browser failure was infrastructure-only, but the retry still has to pass.
4. **PR #670 is stale against the canonical migration sequence.** Preserve its unique audit fixes by restacking, but drop/supersede the competing Contract-152 history.
5. **Production application deployment is older than current `main`.** Do not promote current application code merely because repository/database work advanced; application release remains separate and must respect the Production database boundary.

## Exact next action for 03:00

1. Recheck PR #672 at exact head `57b99590b7ab8f5455c1e4aad73b05c5f29812e1`. If the authenticated-browser retry, Main CI and Visual contracts all finish green and the head remains unchanged/mergeable, squash-merge with expected-head protection. If the local-Supabase startup fails again, treat it as infrastructure and inspect the exact startup logs rather than changing product code speculatively.
2. Regenerate `database.types.ts` from hosted Development Contract 157 through the repository's normal generated-artifact path, verify the generated-contract assertion, and commit it as a focused repair.
3. Start Production 151→157 promotion only through the guarded sequence: **fresh Production backup → pinned Production-shaped 151→157 rehearsal → guarded 151→157 rollout using the successful backup/rehearsal run IDs → independent read-only postflight → hosted-authority PR**. Never direct-apply the six migrations to Production.
4. Once the Production database is independently verified at 157, keep `promotionAuthorised: false` for future schema boundaries and decide the application release separately.
5. Restack PR #670 onto exact current `main`, removing its superseded competing migration and retaining only independently reverified audit fixes.