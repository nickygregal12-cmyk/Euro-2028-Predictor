# Hosted migration inventory and rollout status

> **Contract 144 repository candidate — provider team profile foundation (9 August 2026):** `20260809140000_provider_team_profile_foundation.sql` adds `predictor_internal.provider_team_profiles` and a definer writer granted to no role at all. `provider_entity_map` stays the identity authority; nothing here writes a fixture, score, status, lock, settlement or progression. A Development backfill is a separate `workflow_dispatch` operator action that refuses unless Development already holds contract 144, and refuses the Production project by name.

> **Contract 143 repository candidate — EURO-002 publication state (9 August 2026):** `20260809130000_euro_publication_state.sql` adds the single server-owned Euro 2028 publication lifecycle ADR 0026 requires. It defaults to `hidden`, exposes only a bounded state/change-time read, restricts adjacent transitions to a signed-in `super_admin` and records actor/reason history append-only. This is a repository contract only: it claims **no** Development or Production rollout, and it does **not** publish Euro 2028 or address `EURO-001`.

This is the operational migration inventory. Machine-readable hosted state is authoritative in [`../../config/development-hosted-contract.json`](../../config/development-hosted-contract.json) and [`../../config/production-hosted-contract.json`](../../config/production-hosted-contract.json); repository contract is authoritative in [`../../config/deployment-contract.json`](../../config/deployment-contract.json). Historical rollout reports are evidence only.

## Current state — 11 August 2026 (thirty-eighth entry)

**Production is at contract 174.** Guarded rollout run [31534872592](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/31534872592) applied contracts 172, 173 and 174 from exact `main` `1965bf9`, on the owner authorisation recorded in the thirty-seventh entry. Backup `31532241788` and rehearsal `31533963740` were verified **by the rollout against the API** rather than asserted by whoever dispatched it; the dry run asserted the three files by name with `diff`; and `check-migration-additive.mjs` ran as a **gate**. Backup, rehearsal and rollout all ran from the same commit.

**The rehearsal earned its place, and it vindicated one design decision in particular.** It reported `Exactly three jobs added (0 -> 3)`: the disposable target restored from Production's dump held **zero** cron jobs, exactly as the file anticipated, because `supabase db dump` does not carry managed extension state. Had the rehearsal asserted Production's absolute "ten", it would have failed there for a purely environmental reason and sent somebody hunting a defect that did not exist. It also confirmed every data count unchanged.

**Confirmed independently of the workflow, on a separate read-only connection.** The ledger **names** `20260811230000 action_centre_and_reminder_drivers`, `20260811233000 matchweek_settled_actions` and `20260811234000 provider_calendar_change_proposals`; the total is 174.

**`cron.job` on Production now holds ten, read in full.** The three new ones:

| Job | Schedule | Command as stored |
| --- | --- | --- |
| `player-action-centre-generate` | `*/15 * * * *` | `select public.process_player_action_items();` |
| `player-reminder-schedule` | `5-59/15 * * * *` | `select public.process_reminder_schedule();` |
| `player-reminder-reclaim-stalled` | `45 * * * *` | `select public.reclaim_stalled_reminders();` |

The seven that were already there are unchanged and still active. **Nothing sends**: each new command carries an **empty argument list**, so `process_reminder_schedule` keeps its `dry_run = true` default; no job anywhere names `claim_due_reminders`; none passes `false`; and `reminder_deliveries` holds no row whose `dry_run` is anything but true. All of that is read off the installed table rather than inferred from the migration text.

**Measured over the first hour on Production, rather than predicted.** All three jobs ran repeatedly with **zero failures**, and the action centre wrote **two real `lms_pick_due` items** for two live Last Man Standing entries — Production has an open LMS round where Development had none, so it exercised a generator Development could not. Both items are open and, unlike Development's recaps, both **carry a deadline**, so the "no deadline" reason that keeps Development quiet does not apply here.

**`reminder_deliveries` is nevertheless still empty, and three independent things are keeping it that way.** Each alone would suffice:

1. the two deadlines are **9 and 10 days out**, far outside contract 163's twenty-four hour lead, so neither is due for a reminder yet;
2. `profiles.reminder_emails` is **`false`** for the only account, so contract 163 would skip it regardless;
3. `process_reminder_schedule` is scheduled with **no arguments**, so `dry_run` stays true, and **`claim_due_reminders` — the function a sender would call — is scheduled nowhere at all.**

Only the third is a property of this contract; the first two are circumstances that will change. **When a deadline does come inside the lead window and an account has opted in, the scheduler will begin writing `reminder_deliveries` rows carrying `dry_run = true`.** That is the designed behaviour and still sends nothing, because nothing claims them — but it is the point at which "the table is empty" stops being the evidence, and `dry_run` plus the absent claim job become the whole of it. `SITE-007` still blocks the sender on the brand decision.

**What is now different about Production, stated plainly.** The action centre generates `player_action_items` on a timer there from now on, and contract 174's detector runs inside the already-scheduled `consume_provider_responses` every five minutes. `provider_calendar_change_proposals` came up with **zero** rows, row-level security on and no grant to any browser role; detection writes **no** fixture, and only `admin_decide_provider_change_proposal` may add or void one, gated on `require_competition_admin` and refusing any fixture that already carries a result.

**And what did not change.** `euro_publication_state()` still returns `hidden`, so contract 143 and `EURO-001` are untouched. 578 season fixtures, 1 auth user and 3 entries are unchanged, and every count captured before the apply was compared after it. No competition was launched, no Championship drawn, no Last Man Standing opened, no provider result confirmed, no fixture added or voided, and no football imported. **The deployed application remains at contract 145**, so nothing in the range is browser-reachable, and `promotionAuthorised` stays `false`.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **174** | 174 canonical migrations through `20260811234000_provider_calendar_change_proposals.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **174** | Fast-lane run `31525963941`; see the thirty-sixth entry. | LEVEL WITH REPOSITORY |
| Production Supabase | **174** | `vkfnsqdyhvtwyqkisxhk`. Guarded rollout run `31534872592`, confirmed by a separate named-row query and a full `cron.job` read. | LEVEL WITH REPOSITORY |

**Both one-shot workflows are removed in the same change that reconciles this record**, as each says in its own header. Their run ids above remain the evidence; the files were for this boundary and no other, and leaving a dispatchable production-apply workflow lying around after its boundary has passed is exactly the loaded gun the one-shot convention exists to avoid.

## Current state — 11 August 2026 (thirty-seventh entry)

**Production promotion 171 → 174 is authorised and its guarded pair is built.** The owner authorised this Production migration on 11 August 2026, in reply to a message that named this exact boundary, by instructing that the migrations be rolled out to Production. `production-171-to-174-rehearsal.yml` and `production-171-to-174-rollout.yml` are one-shot files for this boundary and no other. **This entry does not claim the rollout has run**; it records the authorisation, the pair and what was measured before either was dispatched.

**The measurement that changed how this pair is written.** Two live authorities stated that Production holds **zero** `cron` jobs — the contract 170 note and the 158→171 boundary note, the latter as "0 cron jobs before and after". Read directly from `cron.job` on `vkfnsqdyhvtwyqkisxhk` on 11 August 2026, Production holds **seven active jobs**, the same seven Development holds:

| Job | Schedule |
| --- | --- |
| `euro28-auto-submit-due-entries` | `* * * * *` |
| `season-process-due-matchweek-submissions` | `* * * * *` |
| `season-settle-due-lms-rounds` | `0 * * * *` |
| `season-settle-due-matchweek-scores` | `30 * * * *` |
| `season-restart-due-lms-competitions` | `15 * * * *` |
| `provider-poll-dispatch-due-targets` | `*/5 * * * *` |
| `provider-consume-decoded-responses` | `2-59/5 * * * *` |

The narrower claim those notes were reaching for — that the 159→171 boundary scheduled no **new** job — is true. The figure was not, and it is corrected in place in both authorities rather than deleted. **It mattered rather than being a typo:** it is precisely what would lead a reader to conclude that contract 174's detector is inert on Production, when in fact it runs inside `consume_provider_responses`, which is scheduled and active there.

**So two things about this boundary are different from every previous production rollout.**

**It is the first that schedules a job.** Contract 172's whole subject is installing the caller contracts 162, 163 and 170 each ended by recording as absent. Production will go from seven jobs to ten, and the action centre will begin writing `player_action_items` for real people. The rollout therefore asserts the safety properties against the **installed** `cron.job` table rather than against the migration text — a source assertion proves what was written, and only the table proves what is installed: no job names `claim_due_reminders`, none passes `false`, and each new job's command carries an empty argument list, so `process_reminder_schedule` keeps its `dry_run = true` default. **Nothing sends.**

**And contract 174's detector starts working immediately.** It stages append-only proposals every five minutes and writes **no** fixture; only `admin_decide_provider_change_proposal` may, gated on `require_competition_admin`, refusing any fixture that already carries a result and re-checking under the row lock. The rollout asserts the consumer calls the detector exactly once and passes **no** coverage window, because a declared span is what would let withdrawal detection propose voiding real fixtures off a partial poll. Production holds **no** decoded-unconsumed response, so it begins from new data rather than sweeping a backlog.

**One thing the rehearsal had to solve.** Contract 172 calls `cron.schedule` unconditionally, and `supabase db dump` does not carry managed extension state — so a disposable target restored from Production's dump can lack the `cron` schema entirely, and the rehearsal would have died inside `db push` with an error that says nothing about Production. The 158→171 rehearsal's own `cron.job` probe (`to_regclass(...) is null then -1`) half-anticipated this. The new rehearsal installs `pg_cron` on the disposable target explicitly, as restored fidelity with the environment being rehearsed, and compares job counts as a **delta of exactly three** rather than as an absolute, because that target does not inherit Production's seven.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **174** | 174 canonical migrations through `20260811234000_provider_calendar_change_proposals.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **174** | Fast-lane run `31525963941`; see the thirty-sixth entry. | LEVEL WITH REPOSITORY |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | **171** | Guarded rollout run `31505763706`; see the thirty-third entry. Promotion to 174 authorised, pair built, **not yet run**. | THREE BEHIND REPOSITORY |

**The application is not part of this.** The deployed site remains at contract 145, so nothing in the 172–174 range becomes browser-reachable on Production by this promotion. Application promotion is a separate, separately approved milestone.

## Current state — 11 August 2026 (thirty-sixth entry)

**The repository is at contract 174. Development is now hosted at 174. Production remains hosted at 171.** Contracts 172, 173 and 174 reached Development through the ADR 0024 additive fast lane, run [31525963941](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/31525963941), from exact `main` `09214df`. The lane derived the pending set itself and `check-migration-additive.mjs` accepted all three as a **gate**, which is what admits them to this lane at all.

**The postflight was taken independently of the workflow, on a separate read-only connection, and it NAMES rows rather than counting them.** The ledger holds `20260811230000 action_centre_and_reminder_drivers`, `20260811233000 matchweek_settled_actions` and `20260811234000 provider_calendar_change_proposals`; the total is 174 and the latest is `20260811234000`. Naming is the rule established in the thirty-third entry, where a `count(*)` against a hosted ledger returned a stale figure for roughly twenty-five minutes after a successful apply while a row-level query was already correct.

**For contract 172 the ledger is not the evidence that matters — the installed `cron.job` table is.** A migration's source assertion proves what was written; only the table proves what is scheduled. It now holds **ten** jobs, the seven that were already there plus:

| Job | Schedule | Command as stored |
| --- | --- | --- |
| `player-action-centre-generate` | `*/15 * * * *` | `select public.process_player_action_items();` |
| `player-reminder-schedule` | `5-59/15 * * * *` | `select public.process_reminder_schedule();` |
| `player-reminder-reclaim-stalled` | `45 * * * *` | `select public.reclaim_stalled_reminders();` |

**Every one calls with an empty argument list**, so `process_reminder_schedule` runs on its `dry_run = true` default. **No job anywhere in the table names `claim_due_reminders`, and none passes `false`.** Claiming is what a sender does, `SITE-007` still blocks the sender on the brand decision, and nothing sends.

**Nothing was generated by the apply.** `player_action_items`, `reminder_deliveries` and the newly created `predictor_internal.provider_calendar_change_proposals` all held zero rows immediately afterwards, the first generation belonging to the first tick rather than to the migration. The new table came up with row-level security on and no grant to any browser role.

