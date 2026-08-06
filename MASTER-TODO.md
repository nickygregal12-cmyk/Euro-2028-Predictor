# Multi-competition platform — master TODO

**Status date:** 5 August 2026  
**Current facts:** [`docs/quality/current-status.md`](docs/quality/current-status.md)  
**Execution sequence:** [`docs/roadmap.md`](docs/roadmap.md)  
**Programme map:** [`docs/architecture/multi-competition-hub-build-plan.md`](docs/architecture/multi-competition-hub-build-plan.md)  
**Decision authority:** [`docs/adr/README.md`](docs/adr/README.md), including later amendments through ADR 0025

This is the detailed inventory. It does not replace the roadmap's ordering or the current-status facts. Items are moved between the two sections; they are not silently discarded.

# Part I — Parked: Euro 2028 remaining scope

**Parking date:** 29 July 2026  
**Return date:** **January 2028**  
**Recoverable reference:** annotated tag `euro-2028-baseline`, resolving to `1fb8ffd36ad113079181829a8bcc47175c43b6da`.

Read this section in full on return. Do not re-derive the scope from the then-current platform codebase.

## A. Release and operating decision

- [ ] Decide the Euro 2028 published-release plan: whether the tagged tournament product remains published during the hub transition, what URL/brand it uses, and when the final tournament release becomes public.
- [ ] Record the decision and exact release target before changing production publication.
- [ ] Confirm the `euro-2028-baseline` tag still resolves to the recorded commit before beginning the return work.
- [ ] Reconcile every parked item against current code and close it with evidence rather than assumption.

## B. Official tournament reference data

- [ ] Replace provisional teams and host placeholders with the official qualified field after the draw.
- [ ] Verify the final UEFA tournament regulations against `docs/tournament-structure.md`, including the third-place allocation table.
- [ ] Replace provisional fixtures, dates, venues and kickoff times with sourced official data.
- [ ] Set and verify the tournament entry lock from the authoritative schedule.
- [ ] Populate official squads/players so the Golden Boot picker uses authoritative references.
- [ ] Record source URL/type, retrieval date, effective date and provisional/official status for every imported reference set.
- [ ] Remove provisional labels only after the corresponding source evidence exists.

## C. Administration and result operations

- [ ] Re-verify the existing browser result/qualification administration against the final tournament data and all Stage L competition consumers.
- [ ] Confirm result entry, correction and clear support regulation time, extra time and penalties exactly as the final regulations require.
- [ ] Confirm the scoring-impact preview, immutable revisions, audit trail and protected administrator capability remain intact after the platform migrations.
- [ ] Decide whether any final-fixture/bulk confirmation ergonomics are required for tournament operation.
- [ ] Keep the SQL result-entry runbook as emergency recovery, not the primary operating interface.

**Recorded contradiction:** the planning prompt named an “admin result-entry interface” as remaining scope, while the current feature baseline classifies browser result and qualification administration as implemented and production-hosted. The parked task is therefore verification/final-fit work, not an assumed greenfield build.

## D. Remaining tournament-only product slices

- [ ] Complete the Matches Predicted/Live table switcher.
- [ ] Complete the mid-groups bracket projection.
- [ ] Complete feed-gated top-scorer presentation once a supported feed and official player references exist.
- [ ] Reassess any residual H2H/full-profile tournament comparison states against the then-current baseline; build only evidenced gaps.
- [ ] Add bracket clear/un-pick only with version-guarded delete and post-lock delete rejection.
- [ ] Finish any tournament-specific destructive-action polish still open after the platform work.
- [ ] Recheck the picks-are-in, spectator, final-day, confirmation and post-tournament presentation states after surface migration.

## E. Notifications, authentication and support for the tournament

- [ ] Configure and prove Euro-specific deadline reminders against the shared notification system.
- [ ] Verify Auth/SMTP ownership, sender reputation and password-recovery delivery for tournament scale.
- [ ] Resolve the final Turnstile and leaked-password settings.
- [ ] Name primary and secondary authorised administrators and emergency access.
- [ ] Verify support/contact ownership and incident escalation during every match window.

## F. Accessibility, resilience and legal readiness

- [ ] Complete documented keyboard, screen-reader and contrast review on every core tournament journey.
- [ ] Close any remaining loading, empty, partial, retry and unavailable-data states on tournament-only surfaces.
- [ ] Verify 360px hostile-data layouts, both themes and long-name cases.
- [ ] Confirm account deletion/export, privacy notice, terms and non-affiliation wording cover tournament data and public sharing.
- [ ] Complete final security and privacy review without weakening bounded reads or reveal gates.

## G. Full tournament rehearsal

- [ ] Drive one seeded clock through every named pre-tournament, matchday, transition, knockout, final and post-tournament state.
- [ ] Include valid, incomplete, manually submitted, auto-submitted and spectator entries.
- [ ] Include simultaneous live matches, feed loss, awaiting confirmation, correction, clear and replay.
- [ ] Include actual group ties, third-place boundary resolution, Round-of-16 population and full bracket progression.
- [ ] Include KO Predictor, Last Man Standing and Predictor Cup through every tournament state.
- [ ] Include postponed, abandoned and cancelled/void fixtures under the reconciled architecture contract.
- [ ] Measure complete-volume scoring, rank history, qualification, correction and rollback.
- [ ] Rehearse application rollback and repeat encrypted backup restore against the then-current production artifact.
- [ ] Prove monitoring, backup, scheduler/Cron and incident alerts reach named owners.
- [ ] Rehearse authorised and unauthorised desktop/phone journeys.
- [ ] Record defects and rerun the complete rehearsal after fixes.

