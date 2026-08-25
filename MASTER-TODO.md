# Active delivery backlog

**Status date:** 20 August 2026  
**Purpose:** a short index of work that is genuinely still live. An unchecked item here means work remains.  
**Historical snapshot before this reconciliation:** [`docs/history/context-reset-2026-08-19/MASTER-TODO.pre-reconciliation.txt`](docs/history/context-reset-2026-08-19/MASTER-TODO.pre-reconciliation.txt)

This file is **not** implementation truth and does not restate moving contract numbers. Start with [`NOW.md`](NOW.md), then use the authority linked for the task.

| Question | Authority |
| --- | --- |
| Current repository/hosted facts | [`NOW.md`](NOW.md) → [`docs/quality/current-status.md`](docs/quality/current-status.md) |
| Current vNext stage | [`config/vnext-programme.json`](config/vnext-programme.json) |
| vNext stage scope/completion | [`docs/product/vnext-stage-contracts.md`](docs/product/vnext-stage-contracts.md) |
| Accepted product gaps | [`docs/quality/accepted-requirements.md`](docs/quality/accepted-requirements.md) |
| Current risks | [`docs/quality/risk-register.md`](docs/quality/risk-register.md) |
| Decisions | [`docs/adr/README.md`](docs/adr/README.md), [`docs/quality/deferred-decisions.md`](docs/quality/deferred-decisions.md) |
| Hosted migration state | [`docs/ops/ops-pending-migrations.md`](docs/ops/ops-pending-migrations.md) |
| GitHub work | Open issues/PRs — re-read before starting work |

## 1. vNext programme

- [ ] Complete the stage named by `config/vnext-programme.json`; do not infer progress from this file.
- [ ] Before the Stage 13 supporting-surface sweep grows further, close or deliberately schedule the vNext quality foundations: `TEST-002`, `CI-002`, `UX-006`, `TEST-003`, `DOC-004`, `OPS-012`.
- [ ] Stage 13 — migrate/support Account, onboarding, discovery, private-play entry, help and generic failure/empty/loading states using existing working capabilities rather than rebuilding them.
- [x] Stage 14 — Football Hub production cutover. **Done and ON.** Nine destination flags in `netlify.toml`'s `[build.environment]`, `productionCutoverAuthorized: true` in [`config/vnext-programme.json`](config/vnext-programme.json), every legacy route element still mounted so any one destination rolls back on its own with no data rollback, and every hosted environment level at Contract 208 — the boundary these surfaces read across — so the reads exist wherever they run. Three contracts have landed in the repository since. Contract 209 is the provider fixture lifecycle; contract 210 widens the poll window so a postponement is seen before the deadline it affects; contract 211 moves that coverage onto its own hourly tier so it costs a third as much. Both hosted environments sit at contract 209, and contracts 210 and 211 are not rolled out yet. None of the three adds a read any vNext surface makes, so none gates nor is gated by this cutover. [`docs/product/vnext-route-migration-matrix.md`](docs/product/vnext-route-migration-matrix.md) §13 owns the table.
  - [ ] What the cutover did NOT close, named rather than implied: authenticated performance and perceived-performance measurement at the real routes against a real database; and monitoring and alerting for the new surfaces. **`UX-007` is closed, measured 23 August 2026** — three consecutive runs at 375×720 and 1440×900, zero obscured keyboard stops; the hook and the hit-tested browser assertion both already existed and had never been run. See the risk register for what closing it took and why the earlier rectangle-arithmetic probe was unreliable.
  - [x] **A third thing the cutover did not close, found 23 August 2026 and now closed: it made the persistent action feed unreachable.** `vNextOwnsFrame` gives every Hub destination a branch of `AppShell` that renders no AppBar, and the AppBar was the only way into `src/app/ActionCentre.tsx` — so `get_my_actions` had no consumer in the production frame while five generators and contract 172's scheduler kept filling the table. vNext now has its own Action Centre at the shell, mounted once at `VNextSeamHost`. Repository-only: no migration, no new read, no new grant. `MIG-UI-14` in the register carries the detail.
- [ ] Stage 15 — Euro 2028 vNext adoption and final convergence audit.