**The first tick then ran, and it is the evidence worth having.** `player-action-centre-generate` fired at 19:15:00 UTC on 11 August 2026 and **succeeded**, writing **eight settled-matchweek recaps** for eight distinct players — the first rows either of contract 162's tables has ever held on a hosted environment, and the direct answer to the absence contracts 162, 163 and 170 each ended by recording. Nothing else generated, correctly: Development holds no open Last Man Standing round and no open matchweek window, so those two generators had nothing to write.

**Contract 173's trap is now disproven against real data rather than only in pgTAP.** All eight items carry `settled_round_id` and **none carries `round_id`**; `process_player_action_items` runs the three generators and then contract 170's expiry sweep within the same invocation, so these eight have already survived a sweep, and all eight remain open. Had the obvious spelling been used, every one would have been invalidated in the same call that created it, with both functions behaving exactly as written and the only symptom an empty inbox.

**And a recap still cannot become an email.** All eight carry a null `deadline_at`, and contract 163's scheduler selects on `deadline_at is not null`; `player-reminder-schedule` fired at 19:20:00 UTC, **succeeded and queued nothing**, and `reminder_deliveries` remains at **zero rows** — so no row exists to claim and none carries `dry_run = false`. Their `expires_at` is 18 August, seven days after settlement, through the existing sweep rather than a new path.

**The second tick then closed the remaining question.** `player-action-centre-generate` fired again at 19:30:00 UTC and succeeded: still eight items, still eight open, no duplicates. Regeneration is idempotent on hosted data because the `action_key` is derived from what the action IS, and the eight recaps have now survived **two** independent sweeps rather than the one that ran in the call that created them.

**All three jobs have now run, and all three succeeded.** `player-reminder-reclaim-stalled` reached its first hourly slot at 19:45:00 UTC and succeeded with nothing to reclaim, which is the only outcome available while `reminder_deliveries` is empty. Across the first half hour the table records six successful runs and **zero failures**, so contract 172's caller is measured as working rather than merely installed.

**Contract 174 has no backlog to sweep.** Its detector now runs inside `consume_provider_responses`, already scheduled at `2-59/5`; measured after the apply, every decoded provider response on Development is already consumed, so the detector will see only genuinely new provider data. Proposals stay pending until an administrator decides, and a proposal whose fixture already carries a result is refused at detection and again at decision under the row lock.

**Privileges landed as designed.** `generate_matchweek_settled_actions`, `detect_provider_calendar_changes` and `reminder_job_status` are executable by the owner alone. `admin_reminder_delivery_health`, `admin_provider_change_proposals` and `admin_decide_provider_change_proposal` are executable by `authenticated` alone, with no `anon` grant, and each refuses inside on `require_competition_admin()`. `process_player_action_items` remains `service_role`-only.

**Nothing football moved and no publication changed.** `euro_publication_state()` still returns `hidden`, so contract 143 and `EURO-001` are exactly as they were. No fixture, result, poll target, provider credential or Auth setting was touched, and the two poll targets are unchanged.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **174** | 174 canonical migrations through `20260811234000_provider_calendar_change_proposals.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **174** | Fast-lane run `31525963941`, independently confirmed by named rows and by reading `cron.job` in full. | LEVEL WITH REPOSITORY |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | **171** | Guarded rollout run `31505763706`; see the thirty-third entry. Contracts 172 to 174 pending. | THREE BEHIND REPOSITORY |

**Production was not touched and no authorisation for it was sought or given.** Promotion past 171 requires a separately explicit, target-specific owner authorisation naming that exact boundary. The deployed application also remains at contract 145, so nothing in the 172–174 range is browser-reachable on either target.

## Current state — 11 August 2026 (thirty-fifth entry)

**The repository is at contract 174. Development is hosted at 171. Production is hosted at 171.** Contracts 172, 173 and 174 are repository candidates applied to neither, and all three are additive.

| Contract | Migration | What it is |
| --- | --- | --- |
| 174 | `20260811234000_provider_calendar_change_proposals.sql` | Provider calendar changes staged for an administrator, and the decision that publishes them |

**It creates one table and writes no row on apply.** `predictor_internal.provider_calendar_change_proposals` is created empty, with row-level security on and no grant to any browser role. Two new functions are granted to `authenticated` and both refuse inside on `require_competition_admin()`.

**`check-migration-additive.mjs` accepts it and reports one structural step**: the append-only trigger it has just created is dropped and re-created immediately, the same idiom contracts 152 and 156 use. No existing relation, policy, grant or rule is altered.

**What changes on a target when it is applied.** `consume_provider_responses` — already scheduled at `2-59/5` since contract 135 — begins calling the detector as well, so staged proposals will start appearing for any real provider response. **No fixture, prediction, score, lock, settlement, progression or standing moves**, and the queue stays pending until an administrator decides. Development currently holds no live poll target with fixtures in flight, so the practical effect on apply is nil.

**The refusal an operator should expect.** A proposal whose fixture already carries a result is marked with a blocker at detection and refused again at decision, under the row lock. That is the case that would rescore a settled matchweek, and it is the only case where the queue will refuse an administrator outright.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **174** | 174 canonical migrations through `20260811234000_provider_calendar_change_proposals.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **171** | Fast-lane run `31499058072`, independently confirmed. Contracts 172 to 174 pending. | THREE BEHIND REPOSITORY |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | **171** | Guarded rollout run `31505763706`; see the thirty-third entry. Contracts 172 to 174 pending. | THREE BEHIND REPOSITORY |

`221`, `222` and `223` are executed by Database parity on this change's pull request. All three migrations were additionally applied end to end on a disposable PostgreSQL 16.13 before commit, and contract 174's detection, staging, idempotency, withdrawal-window, approval, refusal and append-only behaviours were each driven there.

## Current state — 11 August 2026 (thirty-fourth entry)

**The repository stood at contract 173 in this entry. Development is hosted at 171. Production is hosted at 171.** Contracts 172 and 173 were repository candidates applied to neither, and both are additive.

| Contract | Migration | What it is |
| --- | --- | --- |
| 172 | `20260811230000_action_centre_and_reminder_drivers.sql` | The `pg_cron` caller the action centre and the reminder ledger never had, and an operational health read |
| 173 | `20260811233000_matchweek_settled_actions.sql` | The action centre's settled-matchweek recap generator |

**Neither creates a table and neither writes a row on apply.** Contract 172 defines two functions and inserts three `cron.job` rows; contract 173 defines two functions. The first generation happens on the first tick after apply, not during it.

**Contract 172 schedules and does not send.** `process_reminder_schedule` is called with no arguments, so `dry_run` stays true; `claim_due_reminders` is not scheduled and has no caller; no provider is named and no credential exists. A source assertion refuses any scheduled command anywhere in `cron.job` that passes `false` or that names the claim, so the property cannot later be edited out of a cron string.

**Both were confirmed ABSENT from Production by name**, in the same read-only postflight that confirmed the thirty-third entry's boundary: `20260811230000` and `20260811233000` are not in that ledger, so the approved 159-to-171 boundary held exactly and nothing here rode in on it. Production also holds **zero** cron jobs naming an action or reminder entry point, and `player_action_items` and `reminder_deliveries` are both empty there.

**What changes on a target when these are applied.** The generator begins writing `player_action_items` for open Last Man Standing picks, open matchweek cards and matchweeks settled in the previous seven days, and the scheduler begins writing `reminder_deliveries` rows carrying `dry_run = true`. Both are additive player-visible state through `get_my_actions`, which is already granted and already caller-scoped. **No prediction, score, lock, settlement, progression or standing moves, and no email is sent.**

**Database parity refused contract 172 on its first run, correctly, and the reason generalises.** The privacy assertion read `pg_get_functiondef`, which returns comments with the code, and the comment explaining why `last_error` is deliberately *not* returned contains `last_error` — so the check refused the very function it was written to approve, and the migration failed on a database where nothing was wrong. Both migrations now strip `--` comments before any source match, which is the rule `rpcAllowlistParity.test.ts` already states in as many words. Recorded rather than quietly fixed, because the same trap is available to every future source assertion in this repository, and contract 173 needed the same treatment independently: its generator's own comment says `round_id` out loud, in the sentence explaining why that key must never be written.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **173** | 173 canonical migrations through `20260811233000_matchweek_settled_actions.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **171** | Fast-lane run `31499058072`, independently confirmed. Contracts 172 and 173 pending. | TWO BEHIND REPOSITORY |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | **171** | Guarded rollout run `31505763706` on a separate owner authorisation; see the thirty-third entry. Contracts 172 and 173 pending. | TWO BEHIND REPOSITORY |

`221` and `222` are executed by Database parity on this change's pull request.

## Current state — 11 August 2026 (thirty-third entry)

**The repository stood at contract 171 in this entry. Development remains at 171. Production is now hosted at 171.** All three were level at the moment this entry was written; the entry above is the current position.

Contracts 159 to 171 were applied to Production as **one boundary**, at the owner's direction, through `production-158-to-171-rollout.yml`, run [31505763706](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/31505763706), from exact `main` `0f778ffbde7825228379ea24624cc90a92c2fe0c`.

**The three gates, in order.** Backup run `31500395326` (succeeded). Rehearsal run [31505339791](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/31505339791) (succeeded). The rollout's own API check that both had concluded `success` before it would proceed.

**Why thirteen at once was defensible.** Every migration in the range is additive by `check-migration-additive.mjs`, so it ran as a **gate**. That is the material difference from the 157 → 158 promotion, which was destructive — `get_league_preview` was dropped and recreated because its return type narrowed — and so had to run the checker as a report with the backup-and-rehearsal pair standing in its place. **If a later rollout softens that gate back to a report, the boundary has changed.** The dry run asserted the thirteen files **by name** using `diff`; a count would pass on the wrong thirteen.

**The rehearsal was not a formality.** Its first dispatch, run [31504557398](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/31504557398), failed at the Production dump with `supabase: command not found`. Both workflows had been derived from the proven 157 → 158 pair and dropped its `actions/setup-node` and `supabase/setup-cli` steps. It failed on its own runner rather than part-way through a Production apply. Everything upstream had already passed on that run, including the read-only confirmation that the live source was exactly contract 158 at `20260811000000`.

| Query, taken after the rollout and independently of it | Production |
| --- | --- |
| The thirteen versions `20260811100000` … `20260811220000`, **named individually** | all thirteen present |
| `count(*)` of `supabase_migrations.schema_migrations` | **171** |
| `max(version)` | `20260811220000` |
| `cup_final_group_tables` still carries `sequence between 1 and 3` | **true** |
| `cup_season_group_tables` carries any matchday bound | **false** |
| The six new relations exist | 6 of 6 |
| …granted to `anon` or `authenticated` | **0** |
| `process_player_action_items` reachable by a browser role or `PUBLIC` | **0** |
| `cron.job` rows | **0** |

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **171** | 171 canonical migrations through `20260811220000_league_prediction_cap_honesty.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **171** | Fast-lane run `31499058072` from exact main `dd345ca`. | LEVEL |
| Production Supabase | **171** | Project `vkfnsqdyhvtwyqkisxhk`. Guarded rollout run `31505763706` from exact main `0f778ff`, gated on backup `31500395326` and rehearsal `31505339791`, independently confirmed by the named-row query above. | LEVEL |

**Nothing player-owned moved** across thirteen migrations: 1 auth user, 1 profile, 3 tournaments, 56 teams, 51 matches, 3 entries, 36 match predictions, 1 league, 1 league member, 0 score events, 3 entry totals, 7 game memberships, 10 competitions, 578 season fixtures and 10 season predictions — captured before the apply and compared after.

**What this did NOT do.** It is **schema only**. It published no Euro 2028 — contract 143's state stays `hidden`, publication is an owner act, and `EURO-001` remains a recorded defect. It launched no competition, drew no Championship and opened no Last Man Standing; contracts 166 and 127 write only when an administrator calls them. It scheduled no job, so contract 170's generator has still produced nothing in Production and contract 163 has sent nothing. It imported no football, and copying Development football rows into Production remains forbidden by the contract 132 boundary. **The deployed application remains at contract 145**, so no browser can reach any of this; promotion is separately controlled and `promotionAuthorised` stays `false`.

**The previous entry's warning was applied here.** Verification names the thirteen expected ledger rows rather than counting them, in both the workflow and the independent check — because a `count(*)` against a hosted ledger went stale for twenty-five minutes after a successful apply on this same day, and a count is exactly the shape that looks most like proof.

## Current state — 11 August 2026 (thirty-second entry)

**The repository stood at contract 171 in this entry. Development was hosted at 171. Production stood at 158.**

Contracts 169 to 171 merged as PR #694 at `dd345ca680dd0841d5832f4de7ad3d42ee1099c8` and were applied to Development through `development-fast-lane-rollout.yml`, run [31499058072](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/31499058072).

| Query, taken after the rollout | Development | Production |
| --- | --- | --- |
| `count(*)` of `supabase_migrations.schema_migrations` | **171** | **158** |
| `max(version)` | `20260811220000` | `20260811000000` |
| The three new versions, named individually | all present | absent |
| The batch's four new `predictor_internal` functions in `pg_proc` | 4 of 4 | — |

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **171** | 171 canonical migrations through `20260811220000_league_prediction_cap_honesty.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **171** | Fast-lane run `31499058072` from exact main `dd345ca`, independently confirmed by the queries above. | LEVEL |
| Production Supabase | **158** | Project `vkfnsqdyhvtwyqkisxhk`. Unchanged since rollout run `31475806882`; re-queried after this rollout and still 158. | THIRTEEN BEHIND REPOSITORY, BY DESIGN |

