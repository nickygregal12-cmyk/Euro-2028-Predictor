# Hosted migration inventory and rollout status

This is the operational migration inventory. Machine-readable hosted state is authoritative in [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json) and [`../../config/production-hosted-contract.json`](../../config/production-hosted-contract.json); repository contract is authoritative in [`../../config/deployment-contract.json`](../../config/deployment-contract.json). Historical rollout reports are evidence only.

## Current state — 9 August 2026 (fourth entry)

Contracts 138 and 139 were applied to hosted Development by guarded fast-lane run **31312456909** from exact `main` `d05d469` and independently verified: 139 rows, newest `20260809090000`, the three new RPCs present, no browser grant on the acknowledgement record, and both reads driven against real Development data. That verification also produced the first live evidence of the ingestion chain: **233 provider responses consumed, 2 official results written by the provider**, and 12 fixtures held by an unmapped SportMonks status token which contract 138 now makes visible. Contract 140 (`20260809100000_leave_eligibility_read.sql`) and contract 141 (`20260809110000_season_club_form.sql`) are the two now pending for Development; both are additive. Production remains at contract 132 and is untouched.

## Superseded — 9 August 2026 (third entry)

Contract 137 was applied to hosted Development by guarded fast-lane run **31307808667** from exact `main` `3a8fb21`, and independently verified: 137 rows, newest `20260809070000`, and **all 32 real clubs now resolve to a club identity** where 29 did before. Contract 138 (`20260809080000_provider_review_queues.sql`) and contract 139 (`20260809090000_season_fixtures_read.sql`) are the two now pending for Development; both are additive. Production remains at contract 132 and is untouched.

## Superseded — 9 August 2026 (second entry)

Contracts 134, 135 and 136 were applied to hosted Development by guarded fast-lane run **31306831576** from exact `main` `67322a6`, and independently verified by reading the Development migration ledger: 136 rows, newest `20260809060000`, with contract 135's six relations holding no browser grant, its consumption job scheduled, and contract 136's reference populated. **That verification also found a defect**, which is the reason this entry exists: 29 of 32 real Development clubs resolved to a club identity and three did not. Contract 137 (`20260809070000_club_name_normaliser_fix.sql`) corrects it and is now the only migration pending for Development. Production remains at contract 132 and is untouched.

## Superseded — 9 August 2026 (first entry)

The repository candidate is **contract 136**. Hosted Development remains verified at **contract 133** and hosted Production at **contract 132**, so three migrations are pending for Development: contract 134 (`20260809030000_rate_limit_events_client_revoke.sql`, privileges only), contract 135 (`20260809050000_provider_result_authority.sql`) and contract 136 (`20260809060000_club_identity_reference.sql`). All three are additive — `check-migration-additive.mjs` accepts each — so the guarded development fast lane is the correct lane. Production is further behind and follows only through the separately controlled Production process; no Production promotion is authorised by this entry.

Contracts 135 and 136 are the first migrations in this set that change what a player sees: 135 lets a provider result award points without a human typing it, and 136 changes what the matchweek card returns for a club. The rollout should confirm both against a real Development matchweek rather than only confirming that the migrations applied.

## Superseded — 8 August 2026

The repository candidate is **contract 134**. Hosted Development is verified at **contract 133**, ending at `20260808003000_private_season_cup_player_reads.sql`; hosted Production remains independently verified at **contract 132**, ending at `20260807210812_provider_initial_fixture_approval`. Contract 134 (`20260809030000_rate_limit_events_client_revoke.sql`) is therefore the only migration pending for Development, and it is additive and privileges-only. Production is two behind and needs Contract 133 as well; it follows only through the separately controlled Production process.

The Contract 132 machine records had remained at 131 after the hosted rollouts, even though both migration ledgers had advanced. They were reconciled on 8 August 2026 from independent read-only ledger checks. This current section and the table below are live operating state; the dated superseded sections below remain historical evidence and are intentionally not rewritten.

## Superseded — 5 August 2026

The repository was at **contract 120** and development at **115**, with **five migrations pending** — contract 116 (`20260805120000_season_lms_round_read.sql`, the season Last Man Standing round read), contract 117 (`20260805130000_provider_fixture_revision_import.sql`, the provider kickoff revision import), contract 118 (`20260805140000_neutral_window_fixture_facts.sql`, the neutral window fixture facts) contract 119 (`20260806090000_rescheduled_fixture_lock.sql`, the rescheduled-fixture lock) and contract 120 (`20260806100000_season_cup_phase_read.sql`, the Championship phase and continuing-table read).

