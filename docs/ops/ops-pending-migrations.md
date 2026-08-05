# Hosted migration inventory and rollout status

This is the operational migration inventory. Machine-readable development hosted state is authoritative in [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json); repository contract is authoritative in [`../../config/deployment-contract.json`](../../config/deployment-contract.json). Historical rollout reports are evidence only.

## Current state — 4 August 2026

The repository is at **contract 105**. Development is verified at **103** after fast-lane run 30959460638 and trails by the two pending contracts 104–105.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository `main` | **105** | Contract 104 separates live-only operational callers from terminal-aware current reads through `20260805001000_live_competition_callers.sql`; contract 105 enforces split ancestry and derives the continuing Championship table through `20260805010000_cup_split_group_tables.sql` | MERGED, AWAITING DEVELOPMENT ROLLOUT |
| Development Supabase `iouzoutneyjpugbbtdem` | **103** | Applied 4 August 2026 by fast-lane run 30959460638 on `6dc7ae3`, carrying contracts 98–103 in one batch. Corroborated read-only: the ledger holds 103 rows through `20260804333000`. Contract 103 landed whole — all five lineage columns present, both partial indexes created, the live-public predicate reading `((visibility_kind = 'public'::text) AND (completed_at IS NULL))`, the replaced total key gone, and `bonus_competitions_predecessor_fkey` spanning five columns. The backfill is intact: **zero** non-public rows and **zero** completed rows, so every competition remains the live public instance of its own series and no current reader changes answer. `live_competition_id` and `prepare_competition_lineage` exist only in `predictor_internal`, **neither** in `public`, and `anon`, `authenticated` and `service_role` hold no EXECUTE on either | VERIFIED; TWO CONTRACTS BEHIND THE REPOSITORY |
| Production Supabase | **63** | Hosted migration ledger directly verified through `20260729154931_prediction_consensus_minimum_cohort` | PAUSED AND UNCHANGED |
| Netlify `euro28predictor` non-production contexts | **97 hosted declaration** | `dev`, branch-deploy and deploy-preview point to Development, declare `EURO28_DEPLOYED_DB_CONTRACT=97`, and require Netlify team login. **Owner-reported on 4 August 2026, not independently verified from this repository** — Netlify environment variables are a team-console setting with no read path from CI or from an agent session. See the corroboration note below | NOW SIX BEHIND DEVELOPMENT AND EIGHT BEHIND THE REPOSITORY — the ordinary cycle described below, and the owner may now move it to 103 because the rollout has landed |
| Netlify `euro28predictor` production | **63 hosted declaration** | Production points to Production Supabase, remains publicly accessible and retains the fatal contract gate | BLOCKED BY DESIGN |

The historic Netlify project `euro28-predictor-dev` is out of scope and must not be inspected as current state, configured or deployed to.

### Corroborating the Netlify declaration

The Netlify contract declaration is the one row in this table with **no repository-side read path**. `EURO28_DEPLOYED_DB_CONTRACT` is a Netlify team-console environment variable; CI never sees it, and the protected-preview gate reads only the *commit status*, not the build log. So a green `netlify/euro28predictor/deploy-preview` status does **not** distinguish a current declaration from a stale one — `scripts/validate-deployment-contract.mjs` deliberately waves a *trailing* non-production context through, because a schema-advancing pull request cannot make its preview go green before merge (ADR 0024).

What does distinguish them is the **Netlify build log**, which the owner can read directly:

| Declared value | Line the build prints |
| --- | --- |
| below the repository contract | `Netlify deploy-preview database contract is <declared> and the application requires <repository>: hosted database preview unavailable until the development rollout applies it.` |
| equal to the repository contract | the ordinary verified line, with no "unavailable" clause |
| above the repository contract | the build **fails**: a database ahead of the application is a real mismatch in every context |

Two operational consequences, and the first is already live — contracts 98–103 landed after the declaration moved to 97, so previews are printing the "unavailable" line right now. The rollout that blocked it is done, so moving the declaration to 103 is now the correct next owner action:

1. Every new contract puts the non-production declaration behind again until development is rolled out and Netlify is updated after it. That is the normal cycle, not a fault, and it is why nothing here treats a trailing preview as a failure.
2. The declaration must never be raised *ahead* of the repository contract in any context, and never raised at all for `production`, which stays at 63 with a fatal gate.