**What this did NOT do.** It published no Euro 2028 (contract 143 stays `hidden`), launched no competition, drew no Championship, scheduled no job — `process_player_action_items` remains `service_role`-only and unscheduled, so contract 170's generator has produced nothing — sent nothing, imported no football, and promoted no application. The deployed site remains at contract 145, so **no browser can reach any of this**.

**Two observation notes for the next reader, both about not trusting a status field.**

The Actions API reported this run's job `in_progress` on the snapshot step for **twenty-five minutes after it had finished**. The cancel endpoint is what disproved it: it refused with "Cannot cancel a workflow run that is completed" while the same API's job status still said otherwise. This is the second run today where those step statuses were badly stale.

Worse, and new: a `select count(*), max(version)` against the development ledger kept returning **168** for twenty-five minutes after the migrations had in fact been applied, while a row-level `select version ... where version > ...` against the same table in the same session returned all three new rows. The aggregate was being served from cache. **A hosted claim should be checked by naming the rows expected, not by counting them** — a count can be stale in a way that a named-row query is not, and a count is exactly the shape that looks most like proof.

## Current state — 11 August 2026 (thirty-first entry)

**The repository stood at contract 171 in this entry, with Development at 168 and Production at 158.** Contracts 169, 170 and 171 are repository candidates applied to neither, and all three are additive.

| Contract | Migration | What it is |
| --- | --- | --- |
| 169 | `20260811200000_season_cup_initial_group_table.sql` | A season Championship group table measured over the season it plays |
| 170 | `20260811210000_matchweek_prediction_actions.sql` | The action centre's matchweek generator, and a sweep that re-derives a matchweek's lock |
| 171 | `20260811220000_league_prediction_cap_honesty.sql` | A deterministic, self-declaring cap on the two league prediction reads |

**None creates a table, schedules a job, or writes anything on apply.** All three define functions only. `process_player_action_items` remains `service_role`-only and unscheduled by any migration.

**Contract 171 changes no signature**, so nothing a browser calls today breaks. Both keys it adds are additive: every key either read emitted before, it still emits.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **171** | 171 canonical migrations through `20260811220000_league_prediction_cap_honesty.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **168** | Fast-lane run `31489582932`, independently confirmed. Contracts 169 to 171 pending. | THREE BEHIND REPOSITORY |
| Production Supabase | **158** | Project `vkfnsqdyhvtwyqkisxhk`. Unchanged since rollout run `31475806882`. | THIRTEEN BEHIND REPOSITORY, BY DESIGN |

`218`, `219` and `220` are written and **have not been executed**: the authoring environment has no Docker daemon and no Supabase CLI. Database parity on their pull request is what runs them.

## Current state — 11 August 2026 (thirtieth entry)

**The repository stood at contract 170 in this entry. Development was hosted at 168. Production stood at 158.** Contracts 169 and 170 are repository candidates applied to neither, and both are additive.

| Contract | Migration | What it is |
| --- | --- | --- |
| 169 | `20260811200000_season_cup_initial_group_table.sql` | A ranking correction: a season Championship group table measured over the season it plays |
| 170 | `20260811210000_matchweek_prediction_actions.sql` | The action centre's matchweek generator, and an expiry sweep that re-derives a matchweek's lock |

**Neither creates a table and neither schedules a job.** `process_player_action_items` remains `service_role`-only and remains unscheduled by any migration, so applying contract 170 generates no action until something calls it.

**Neither writes anything on apply.** Contract 169 defines functions; contract 170 defines functions. No fixture, prediction, score, lock, settlement or progression moves.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **170** | 170 canonical migrations through `20260811210000_matchweek_prediction_actions.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **168** | Fast-lane run `31489582932`, independently confirmed. Contracts 169 and 170 pending. | TWO BEHIND REPOSITORY |
| Production Supabase | **158** | Project `vkfnsqdyhvtwyqkisxhk`. Unchanged since rollout run `31475806882`. | TWELVE BEHIND REPOSITORY, BY DESIGN |

`218` and `219` are written and **have not been executed**: the authoring environment has no Docker daemon and no Supabase CLI. Database parity on their pull request is what runs them.

## Current state — 11 August 2026 (twenty-ninth entry)

**The repository stood at contract 169 in this entry. Development was hosted at 168. Production stood at 158.** Contract 169 — `20260811200000_season_cup_initial_group_table.sql` — is a repository candidate applied to neither, and it is additive.

**It is a ranking correction, not a feature.** `predictor_internal.cup_final_group_tables` measures four of its nine ADR 0014 §5.2 keys over `win.sequence between 1 and 3`. Contracts 120 and 167 show that table for a season Predictor Championship whose group stage runs to thirty-eight matchdays. Driven on a disposable PostgreSQL 16 with two players level on table points: **the group winner changes**, and under ADR 0014 the group winner decides qualification and seeding.

**Nothing on either hosted environment is wrong today because of it**, because no season Championship group stage exists on either: contract 166's draw and contract 127's launcher have never been called. The defect is latent, and this is the migration that closes it before it is not.

**What it does not do.** It does not touch `cup_final_group_tables` — a source assertion in the migration fails if that function loses its bound — and it does not touch `admin_finalise_predictor_cup_groups`, which still gates qualification on the same three windows and still demands exactly three settled ones. **A season group stage therefore still cannot qualify anyone.** That is roadmap item 8 and is not claimed here.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **169** | 169 canonical migrations through `20260811200000_season_cup_initial_group_table.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **168** | Fast-lane run `31489582932`, independently confirmed. Contract 169 pending. | ONE BEHIND REPOSITORY |
| Production Supabase | **158** | Project `vkfnsqdyhvtwyqkisxhk`. Unchanged since rollout run `31475806882`. | ELEVEN BEHIND REPOSITORY, BY DESIGN |

`218_season_cup_initial_group_table.sql` is written and **has not been executed**: the authoring environment has no Docker daemon and no Supabase CLI. Database parity on its pull request is what runs it.

## Current state — 11 August 2026 (twenty-eighth entry)

**The repository stood at contract 168 in this entry, Development reached 168 here, and Production remained at 158.**

Contracts 159 to 168 merged as PR #691 at `2be5c8f682fb12200c63a36d6504889c1554c045` and were applied to Development through `development-fast-lane-rollout.yml`, run [31489582932](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/actions/runs/31489582932), dispatched from `main` with `project_ref=iouzoutneyjpugbbtdem`. The lane proved all ten additive by reading them, took its pre-apply snapshot, applied, and confirmed nothing pending.

**The claim is not the workflow's.** Taken afterwards and independently:

| Query | Development | Production |
| --- | --- | --- |
| `count(*)` of `supabase_migrations.schema_migrations` | **168** | **158** |
| `max(version)` | `20260811190000` | `20260811000000` |

The fourteen browser- and administrator-reachable functions the batch adds are named in `pg_proc` on Development. Production was queried **after** the Development rollout and is unchanged, so contracts 159 to 168 are **not** production-hosted and no production promotion is claimed or implied.

**Database parity executed pgTAP suites `208` to `217` on the merged head and all pass.** The twenty-seventh entry below recorded them as unrun, which was true when written.

**One operational note for the next reader.** The GitHub Actions API served step statuses for this run up to ten minutes stale — it reported the snapshot step still running for several minutes after the job had in fact completed successfully. Read the hosted database, not the workflow's step list, when deciding whether a rollout landed.

**What this did NOT do.** It published no Euro 2028 (contract 143 stays `hidden`), launched no competition (contract 166 draws only when an administrator calls it, and nobody has), scheduled no reminder job, sent nothing, imported no football, and promoted no application — the deployed site remains at contract 145, so **no browser can yet reach any of this**. Production was not touched.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **168** | 168 canonical migrations through `20260811190000_season_admin_inspection.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **168** | Fast-lane run `31489582932` from exact main `2be5c8f`, independently confirmed by a read-only ledger query (168 rows, latest `20260811190000`) and by naming the batch's fourteen new functions in `pg_proc`. | LEVEL |
| Production Supabase | **158** | Project `vkfnsqdyhvtwyqkisxhk`. Unchanged since rollout run `31475806882`; re-queried after the Development rollout and still 158 with latest `20260811000000`. | TEN BEHIND REPOSITORY, BY DESIGN |

## Current state — 11 August 2026 (twenty-seventh entry)

**The repository was at contract 168 in this entry. Development and Production both remained at 158.** Contracts 159 to 168 are repository candidates and **no rollout is claimed for any of them**. All ten are additive.

| Contract | Migration |
| --- | --- |
| 165 | `20260811160000_lms_organiser_reads.sql` |
| 166 | `20260811170000_cup_multi_group_launch.sql` |
| 167 | `20260811180000_cup_group_stage_read.sql` |
| 168 | `20260811190000_season_admin_inspection.sql` |

**Contract 159 should still be sequenced first** — it is the security fix, and until it is applied both hosted environments hold an unrated invite-probe path that `SEC-001` is otherwise closed on.

**Nothing in 165 to 168 creates a table.** All four are functions only: two organiser reads, one Championship draw driver with its administrator entry point, one group-stage read, and two administrator inspection reads. No existing relation, policy, trigger or grant moves.

**Contract 166 is the only one that writes anything at all**, and only when an administrator explicitly calls it: it inserts groups, members and fixtures for one competition, refuses if that competition is already drawn, and takes a transaction-scoped advisory lock so two administrators pressing the button together cannot both draw. Applying the migration draws nothing.

**Executed before commit** against a disposable PostgreSQL 16, with the real Cup authorities (`select_season_cup_format`, `cup_league_schedule`) extracted from the repository rather than stubbed. The 100-entrant case produced 5 groups of 20 and 950 fixtures with every pairing occurring exactly once; a 25-entrant field produced groups of 13 and 12 with the smaller group correctly holding no fixture in the last two rounds. That is **not** the Database parity job: it proves the SQL applies and behaves, not that it composes with the full 168-migration chain. pgTAP suites `208` to `217` have **not** been run.

## Current state — 11 August 2026 (twenty-sixth entry)

**The repository stood at contract 164 in this entry. Development and Production both remain at 158.** Contracts 159 to 164 are repository candidates and **no rollout is claimed for any of them**.

| Contract | Migration | Additive? |
| --- | --- | --- |
| 159 | `20260811100000_invite_resolver_probe_hardening.sql` | yes |
| 160 | `20260811110000_domestic_league_table.sql` | yes |
| 161 | `20260811120000_season_history_discovery.sql` | yes |
| 162 | `20260811130000_action_centre.sql` | yes |
| 163 | `20260811140000_reminder_delivery.sql` | yes |
| 164 | `20260811150000_season_lms_field.sql` | yes |

**Contract 159 should still be sequenced first**, for the reason the twenty-fifth entry gives: it is a security fix, and until it is applied both hosted environments hold an unrated invite-probe path that `SEC-001` is otherwise closed on.

**Nothing in 161 to 164 alters an existing relation.** The five new tables are created empty and revoked from every browser role; the one new trigger belongs to contract 160 and binds to a table that migration creates. Contract 163 in particular applies **inert**: it names no provider, holds no credential, makes no outbound call, and `dry_run` defaults to true, so applying it queues nothing and sends nothing until an operator explicitly runs its jobs.