Contract 118 is the first in this set to change an EXISTING browser-reachable function rather than only add one — it redefines `get_bonus_games`, so the rollout should confirm the tournament path returns what it returned before, which `169_neutral_window_fixture_facts.sql` asserts in CI.

**The fast lane fails before it applies anything, and the cause is now measured rather than inferred.** Contract 119 stopped that step swallowing the CLI's own error, and the first dispatch after it — run `31050470866` on `f648037`, 5 August 2026 — printed this:

```
failed to connect to postgres: failed to connect to
  `host=aws-1-eu-west-2.pooler.supabase.com user=postgres.iouzoutneyjpugbbtdem database=postgres`:
  failed SASL auth (FATAL: password authentication failed for user "postgres" (SQLSTATE 28P01))
```

**The error text is measured. The cause is still not established, and this document has now guessed it twice.** First as "the runner's own Postgres connection", then — once contract 119 printed the CLI text — as a stale password in `SUPABASE_DEV_DB_URL`. The owner rejected the second reading, and the reasoning holds against it:

**a repository secret is one stored value, and the same value succeeded at 17:29 and failed at 20:08 on 5 August 2026** (run `31030063029`, which applied contracts 114 and 115). "The password has always been wrong" cannot explain a run that worked three hours earlier. Either the value was edited between those times, or what it points at changed underneath it.

What the surviving evidence rules out, checked rather than assumed:

- **the workflow** — byte-identical between the successful commit `16ce4d5` and the first failing commit `8636bfb`; contract 119 only changed error printing, and only after the failures began;
- **the project** — `ACTIVE_HEALTHY`, not paused or restoring, and its migration ledger holds exactly 115 rows ending at `20260805110000`, so development is where this table says it is;
- **anything applied here** — no migration in the repository contains `alter role`, `alter user` or a password change;
- **PostgreSQL itself** — its logs carry no authentication failures at all, which is what a rejection at the pooler looks like, because such a connection never reaches the database.

**Why the message misleads.** Supavisor answers `28P01` for a tenant it cannot find as well as for a password it rejects, and does not distinguish them. So a URL aimed at the wrong pooler cluster is indistinguishable, in this output, from a bad credential — and both `aws-0-eu-west-2` and `aws-1-eu-west-2` are live, distinct clusters. Two explanations therefore fit equally: the secret was edited during the vault-secret and real-league-data work that evening, or the project's pooler tenant moved.

The fast lane settles it rather than inviting a third guess: on failure it connects with a password that is *known* to be wrong, to both the configured cluster and its sibling. **That probe has now run** — run `31057118098` on `0af62d97`, 5 August 2026:

```
--- configured cluster, with a KNOWN-WRONG password ---
aws-1-eu-west-2.pooler.supabase.com:5432
  FATAL:  password authentication failed for user "postgres"

--- sibling cluster aws-0-eu-west-2.pooler.supabase.com, same known-wrong password ---
  FATAL:  (ENOTFOUND) tenant/user postgres.iouzoutneyjpugbbtdem not found
```

**The host is right and the credential is what is being rejected.** `aws-1` recognises the tenant — it answers a bad password with an authentication failure rather than denying the project exists — and `aws-0` states outright that it has never heard of it. So the wrong-cluster explanation is dead, and so is the suggestion that the secret's host needs changing: it is already correct, and changing it would break a working half.

That leaves the credential, which is where this document started and was told it was wrong. Both can be true, and the distinction decides the fix:

- **the stored password is stale** — rotated in the dashboard during the vault-secret and real-league-data work that evening, and the secret never updated;
- **the stored password is correct but the URI mangles it** — a `%`, `@`, `:`, `/`, `#` or `?` in the password that is not percent-encoded is decoded by libpq into something else before it reaches Supavisor. The password a person holds is then genuinely right while the connection still fails, which is exactly how "the password isn't the issue" and this output are both true at once.

The second is consistent with the timing that the first never explained: **the same secret succeeded at 17:29 and failed at 20:08**, so something about it changed in between — and re-pasting a connection string is precisely when an encoding error is introduced.