## H. Final release gate

- [ ] Verify official data and all tournament rules against their authorities.
- [ ] Verify branch protection and required checks.
- [ ] Pass CI, Database parity, Browser E2E, exact-head deploy preview and production smoke.
- [ ] Confirm the intended repository head, application contract, Supabase project and Netlify context.
- [ ] Obtain explicit owner approval for any production write or release.
- [ ] Run the release freeze and exact production dress rehearsal.
- [ ] Publish only the exact approved artifact and record dated evidence.

# Part II — Active: hub delivery

## Stage A — decisions, documentation and controls

The closed items below were verified against the repository on 30 July 2026, not assumed.

- [x] Merge ADRs 0011–0018 after review; do not treat an open branch as repository authority.
- [x] Land the repository programme map under `docs/architecture/`.
- [x] Reframe roadmap, current status, `AGENTS.md`, `CLAUDE.md` and this inventory.
- [x] Reconcile `docs/architecture-and-tournament-states.md` with ADRs 0011–0013 before surface migration.
- [x] Broaden Database parity triggering to `src/domain/**` and record the control gap.
- [x] Reconcile stale live status wording while preserving historical evidence.
- [x] Withdraw Scoreline and defer platform brand selection with a trigger under ADR 0019. The repository/application name stays Euro 2028 Predictor through rehearsal; decide after Phase 0 discovery and before the closed cohort.
- [ ] Complete the closest-competitor product review before final positioning.
- [ ] Decide the close-season retention approach before the first exposed close season.
- [ ] Keep all hosted claims target-specific and freshly verified.

## Stage B — competition-context engine and migrations — COMPLETE

Closed by the intentional merge of PR #226 as `2648540` on 30 July 2026. Retained as the record of what the stage covered.

- [x] Land the isolated pure `src/domain/competition/` foundation and fake-clock suite.
- [x] Keep the existing surfaces untouched until separate migration PRs.
- [x] Migrate `entryLock.ts` with a differential test proving tagged Euro behaviour unchanged.
- [x] Migrate `matchCentre.ts` without removing legacy compatibility until consumers move.
- [x] Migrate `matchesTab.ts`.
- [x] Migrate `homeDashboard.ts`.
- [x] Ensure no surface reads an ambient clock or computes competition timing independently.
- [x] Remove legacy timing paths only after all consumers and regression evidence are complete.
- [x] Keep Database parity and Browser E2E path scopes applicable as new domain siblings appear.

## Stage C — competition-season schema

All seven pre-migration contract suites are landed through PR #292. The owner-approved [`docs/architecture/stage-c1-c2-governance.md`](docs/architecture/stage-c1-c2-governance.md) amendment divides implementation into C1 and C2.

### Stage C1 — unblocked competition-season foundation — issue #303