**Two recurring jobs would need scheduling separately** and are deliberately not scheduled by these migrations: `process_player_action_items()` and `process_reminder_schedule(...)`. Applying the contract does not start them, which is why applying it changes no player-visible behaviour.

**All six were executed before commit** against a disposable PostgreSQL 16 cluster carrying stand-ins for the relations they depend on. That is **not** the Database parity job and does not substitute for it: it proves the SQL applies and behaves, not that it composes with the full 164-migration chain. pgTAP suites `208` to `213` have **not** been run — no Docker daemon and no Supabase CLI in the authoring environment.

## Current state — 11 August 2026 (twenty-fifth entry)

**The repository stands at contract 160 in this entry. Development and Production both remain at 158.** Contracts 159 and 160 are repository candidates and **no rollout is claimed for either**.

| Contract | Migration | Additive? | Lane it would take |
| --- | --- | --- | --- |
| 159 | `20260811100000_invite_resolver_probe_hardening.sql` | yes — one `create or replace function` and one catalogue-reading `do` block | ADR 0024 additive fast lane |
| 160 | `20260811110000_domestic_league_table.sql` | yes — three new tables, two internal functions, four new public functions, one trigger on a table it creates | ADR 0024 additive fast lane |

**Contract 159 is a security fix and should be sequenced first.** `public.resolve_invite_code` — the universal invite entry point — charged no rate limit and returned the target id and member count, which is a wider and cheaper confirmation oracle than the `get_league_preview` contract 158 narrowed for exactly that reason. Contract 158 recreated the resolver to widen its shape check and carried neither fix into it. Until 159 is applied, both hosted environments hold a probe path that `SEC-001` is otherwise closed on.

**Contract 160 alters no existing relation.** Its three tables are created empty and revoked from every browser role; its one trigger binds to a table the same migration creates; `season_fixtures`, `season_fixture_result_revisions` and the protected result authority are untouched, which the migration asserts at apply time rather than claiming here.

**Both were executed before commit** against a disposable PostgreSQL 16 cluster carrying stand-ins for the relations they depend on. That is *not* the Database parity job and does not substitute for it: it proves the SQL applies and behaves, not that it composes with the full 160-migration chain. `208` and `209` pgTAP have **not** been run — no Docker daemon and no Supabase CLI in the authoring environment.

## Current state — 11 August 2026 (twenty-fourth entry)

**Repository, Development and Production are level at contract 158.** The twenty-third entry recorded Development reaching 158 with Production one behind; this entry records the Production promotion.

**The order was backup, rehearsal, rollout, and the rollout checked the first two itself** — against the API, by run id, rather than trusting whoever dispatched it.

| Step | Run | Result |
| --- | --- | --- |
| Encrypted, restore-verified backup | `31473742437` | success, before any write |
| Pinned 157→158 rehearsal | `31475471473` | success, read-only against Production |
| Guarded rollout | `31475806882` | success, from exact main `fd109e4` |

**This is the first Production migration in the sequence the additive checker refuses.** `get_league_preview` is dropped and recreated because its return type narrows — it stops returning the league id, the member count and the owner's name, which is the confirmation oracle `SEC-001` named — and PostgreSQL cannot narrow a return type with `create or replace`. Both pinned workflows therefore run `check-migration-additive.mjs` as a **report** and print the refusal, rather than as a gate. A gate quietly weakened to let one file past would be worse than one that says out loud what it found; what stands in its place is the backup and the Production-shaped rehearsal.

**The rehearsal is what made this safe to do at all.** A fresh four-file Supabase-native dump of live Production was restored to a disposable local target carrying Production's own privilege shape — asserted, not assumed, by checking that `season_fixtures` is granted to no browser role there — and the migration was applied to that copy with real rows before anything touched Production.

**Verified independently, not from the rollout's own output.** 158 rows ending `20260811000000_invite_code_hardening`; `gen_invite_code()` returning **twelve** characters; `bonus_competitions_invite_code_shape` and `invite_code_registry_shape` both `^[A-Z0-9]{6,16}$` with `resolve_invite_code` widened alongside them; `get_league_preview` narrowed to `TABLE(name text, is_member boolean)`; the `league_invite_probe` limit charged **before** the lookup in both the preview and `join_league`; that function's game-membership gate still present; `rotate_league_invite_code` executable by `authenticated` and by no anonymous role; the Euro publication state still `hidden`.

**The coupling is the part that would have hurt.** Contract 158 was authored when `gen_invite_code()` had one caller. Contracts 152 to 155 landed in between and pinned the code to exactly six characters in three places. Had any one of them been missed, every private competition creation on Production would raise `check_violation` and every newly issued code would read as a wrong code rather than a broken feature. All three widen in the same migration and all three were asserted on the live database.

**Nothing player-owned moved and no code was rewritten**: 1 auth user, 1 profile, 3 tournaments, 56 teams, 51 matches, 36 match predictions, 1 league, 1 league member, 10 competitions, 578 season fixtures, and Production's single league invite code — still six characters, still in the shared registry. Twelve characters is what the generator issues **next**; shortening a live invite link's life is an owner act through `rotate_league_invite_code`, taken per league.

**What this did NOT do.** It rotated no invite code, published no Euro 2028 (contract 143 stays `hidden`), promoted no application — the deployed site remains at contract 145, so **no browser can yet reach any of this** — and imported no football.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **158** | 158 canonical migrations through `20260811000000_invite_code_hardening.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **158** | Pinned 157→158 rollout run `31473692593` from exact main `4d4b860`, independently confirmed. | LEVEL |
| Production Supabase | **158** | Project `vkfnsqdyhvtwyqkisxhk`. Rollout run `31475806882` gated on backup `31473742437` and rehearsal `31475471473`, independently confirmed. | LEVEL |

## Superseded — 11 August 2026 (twenty-third entry)

**Development is at contract 158. Production remains at 157.** The twenty-second entry recorded contract 158 as a repository candidate applied to neither hosted environment; this entry records Development receiving it, and one correction that entry needs.

**The correction: `stage-c1-development-rollout.yml` could not carry it.** The twenty-second entry said Development would take that workflow "with its backup and rehearsal", repeating what `check-migration-additive.mjs` prints when it refuses a destructive migration. Both were wrong, and the same wrong. That workflow is a **spent one-shot pinned to contract 65** — it refuses everything else by name, which is exactly what it did on run `31472268116`. Its name reads general and it is not, so a destructive development migration has had **no runnable lane at all**, and the checker's refusal has been pointing at a door that is bricked up.

`development-157-to-158-rollout.yml` is that boundary's lane, in the same pinned per-boundary shape the Production promotions use: main only, clean checkout, confirmation phrase, Production refused by name, repository row 158 pinned by filename, the live source proven to be exactly 157, everything above the target held back, and a dry run required to equal exactly one migration before anything is applied. It carries **no encrypted backup**, deliberately: ADR 0024's premise is that Development data is disposable, and what the fast lane's refusal actually protects is applying something destructive *without noticing* — so the lane keeps every part of the noticing and drops the ceremony that exists for Production's irreplaceable rows.

The generalisation — one guarded development lane taking a boundary as input — is the better answer and was deliberately not attempted here. Inventing a general-purpose destructive lane while landing a security contract is two risks where one will do.

**Verified by separate read-only query, not from the job's own output** — the lane applies and deliberately does not verify, because a job reporting on its own write is not independent evidence. Confirmed on `iouzoutneyjpugbbtdem`: 158 rows ending `20260811000000_invite_code_hardening`; `gen_invite_code()` returning **twelve** characters; `bonus_competitions_invite_code_shape` and `invite_code_registry_shape` both `^[A-Z0-9]{6,16}$` and `resolve_invite_code` widened with them; `get_league_preview` narrowed to `TABLE(name text, is_member boolean)` with the id, member count and owner name gone; the `league_invite_probe` limiter charged **before** the lookup in both the preview and `join_league`; that function's game-membership gate still present, which an earlier draft of the migration had silently dropped; `rotate_league_invite_code` executable by `authenticated` and by no anonymous role; `gen_invite_code` reachable by no anonymous role.

**Nothing was rewritten.** All 4 Development leagues still hold a code, all 4 are still six characters, and the shared registry still holds 4 rows. Existing invite links keep working; twelve characters is what the generator issues **next**, and shortening an existing code's life is an owner act through `rotate_league_invite_code`, taken per league.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **158** | 158 canonical migrations through `20260811000000_invite_code_hardening.sql`. | LEVEL WITH DEVELOPMENT |
| Development Supabase `iouzoutneyjpugbbtdem` | **158** | Pinned 157→158 rollout run `31473692593` from exact main `4d4b860`, independently confirmed. | LEVEL |
| Production Supabase | **157** | Project `vkfnsqdyhvtwyqkisxhk`. Rollout run `31446392236` gated on backup `31445515426` and rehearsal `31446161436`, independently confirmed. | ONE BEHIND |

## Superseded — 11 August 2026 (twenty-second entry)

**Contract 158 is the repository candidate and is applied to neither hosted environment.** It is `SEC-001` invite-code hardening, rebased from a concurrent session's branch (#670) that had claimed contract 152 before that number was taken.

**It was renumbered, and the renumber was not cosmetic.** The branch carried `20260810190000_invite_code_hardening.sql` and `supabase/tests/201_invite_code_hardening.sql`; `main` already holds a *different* migration at `20260810190000` and a different suite at `201`. Two branches claiming one contract number is the failure `NOW.md` warns about in its own text, and here it produced a direct filename collision rather than a merge conflict anyone would notice.

**What it changes.**

| | Before | After |
| --- | --- | --- |
| `gen_invite_code` | seeded `random()`, six characters, 31^6 | pgcrypto CSPRNG, rejection-sampled, twelve characters |
| `get_league_preview` | answered any guess with id, member count, owner name | name and season only |
| Cost of a wrong guess | none — the 5/min budget fires on a SUCCESSFUL join | `league_invite_probe`, charged on preview and join |
| A leaked code | permanent, escapable only by deleting the league | `rotate_league_invite_code` |

**The compatibility repair is the part worth reading.** The migration was authored when `gen_invite_code()` had exactly one caller. Contracts 152 to 155 landed in between and gave it a second family: `allocate_invite_code` feeds both private-container creators, and the shared registry mirrors the result by trigger. Three places pinned the code to exactly six characters, and each was a live failure rather than a theoretical one — `bonus_competitions_invite_code_shape` would have refused every private competition, `invite_code_registry_shape` would have failed the registering trigger and taken the creating transaction with it, and contract 155's resolver would have answered `found: false` for every code issued after this contract, which reads as a wrong code rather than a broken feature. All three widen to `{6,16}` here, as ALTERs, because 152 to 157 are already applied to both hosted environments.

**It does not use the fast lane.** `check-migration-additive.mjs` refuses it on `drop function`, correctly: `get_league_preview` is dropped and recreated because its return type narrows, which `create or replace` cannot do. So Development takes `stage-c1-development-rollout.yml` with its backup and rehearsal, and Production takes its own pinned 157→158 pair.

**Fifty-six visual baselines were re-rendered, and only one of them is a design change.** The gallery's `LeaguePreviewCard` stops receiving `memberCount` and `ownerName`, which is this contract's disclosure boundary arriving on screen. That section is genuinely a pixel shorter, and because the suite captures each section after `scrollIntoViewIfNeeded()`, the changed height moves later sections' sub-pixel scroll offsets and rounds their captured height by one pixel — so `textinput`, `alert`, `emptystate` and `clubmatchcard` all differed by `1246×224` against `1246×223` without anything about them changing. Ruled out the framer-motion 13 bump as the cause before re-rendering: `chore/dependency-bumps` carries it and its `visual` run passed. The images were produced by `visual-contracts.yml` with `update_baselines` and `commit_baselines`, so they come from the comparison runner rather than a developer machine — an image is only comparable to one rendered by the same toolchain.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **158** | 158 canonical migrations through `20260811000000_invite_code_hardening.sql`. | ONE AHEAD OF BOTH HOSTED |
| Development Supabase `iouzoutneyjpugbbtdem` | **157** | Fast-lane run `31444748121`, independently confirmed. | ONE BEHIND |
| Production Supabase | **157** | Project `vkfnsqdyhvtwyqkisxhk`. Rollout run `31446392236` gated on backup `31445515426` and rehearsal `31446161436`, independently confirmed. | ONE BEHIND |

## Superseded — 11 August 2026 (twenty-first entry)

**Repository, Development and Production are level at contract 157.** The twentieth entry recorded Development reaching 157 with Production six behind; this entry records the Production promotion.

**The order was backup, rehearsal, rollout, and the rollout checked the first two itself.** It is not enough that a backup was taken — the workflow confirms against the API that the named runs concluded success and are the workflows they claim to be, because "take a backup first" survives exactly as long as the person in a hurry remembers it.

| Step | Run | Result |
| --- | --- | --- |
| Encrypted, restore-verified backup | `31445515426` | success, before any write |
| Pinned 151→157 rehearsal (first attempt) | `31445831137` | **refused** — see below |
| Pinned 151→157 rehearsal | `31446161436` | success |
| Guarded rollout | `31446392236` | success, from exact main `9e29c8d` |

**The first rehearsal refused on a defect in the rehearsal, not in the batch.** Its precondition step reads the restored copy BEFORE the apply — deliberately, so contract 152's backfill is compared against a count measured beforehand rather than a number written into the workflow — and it asked for a count over `bonus_competitions.name`, a column contract 152 ADDS. At that instant the copy is contract 151 and the column does not exist. Everything before it had already succeeded: the four-file dump, the restore carrying Production's own privilege shape rather than a fresh stack's defaults, the `season_fixtures` browser-grant check on the restored copy, and the source boundary at exactly 151. Fixed in `9e29c8d`; the backup did not need retaking and Production was read-only throughout.

**Verified independently, not from the rollout's own output.** 157 rows ending `20260810230000_player_preferences`; four new relations carrying **zero** `anon`/`authenticated`/`PUBLIC` table grants; contract 152's backfill covering Production's 1 league invite code with no competition row invented; **zero** private competitions, so the `NOT VALID` identity constraint had nothing to tolerate here — that concession exists for one legacy Development row and Production never needed it; `season_wrapped`, `competition_follows` and `pinned_rivals` all empty; ten new public functions executable by `authenticated` and by no anonymous role; contract 153's narrowed `join_competition_game` refusing a private competition; the Euro publication state still `hidden`.

**Nothing player-owned moved**: 1 auth user, 1 profile, 2 entries, 36 match predictions, 1 league, 10 competitions and 578 season fixtures, all unchanged across the migration.

**What this did NOT do.** It created no private league, Last Man Standing or Championship — it added the authorities a player uses to create one, and every container arrived empty. It did not publish Euro 2028. It did not promote the application: the deployed site remains at contract 145, so **no browser can yet reach any of these ten functions**. It imported no football.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **157** | 157 canonical migrations through `20260810230000_player_preferences.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **157** | Fast-lane run `31444748121`, independently confirmed. | LEVEL |
| Production Supabase | **157** | Project `vkfnsqdyhvtwyqkisxhk`. Rollout run `31446392236` gated on backup `31445515426` and rehearsal `31446161436`, independently confirmed. | LEVEL |