**Do not duplicate the route matrix here.** [`docs/product/vnext-route-migration-matrix.md`](docs/product/vnext-route-migration-matrix.md) owns route fate. The active Championship/Stage 12 branch already carries its Stage 12 correction.

**Stage 12's two carried backend debts are paid in the repository, proved in Development, and still owed in Production.** The two Championship migrations pin `get_season_cup_phase` to a determinate membership row and put `bonus_competition_entrants.outcome` on the bracket read, so elimination is stated by the settlement authority rather than inferred. `config/vnext-programme.json` moves both from `carriedDebt` to `resolvedDebt`.

- [x] Roll the two Championship migrations to Development through the guarded lane and verify hosted. Done: [`config/development-hosted-contract.json`](config/development-hosted-contract.json) records fast-lane run 32312618799 from main `0c48962`, and an independent read-only query after it named 208 ledger rows with newest `20260819130000`, the installed phase definition using the determinate split membership rule, and the bracket emitting the caller's own outcome. Every Contract-205 protected count is unchanged.
- [ ] Promote 205→208 to Production. A SEPARATE AND UNAUTHORISED MILESTONE, coordinated by its own ops change. `hostedRolloutRequired` stays `true` in `config/vnext-programme.json` until it lands, because the flag covers every hosted environment and one of them is still owed.

## 2. Accepted product gaps still requiring delivery

Read the register for the actual requirement and acceptance evidence; these identifiers are an index, not a second specification.

- [ ] Domestic frontend: `DFA-001`, `DFA-004`, `DFA-006`–`DFA-012` where still open in the register.
- [ ] Product/data consumers and extensions: `MIG-UI-15`, `MIG-UI-16`, `MIG-UI-18`–`MIG-UI-20`, `INNOV-011a`, `INNOV-012a`, `INNOV-017a`, `INNOV-019a`, `PROF-001`.
- [ ] Capacity/lifecycle: `CAP-006`, `CAP-007`.
- [ ] Two-site/account/launch requirements that remain open under `SITE-*` and `ACCOUNT-*`.

Completed rows stay in the accepted-requirements register for traceability, but they do **not** stay as unchecked work here.

## 3. Active issue work outside the sequential vNext programme

Re-check GitHub before acting; issue bodies may contain dated evidence, while comments/current source can move the state forward.

- [ ] **#27** — finish retirement proof for the exact legacy `euro28-predictor-dev` surface.
- [ ] **#28** — Development Turnstile/CAPTCHA configuration and real auth-journey evidence.
- [x] **#33** — verify the effective Protect Main/ruleset controls and required contexts. **Closed by reading the ruleset rather than by asserting it.** On 25 August 2026 `GET /rules/branches/main` returned three rules from repository ruleset `20508177` — `deletion`, `non_fast_forward` and `required_status_checks` — with `enforcement: active`, `current_user_can_bypass: never` and `strict_required_status_checks_policy: false`. The required contexts are `CI / Required merge gate`, `Migration safety / Required migration gate` and `Database parity / Required parity gate`; `vNext merged browser gate` is **not** among them, which is what makes this worth closing mechanically rather than once. Every previous attempt recorded the same obstruction — that the connected tooling could not read rulesets — and it can: the endpoint needs only read access. The set is now tracked in [`config/required-merge-contexts.json`](config/required-merge-contexts.json), CI refuses a pull request that renames a gate job out from under a required context, and `npm run check:required-contexts -- --live` re-reads the hosted set from the Conductor doctor. Adding a context to the ruleset remains an owner action and is deliberately not automated.
- [ ] **#272** — independent qualified UK data-protection review; engineering cannot self-approve it.
- [ ] **#854** — AI Lab first-weekend/operational completion. **Contract 215 in PR #997 closes forecast/value currency at the repository boundary so historical horizons cannot become today's BET/PASS and stale advice cannot survive a fresher canonical forecast. Keep this item open:** generated Bet Builder slips still need immutable slip-level settlement/performance evidence, and hosted rollout/real operational evidence are separate milestones.
- [x] **#863 / PROF-001** — same-season bounded player-profile visibility. **Closed.** The backend is contract 206's `get_season_player_profile_by_ref`, merged in #920; the Development rollout is recorded in [`config/development-hosted-contract.json`](config/development-hosted-contract.json) at Contract 208; the generated types carry the RPC (`database.types.meta.json` at 208); and the consumer exists. `buildLeaguesModel.destinationOf` now opens a `compare` row by the season ref, `useVNextPlayerProfileSource` reads through whichever address the doorway carried — the account id where the shared-league boundary revealed one, the ref where it did not — and the account id never travels across the same-season boundary, which is what the migration means by *"player_ref is the only navigation identity exposed by this path"*. The pin has no ref-addressed write, so a same-season profile reports its pin state as unanswered rather than as unpinned.
- [x] **`PROF-002`** — first-release social scope settled after the merged Rival Watch work. **Pinned rivals are enough for first release.** The current experience is server-backed, season-scoped, limited to players already reachable through the shared-private-league boundary, persisted through `set_pinned_rival`, and re-read from `get_my_preferences`; it supplies the actual first-release job of deliberately keeping a small set of rivals close without creating a directory or follower graph. A separate named "people you follow" list would require a new enumeration contract only to duplicate that job, so it is not a first-release engineering blocker. No follower counts, global people search, popularity, feed or follower notifications are implied. If a distinct cross-surface people list is later shown to add a real journey Rival Watch cannot serve, it returns as a future enhancement under a new product decision rather than by reviving this checkbox.
- [ ] **#865** — optional native Supabase passkey Development pilot, subject to current provider capability and RP/domain gates.
- [ ] **#866** — available-provider anomaly corroboration sentinel.
- [ ] **#867 / INNOV-012a** — deterministic League Side Honours.
- [ ] **#868** — Predictor Hub external clearance/domain/DNS/Auth/sender operations.