**The owner action for both is the same**: re-copy the **Session pooler** URI from the Supabase dashboard into `SUPABASE_DEV_DB_URL`, percent-encoding any reserved character in the password. The probe re-runs automatically on the next failed dispatch, so a wrong second attempt reports itself rather than needing another investigation.

Nothing was applied: the failure precedes the snapshot and the push, and development is unchanged at 115 — verified independently.

Contract 112 was pending for part of 5 August 2026 — the first time in this sequence the two were not level — and the ordinary fast-lane rollout closed it the same day. Contract 113 went the same way, and contracts 114 and 115 closed together. **One thing the contract 115 rollout established is a negative**, recorded here because it is the blocker rather than a footnote: two probes through `net.http_post` with a deliberately wrong `apikey` both returned HTTP 500 `function_not_configured`, detail `Missing named Supabase secret key: provider-poll`. A resolving key would have returned 401. No provider was contacted and no credential was spent, because the Edge Function checks its own configuration before it reads the request. The database can now call out; the Edge Function cannot yet authorise the caller.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **134** | Contract 117 is the repeatable path a provider kickoff change takes to the fixture, `20260805130000_provider_fixture_revision_import.sql` — it revises an existing kickoff, creates none, deletes none and never writes `competition_round_id`. Beneath it: contract 116 is the season Last Man Standing round read, from a concurrent session. Beneath that: Contract 115 makes the database a provider kickoff change takes to the fixture, `20260805120000_provider_fixture_revision_import.sql` — it creates no fixture, deletes none and never writes `competition_round_id`. Beneath it: Contract 115 makes the database able to call the provider at all, `20260805110000_provider_poll_dispatch.sql` — `pg_net` was available on the project and **not installed**, so PostgreSQL could make no outbound HTTP request, and the deployed `provider-poll` Edge Function had a scheduler that could not reach it. It installs the extension and attempts to revoke the `net` schema from `anon`, `authenticated` and `service_role` and, where the platform owns pg_net, reports that it could not — measured on hosted development, `postgres` is neither superuser nor a member of `supabase_admin`, so it cannot change platform grants; what it enforces instead is that no browser-reachable function in an exposed schema calls into `net`, which is the actual path from a session to an outbound request, then drives the Edge Function from `pg_cron` every five minutes at each target's declared cadence. It records no poll target and imports no fixture, so on application the job runs and does nothing. Beneath it: Contract 114 gives the season matchweek card its bounded browser path — one read and three writes scoped to the caller's own entry, `20260805100000_season_card_rpcs.sql`. Beneath that: Contract 113 is the round play window, `20260805090000_round_play_windows.sql` — the authority `fixtureReassignment.ts` resolves a moved kickoff against and never had. Beneath it: | Contract 112 is the provider identity map, `20260805080000_provider_entity_map.sql` — the fact every ingestion step was blocked on. Beneath it: | Contract 108 refuses any successor round that opened or locked before its predecessor finished, through `20260805040000_successor_window_calendar_guard.sql`; contract 109 supplies the calendar itself — the next eligible league round, the successor's windows generated from it exactly once, and the hourly job that drives the restart — through `20260805050000_lms_successor_window_scheduler.sql`, completing ADR 0025 decision 1; contract 110 gives the season Predictor Championship rounds it can be played over, through `20260805060000_season_cup_round_calendar.sql` | MERGED AND ROLLED OUT |
| Development Supabase `iouzoutneyjpugbbtdem` | **133** | Development Fast Lane run `31276698062` / #46 from exact `main` `1138d0967bcff4168680980dc3352517f1e9c772` proved the sole pending migration additive, applied `20260808003000_private_season_cup_player_reads.sql`, and postflight confirmed Contract 133; independent read-only verification confirmed the ledger tip. | LEVEL WITH CONTRACT-133 REPOSITORY CANDIDATE |
| Production Supabase | **132** | Independent read-only ledger verification on 8 August 2026 ends at `20260807210812_provider_initial_fixture_approval`; application promotion remains separately controlled. | TWO BEHIND CONTRACT-134 REPOSITORY CANDIDATE — Contracts 133 and 134 both pending |
| Netlify `euro28predictor` non-production contexts | **132 hosted declaration** | Direct Netlify read on 8 August 2026: `dev`, `branch-deploy` and `deploy-preview` point to Development, each declare 132, and Team SSO protects all contexts. `dev-server` remains blank and fails closed. A declaration may intentionally trail its hosted database but must never lead it. | TRAILS HOSTED DEVELOPMENT 133 BY ONE; VALID UNDER THE GUARDED TRAILING-DECLARATION MODEL |
| Netlify `euro28predictor` production | **132 hosted declaration** | Direct Netlify read on 8 August 2026: production points to Production Supabase and declares 132; Team SSO protects production. The published artifact is still the 30 July `8244b722…` Contract-63-era bundle, so declaration alignment is **not** an application deployment. | LEVEL WITH HOSTED PRODUCTION; PUBLISHED APPLICATION STILL OLD |