## Superseded — 11 August 2026 (twentieth entry)

**Development is at contract 157. Production remains at 151.** The nineteenth entry recorded contracts 152 to 157 as a repository candidate applied to neither hosted environment; this entry records what happened when they were applied, and it is not a tidy story.

**The registry outage lifted, and it had been hiding the work.** The nineteenth entry recorded that no local Supabase stack could start, so the pgTAP suites for this batch had never run. When the images became pullable the suites ran for the first time and found **three real defects and seven broken suites**, none of which any repository-level check could have caught.

| What | Where | Why it was invisible |
| --- | --- | --- |
| Assertion matched its own comment: `seed` inside "the seeding", and `draw_completed_at` inside a comment | contract 154's DO block | Only runs when the migration is applied |
| No-write assertion spelled `delete from` literally, so the ADR 0024 additive checker refused the whole batch from the fast lane | contract 155 | Fast lane had never been reached |
| Private fixtures with no name, owner or invite code — the shape contract 152 now refuses | pgTAP 154, 156, 159, 162, 176, 179, 185 | Only fails against a real database |
| Revoked tables read while wearing the `authenticated` role | pgTAP 202, 203 | Only fails against a real database |

**The fixtures were changed, not the constraint.** `NOT VALID` was always about tolerating the one ownerless legacy private competition on hosted Development, not about admitting new ones. Suite 179 needed its players created before its competitions because the owner is a foreign key into `auth.users`; suite 154 had no users at all.

**One hazard is recorded and deliberately not fixed, because it is not reachable.** Contract 107's Last Man Standing restart driver builds its successor by copying `visibility_kind` and cannot copy the three identity columns, which did not exist when it was written — so restarting a **private** Last Man Standing would violate contract 152's constraint. Its only caller, contract 109's scheduler, already filters `visibility_kind = 'public'`, matching the driver's own `public_wipeout_restart` audit action, and the driver is granted to no role. What happens to an invite code across a lifecycle transition is a rule decision with its own authority and was not taken inside a UI batch.

**Evidence.** Database parity green across all 131 pgTAP files at repository head `d49541f`; guarded Development fast-lane run **31444748121** from exact main `39fade8`, with the additive checker accepting all six and reporting contract 152's two paired trigger re-creations and contract 156's one as structural rather than destructive. Independently confirmed by read-only query: 157 rows ending `20260810230000_player_preferences`; four new relations with **zero** browser grants; backfill covering 4 of 4 league codes and inventing no competition row; the legacy private competition untouched; `season_wrapped`, `competition_follows` and `pinned_rivals` empty; ten new functions executable by `authenticated` and no anonymous role; `join_competition_game` refusing a private competition; Euro publication state still `hidden`.

**Known open, and not a defect in the contracts.** `database.types.ts` is generated from hosted Development by a script requiring `SUPABASE_ACCESS_TOKEN`, which no workflow holds, so the staleness guard stays red at `expected 151 to be 157` until the owner supplies that secret or an equivalent path. It gates no rollout.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **157** | 157 canonical migrations through `20260810230000_player_preferences.sql`. | LEVEL WITH DEVELOPMENT |
| Development Supabase `iouzoutneyjpugbbtdem` | **157** | Fast-lane run `31444748121` from main `39fade8`, independently confirmed. | LEVEL |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | **151** | Rollout run `31420443441`, independently confirmed. Contracts 152 to 157 pending its own approved promotion. | SIX BEHIND |

## Superseded — 10 August 2026 (nineteenth entry)

**Contracts 152 to 157 are the repository candidate and are applied to neither hosted environment.** They close the six `MIG-UI` items that remained after the contract 146–151 batch, and they are accumulated as one batch at the owner's direction.

| Contract | Item | What it adds |
| --- | --- | --- |
| 152 | foundation | A private competition's name, owner and invite code, and one namespace for every code |
| 153 | `MIG-UI-05` | Private Last Man Standing: create, invite, join |
| 154 | `MIG-UI-06` | Private Predictor Championship: create, invite, join, launch |
| 155 | `MIG-UI-07` | One code entry point resolving league or private container |
| 156 | `MIG-UI-08` | The permanent season Wrapped archive |
| 157 | `MIG-UI-09`, `MIG-UI-10` | Follow, favourite team, onboarding progress, pinned rival |

**The audit the register demanded was run rather than reasoned about.** `MIG-UI-09` and `MIG-UI-10` both say to check the existing account/preference authority first and add a contract only if it cannot hold them. Measured on hosted Development, `public.profiles` holds `id`, `display_name`, `created_at`, `last_seen_at`, `last_seen_points`, `welcomed_at` and `reminder_emails` — and that is all of it. No preferences table exists anywhere in `public` or `predictor_internal`. So the audit's answer is that a contract is needed, and contract 157 is the narrowest one.

**Two obstacles are recorded rather than worked around.** The container registry is refused by this session's egress policy (403 from `pkg-containers.githubusercontent.com`), so no local Supabase stack could be started; contract 152 was instead validated against hosted Development's real schema inside a **rolled-back transaction**, which applied cleanly, backfilled all four existing league codes, left the one seeded private row intact, and was confirmed to have changed nothing afterwards. Separately, `database.types.ts` is generated from the hosted Development project rather than locally, so that guard cannot go green until the Development rollout has applied this batch — it is expected red until then, and is not a defect in the contracts.

**Nothing is claimed hosted.** These contracts reach Development only through the guarded additive fast lane, and Production only through its own separately approved promotion.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **157** | 157 canonical migrations through `20260810230000_player_preferences.sql`. | SIX AHEAD OF BOTH HOSTED |
| Development Supabase `iouzoutneyjpugbbtdem` | **151** | Guarded fast-lane run `31417611501`, independently confirmed. Contracts 152 to 157 pending. | SIX BEHIND REPOSITORY |
| Production Supabase | **151** | Rollout run `31420443441` gated on backup `31418252958` and rehearsal `31419966598`, independently confirmed. | SIX BEHIND REPOSITORY |

## Superseded — 10 August 2026 (eighteenth entry)

**Production is open for play.** The seventeenth entry levelled the schema at contract 151; this entry records the operating state that turns a levelled database into a product a player can use, and what it deliberately did not do.

**The blocker was not what the roadmap assumed.** Every round on both league seasons carried `window_opens_at` **null** — contract 113's window deriver had never been run on Production, so nothing could open, lock or settle no matter what else was published. `predictor_internal.derive_round_play_windows` wrote **38** windows for the Premier League and **33** for the Scottish Premiership, matching their round counts exactly.

**What was opened, in the order the dependencies force.**

| Step | Action | Result |
| --- | --- | --- |
| 1 | `derive_round_play_windows` on both seasons | 38 + 33 windows |
| 2 | `tournaments.status` `draft` → `active` | both seasons enter contract 147's catalogue |
| 3 | `bonus_competitions` published, active, registration open | all six games joinable |
| 4 | `admin_open_season_competition` on both Last Man Standing | opened: 38 and 31 windows, Classic setup written |
| 5 | `admin_open_season_competition` on both Championships | **`not_open` / `below_threshold`**, shortfall 100, nothing written |

**The Championship is published and cannot be drawn, which is the rule working rather than a gap.** ADR 0014's public Championship opens at a hundred entrants; Production holds one player, so `resolve_public_cup_launch` refused and wrote no group, no draw and no fixture. Launching it anyway would fix a one-entrant draw permanently, which is exactly the irreversibility contract 127 made an operator decision. It opens itself when the field arrives.

**Playability was driven, not asserted.** Read back as the owner through the browser-reachable reads: the catalogue returns both seasons; `get_season_play_context` resolves Premier League **matchweek 1** locking 2026-08-21T19:00Z and Scottish Premiership **matchweek 3** locking 2026-08-22T14:00Z; `get_season_matchweek_card` returns 10 and 6 fixtures with real clubs, short codes and colours from contracts 136–137; and `get_season_lms_round` returns window 1 with all ten Premier League fixtures and `available: true`.

**One privilege moved, with owner approval and by the runbook.** `admin_capabilities` on the single account went from `["results"]` to `["results","competitions"]` — merged into the stored object so `provider`/`providers` survived. `super_admin` was declined in favour of the narrow pair, which is what [`ops-admin-bootstrap.md`](ops-admin-bootstrap.md) asks for. No other account holds any capability. The opening calls took their JWT claims **from that stored grant rather than asserting one**, so `require_competition_admin` still decided; a missing grant would have refused.

**A fresh backup preceded every mutation**: run `31424038086`, encrypted and restore-verified, taken after the contract-151 rollout and before the first write.

**What this did NOT do.** It did not publish Euro 2028 — still `hidden`. It did not make the site public: the password protection stands and `AGE-001` remains accepted and unbuilt, so "playable" means playable by whoever holds the password. It entered nobody into a game, and it did not launch the Championship.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Netlify `euro28predictor` non-production contexts | **151 hosted declaration** | Raised from 145 on 10 August 2026 after hosted Development was independently verified at 151. `dev-server` remains blank and fails closed. A declaration may trail its hosted database but must never lead it. | LEVEL WITH HOSTED DEVELOPMENT |
| Netlify `euro28predictor` production | **151 hosted declaration** | Raised from 145 on 10 August 2026 only after rollout run `31420443441` applied contract 151 to Production and an independent read confirmed it. Raising it is what lets the production build pass `validate-deployment-contract.mjs`, which demands an exact match. | LEVEL WITH HOSTED PRODUCTION |

## Superseded — 10 August 2026 (seventeenth entry)