## 4. Decisions and external gates

- [x] `DEC-017` — icon infrastructure decision. Answered: a vNext-native outline vocabulary, drawn in the lane rather than imported or added as a dependency.
- [x] `DEC-016` — vNext light-theme/persisted-theme decision. Answered: dark stays the default, a designed light ramp ships beside it, and the player's choice outranks the device.
- [ ] #272 external review before the blocked account-erasure ownership/schema path.
- [ ] #868 external brand/domain clearance and registration before public Hub launch.
- [ ] Any Production database/application mutation requires explicit authority for that exact action and target; a repository gap is not authorisation.

## 5. Release-quality debt that remains real

- [ ] **Apply contract 209 to Development, then confirm the provider lane is alive again.** Until it is applied, Development has imported nothing since 10 August: `ING-001` in the risk register. Confirm by the next `provider_response_consumption` row reading outcome `applied`, and by a postponed fixture appearing as postponed on Matches without anyone touching it. The 13 already-consumed responses do not replay — the recovery arrives with the next poll.
- [x] **`ING-002`** — measure SportMonks status tokens `14`–`21` against real payloads, or remove the guessed rows so they fail closed to `unknown`. **Checked against real payloads first and then removed at contract 213, pending hosted rollout.** None of `14`–`21` appears in either environment's retained responses, so all seven guessed rows are dropped rather than remapped; an unmapped token resolves `unknown` and is recorded in `provider_status_observations` where it can be measured. One residual stays open and is named in the risk register: token `4` was not observed either and is deliberately kept, because the retained window is too thin for a stoppage token and dropping it would change how a live match reads.
- [x] **`ING-005`** — decide whether the published prediction deadline is per fixture or per matchweek. **Decided per fixture and built at contract 212, pending hosted rollout.** Enforcement has been per fixture since contract 119; the card read published the matchweek instant, so a rescheduled fixture read as locked while the trigger would accept the write. The card now publishes `lock_at` and `locked` per fixture from the enforcement authority itself, and the Match Predictor draws each fixture against its own. Contract 119 is not reversed.
- [x] **`ING-006`** — a postponement can be up to 22 hours stale and the staleness spans the matchweek lock, so a player can be locked into a match already called off. **Closed on both hosted environments on 20 August 2026 by contract 210 and contract 211.** The originally proposed remedy here — raising `cadence_minutes` to 360 — was withdrawn as the worse fix: it spends four times the credit every day of the year and still leaves hours of silence immediately before a lock. What shipped instead is a deadline watch tier, `deadline_cadence_minutes` 60 inside `deadline_lead_minutes` 720, with `live_lead_minutes` returned to 15; same coverage at 77 polls a matchweek rather than 252. Arithmetic, cost and measured read-back in the risk register.
- [ ] Manual assistive-technology/accessibility checks and the vNext contrast/geometry gaps named in the risk register.
- [ ] Full-volume/performance and rollback rehearsals at the release stage that owns them.
- [ ] Remaining security/operations work such as CSP inline-style removal, residual rate-limit coverage, monitoring/alerting and recovery ownership where still open in the risk register.
- [ ] Repository hygiene still intentionally partial: release/version metadata, licence/changelog policy and historical component-gallery cleanup where still open.