The historic Netlify project `euro28-predictor-dev` is out of scope and must not be inspected as current state, configured or deployed to.

### Historical Netlify declaration evidence — 5 August 2026

The section below is retained as dated evidence of how the previous 97/63 declarations were verified and how the trailing-preview gate behaves. Its old numeric actions are **not current instructions**; the live table above and [`netlify-deploy-access.md`](netlify-deploy-access.md) now carry the current 132/132 declarations and published-artifact distinction.

### Corroborating the Netlify declaration

The Netlify contract declaration was for a long time the one row in this table with **no repository-side read path**, and the note below was written under that constraint. On 5 August 2026 it was **read directly** for the first time, through a Netlify connector available to an agent session: `dev`, `branch-deploy` and `deploy-preview` each declare `EURO28_DEPLOYED_DB_CONTRACT=97` and `production` declares `63`, confirming the owner report exactly. Two things about that read are worth keeping in mind before treating it as a standing capability. It is a *session* capability, not a repository one — **CI still cannot see these values**, so every mechanical guard below remains as necessary as it was; and the connector has been intermittent, so a future session may not have it. Treat a direct read as strong evidence when it is available and fall back to the build-log method below when it is not. `EURO28_DEPLOYED_DB_CONTRACT` is a Netlify team-console environment variable; CI never sees it, and the protected-preview gate reads only the *commit status*, not the build log. So a green `netlify/euro28predictor/deploy-preview` status does **not** distinguish a current declaration from a stale one — `scripts/validate-deployment-contract.mjs` deliberately waves a *trailing* non-production context through, because a schema-advancing pull request cannot make its preview go green before merge (ADR 0024).

What does distinguish them is the **Netlify build log**, which the owner can read directly:

| Declared value | Line the build prints |
| --- | --- |
| below the repository contract | `Netlify deploy-preview database contract is <declared> and the application requires <repository>: hosted database preview unavailable until the development rollout applies it.` |
| equal to the repository contract | the ordinary verified line, with no "unavailable" clause |
| above the repository contract | the build **fails**: a database ahead of the application is a real mismatch in every context |

The **5 August interpretation** was that contracts 98–110 had made the non-production declaration trail 97 and that the next update would move it to the then-verified Development level 110 while Production remained 63. Those numbers and that action are retained only to explain the evidence of that day; they were superseded by later hosted rollouts and the fresh 8 August Netlify read above.

The durable rules that survive the old numbers are:

1. A new repository contract may leave a non-production declaration trailing until the matching hosted Development rollout is verified. A trailing preview is an intentional pre-rollout state, not permission to guess a higher hosted value.
2. No Netlify declaration may be raised ahead of the **matching hosted database**. Production is separately controlled and a matching database/declaration still does not mean the application artifact has been rebuilt or published.

`tests/scripts/documentationContractFreshness.test.ts` now holds the mechanical part without a magic baseline number: the non-production documentation values must match the Development hosted machine record, the production documentation value must match the Production hosted machine record, the two documentation tables must agree, and no context may be declared ahead of the repository contract. CI still cannot query the Netlify team-console value itself, so a fresh session/platform read remains required to prove the external configuration actually matches those records.