- [x] Classify every landed Stage C assertion as C1, C2 or shared before-state.
- [x] Add an executable guard proving C1 leaves the effective `auth.users` foreign-key action matrix, competitive ownership and ownership RLS unchanged.
- [x] Add competition/season scoping under the reviewed C1 migration plan. *(PR #317, hotfixed by PR #349, merged at repository contract 65.)*
- [x] Add stable competition identity and additive season fields on the existing `tournaments` root.
- [x] Add generic rounds/matchweeks and monotonic lock-transition evidence.
- [x] Broaden same-reference safeguards to same-season safeguards without weakening them.
- [x] Persist competition timezone, reject invalid zones and remove authoritative viewer fallback.
- [x] Preserve independent entries, standings, honours and historical seasons.
- [x] Preserve every Euro identifier, rule, score, rank, access boundary and Stage B context output.
- [x] Extend applied-state, RLS/grant and adversarial cross-season tests in the same change.
- [x] Prove zero-to-current rebuild, database lint, pgTAP, generated types and full Database parity on disposable infrastructure.
- [x] Complete the guarded hosted development rollout (workflow from PR #351). *(Applied and postflight-verified 2–3 August 2026; later additive development movement is recorded only in `docs/quality/current-status.md` and the development machine record, not duplicated here.)*
- [ ] Keep production at contract 63 and paused until an intentional release milestone. *(Standing constraint, not a task to complete; production remains at 63.)*

### Stage C1b — persistent game catalogue and memberships — DELIVERED at contract 66 (PR #371)

- [x] Audit and map existing competitions/tournaments/entries/profiles/leagues/bonus-competition relations, RPCs and browser grants before writing SQL; extend existing structures rather than duplicating them. *(The audit drove the design: existing structures were extended, not duplicated.)*
- [x] Persist game definitions, per-competition-season game availability (active/inactive), one user entry per competition-season game with joined/left/disqualified state and append-only join/leave/rejoin evidence, and game-owned policy references.
- [x] Keep membership separate per game (Main Predictor, LMS, Predictor Championship); derive competition membership from game membership with no second membership truth.
- [x] Seed Premier League 2026/27, Scottish Premiership 2026/27 and Euro 2028 with each competition's valid game catalogue; preserve Euro game registrations.
- [x] No C2 content: no ownership transfer, erasure redesign, pseudonymisation or replacement ownership RLS (issue #272 remains the blocker). *(Boundary held; issue #272 still blocks C2.)*

### Stage C2 — blocked profile ownership and account erasure — issue #272

- [ ] Obtain the independent UK data-protection review and record the approved lawful basis, erasure boundary, retention schedule and safeguards.
- [ ] Settle account deletion/anonymisation effects on historical competition integrity.
- [ ] Add nullable profile/auth ownership only if the review approves it.
- [ ] Repoint competitive ownership and related RLS only under the approved boundary.
- [ ] Implement and prove account erasure/pseudonymisation, league transfer/archive and backup treatment.
- [ ] Update the PR #246 before-state to the reviewed after-state without weakening its full action inventory.

No C2 schema, function, policy, ownership or deletion change may enter C1 for convenience.

## Stage D — ingestion and headless rehearsal

**Custody foundation delivered; live rehearsal remains.** The repository now has strict provider decoders, a server-only request boundary, raw-response archive-before-processing custody and append-only processing evidence. Provider data remains provisional and cannot write official competition truth.

**The Edge Function is deployed to development** (`provider-poll` version 1, `ACTIVE`, 5 August 2026, owner-authorised; [`docs/ops/ops-provider-poll-deployment.md`](docs/ops/ops-provider-poll-deployment.md)). That is a smaller step than it sounds: no provider has been contacted, no credential has been spent, nothing has been archived, and the named caller key has not been observed to resolve. All three providers are supported simultaneously — `provider` is a per-request field, not a deployment-time choice — so the outstanding question is which provider's terms and coverage are confirmed, not which one is wired.

- [ ] Confirm provider terms, coverage, timezone and exceptional-state mappings with dated evidence. *(**Retention half confirmed by the owner on 5 August 2026: all three providers permit storing responses.** That was the blocking half — this architecture archives exact raw response text and keeps it, so a licence permitting the call but not the retention would have made the custody control itself a breach. Coverage, timezone and exceptional-state mappings remain open and are what `scripts/ops/provider-bakeoff.ts` measures.)*
- [x] Implement the strict provider-response custody boundary behind one internal model.
- [x] Relate a provider's season, round and team identifiers to this platform's rows (contract 112, `public.provider_entity_map`). Every ingestion step was blocked on it, and the composite foreign keys make mapping a club onto the wrong competition season a database refusal rather than a silent wrong league table. It resolves and reports gaps; it imports nothing.
- [x] Build the round-window authority `fixtureReassignment.ts` needs (contract 113, `competition_rounds.window_opens_at` / `window_closes_at`). Derived from the fixtures a round is played over, held disjoint per competition season by a trigger with inclusive bounds — so windows that merely touch are refused and an ambiguous destination cannot arise from stored data. Stored rather than computed at resolve time, because the derivation reads fixtures and reassignment moves one.
- [x] **Owner decision taken 5 August 2026, and it reverses the question rather than answering it.** A rescheduled fixture is NOT reassigned to another round: it stays in the matchweek it was scheduled in, its prediction stays editable until its own kickoff whether it is replayed midweek with other games or alone, and a single moved match never creates a round — named explicitly for LMS. **The round is a label, not a position**: it still scores into its original matchweek but sorts by its actual kickoff wherever fixtures are listed by date. Recorded as an amendment in ADR 0020. The per-match guard that ADR already calls the integrity floor becomes the operative rule for a moved fixture, so the machinery largely exists.
- [ ] Order fixture lists by kickoff while labelling by round, so a rescheduled match shows in true chronological position under its original matchweek. Grouping strictly by round is the easy misreading and produces a list where a November match sits under a September heading.
- [x] Make the per-fixture lock the operative rule for a rescheduled fixture — contract 119, `20260806090000_rescheduled_fixture_lock.sql`. Only a rescheduled fixture, on the owner's decision of 5 August 2026 recorded in ADR 0020: the universal per-fixture reading shares the same arithmetic but would make an ordinary matchweek predictable in stages. No TypeScript parity was needed — `cardSubmission.ts` takes the lock instant as an input, so the derivation lives only in SQL. 18 assertions, five mutants killed.
- [x] Reconcile contract 113's round play window with the amendment. **Recorded as unused capability; no justified use was found and none was invented.** Measured rather than assumed: outside its own migration and `164_round_play_windows.sql`, nothing in `supabase/` or `src/` reads `competition_rounds.window_opens_at` or `window_closes_at` — every other repository hit is the unrelated `bonus_competition_windows.opens_at` aliased under the same name in the Cup RPCs. `resolveFixtureReassignment` has no caller outside its own test either. ADR 0020 § "What this supersedes in the repository" already stated both correctly, so the reconciliation gap was in the **code**, which is the more misleading place for it: `fixtureReassignment.ts` opened by asserting as current authority that a rescheduled fixture "moves to the round containing its new kickoff" — the exact rule the amendment reversed — and `matchweekSettlement.ts` twice repeated it, once claiming a moved fixture is "simply absent from this matchweek's card" when it now stays on it and holds settlement until played. All three corrected in place, pointing at the ADR. Nothing is deleted: the amendment superseded a model, not a file, and the migration is applied at contract 113 so its text is history rather than a live claim.
- [x] Give the season Last Man Standing round a bounded browser read (contract 116, `20260805120000_season_lms_round_read.sql`). Contract 116 lets a season Last Man Standing entrant SEE the round they can already pick in. Contract 86 widened the selection trigger to season fixtures, but the read was never widened — `get_my_lms` resolves every window through `bonus_window_fixtures` joined to `public.matches`, so a season round comes back with an empty fixture array and a player can save a pick whose fixtures they cannot see. `get_season_lms_round` reads `season_cup_window_fixtures` joined to `season_fixtures` instead, returns one round — the earliest still open to a pick, or the last one when the season has finished locking — and answers survival from `predictor_internal.season_lms_pick_outcome`, the same authority the settlement replay folds over, rather than handing a browser raw scores to judge, because a season fixture carries no winner column. It is a new function rather than a widened `get_my_lms` for that reason: a shared payload would have been half-null in both directions and would have put a survival authority in the client. Nothing about any other entrant appears in it, no table grant is added and no rule moves. `167_season_lms_round_read.sql` holds 23 assertions, including one that measures both functions against the same seeded round so the gap is proven rather than claimed.
- [x] Make the database able to call the provider at all (contract 115, `20260805110000_provider_poll_dispatch.sql`). Measured rather than assumed: `pg_net` was available on development and `installed_version: null`, so PostgreSQL could make no outbound HTTP request — the deployed Edge Function had a scheduler that could not reach it. Installs the extension and attempts to revoke the `net` schema from `anon`, `authenticated` and `service_role` and, where the platform owns pg_net, reports that it could not — measured on hosted development, `postgres` is neither superuser nor a member of `supabase_admin`, so it cannot change platform grants; what it enforces instead is that no browser-reachable function in an exposed schema calls into `net`, which is the actual path from a session to an outbound request. CI found that limit rather than a review: the first version revoked and asserted the result, PostgreSQL warned instead of erroring, and only the assertion noticed. It then drives `provider-poll` from `pg_cron` every five minutes at each target's declared cadence. Records no target and imports no fixture.
- [x] Record the two `vault` secrets and at least one `provider_poll_targets` row, then observe a real dispatch. **Done 5 August 2026** — see [`docs/ops/ops-first-live-provider-poll.md`](docs/ops/ops-first-live-provider-poll.md). The first provider contact this platform has ever made: 380 real Premier League fixtures, 20 teams, 38 matchdays, archived verbatim at 365,300 bytes before decoding and decoded by the committed decoder with no contract mismatch. It wrote no fixture, and `provider_mapping_gaps` reports `ready: false` with every team and every round unmapped — the designed answer, since the identity map is empty.
- [x] Replace the invented development clubs and fixtures with real ones (5 August 2026, owner-authorised; [`docs/ops/ops-real-league-data-adoption.md`](docs/ops/ops-real-league-data-adoption.md)). Premier League from football-data (competition 2021, season 2502) and Scottish Premiership from SportMonks (league 501, season 28275) — two providers, because football-data's plan carries 12 competitions and Scotland is not among them. 20 and 12 real clubs, 380 and 198 real fixtures, 105 `provider_entity_map` rows, all built from payloads already archived, with no further provider calls. `provider_mapping_gaps` now returns `ready: true`. The real Scottish season is 33 rounds with the five post-split rounds correctly empty, confirming the owner's 33 + 5 correction against the source.
- [x] Guard `scripts/seed-dev/seed-league-seasons.ts` against real data. **Correcting an overstatement made when this item was written**: the seed was never able to overwrite real football. It already refused any season holding fixtures, deletes nothing anywhere, and inserts clubs with `on conflict do nothing` — a re-run today is a no-op that prints a notice. The real residual was narrower: had fixtures been cleared while the clubs and their map rows survived, twenty invented clubs would have landed *alongside* the twenty real ones, because no invented name collides with a real one. It now refuses any season holding provider-mapped clubs, checked before the fixture guard because the two protect against different things, and pinned by tests including the ordering.
- [x] Build the automatic fixture **revision** import — contract 117, `20260805130000_provider_fixture_revision_import.sql`. Contract 116 is the repeatable path a provider kickoff change takes to the fixture: it revises an existing fixture's kickoff, creates none, deletes none and never writes `competition_round_id` — the owner amendment made executable. It fails closed on the whole payload when any identifier is unmapped, refuses a kickoff moved into the past or a fixture no longer scheduled, and records every move append-only as an administrator's review queue. 27 assertions, six mutants killed at 4, 4, 4, 2, 2 and 1 failures, including the one that moves a fixture to whichever matchweek its new kickoff lands in.
- [ ] Build automatic fixture CREATION and the administrative reassignment workflow. Contract 117 stopped at revision on purpose: a fixture appearing that this platform did not know about changes what a competition IS, and the season surfaces, LMS eligibility and the Championship calendar all derive from the fixture set. It needs its own authority rather than arriving as a side effect of a kickoff importer.
- [x] Configure the approved development credential and execute one bounded non-production request. **Done 5 August 2026**: one football-data poll, HTTP 200, owner-authorised before the spend. The caller key needed a fix first — `CALLER_KEY_NAME` reused the function slug, and Supabase rejects a hyphen in a secret key name, so the lookup could never resolve.
- [x] Verify the exact raw response is archived before decode and every processing attempt is append-only. Verified against a real response rather than a fixture: one `provider_raw_responses` row at status 200 and 365,300 bytes, one `provider_response_processing` row recording the successful decode of 380 fixtures.
- [ ] Keep ingestion provisional, replay-safe and unable to write official fixtures, results, locks, scores, totals, ranks or standings. **The write half is now enforced rather than merely true** — `171_ingestion_write_boundary.sql` names all fourteen provider/poll functions with their permitted writes and asserts none reaches a result, score, total, lock, progression, standing or player prediction, from `pg_get_functiondef` against the built database rather than by grepping the tree. A new provider or poll function fails the suite until somebody records what it may touch, which is the property that makes it a guard rather than a snapshot. Writing the list corrected two beliefs: `dispatch_due_provider_polls` writes `public.provider_poll_targets`, so "ingestion writes nothing in `public`" was already false — the right question is whether it writes anything a player's result depends on, and it does not. The suite states its own limit: a text scan cannot follow dynamic SQL, and a future contract using `execute format(...)` would pass it while proving less. **Replay-safety is still unproven and stays open**, as do the anomaly fixtures and the stale-data-fails-closed item below.
- [ ] Audit kickoff, round and result changes.
- [ ] Build deterministic anomaly fixtures for events not observed live.
- [ ] Prove stale/unavailable data fails closed.
- [ ] Build bulk review/confirmation ergonomics without allowing feeds to become official truth.
- [ ] Run the headless season and maintain an anomaly/evidence log.
- [ ] Introduce the closed cohort only after the provisional pipeline has demonstrated stability.

## Cross-stage — UI modernisation and approved tooling

Owned by [`docs/design/ui-modernisation-execution.md`](docs/design/ui-modernisation-execution.md) (adopted 5 August 2026), which reconciles the design plan's §13.2 rollout order with this inventory's stage priorities and phases the approved tooling plan ([`docs/quality/open-source-improvements/`](docs/quality/open-source-improvements/README.md)) around it. The surface items below deliver the Stage E–H surface work; they are the *how and in what order*, not a second scope.

- [x] Activate the design and tooling authorities: record the reconciled migration order, classify `src/premium/**` as a reference prototype with an executable boundary guard, declare `ComponentsPreview` the component/state harness, and declare Lucide, `flag-icons` and Framer Motion the only approved icon, flag and motion systems. *(This entry; guard is `tests/design/premiumPrototypeBoundary.test.ts`.)*
- [x] Knip report-only baseline with every finding classified (production entry point / dev harness / reference prototype / historical evidence / confirmed dead code / requires investigation); no deletions in the setup PR. *(`knip.json`, `npm run check:dead-code`, report in [`docs/quality/knip-baseline.md`](docs/quality/knip-baseline.md), configuration guarded by `tests/scripts/knipConfiguration.test.ts`.)*
- [x] Remove the three confirmed-dead symbols the baseline names (`fetchLastSeen`, `fetchEntrySubmissionStatus`, `PredictIcon`). *(Unused-export count moved 27 → 24; `fetchEntrySubmissionStatus` proved to be a duplicate caller of an RPC the live Review workspace still uses, so the deployment contract is unaffected.)*
- [x] Visual **foundations**: neutral ramp, surface levels, border ramp, radii, type scale, spacing, tabular numerals, motion tokens and stacking order, derived into `src/styles/tokens.css` and rendered in `ComponentsPreview` — not copied from `premium.css`. *(Guarded by `tests/design-system/foundationTokens.test.ts`; consumed by no production component yet, so adoption stays reversible.)*
- [x] Adopt the target foundations component by component. The type scale reached every stylesheet, the seven neutral tokens were repointed at the target ramp, and the stacking scale reached the five application layers that had literals — including a toast host that had been sitting *below* the modal it needed to appear over. The last 21 off-scale font sizes in product surfaces (admin, third-place resolution, games, the body default and the choice sheet) are now scale steps. *(`tests/design-system/foundationAdoption.test.ts` relates tokens to consumers, so an unadopted literal fails; every remaining exclusion is listed there with a reason.)*
- [x] Finish the two adoption remainders the guard named: the three DEV harness stylesheets (`ComponentsPreview`, `SeasonPreview`, `SeasonLeaderboardPreview`) now draw every font size from the six-step scale, and `ProgressBar`'s width transition now uses `--duration-sheet` rather than a `0.3s` literal. *(`tests/design-system/foundationAdoption.test.ts`'s font-size and transition checks both name zero product-facing files now; the two design-system exclusions — crest monograms and a movement triangle — are unrelated to this item and remain.)*
- [x] Close the three gallery states the first-state matrix names and the harness did not render: **offline, unavailable and conflict**. Each is a section of its own showing the treatment §9.1/§9.2 requires — an offline banner with the last-known content still on screen and writes disabled rather than queued; unavailability with and without a known recovery; and a conflict that shows both values and writes nothing until the player chooses. *(`tests/design-system/galleryStateCoverage.test.ts` relates the harness to the state matrix, which is what was missing: "the gallery covers the states" was a claim nothing checked.)*
- [x] Close the remaining three the guard named: **refreshing**, **stale** and the **blocking error** page. Refreshing keeps content on screen and disables only the action whose truth is uncertain; stale labels its own age and restricts the sensitive write while saying what would make it safe; the blocking error carries a correlation reference and deliberately offers no retry, because a request that failed a contract check fails identically on repeat. *(The §9.1/§9.2 matrix is now fully rendered — `galleryStateCoverage.test.ts` keeps the count so a state added to the matrix without a section fails.)*
- [ ] Add the explicit phone and desktop width anchors the gallery still lacks. Deliberately deferred to the Playwright visual-contract change they serve: pinning panel widths is what makes a screenshot deterministic, so it should land with the baselines rather than ahead of them.
- [x] **Performance evidence and the preview-score investigation.** `lighthouserc.json`, `npm run check:lighthouse` and [`docs/quality/lighthouse-baseline.md`](docs/quality/lighthouse-baseline.md) audit a locally served production build: `/auth/login` 89, `/auth/signup` 94, `/auth/reset` 95, accessibility 100 throughout. The design preview's performance-20 score is **closed as a measurement artefact**, not a code regression — two PRs changing no runtime code scored 20 and 21 on previews while the same bundle scores 89–95 locally. Guarded by `tests/scripts/lighthouseConfiguration.test.ts`.
- [x] Build the Playwright visual contract harness against stable `ComponentsPreview` anchors: `playwright.visual.config.ts`, `e2e/visual-gallery.spec.ts`, `data-section` anchors derived from section titles, and the pinned `?width=phone` / `?width=desktop` panels the contracts need. Diff images and reports upload as artefacts on failure. *(Determinism guarded by `tests/design-system/visualContractHarness.test.ts`; the suite is absent from every merge-gating workflow until baselines exist.)*
- [ ] **Run the bootstrap and commit the baselines.** Dispatch `.github/workflows/visual-contracts.yml` with `update_baselines`, review the uploaded PNGs like code, commit them under `e2e/visual-baselines/`, then add the `pull_request` trigger. Baselines cannot be produced in a development container — an image rendered there never matches one from a GitHub runner — so this step needs a human to press the button.
- [ ] Extend the visual contracts to reduced motion. Deferred with a reason rather than skipped: `animations: 'disabled'` already freezes motion for determinism, so a reduced-motion baseline proves something different — that the reduced-motion *rules* are honoured — and is better added once the first baselines have proven stable.
- [ ] Promote the Lighthouse run to a CI job once performance drift between runners is measured and a floor can be set without false alarms. *(One prerequisite is now closed: the command itself was unrunnable without a `.env.local` — the build rendered nothing and the audit died on `NO_FCP` — so promoting it as it stood would have produced a job that could only fail. `scripts/run-lighthouse.mjs` supplies placeholder configuration when the caller has none. The drift measurement is still outstanding, and is the remaining gate.)*
- [x] First reversible product slice, **surface half**: the thin competition shell (masthead + sub-navigation that never replaces global navigation, §4.5) and the phone-first season Match Predictor page, built as production code under `src/features/season/` against a typed read model with explicit commands, the §12.1 card state machine, optimistic save with version-conflict recovery over the shared save coordinator, the first `LockStateReason` → player-copy layer, the fail-closed route flag `VITE_UI_SEASON_MATCH_PREDICTOR`, and the `season-predictor` telemetry route category. Proven at `/dev/season-predictor` across healthy/slow/load-failure/save-failure/conflict/no-fixtures scenarios and before/at/after-lock clocks. *(Guards: `tests/features/season/`, `tests/app/routeFlags.test.ts`.)*
- [x] First reversible product slice, **data half — repository side**: contract 114 supplies the bounded season RPCs (`get_season_matchweek_card`, `save_season_prediction`, `set_season_matchweek_joker`, `confirm_season_matchweek_card`), a version column with the shared PT409 trigger on `season_predictions`, and delete-path lock enforcement so clearing or un-Jokering a locked matchweek refuses. `src/services/supabase/seasonMatchPredictor.ts` implements the UI-04 gateway seam over them. *(pgTAP `165_season_card_rpcs.sql`; hosted development apply is the ordinary fast-lane rollout.)*
- [ ] Register the production season Match Predictor route now that contract 114 is applied to development: route table, titles, redirects, axe matrix, MSW scenarios against the now-real network boundary, and the flag flip. The fixtures behind it remain the invented development seed, not real football.
- [x] Step 4 — the season Match Predictor **standings** surface over `get_season_leaderboard`: a presenting model that never ranks, matchweeks-played beside points, and no competition-level standings tab, because ADR 0011 gives each game its own table. *(`src/features/season/SeasonStandingsPage.tsx`, proven at `/dev/season-standings`; route registration outstanding with the rest.)*
- [x] Step 5 — the season **Last Man Standing** surface over contract 116: the entrant's own round, the pick separated from the survival verdict the settlement job owns, a non-optimistic write, and refusal copy classified by error code rather than flattened to "something went wrong". *(`src/features/season/SeasonLmsPage.tsx`, proven at `/dev/season-lms`.)*
- [x] **Public acquisition landing page (Appendix E), brought forward from step 8 on owner direction.** Until this, an anonymous visitor at `/` was redirected to `/auth/login` — the product's front door was a password field for an account they did not have. `src/features/landing/` renders E.3's eight surfaces in order, in the production design system and *not* the prototype's Touchline brand, which ADR 0019 still defers. Behind the fail-closed `VITE_UI_PUBLIC_LANDING`, whose off state is the previous redirect rather than a second implementation. *(Guards: `tests/features/landing/`, `tests/app/publicLandingRoute.test.tsx`; `/` added to `e2e/axe-unauthenticated.spec.ts`, the only harness that sees the signed-out root.)*
- [ ] Continue the reconciled order: Championship surfaces, the Hub action/social experience, the remaining Appendix E acquisition work, then legacy route retirement by journey.

## Stage E — season Predictor

**Backend foundation delivered; product surfaces remain.** The season path has stored fixtures and predictions, whole-matchweek Jokers, zero-buffer locks, empty-card semantics, recurring lock processing, replay-safe fixture reassignment, scoring parity, stored matchweek totals and a bounded season leaderboard.

- [x] Build the backend authorities from ADR 0012 as amended by ADR 0020.
- [x] Add recurring matchweek submission scheduling around the stored card and lock authorities.
- [x] Extend TypeScript/PostgreSQL parity for season scoring.
- [x] Cover backend late entry, unbanked rounds, blank/partial cards, reschedules and corrections.
- [ ] Build the fast phone entry and completion flow.
- [ ] Build matchweek, monthly and form standings as first-class retention surfaces that never feed back into the canonical total.
- [ ] Prove the complete user journey across hostile loading, unavailable, correction and replay states.
- [ ] Measure completion and low-rank retention during the closed cohort and record the result.

## Stage F — season Last Man Standing

**Rules, storage, settlement and the complete restart lifecycle are delivered; surfaces remain.** Eligibility, deterministic C-collation auto-assignment, used-team cycles, lock-time selection writes, correction-aware replay, entrant-state projection and the recurring settlement job are implemented. Contract 107 creates the idempotent linked successor without copying selections, cycles, projections or windows; Contract 108 refuses any inherited past round; Contract 109 derives the first eligible future league matchweek from the existing lock authority, creates the successor calendar exactly once and drives the lifecycle from settlement's immutable report.

- [x] Encode the ADR 0013 rules as pure TypeScript authorities with PostgreSQL parity.
- [x] Persist LMS setup, selections, used cycles and entrant state with server-side lock and allowance enforcement.
- [x] Drive `resolve_lms_pick` and `conclude_lms_round` from confirmed results through the correction-aware settlement job.
- [x] Implement the ADR 0025 `restart_all_reentered` lifecycle as a separate idempotent, advisory-lock-protected successor operation. *(Contract 107; successor intentionally arrives with no windows.)*
- [x] Refuse successor windows that opened or locked before the predecessor completed, at both publisher and database boundaries. *(Contract 108; safety guard only, not scheduling.)*
- [x] Add the separate calendar authority/driver that starts the successor at the next eligible league round and creates its windows exactly once. *(Contract 109; uses the existing matchweek lock authority, remains inert when the calendar is not derivable, and is idempotent.)*
- [ ] Complete public/private registration and repeating-competition user journeys. **Joining is built and needed no migration**: `SeasonLmsRegistration` over `register_bonus_competition` (competition-neutral — it resolves a competition by id and delegates to `join_competition_game`) with the registration instants from the contract-118 games hub read. It closes a surface gap where the page told a non-entrant to join and offered no control to do it. States resolve against the server's instant, not the browser clock; the competition is matched by exact id supplied by the caller, never searched by game key, because a wipeout successor (contract 107) means a season can list two and instance resolution belongs to contracts 103/104. **Still open here:** private/organiser registration, the repeating-competition journey across a successor, and **withdrawal** — deliberately not built, because `leave_competition_game` refuses once a `bonus_score_events` row exists for the caller and no browser read exposes that fact, so a Leave control could not honestly predict its own availability. That one needs a read before it needs a button.
- [ ] Build managed entrants and organiser audit/ownership paths.
- [ ] Prove the consolidated weekly-picks read model and phone selection surface.
- [ ] Cover every depletion, reduced-round, reset and exceptional endgame through complete browser journeys.

## Stage G — season Predictor Cup

**Rules, shared machinery, split persistence and the round calendar delivered; the phase driver and surfaces remain.** The shared Cup machinery is competition-neutral; the season supplies its own sources. Contract 110 removed the prerequisite that had been blocking the phase driver: `bonus_cup_fixtures.window_id` is `NOT NULL` and nothing in the repository created a window for a season competition, so no season Championship fixture could be persisted in either phase. Split groups and memberships are phase-aware, each child has one initial parent, and continuing standings are derived from settled fixtures across both phases rather than copied into a starting total.

- [x] Build from ADR 0014 as amended by ADRs 0020, 0022 and 0025.
- [x] Reuse the existing draw, qualification, bracket and Penalty Number machinery through competition-neutral sources.
- [x] Prove format selection, circle-method schedules, tie settlement and reduced fixture sets.
- [x] Persist `stage = 'split'`, phase-aware membership, one-parent ancestry and derived continuing standings.
- [x] Schedule a season Championship over the next eligible league matchweeks, refusing a season that cannot supply its whole format. *(Contract 110; the prerequisite for everything below.)*
- [x] Launch a season Championship: threshold, format, initial group, draw and round-robin fixtures on those rounds. *(Contract 111, single-group shape; the public threshold applies only to public competitions.)*
- [ ] Drive the multi-group shape — seeding, draw and bracket — which every public hundred-entrant field takes.
- [ ] Settle a season Championship tie from confirmed results, which `settle_season_cup_tie` still has no caller for.
- [ ] Build the phase-transition driver that creates the two child groups, assigns entrants by the final initial table and schedules the immutable split fixtures.
- [x] Expose the continuing table and phase state through a bounded browser read — contract 120, `20260806100000_season_cup_phase_read.sql`. Measured before it was built: on hosted development, **zero** functions `authenticated` may execute read `cup_split_group_tables`, `parent_group_id` or `cup_final_group_tables`, and `get_my_cup` was last defined on 29 July 2026 — before contract 102 created the split phase — so nothing has widened it since. Fifth instance of the contract 86/98/116/118 defect, along the initial-versus-split axis rather than the tournament-versus-season one, which is why `168_tournament_only_browser_reads.sql` did not catch it. `get_season_cup_phase` returns the caller's own phase and their own group's table from whichever authority owns that phase: `cup_split_group_tables` already filters `phase_kind = 'split'`, so the branch is a lookup of an established fact rather than a new decision. It adds no rule, recomputes nothing, joins no profile and gives a non-entrant `entered: false` rather than an exception that would confirm the competition exists. Contract 121 adds the season play-context read — which season a URL means and which matchweek its card opens at — which is what lets that surface be registered on a production route. Contract 122 makes ADR 0012's two retention tables answerable: the monthly table, whose month comes from a round's `window_opens_at` read in the competition's own timezone, and rolling form, which needs only round ordinal. Contract 123 keeps that window fresh: contract 117 moves the kickoffs contract 113's stored span is derived from, and a refresh whose proposed span would overlap another round's window leaves the old window intact and queues a row for review rather than raising, which is what stops a derived view's recomputation being able to fail a provider import. Both are derived views and neither touches the canonical total.
- [ ] Build the season Predictor Championship surfaces after the Phase 1 design gate. **The phase surface is built** — `SeasonCupPhasePage` over contract 120 through `createSeasonCupRpcGateway`, reachable at `/dev/season-cup` until the production routes are registered, like the three season surfaces beside it. It renders the caller's phase and their own group's table, marks a shared rank the authority assigned rather than deriving one, and states the split as ADR 0014 defines it — the same competition continuing with a narrower field, points carried, nobody eliminated. Opponents appear as an entrant at a rank because contract 120 discloses no display name and this surface does not work around that. A load failure renders as a failure with a retry, never as an empty table, which is the empty-versus-failed line the read contracts exist to hold. What remains for this game is entry/registration, fixtures and opponents, tie settlement status, the Penalty Number journey, the knockout bracket, and private management/public discovery — all of which need drivers or reads that do not exist yet.

## Stage H — hub and social product

- [x] Register production routes for the season standings, Last Man Standing and Championship surfaces, and open them from the competition dashboard. *(They were production code reachable only from DEV harnesses; the routes resolve season and competition ids from `fetchHubMembership` rather than from the slug. Main Predictor still waits on the play-context read for which matchweek to open.)*
- [x] Fix the route-declaration blind spot that let a wrapped `<Route>` escape the SPA-status, title and axe controls at once — `/competitions/:competitionSlug/:seasonSlug` was answering HTTP 404 while rendering. One shared extractor, with the wrapped case pinned by a test.
- [x] Give the Predictor Championship an entry path, and put every season game page in the competition shell. *(Entry is `join_competition_game` for every game key, so Last Man Standing and the Championship share one registration model parameterised only by wording. The dashboard's placeholder intro paragraph was removed rather than left promising features as body text.)*
- [ ] Build the cross-competition dashboard. **The per-competition dashboard's entry half is done and needed no migration.** It had been rendering the static catalogue's `joined` flag — so it could disagree with the Hub one tap away — and an entry button that was enabled with no handler at all, doing nothing when pressed. `get_competition_games` already returned every fact needed (game `id`, registration window, `completed_at`, `allow_rejoin`, membership row, `server_now`); the decode layer was dropping them, including the id a join is addressed by. `decideGameMembership` resolves join/rejoin/leave against the server's instant and states a refusal as a sentence rather than rendering a control the server would reject. **Still open here:** the cross-competition view itself, next action and next lock, and current rank. Leaving is offered but cannot be predicted — `leave_competition_game` refuses once a `bonus_score_events` row exists for the caller and no browser read exposes that, so an honest "can I leave?" control still needs a read.
- [ ] Build one weekly action surface across entered games.
- [ ] Add league/game preferences without changing enrolment.
- [ ] Add invitations, rerun/copy and “more competitions” discovery.
- [ ] Add managed-entry bulk operations and claim flow.
- [ ] Make the league table worth sharing and add public read-only invite previews; a purpose-built weekly results card is secondary to improving the artefact players already share.
- [ ] Make competition and game separation immediately visible, not only correct in the schema.
- [ ] Make any score explainable on screen without asking the organiser.
- [ ] Complete pre-auth invite trust and aggregate-disclosure review.
- [ ] Complete loading, empty, partial, retry and unavailable-data states.
- [ ] Complete landing, legal/footer, account deletion/export and analytics decisions.
- [ ] Prove no aggregate ranking or cross-competition score path exists.

## Stage I — client distribution

- [ ] Deliver the installable PWA and web push.
- [ ] Prove notification consolidation and deadline delivery.
- [ ] Build the thin native shell governed by ADR 0016.
- [ ] Prove deep links, authentication redirect, native share and biometric paths.
- [ ] Prove offline rendering of locked entries.
- [ ] Submit to stores early enough for rejection/resubmission.
- [ ] Keep the web release/rollback path independent of store review.

## Stage J — launch readiness

- [ ] Close manual accessibility evidence.
- [ ] Prove monitoring, alerting, incident and ownership procedures.
- [ ] Prove backup restore and application rollback.
- [ ] Add a second authorised administrator.
- [ ] Load-test realistic weekend traffic and service ceilings.
- [ ] Complete privacy, terms, provider and store disclosures.
- [ ] Close authentication, email, abuse and support operations.
- [ ] Verify branch protection and all required checks.
- [ ] Run exact-head release rehearsal.

## Stage K — public season

- [ ] Operate rather than expand scope mid-season.
- [ ] Keep releases, incidents and hosted verification in dated evidence.
- [ ] Measure completion, multi-game entry, retention and operational load.
- [ ] Decide later-stage changes from evidence, not the planning draft.

## Stage L — Euro 2028

- [ ] Return to Part I in January 2028.
- [ ] Reconcile the parked inventory against the then-current platform.
- [ ] Complete every open tournament gate before public release.

- [x] **Contract 118 — the games hub reads a season's fixtures.** **Contract 118 stops the games hub being blind to a season's fixtures.** `get_bonus_games` built its per-window fixtures from `bonus_window_fixtures` joined to `public.matches` with no branch on competition kind, so a season window returned an empty array — and because a window can only settle when `total > 0 and confirmed >= total`, a season competition's first locked round stayed in flight permanently and the hub card stuck on it. Three internal functions supply the facts instead: a tournament limb, a season limb mapping season status onto the tournament vocabulary on contract 77's established equivalence, and a neutral combiner that unions rather than branches. Fourth instance of one defect — contracts 86, 98, 116 and this — and `168_tournament_only_browser_reads.sql` now catches the fifth.