## 6. Parked — valid future scope, not today's backlog

Euro 2028 official-data/final-release work remains parked until the tournament return window. It includes final qualified teams/draw, regulations, fixtures/kickoffs/venues, official squads/player references, final lock, tournament operations rehearsal and remaining tournament-only presentation work.

Do **not** surface those parked checkboxes beside current Hub/vNext work. The pre-reconciliation inventory is preserved in the historical snapshot linked at the top, and the recoverable `euro-2028-baseline` tag remains the tournament reference.

## Closure rule

When work completes:

1. update the canonical requirement/risk/issue with evidence;
2. remove or check off the corresponding live item here;
3. never copy historical completion narratives into this file;
4. never delete the historical snapshot merely to make the backlog look shorter.

The goal is simple: **if an AI sees an unchecked item in this file, it should be able to assume that meaningful work still remains.**

## Contract 214 sweep — current-card confirmation integrity

Contract 214 is implemented in the repository: a successful material season prediction or Joker change invalidates the previous matchweek confirmation, no-op or rejected writes preserve it, and the card read exposes the server-held confirmation instant plus a compact reference. Hosted rollout remains pending; this repository change does not claim a hosted schema update.

## Contract 215 sweep — AI Lab forecast/value currency

Contract 215 is implemented in the repository: the value loop keeps every historical forecast horizon as immutable audit evidence but assesses only the fixture's canonical newest non-quarantined forecast, and the current-recommendation read fails closed while a fresher canonical forecast awaits value evaluation. Hosted rollout remains pending; this repository change does not claim a hosted schema update.

## Contract 218 sweep — standings that move while you are looking at them

Contract 218 publishes one table, `public.matches`, on the realtime channel.
That is the whole migration. ADR 0008 already decided the shape years of
audits had asked for: a narrow live-results channel that INVALIDATES standings
queries, never a synchronisation layer and never a second place scores can
come from.

The browser reads no payload from it. The subscription hands its callback
nothing, so the only thing that can travel over this channel is the fact that
something changed; the numbers are refetched from `get_leaderboard`, which is
the only thing in the system that ranks anything. `REL-005` and `ACQ-R15` --
"users must refresh for result and standing changes" -- are what this closes.

It ships switched off. `VITE_LIVE_UPDATES_ENABLED` must be exactly `true`, per
ADR 0008's own consequence that the feature stays guarded until hosted
operational evidence exists.

## Contract 217 sweep — a channel that does not need a provider

The reminder path gained a second channel it can actually run. Web push needs no
provider account and no brand decision, so contract 217 adds it inside the
existing ledger: `channel` is a column on the row that was already there, chosen
at claim time from the player's live subscriptions, and the once-per-action
unique key is untouched so nobody is told the same thing twice.

**Outstanding, and it is one thing.** No player can turn it on. The account
switch cannot be written until the generated database types know contract 217,
and those come from hosted Development, which trails the repository. Rolling
this contract out to Development and regenerating the types is the single step
that unblocks the player-facing half; `tests/vnext/notificationPreferences.test.tsx`
fails at that moment and says what to build.

## Contract 216 sweep — the reminder sender gets a caller

Contract 216 is implemented in the repository: a `pg_cron` job posts a run id to
`notification-dispatch` every five minutes, a run ledger records what each
invocation was asked to do and what came back, and the per-row dry-run gate can
refuse for the first time — the claim now tightens it and never clears it.

**Outstanding and owned elsewhere.** No provider credential exists in any
environment, so nothing sends and no end-to-end delivery is claimed. Development
rollout of this contract, and the separate owner decision that would make
delivery live, are tracked in
[`docs/ops/notification-delivery.md`](docs/ops/notification-delivery.md).