## Contracts 64–111

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
- **103:** A competition can happen more than once (ADR 0025 decision 1, prerequisite). `unique (tournament_id, game_key)` was an *availability* key doing an *instance* row's job, which is why a restart was unrepresentable rather than merely unimplemented. It becomes one partial key over the live **public** instance plus one live-row-per-series key, so independent private series coexist; `bonus_competitions` gains explicit public/private scope, season/game-pinned lineage and a `completion_reason`. Nothing in it can create a second instance — that is contract 107, after contracts 104–106 close the caller, Cup-split and terminal-awareness prerequisites.
- **104:** The ten measured tournament+game callers now resolve instance identity explicitly. Locks, recomputation and compatibility league creation require the live public row. Read surfaces use one internal current-public resolver: live first, otherwise the latest terminal public result, so a successor hides its predecessor without making final Cup/LMS results disappear. Contract 102's initial-phase Cup membership filters remain intact. No restart is created until contract 107.
- **105:** Predictor Championship split ancestry and continuing standings. Every split member must have an initial membership in the child group's single parent, populated children cannot change parent, and source membership cannot move or disappear. `cup_split_group_tables` derives table and tiebreak totals from settled initial and split fixtures together, so later corrections move the continuing table and no copied starting total can drift.
- **106:** DATA-009. Contract 104 gave the two Bonus Games rederive functions the LIVE resolver, which filters `completed_at is null`, and each guards `if v_competition_id is null then return; end if;` — so once a competition completed, a corrected result resolved nothing and the rederive silently did nothing. Both now resolve through `current_public_competition_id`, which falls back to the most recently completed public instance. This mirrors the season path, where contract 89 already reopens a completed competition on a correction rather than freezing it. Rederiving scores is not reopening: `completed_at` and `completion_reason` are left untouched, which belongs to the restart driver at contract 107.
- **107:** The Last Man Standing restart, as a lifecycle transition (ADR 0025 decision 1) — the driver contracts 103 to 106 cleared the way for. A wiped-out competition completes as `no_winner_restarted`; a successor is created in the same series at the next sequence, naming its predecessor; the immutable setup is carried across and every entrant re-enters; selections, used cycles, entrant-state projections, windows and audit history are deliberately not copied, because a restart resets the competition. Idempotent under a series-scoped advisory lock, so a retrying job returns the existing successor rather than forking. **Window generation is deliberately not included** — no committed migration creates a `bonus_competition_windows` row, so "the next eligible league round" has no calendar authority to read yet; the successor is inert until that lands as its own contract.
- **108:** The guard that deferral needed. `scripts/bonus-games/publish-catalogue.sql` is the only committed writer of `bonus_competition_windows`, is documented as safe to rerun, runs in CI on every Browser E2E job, and targets the **live** competition — which after a restart is the successor. A rerun mid-tournament writes rounds that have already locked onto a competition that has only just started. `recompute_lms_for_tournament` settles them at once; no entrant has a selection, so ADR 0013's whole-round wipeout rule carries the field every round and the final round crowns **everybody champion** — from rerunning a script whose own header called it safe. None of the three components is wrong on its own, which is why the fix sits between them: a successor may not hold a round that opened or locked before its predecessor completed. Deliberately narrow — first instances are exempt, so the Euro catalogue is untouched, and rounds still ahead of the restart are permitted because the re-entered field can play them. It schedules nothing and does not relieve the future scheduler of deciding where a successor's calendar starts.
- **109:** The successor's calendar, and the end of ADR 0025 decision 1. The deferral at contract 107 rested on "the next eligible league round" having no authority to read. It has one, and it was already built: contract 83's `season_matchweek_lock_at` derives a round's instant from the earliest kickoff minus the game's own buffer and returns null when the fixture list is incomplete; `game_definitions` supplies that buffer per game; `competition_rounds` supplies the ordering. So eligibility is the earliest-locking league matchweek whose instant is derivable and falls after the predecessor ended — contract 108's boundary, reached from the other side. Rounds are ordered by that instant rather than by league number, so a rescheduled fixture cannot produce a window that opens after it locks. Fixtures are correlated back through the insert's returned sequence, not by matching labels. The job is separate from settlement as the ADR requires, and it has to be: settlement's else branch **un-completes** a competition awaiting restart, so there is no lifecycle state to search for and the job reads the latest `season_lms_settled` report instead — skipping any competition that already has a successor, because the audit trail is immutable and would otherwise re-trigger for ever.
- **110:** The season Predictor Championship gets rounds it can be played over. Contracts 74–79 made the shared Cup machinery competition-neutral, 102 persisted the split as a distinct phase and 105 derived the continuing table across both — and not one of them could put a fixture in the database. `bonus_cup_fixtures.window_id` is `NOT NULL`, and **nothing in the repository created a window for a season competition**: until contract 109 the only committed writer of `bonus_competition_windows` anywhere was the Euro catalogue script. That is why the phase-transition driver could not be built, and this is the prerequisite. It schedules N rounds from the next eligible league matchweeks through the resolver contract 109 introduced, **refuses** a season that cannot supply the whole format rather than truncating it — a Championship played over four rounds of a five-round format has a final table nobody can reconstruct — and **appends** rather than owning the calendar, so the split phase is scheduled on the same competition at a later boundary with the sequence continuing. It has no caller yet; the phase driver is the next contract.
- **111:** A season Predictor Championship is launched. A read-only sweep found all six of its authorities called by **zero** other functions — complete rules, competition-neutral sources, phase-aware storage and a derived continuing table, with nothing able to create a group, member or fixture. This runs the first three: the launch threshold, the format selector and the circle-method schedule, onto contract 110's rounds. **The public threshold and the single-group shape do not overlap** — the public Championship opens at a hundred entrants, and a hundred-entrant field always takes the multi-group shape, which stops at twenty. So the shape this drives belongs to private, organiser-created competitions, and the public Championship waits for the multi-group driver. The multi-group shape is refused by name rather than half-drawn. Settlement still has no caller, and the phase driver comes after it, because the split ranks entrants by a table derived from settled fixtures.