**Repository, Development and Production are all at contract 151.** The six-migration batch the sixteenth entry was accumulating has been promoted, in the order backup → rehearsal → rollout, and verified independently on both hosted targets.

Contract 151 reached Production through guarded rollout run **31420443441** from exact `main` `5017670dfb93cab1ac0ebb2631a081f6967cdf9a`, after its own API check that backup run **31418252958** and rehearsal run **31419966598** had both concluded success. Independent read-only verification afterwards:

```json
{"migration_count": 151, "latest": "20260810170000_season_player_profile",
 "new_reads_present": 5, "internal_present": 2, "live_columns": 3,
 "idle_cadence_default": "1440", "anon_grants_on_new_reads": 0,
 "auth_users": 1, "profiles": 1, "entries": 2, "match_predictions": 36,
 "euro_publication_state": "hidden"}
```

All five new reads and both new `predictor_internal` functions are genuinely present rather than merely having their migration rows recorded; the idle cadence default is the one contract 146 sets; no new read carries a `PUBLIC` or `anon` execute grant; every player-owned count is identical to the pre-apply snapshot; and the Euro publication state is untouched, which a batch of season reads has no business moving.

**The first rehearsal failed, and it failed correctly.** Run **31419607734** stopped before touching anything, on the guard that Development must already hold the target — *Production is never the first hosted environment to see a migration*. The guard read `config/development-hosted-contract.json` on `main`, which still said 145 although hosted Development had been at 151 since fast-lane run 31417611501. The record, not the database, was stale: the automation had already opened #664 with the correct values and it was sitting unmerged. Development was re-verified independently before that record was merged — 151 rows ending `20260810170000_season_player_profile`, five new reads, two new internal functions, three `live_*` columns, zero `anon`/`PUBLIC` grants — and the second rehearsal, run **31419966598**, passed every step. **A stale machine record is not a cosmetic problem when a guard reads it**, which is the transferable point: the follow-up automation's pull request is part of the rollout, not paperwork after it.

**Three inherited comment blocks in the pinned pair named the wrong boundary** and are corrected: a `132 -> 144` header, "the twelve reviewed migrations", a justification naming contract 135, and two step labels reading "contract 144" and "contract 145". The logic reads `SOURCE_CONTRACT` and `TARGET_CONTRACT` and was correct throughout — which is why the run proved a 145 source and a 151 result under a label saying otherwise — but the eleventh entry made this exact point about the previous pair and it is worth not making a third time.

**Production football state changed today, and NOT through this promotion.** Between 17:37 and 17:52 UTC — roughly an hour before this rollout, which applies DDL only — Production received 578 season fixtures across both leagues, 56 teams, 105 provider identity rows and a second, enabled provider poll target. That work is not recorded here because it is not this promotion's; it is noted so a later reader does not attribute it to the schema batch. Its provenance was checked rather than assumed: 578 rows in `provider_fixture_proposals`, and the 12 fixtures that hold a result carry `action = 'confirm'` with `actor_id` null, each tied to a retained `raw_response_id` and a SportMonks status token — contract 135's audited automatic path. **No sign of a Development row copy**, which the contract 132 boundary forbids. Both poll targets carry contract 146's columns with `cadence_minutes` at 1440.

**What this did NOT do.** It did not publish Euro 2028 — the state is still `hidden`. It did not promote the application, which is separately controlled. It opened no season competition: both league seasons are still `draft`, so contract 147 correctly returns nothing on Production. `promotionAuthorised` stays `false`.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **151** | 151 canonical migrations through `20260810170000_season_player_profile.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **151** | Guarded fast-lane run `31417611501`, independently confirmed by a read-only ledger query and by proving the five new reads, two internal functions and three columns present with zero browser grants. | LEVEL |
| Production Supabase | **151** | Rollout run `31420443441` gated on backup `31418252958` and rehearsal `31419966598`; independently confirmed by a read-only query returning 151 rows ending `20260810170000_season_player_profile` with every player-owned count unchanged. | LEVEL |

**A generated-types artifact depends on this level.** `src/services/supabase/database.types.ts` was generated read-only from Development at contract 151 precisely because Development and the repository are level; `tests/services/databaseTypes.test.ts` fails if a later migration lands without a regeneration. See [`../quality/database-types-baseline.md`](../quality/database-types-baseline.md).

## Superseded — 10 August 2026 (sixteenth entry)

**Contracts 146 to 151 are the repository candidate and are applied to neither hosted environment.** They are being accumulated as one batch before rollout, at the owner's direction, rather than promoted one at a time.

Contract 146 makes the provider poll affordable and makes its question move. Contract 147 and contract 148 close two of the `MIG-UI-*` backend gaps the UI finalisation work registered: `MIG-UI-12`, the published weekly catalogue carrying the **route slug** a URL is built from — publishing a league previously needed a frontend code change for it to exist — and `MIG-UI-11`, one season fixture addressed by its own id, so an addressable Match Centre link no longer has to carry the fixture's day as a hint.

Contract 147 returns **league seasons only**, which is an `EURO-001` safety property and not a filter of convenience: a catalogue enumerating `tournaments` without discriminating on kind would put Euro 2028 on the weekly platform's own discovery surface. It excludes drafts, so Production correctly returns nothing there until a season is opened.

**Contract 149 adds `MIG-UI-01`** — the league-wide prediction reveal, gated on the matchweek's own lock. **Contract 150 adds `MIG-UI-03`** (league rank movement) and **contract 151 adds `MIG-UI-02`** (player profile and prediction history). The batch is complete and ready for rollout: contract 146 through contract 151, six migrations, all additive. `MIG-UI-04`, `MIG-UI-08` and `MIG-UI-09` are marked not-blockers by the register itself; `MIG-UI-05`, `MIG-UI-06` and `MIG-UI-10` are a separate and larger workstream and are not in this batch.

**The `MIG-UI-*` register itself is not yet on `main`** — it lives on the unmerged UI finalisation branch, so the identifiers above are traceable only there until that branch lands.

**Production still cannot ingest anything.** `dispatch_due_provider_polls()` returns `configured: false`: Production holds the Vault secret `provider_poll_function_url` but **not** `provider_poll_caller_key`, which Development has. Re-checked after the owner reported adding secrets on 10 August 2026; the database Vault secret was still absent, and it is separate from the Edge Function secrets.

**Development's provider waste was stopped on 10 August 2026** without waiting for contract 146: the live SportMonks target's `cadence_minutes` moved from 5 to 1440, ending roughly 287 wasted requests a day. Its path still carries the frozen `2026-08-08/2026-08-09` window and can only become a rolling one once contract 146 is applied there.

## Superseded — 10 August 2026 (fifteenth entry)

**Contract 146 is the repository candidate and is applied to neither hosted environment.** It makes the provider poll affordable and makes its question move, and it exists because both halves were measured rather than suspected. On hosted Development the one live target carried `cadence_minutes = 5`, so it polled 288 times a day while the next fixture in either league was **eleven days away** — the next Premier League kickoff is 21 August and the next Scottish Premiership kickoff 22 August. It also asked for `/fixtures/between/2026-08-08/2026-08-09`, a range already in the past, so it could have polled for a month and never seen the fixtures it was paid to find. The expensive half and the useless half were independent, which is why neither was obvious alone.

`cadence_minutes` keeps its name and becomes the **idle** cadence, now defaulting to one call a day. `live_cadence_minutes` applies only inside a window that opens `live_lead_minutes` before a kickoff and closes `live_tail_minutes` after it, **and only while that fixture still has no result** — so contract 135 writing the official result is what ends the expensive polling, rather than anyone deciding it should. A stored path may carry `{{date:+N}}` placeholders resolved at dispatch in the competition's own timezone, so the window rolls forward on its own.

Cost, stated so it can be checked rather than trusted: with the defaults and a Saturday whose kickoffs run 11:30 to 19:00, the live window spans about 9h45, which is 58 requests at ten-minute spacing plus one idle call. A day with no fixtures costs exactly one request. Two league targets therefore cost about 118 requests on a full matchday and 2 on a quiet one.

**Production still cannot ingest anything, and the reason is now measured.** `dispatch_due_provider_polls()` on Production returns `configured: false`. It holds the Vault secret `provider_poll_function_url` but **not** `provider_poll_caller_key`, which Development has. Until that secret and the Edge Function's `SPORTMONKS_API_TOKEN` and `provider_poll` caller key exist, no fixture can reach Production — and because contract 127 derives a season calendar from fixtures, opening a season competition first would only produce an empty calendar. The order is credentials, then fixtures, then open.

**Production football state, measured 10 August 2026:** zero season fixtures, zero provider poll targets, zero provider entity map rows, zero poll dispatches, both league seasons `status = draft`, and the only 24 teams are the Euro 2028 placeholders `Team A1`…`Team F4`. No club exists in Production.

## Superseded — 10 August 2026 (fourteenth entry)

**The release smoke runs, and it passes.** `production-smoke.yml` run **`31397090845`** succeeded in full against published commit `be3efdff6ac9880e3385ae142d7f0485c5068649` at contract 145 — the anonymous perimeter assertion, the authenticated release-identity poll, the browser session, the HTTP smoke and the Playwright browser smoke. The thirteenth entry recorded that gate as unclosable in practice; it is closed.

**The mechanism was measured, and the measurement contradicted the documentation.** A disposable probe ran five candidate exchanges from a runner. HTTP Basic auth was refused in both forms and the anonymous 401 carried **no `WWW-Authenticate` header at all**; a form POST of `password=` followed by the returned cookie answered 200 with our release identity. Netlify's site password is a login form, and Basic-Auth-via-`_headers` is a different feature that the public material conflates with it constantly. Building on that guess would have produced a smoke failing for a reason nobody could distinguish from a bad release.

**It is two assertions rather than one.** An authenticated-only smoke would have been *weaker* than the accidental red it replaced, which at least proved an anonymous visitor was refused. So a credential-free request must now answer 401 before anything authenticates, and a 200 there is a stop rather than a warning — publishing is not a decision a workflow may take on the owner's behalf.

**The first run that got far enough found a real defect.** Its route sweep failed on `/predict` — a retired tournament path that `src/App.tsx` no longer declares and `netlify.toml` deliberately sends to the 404 catch-all, but which the smoke's hand-written route list still demanded 200 for. The list is now derived from netlify.toml's own 200 rules, which widened the sweep from eight hand-listed routes to the thirty-three the configuration actually promises, including every parameterised competition, league, join, h2h and profile route — none of which had ever been checked against production. The same stale path was removed from the browser spec, where it could never have tested the signed-out gate it claimed to.

**The legacy-brand allowance is retired**, in the change that made the smoke runnable rather than the one that noticed it, so the first authenticated run proved the published title before the looser branch was dropped.

**What this did NOT do.** It proves the signed-out surface only. Nothing here shows what a logged-in player sees, and the honest expectation is that they would find the competitions empty: Production still holds zero season fixtures and `admin_open_season_competition` has never been run there. Euro 2028 is still `hidden`. `promotionAuthorised` stays `false`.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **145** | 145 canonical migrations through `20260810010000_rate_limit_atomicity.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **145** | Guarded fast-lane run `31376619737`, independently confirmed by a read-only ledger query and by driving the contract on the target. | LEVEL |
| Production Supabase | **145** | Rollout run `31379974246` gated on backup `31378953968` and rehearsal `31379390093`; independently confirmed by a read-only ledger query and by driving the contract on the target. | LEVEL |
| Published production artifact | **145** | Deploy from `be3efdff…`, verified end to end by passing smoke run `31397090845`: perimeter, release identity, security headers, thirty-three routes, 404 catch-all and signed-out browser journeys. | LEVEL AND SMOKE-VERIFIED |

## Superseded — 10 August 2026 (thirteenth entry)

**The published application moved for the first time since 30 July, and every one of the four rows is now at contract 145.** Deploy **`6a79b4d5a5e45e0008beec70`** from commit `ff1fe15db680dd5f5f6698749a8371aba2584cec`, published 11:24:44Z, build time 38 seconds, 38 files, 35 redirect rules, 1 header rule, no functions, 1651 files secret-scanned with zero matches. The rollback target is the deploy it replaced, `6a6bac566b6e440008d44e5b`.