`tests/scripts/documentationContractFreshness.test.ts` holds the part that is mechanical: this table and [`netlify-deploy-access.md`](netlify-deploy-access.md) must state the same values, production must stay at 63 in both, and no context may be declared ahead of the repository contract. Nothing in this repository can confirm what Netlify actually carries.

## Contracts 64–105

- **64:** Cup winner deletion semantics.
- **65:** Stage C1 competition-season foundation.
- **66:** C1b game catalogue and memberships.
- **67:** Matchweek lock scope.
- **68:** Season fixtures.
- **69:** Season predictions.
- **70:** Season scoring SQL parity.
- **71:** LMS pick resolution.
- **72:** LMS persistence.
- **73:** LMS round conclusion and season exhaustion.
- **74:** Season Cup rules.
- **75:** Neutral Cup points source.
- **76:** Neutral Cup settlement source.
- **77:** Season Cup sources.
- **78:** Circle-method season Cup league schedule.
- **79:** Shared Cup-store competition domains.
- **80:** Season matchweek card lock resolution.
- **81:** Season matchweek card status and submission-outcome storage.
- **82:** The matchweek card is not pre-filled (ADR 0012 amendment).
- **83:** Recurring season matchweek scheduler.
- **84:** LMS eligibility and auto-assignment parity.
- **85:** LMS result-to-outcome rule and season replay.
- **86:** Season LMS selection made possible (participation check accepts either fixture link).
- **87:** The mandatory used-list reset made storable (club uniqueness scoped to a used cycle).
- **88:** Lock-time auto-assignment for a missed season LMS pick, behind a narrowed server-only lock exception.
- **89:** The season LMS settlement job — replay from results, the entrant-state projection, and an hourly cron tick.
- **90:** The season Main Predictor score store, at matchweek granularity.
- **91:** Matchweek settlement parity — what each fixture on a card means for scoring, and whether the matchweek may settle.
- **92:** The replay link — which fixture an abandoned match handed its slot to, making `carried_to_replay` reachable from stored data.
- **93:** The season Main Predictor scoring job — the first thing that writes a season points total.
- **94:** `standings.ts` SQL parity — the season table, ranked.
- **95:** The bounded season leaderboard read — the first season RPC a browser role may call, limited to league co-members.
- **96:** Cup tie refusal order — a parity drift found by differential sweep, corrected in both languages.
- **97:** Server-only provider-response custody and strict decoder evidence. Committing it deploys nothing, configures no credential and calls no provider.
- **98:** The Cup RPC layer stops reading a tournament relation. `admin_settle_predictor_cup_round`, `submit_cup_penalty_number` and `get_my_cup` took the Penalty Number target and its lock instant straight from `bonus_window_fixtures ⋈ matches`, so a season Cup round would have summed a target of **zero** and refused every Penalty Number submission. Both facts now come from a tournament limb, a season limb and a neutral combiner, the same shape contracts 75–77 used.
- **99:** An `invalid` automatic-submission outcome must say why. The CHECK's refusal branch ended in `char_length(btrim(failure_message))`, which is NULL for a null message — and a CHECK rejects only FALSE — so the constraint guaranteeing a reason accepted a refusal carrying none, on an immutable table where such a row could never be corrected. Added **validated**: the ADR 0025 precondition audit found the table empty in development and production.
- **100:** REL-001. `recompute_tournament_scores` already took a tournament advisory lock, but confirming a result fires **two** after-row triggers on `matches` and PostgreSQL fires them in name order — so `recompute_bonus_scores_on_result` ran the Bonus Games delete-and-rederive **first, holding no lock at all**. Both `predictor_internal` rederive functions now take the same transaction-scoped lock on the same key, placed inside the functions so the guarantee does not depend on trigger order.
- **101:** Euro post-lock reveal stops gating on shared leagues (ADR 0025 decision 4). `get_rival_entry` and `get_h2h_rank_history` lose the gate outright; `get_player_profile` gains a lock condition as it loses the league one, because it had no lock gate on access and deleting the league gate alone would have widened pre-lock access. `get_league_match_picks` stays league scoped and contract 95 is untouched.
- **102:** Predictor Championship split-stage persistence. Groups identify `initial` or `split` phase and split groups retain their initial parent; membership is phase-aware so original and split rows coexist; `stage = 'split'` fixtures carry a group and the overall Cup matchday. No points are copied into a starting total. Existing tournament reads remain on the initial roster and knockout authorities explicitly accept only playoff or knockout stages.
- **103:** A competition can happen more than once (ADR 0025 decision 1, prerequisite). `unique (tournament_id, game_key)` was an *availability* key doing an *instance* row's job, which is why a restart was unrepresentable rather than merely unimplemented. It becomes one partial key over the live **public** instance plus one live-row-per-series key, so independent private series coexist; `bonus_competitions` gains explicit public/private scope, season/game-pinned lineage and a `completion_reason`. Nothing in it can create a second instance — that is contract 106, after contracts 104–105 close the caller and Cup-split prerequisites.
- **104:** The ten measured tournament+game callers now resolve instance identity explicitly. Locks, recomputation and compatibility league creation require the live public row. Read surfaces use one internal current-public resolver: live first, otherwise the latest terminal public result, so a successor hides its predecessor without making final Cup/LMS results disappear. Contract 102's initial-phase Cup membership filters remain intact. No restart is created until contract 106.
- **105:** Predictor Championship split ancestry and continuing standings. Every split member must have an initial membership in the child group's single parent, populated children cannot change parent, and source membership cannot move or disappear. `cup_split_group_tables` derives table and tiebreak totals from settled initial and split fixtures together, so later corrections move the continuing table and no copied starting total can drift.