Contracts 64–111 are all applied to development, with nothing pending. None is authorised for production merely to remove the intentional contract gap.

## Pending hosted work

1. Re-read `main`, the development machine record and open migration PRs before every hosted change; never infer current state from an older report.
2. Apply every later contract to development only through the guarded rollout workflow and update the development machine record from fresh postflight evidence. Contracts 87 and 88 were applied by fast-lane run 30906915108, contract 89 by run 30911943023, contracts 90 and 91 by run 30916033941, contracts 92 and 93 by run 30920330240, contracts 94 and 95 by run 30923985137, contract 96 by run 30927288358, contract 97 by run 30931550512, and **contracts 98–103 together by run 30959460638**, all on 4 August 2026, then **contracts 104 and 105 together by run 30968263589**, **contract 106 by run 30984799464**, **contract 107 by run 30988219931** **contract 108 by run 30993039183** **contract 109** on `41fa111` and **contract 110** on `a6ef054`, all on 5 August 2026. Nothing is pending: development and the repository are level at 111.

   Contract 103 briefly had no lane at all. `scripts/check-migration-additive.mjs` refused it for `drop trigger`, and the fast lane derives its own pending list, so refusing one contract refused the whole batch — while `stage-c1-development-rollout.yml`, the documented fallback, is pinned to contract 65 by name, file SHA and confirmation phrase and cannot carry anything else. The refused statement was `drop trigger if exists prepare_competition_lineage` immediately followed by `create trigger`, the house form used by sixteen migrations, re-creating a trigger the same migration had just introduced. The checker now treats a drop as structural **only** when the very next statement re-creates the same trigger on the same table, reports the pairing rather than carrying it silently, and leaves every unpaired drop destructive. Contract 81 had already met this collision and worked around it by omitting the guard; the comment at `20260804093000_season_card_status.sql:173` describing that workaround is now historical, and the migration is applied so it stays as written.
3. The Netlify `dev`, branch-deploy and deploy-preview declarations moved 86 → 97 on 4 August 2026, owner-reported; read the corroboration note above before relying on it. They now trail both by thirteen. The precondition that they move only **after** development is rolled out is satisfied — development is at 110 — so moving them to **110** is unblocked and is the next owner action here. Note that setting the variable remains an owner action: the direct read recorded above proves the declaration can now be *observed* from an agent session, which is not the same as being authorised to change it.
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

## Contract 132 — provider initial fixture approval

`20260807210812_provider_initial_fixture_approval.sql` is the contract 132 migration. Promote it Development first and verify the proposal table, staging helper, authenticated admin approval/rejection RPCs, grants, and empty-season guard before applying the identical migration to Production. Production provider secrets remain an environment-level prerequisite for live ingestion and are not stored in repository migrations.

> **Contract 133 boundary (8 August 2026):** Contract 133 follows the directly verified hosted Contract-132 baseline and adds only bounded player reads for season Predictor Championship instances. Development must receive Contract 133 through the guarded fast lane before any separate Production promotion is considered.