**Netlify's own repository build produced it, not an upload.** The twelfth entry recorded that the agent session could not upload an artifact because `api.netlify.com` and `netlify-mcp.netlify.app` are refused by the session egress policy. Merging the documentation change that recorded that denial was itself a push to `main`, Netlify built it, and the release happened. The denial delayed the release by one merge rather than blocking it. A repository build is also the stronger evidence: the deploy record carries the exact `commit_ref`, which an upload need not.

**The release smoke could not run, and that is not a verdict on the artifact.** `production-smoke.yml` run `31383883792` fetches `release.json` anonymously and retries 120 times; every attempt between 11:32 and 11:42 returned **401**, because the site is protected. The workflow fails by construction against a protected site whatever was published, and would have failed identically before this release. What it does establish is that the perimeter refuses an anonymous visitor — corroborated independently by the deploy's own Lighthouse plugin, which could not load the site for the same reason.

**The access-control mechanism changed and needs an owner confirmation.** A project read at 11:0x showed `requiresSSOTeamLogin: true` with `requiresPassword: false`; a read at 11:26 showed `requiresPassword: true` across all contexts with `requiresSSOTeamLogin: false`. Nothing in this work changed it — the only Netlify write was the production `EURO28_DEPLOYED_DB_CONTRACT`, and an environment variable cannot move an access control. The site is protected either way and this is not a public launch, but production should not be described as "behind Team SSO" until the project is read again.

**What this did NOT do.** It published no football and opened no competition: Production still holds zero season fixtures and `admin_open_season_competition` has still never been run there, so a signed-in visitor finds the competitions empty. It did not publish Euro 2028 — the state is still `hidden`. It did not make the site public. It proves what was built and published, not what a logged-in player sees. `promotionAuthorised` stays `false`.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **145** | 145 canonical migrations through `20260810010000_rate_limit_atomicity.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **145** | Guarded fast-lane run `31376619737`, independently confirmed by a read-only ledger query and by driving the contract on the target. | LEVEL |
| Production Supabase | **145** | Rollout run `31379974246` gated on backup `31378953968` and rehearsal `31379390093`; independently confirmed by a read-only ledger query and by driving the contract on the target. | LEVEL |
| Published production artifact | **145** | Deploy `6a79b4d5a5e45e0008beec70` from `ff1fe15d…`, published 11:24:44Z by a Netlify repository build on the push to `main`. Rollback target `6a6bac566b6e440008d44e5b`. | LEVEL — RELEASE SMOKE UNRUNNABLE AGAINST A PROTECTED SITE |

## Superseded — 10 August 2026 (twelfth entry)

**All four declarations are now at contract 145, and the published application is still not.** The eleventh entry levelled the repository and the two databases. This entry moves the Netlify declarations onto them and records what happened when the application release was attempted.

**The Netlify declarations moved after their databases, never before.** The three non-production contexts were raised from 132 to 145 once the guarded fast lane had applied contract 145 to Development. The production context was raised from 132 to 144, and then from 144 to 145 only after rollout run `31379974246` had applied contract 145 to Production and the read-only ledger query in the eleventh entry had confirmed it. A direct Netlify project read on 10 August 2026 confirms all four values and confirms every other context value survived the change; `dev-server` is still blank and still fails closed.

**Why the artifact has been stuck since 30 July, measured rather than assumed.** `scripts/validate-deployment-contract.mjs` runs in `prebuild` and demands an *exact* match for the production context; only a non-production context may trail. The production declaration read 132 from 31 July until this morning while the repository moved to 133 and beyond, so every production build from `main` in that window would have failed the gate before Vite ran. The stale bundle is the guard working, not a separate fault. With declaration and repository both at 145 the gate is satisfied for the first time since 30 July.

**The agent session cannot upload the artifact.** The Netlify MCP tools work, because they run outside the session container, and they were enough to read the project, read and write the environment variables and read the published deploy. The zip-and-build upload runs `npx @netlify/mcp` *inside* the container, and both `api.netlify.com` and `netlify-mcp.netlify.app` were refused by the session egress policy with `CONNECT tunnel failed, response 403`, with no proxy-side relay failure recorded. That is an organisation egress denial: it is reported here rather than routed around. The route that remains is Netlify's own repository build on a push to `main`.

**Rollback target recorded.** Published production deploy `6a6bac566b6e440008d44e5b`, `state: ready`, `context: production`, `branch: main`, `commit_ref: 8244b7222b9d108e59380fd16351c02b578497ee`, published 30 July 2026. Its own record says `deploy_source: "api"` with `has_source_zip: true` and `manual_deploy: false` — the currently live bundle was itself a source-zip build, not a local `dist` push.

**Feature flags are unchanged and that is deliberate.** Production carries `VITE_UI_SEASON_MATCH_PREDICTOR=true`, set by the owner on 8 August 2026. `VITE_UI_PUBLIC_LANDING` is set for `deploy-preview` only, in `netlify.toml`, and is not set for production. `src/app/routeFlags.ts` fails closed, so a production build serves the UI Alpha season Match Predictor and the **legacy** landing. No flag was added or removed in this entry.

**Team SSO is unchanged and still protects all contexts.** This is not a public launch; `AGE-001` remains accepted and unbuilt.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **145** | 145 canonical migrations through `20260810010000_rate_limit_atomicity.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **145** | Guarded fast-lane run `31376619737`, independently confirmed by a read-only ledger query and by driving the contract on the target. Unchanged since the eleventh entry. | LEVEL |
| Production Supabase | **145** | Rollout run `31379974246` gated on backup `31378953968` and rehearsal `31379390093`; independently confirmed by a read-only ledger query and by driving the contract on the target. Unchanged since the eleventh entry. | LEVEL |
| Published production artifact | **63-era** | Deploy `6a6bac566b6e440008d44e5b` from `8244b722…`, published 30 July 2026. Not moved by this entry. | THIRTEEN CONTRACTS BEHIND THE DATABASE IT TALKS TO |

The two Netlify declaration rows that stood in this table are preserved here as prose rather than as table rows, for the same reason the earlier pair was: the machine check requires exactly one row per context group, and the live declaration now lives in the eighteenth entry. Their content is unchanged and is not restated more favourably. A direct Netlify read on **10 August 2026** found `dev`, `branch-deploy` and `deploy-preview` pointing at Development and each declaring **145**, raised only after the fast lane applied contract 145 there, with `dev-server` blank and failing closed; and production pointing at Production Supabase and declaring **145**, raised from 144 only after rollout run `31379974246` and its independent ledger verification, while the published artifact was still the 30 July `8244b722…` Contract-63-era bundle — so declaration alignment was **not** an application deployment. A declaration may intentionally trail its hosted database but must never lead it.

## Superseded — 10 August 2026 (eleventh entry)

**Repository, Development and Production are all at contract 145.** For the first time in this sequence the three are level.

Contract 145 reached Production through guarded rollout run **31379974246** from exact `main` `03a0ca0c82a9857c2e63f39a524e62f3877e0abc`, after its own API check that backup run **31378953968** and rehearsal run **31379390093** had both concluded success. Independent read-only verification afterwards:

```json
{"migration_count": 145, "latest": "20260810010000_rate_limit_atomicity",
 "enforce_rate_limit_takes_advisory_lock": true,
 "enforce_rate_limit_public_execute": 0, "rate_limit_events_browser_grants": 0,
 "auth_users": 1, "entries": 2, "match_predictions": 36,
 "euro_publication_state": "hidden", "sportmonks_final_statuses": 1}
```

The advisory lock is genuinely in the function rather than merely the migration row being present; no grant moved on `enforce_rate_limit` or on `rate_limit_events`; no player-owned count moved; and the Euro state and SportMonks vocabulary are untouched, which a rate-limiter change has no business moving.

**The rehearsal passed first time.** That is worth recording against the previous boundary, where it took four attempts and found three defects — all in the workflow rather than in the migrations. The successors were derived from the pair that worked rather than written afresh, so the absolute Postgres 17 `pg_dump`, the faithful privilege restore that runs `prepare-disposable-restore-target.sql`, and paths that never rely on `cd` were present from the start. Deriving from a proven artefact rather than a remembered one is the transferable lesson.

**Two step labels in the successor rehearsal were stale** and are corrected here: the source-proof step read "contract 132" and the verification step read "contract 144", both inherited from the derivation. Cosmetic only — the logic reads `SOURCE_CONTRACT` and `TARGET_CONTRACT`, which is why the run correctly proved a 144 source and a 145 result — but a misleading label on a production promotion is worth fixing before someone reads a run and believes it.

**Risk-register `DATA-007`.** The atomicity half is now closed in both hosted environments. The rest of that entry is unchanged: invalid operations still consume no limit, the expensive read RPCs are still unbounded, and there are no edge/IP controls or alerting, so the entry stays open and reduced.

**What this did NOT do.** It did not publish Euro 2028 — the state is still `hidden` in Production. It did not promote the application: the published artifact remains the 30 July contract-63 bundle, and [`records/production-application-release-144.md`](records/production-application-release-144.md) describes the separate release, which is now one contract further behind. It imported no football; Production still holds zero season fixtures. `promotionAuthorised` stays `false`.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **145** | 145 canonical migrations through `20260810010000_rate_limit_atomicity.sql`. | LEVEL |
| Development Supabase `iouzoutneyjpugbbtdem` | **145** | Guarded fast-lane run `31376619737`, independently confirmed by a read-only ledger query and by driving the contract on the target. | LEVEL |
| Production Supabase | **145** | Rollout run `31379974246` gated on backup `31378953968` and rehearsal `31379390093`; independently confirmed by a read-only ledger query and by driving the contract on the target. | LEVEL |

## Superseded — 10 August 2026 (tenth entry)

**Development is at contract 145; Production is at 144 and its promotion to 145 is authorised and prepared.**

Contract 145 reached Development through guarded fast-lane run **31376619737** from exact `main` `a4baae0`. Confirmed by an independent read-only query rather than from the job: 145 rows ending `20260810010000_rate_limit_atomicity`, `enforce_rate_limit` genuinely containing `pg_advisory_xact_lock`, and zero execute grants on that function alongside zero browser grants on `rate_limit_events` — so the redefinition did the thing it exists to do and widened no control while doing it.

**The 132→144 promotion pair is spent.** Those workflows are pinned one-shots and now refuse by design: their source check requires live Production at 132, and Production is 144. `production-144-to-145-rehearsal.yml` and `production-144-to-145-rollout.yml` are their successors, derived from the pair that succeeded so the three defects found across four rehearsal attempts — the Ubuntu 16 `pg_dump`, the stripped privileges, the `--file` resolved against the project root — are fixed in them from the start.

**What the new pair asserts is different, because contract 145 is different.** The 132→144 verification checked that three new contracts arrived inert. Contract 145 redefines exactly one function, so "Euro is hidden, zero profiles" would prove nothing about it. The successors assert that `enforce_rate_limit` contains `pg_advisory_xact_lock`, that it still carries no PUBLIC/`anon`/`authenticated` execute grant — `create or replace` preserves the access-control list, so a redefinition must not have widened a security control — that `rate_limit_events` still has no browser grant, and that the Euro state and SportMonks vocabulary are untouched, since a rate-limiter change has no business moving them.

**A fresh backup is required and the earlier one does not carry over.** Backup run 31365261774 captured Production at contract 132. The 144→145 rollout gates on a backup run id and a rehearsal run id it verifies through the API, and both must describe the boundary actually being promoted.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **145** | 145 canonical migrations through `20260810010000_rate_limit_atomicity.sql`. | LEVEL WITH DEVELOPMENT |
| Development Supabase `iouzoutneyjpugbbtdem` | **145** | Guarded fast-lane run `31376619737` from exact `main` `a4baae0`, independently confirmed by a read-only ledger query returning 145 rows and by driving the contract on the target: the advisory lock is in the function and no grant moved. | LEVEL WITH REPOSITORY |
| Production Supabase | **144** | Rollout run `31374274932`, independently confirmed. Promotion to 145 authorised 10 August 2026; the pinned successor workflows exist and no backup or rehearsal has yet been run for this boundary. | ONE BEHIND, PROMOTION PREPARED |

## Superseded — 10 August 2026 (ninth entry)

**Production is at contract 144.** The promotion the seventh entry recorded as authorised-but-blocked has happened, and the machine records are reconciled from an independent read rather than from the job's own output.

**How it cleared.** The blocker was the secret, not the schema: `SUPABASE_PROD_DB_URL` named the IPv6-only direct host while GitHub runners are IPv4-only. Repointing it at the `eu-west-2` session pooler on port 5432 cleared it, and backup run **31365261774** then completed in five minutes where run 31327860208 had failed in thirty-four seconds.