Contracts 64–103 are applied to development; contracts 104–105 are pending there. None is authorised for production merely to remove the intentional contract gap.

## Pending hosted work

1. Re-read `main`, the development machine record and open migration PRs before every hosted change; never infer current state from an older report.
2. Apply every later contract to development only through the guarded rollout workflow and update the development machine record from fresh postflight evidence. Contracts 87 and 88 were applied by fast-lane run 30906915108, contract 89 by run 30911943023, contracts 90 and 91 by run 30916033941, contracts 92 and 93 by run 30920330240, contracts 94 and 95 by run 30923985137, contract 96 by run 30927288358, contract 97 by run 30931550512, and **contracts 98–103 together by run 30959460638**, all on 4 August 2026. Development is verified at 103; contracts 104–105 are the pending development migrations.

   Contract 103 briefly had no lane at all. `scripts/check-migration-additive.mjs` refused it for `drop trigger`, and the fast lane derives its own pending list, so refusing one contract refused the whole batch — while `stage-c1-development-rollout.yml`, the documented fallback, is pinned to contract 65 by name, file SHA and confirmation phrase and cannot carry anything else. The refused statement was `drop trigger if exists prepare_competition_lineage` immediately followed by `create trigger`, the house form used by sixteen migrations, re-creating a trigger the same migration had just introduced. The checker now treats a drop as structural **only** when the very next statement re-creates the same trigger on the same table, reports the pairing rather than carrying it silently, and leaves every unpaired drop destructive. Contract 81 had already met this collision and worked around it by omitting the guard; the comment at `20260804093000_season_card_status.sql:173` describing that workaround is now historical, and the migration is applied so it stays as written.
3. The Netlify `dev`, branch-deploy and deploy-preview declarations moved 86 → 97 on 4 August 2026, owner-reported; read the corroboration note above before relying on it. They trail development at 103 by six and the repository at 105 by eight. The precondition that they move only **after** development is rolled out is satisfied — run 30959460638 applied 98–103 — so moving them to 103 is unblocked and is the next owner action here.
4. Keep production Supabase and the production Netlify declaration at 63 until a separately scoped, explicitly approved milestone release.
5. Keep non-production Netlify deploys protected by team login and use the repository's protected-preview verification gate.
6. Do not use the historic `euro28-predictor-dev` Netlify project.

## Next implementation boundary

The first provider rehearsal is one bounded non-production request whose exact raw response and processing evidence are verified without writing any official fixture, result, lock, score, total, rank or standing. If authentication material is unavailable, stop after deployment rather than weakening the boundary.

## Related authority

- [`netlify-deploy-access.md`](netlify-deploy-access.md)
- [`../quality/current-status.md`](../quality/current-status.md)
- [`../../AGENTS.md`](../../AGENTS.md)
- [`../../config/deployment-contract.json`](../../config/deployment-contract.json)
- [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json)
- [`../adr/0024-development-environment-operating-model.md`](../adr/0024-development-environment-operating-model.md)