**The rehearsal took four attempts and found three defects, all of them in the rehearsal workflow rather than in the twelve migrations.** Recorded because the runs are in the history and a reader deserves to know they say nothing about the promotion's safety: run 31366046231 called bare `pg_dump`, which resolves to Ubuntu's 16 client and refuses against a 17.6 server; run 31367760639 dumped with `--no-privileges`, so the fresh local stack's own default privileges granted `anon` and `authenticated` on every restored public table and contract 139 correctly refused a target that was not Production-shaped; run 31370007090 reported `dump is empty: roles.sql` because `supabase init` makes the work directory a project root and the CLI resolves a relative `--file` against that rather than against the working directory. The second of those is the one worth keeping: it proved the guard catches an unfaithful target, and it prompted measuring the real privilege shape on both hosted projects, which return NONE.

**Rehearsal run 31373514522** then restored a fresh Production dump into a disposable local target and replayed all twelve there, reaching exactly 144 with every player-owned count intact and the three new contracts inert.

**Rollout run 31374274932** applied contracts 133–144 to Production from exact `main` `e54a45b`, after its own API check that the backup and rehearsal runs had both concluded success. Independent read-only verification afterwards:

```json
{"migration_count": 144, "latest_version": "20260809140000",
 "latest_name": "provider_team_profile_foundation", "contract_145_absent": true,
 "auth_users": 1, "profiles": 1, "entries": 2, "match_predictions": 36, "entry_totals": 2,
 "euro_publication_state": "hidden", "euro_publication_history": 0,
 "sportmonks_final_statuses": 1, "provider_team_profiles": 0, "season_fixtures": 0}
```

Every player-owned count is identical to the pre-apply snapshot. Contract 145 is absent, held back by the pinned boundary as intended.

**What this did NOT do**, so no later reader mistakes a schema promotion for a launch: it did not publish Euro 2028 — contract 143 arrived `hidden` and publication remains an owner act; it did not promote the application, which is separately controlled and still at the Euro baseline; it imported no football, and Production still holds zero season fixtures, so contract 135's provider result authority has nothing to act on there yet. `promotionAuthorised` stays `false` in `config/production-hosted-contract.json`, which is the fail-closed default and is enforced by `production-hosted-contract-expectations.mjs`.

**Contract 145 remains unpromoted to either hosted environment.** It is pending for Development and outside the authorised Production set. It redefines `enforce_rate_limit` to take an advisory lock, which is a behaviour change to a security control and wants its own decision rather than a ride-along.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **145** | 145 canonical migrations through `20260810010000_rate_limit_atomicity.sql`. | ONE AHEAD OF BOTH HOSTED |
| Development Supabase `iouzoutneyjpugbbtdem` | **144** | Guarded fast-lane run `31327666892`, independently confirmed by a read-only ledger query returning 144 rows. Contract 145 not yet applied. | ONE BEHIND REPOSITORY |
| Production Supabase | **144** | Rollout run `31374274932` from exact `main` `e54a45b`, gated on backup `31365261774` and rehearsal `31373514522`; independently confirmed by a read-only ledger query returning 144 rows ending `20260809140000_provider_team_profile_foundation` with contract 145 absent. | LEVEL WITH DEVELOPMENT |

## Superseded — 10 August 2026 (eighth entry)

**At the time of this entry the repository stood at contract 145 and hosted Development was one behind at 144.** `20260810010000_rate_limit_atomicity.sql` is the only pending Development migration. It is additive in the sense the fast lane checks — it creates and drops nothing, and redefines exactly one function — and it is privileges-neutral: `create or replace` preserves the existing access-control list, and the migration re-states the original `revoke all ... from public` rather than restoring it.

**What it changes, so a reviewer of the rollout knows what to look at.** `public.enforce_rate_limit(text, int)` now takes `pg_advisory_xact_lock` keyed on the calling user before it prunes, counts and inserts. Its signature, its `security definer` property, its pinned `search_path`, both ceilings (60/min prediction save, 5/min league membership), both trigger bindings and `public.rate_limit_events` itself are untouched. Nothing else in the schema moves.

**Nothing is claimed hosted.** Contract 145 reaches Development only through the guarded additive fast lane, and Production only through its own separately approved promotion — which remains blocked on `SUPABASE_PROD_DB_URL` as the seventh entry below records. Risk-register `DATA-007` therefore stays open in both hosted environments until the apply happens, and remains partly open in the repository, because atomicity is one of the four things its closure asks for.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **145** | 145 canonical migrations through `20260810010000_rate_limit_atomicity.sql`. | ONE AHEAD OF DEVELOPMENT |
| Development Supabase `iouzoutneyjpugbbtdem` | **144** | Unchanged since the seventh entry: guarded fast-lane run `31327666892`, independently confirmed by a read-only ledger query returning 144 rows. No rollout has been attempted for contract 145. | ONE BEHIND REPOSITORY |
| Production Supabase | **132** | Unchanged since the seventh entry. Promotion is authorised to 144 and blocked on the IPv4 reachability of `SUPABASE_PROD_DB_URL`; contract 145 is not part of that authorised set. | THIRTEEN BEHIND, BLOCKED ON THE SECRET |

## Superseded — 9 August 2026 (seventh entry)

Repository, Development and the machine records all stand at **contract 144**. Development was applied by guarded fast-lane run 31327666892 from exact `main` `72af085` and independently confirmed by a read-only ledger query returning 144 rows ending `20260809140000_provider_team_profile_foundation`, with contract 142 resolving token `22` to `in_play`, contract 143 arriving `hidden` with empty history, and contract 144's writer holding no grant.

**Production remains at contract 132, and its promotion to 144 is blocked on infrastructure rather than on approval.** The owner authorised the Production migration on 9 August 2026. The first gate — `production-backup.yml`, run **31327860208** — failed in 34 seconds, before reading a single row:

```
psql: error: connection to server at "db.vkfnsqdyhvtwyqkisxhk.supabase.co"
(2a05:d01c:1b7:9302:6bc5:501b:c449:4da0), port 5432 failed: Network is unreachable
```

That is an IPv6 address. GitHub-hosted runners are IPv4-only, and `SUPABASE_PROD_DB_URL` names the **direct** database host, which Supabase serves over IPv6 unless the IPv4 add-on is held. This is not general unreachability: the Development fast lane connected successfully from the same runner fleet minutes earlier, so the difference is the form of this one secret.

**What clears it — an owner action, because it is a repository secret.** Repoint `SUPABASE_PROD_DB_URL` at the IPv4-reachable session pooler for `eu-west-2`:

```
postgresql://postgres.vkfnsqdyhvtwyqkisxhk:<password>@aws-0-eu-west-2.pooler.supabase.com:5432/postgres
```

Session mode on port **5432**, not transaction mode on 6543 — transaction pooling does not carry the prepared statements `supabase db push` relies on. The existing secret guard still holds after the change, because the pooler username embeds the project ref, so `production-backup.yml`, the rehearsal and the rollout all continue to refuse a secret that resolves to Development. The alternative is enabling the project's IPv4 add-on and leaving the secret alone.

**Nothing was written to Production.** No backup exists for the 132 → 144 boundary, no rehearsal has run, and `promotionAuthorised` stays `false` in `config/production-hosted-contract.json` until the promotion actually happens.

The two workflows the promotion needs are now authored and committed: `production-132-to-144-rehearsal.yml` (read-only against Production; restores a fresh dump to a disposable local target and rehearses the forward apply there) and `production-132-to-144-rollout.yml` (pinned to exactly the twelve migrations, and refusing to write until it has itself confirmed a successful backup run id and a successful rehearsal run id through the API). All twelve migrations were checked with `scripts/check-migration-additive.mjs` and every one reported additive.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **144** | 144 canonical migrations through `20260809140000_provider_team_profile_foundation.sql`, merged to `main` in #623. | LEVEL WITH DEVELOPMENT |
| Development Supabase `iouzoutneyjpugbbtdem` | **144** | Guarded fast-lane run `31327666892` from exact `main` `72af085`, plus an independent read-only query returning 144 rows ending `20260809110000`→`20260809140000`; contract 142 resolves token `22`, contract 143 is `hidden` with empty history, contract 144's writer holds no grant. | LEVEL WITH REPOSITORY |
| Production Supabase | **132** | Independent read-only ledger verification returning 132 rows ending `20260807210812_provider_initial_fixture_approval`. Promotion to 144 is authorised but BLOCKED: `SUPABASE_PROD_DB_URL` names the IPv6-only direct host and GitHub runners are IPv4-only. | TWELVE BEHIND, BLOCKED ON THE SECRET |

## Superseded — 9 August 2026 (sixth entry)

Hosted Development stands at **contract 141**, `20260809110000_season_club_form`, confirmed twice: by guarded fast-lane run **31315796640** from exact `main` `d03fcaf`, and by an independent read-only query of `supabase_migrations.schema_migrations` on project `iouzoutneyjpugbbtdem`, which returned exactly 141 rows ending at that version. `config/development-hosted-contract.json` now says so; it had been stranded at 133 for a reason worth recording.

**Why the machine record was eight contracts stale.** The follow-up automation did write a record after each rollout and did push it — four branches, four open pull requests (#613, #615, #617, #619). None could be merged, because each one also rewrote `productionContract` from **132** down to a hard-coded **63**: a literal in `.github/workflows/development-hosted-status-followup.yml` that was true when it was written and false from the next production rollout onwards. Every run therefore proposed an unapproved contract-declaration change alongside a correct development one, and the correct half sat unmerged behind the wrong half. The workflow now reads both `productionContract` and `productionPromotionAuthorised` from `config/production-hosted-contract.json`, which is their authority, so the record it writes is true in both halves. The four open pull requests are superseded and can be closed unmerged.

**Pending for Development: three, all additive.** Contract 142 (`20260809120000_sportmonks_second_half_status.sql`) inserts one status-vocabulary row. Contract 143 (`20260809130000_euro_publication_state.sql`) creates the EURO-002 publication state, its history and two RPCs. Contract 144 (`20260809140000_provider_team_profile_foundation.sql`) creates one internal table and one definer writer granted to no role. All three are new relations, functions and grants only; none alters an existing relation. Production remains at contract 132, untouched and unauthorised for promotion.

| Environment | Contract | Evidence | Status |
| --- | ---: | --- | --- |
| Repository candidate | **144** | 144 canonical migrations through `20260809140000_provider_team_profile_foundation.sql`. | THREE AHEAD OF DEVELOPMENT |
| Development Supabase `iouzoutneyjpugbbtdem` | **141** | Guarded fast-lane run `31315796640` from exact `main` `d03fcaf1b50b2f66ddb0ea0366a413afa9fe84bb`, plus an independent read-only query of `supabase_migrations.schema_migrations` returning exactly 141 rows ending `20260809110000_season_club_form`. | CONTRACTS 142, 143 AND 144 PENDING |
| Production Supabase | **132** | Independent read-only ledger verification on 8 August 2026 ends at `20260807210812_provider_initial_fixture_approval`; unchanged since. Promotion remains unauthorised. | UNTOUCHED |

## Superseded — 9 August 2026 (fifth entry)

Contracts 140 and 141 were applied to hosted Development by guarded fast-lane run **31315796640** from exact `main` `d03fcaf` and verified: 141 rows, newest `20260809110000`, and all twelve Scottish clubs returning real derived form from results the provider wrote automatically. Contract 142 (`20260809120000_sportmonks_second_half_status.sql`) is the only migration now pending; it is additive and inserts one vocabulary row. Production remains at contract 132 and is untouched.

## Superseded — 9 August 2026 (fourth entry)

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

The two Netlify declaration rows that stood in this table are preserved here as prose rather than as table rows, because the current declaration now lives in the twelfth entry and the machine check requires exactly one row per context group. Their content is unchanged and is not restated more favourably: a direct Netlify read on **8 August 2026** found `dev`, `branch-deploy` and `deploy-preview` pointing at Development and each declaring **132**, trailing hosted Development 133 by one — valid under the guarded trailing-declaration model — with `dev-server` blank and failing closed; and production pointing at Production Supabase and declaring **132**, level with hosted Production, with Team SSO protecting production and the published artifact still the 30 July `8244b722…` Contract-63-era bundle, so declaration alignment was **not** an application deployment.

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
