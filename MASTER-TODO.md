# Multi-competition platform — master TODO

**Status date:** 2 August 2026  
**Current facts:** [`docs/quality/current-status.md`](docs/quality/current-status.md)  
**Execution sequence:** [`docs/roadmap.md`](docs/roadmap.md)  
**Programme map:** [`docs/architecture/multi-competition-hub-build-plan.md`](docs/architecture/multi-competition-hub-build-plan.md)  
**Decision authority:** [`docs/adr/0011-multi-competition-platform.md`](docs/adr/0011-multi-competition-platform.md) through [`docs/adr/0019-brand-decision-deferred.md`](docs/adr/0019-brand-decision-deferred.md)

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
- [ ] Complete the guarded hosted development rollout (workflow from PR #351). **Blocked on the owner replacing `SUPABASE_DEV_DB_URL` with the development Session pooler URI** — see `docs/ops/stage-c1-contract-65-rollout-recovery.md`. After postflight, align non-production Netlify to contract 65.
- [ ] Keep production at contract 63 and paused until an intentional release milestone.

### Stage C1b — persistent game catalogue and memberships (next migration after hosted 65)

- [ ] Audit and map existing competitions/tournaments/entries/profiles/leagues/bonus-competition relations, RPCs and browser grants before writing SQL; extend existing structures rather than duplicating them.
- [ ] Persist game definitions, per-competition-season game availability (active/inactive), one user entry per competition-season game with joined/left/disqualified state and append-only join/leave/rejoin evidence, and game-owned policy references.
- [ ] Keep membership separate per game (Main Predictor, LMS, Predictor Championship); derive competition membership from game membership with no second membership truth.
- [ ] Seed Premier League 2026/27, Scottish Premiership 2026/27 and Euro 2028 with each competition's valid game catalogue; preserve Euro game registrations.
- [ ] No C2 content: no ownership transfer, erasure redesign, pseudonymisation or replacement ownership RLS (issue #272 remains the blocker).

### Stage C2 — blocked profile ownership and account erasure — issue #272

- [ ] Obtain the independent UK data-protection review and record the approved lawful basis, erasure boundary, retention schedule and safeguards.
- [ ] Settle account deletion/anonymisation effects on historical competition integrity.
- [ ] Add nullable profile/auth ownership only if the review approves it.
- [ ] Repoint competitive ownership and related RLS only under the approved boundary.
- [ ] Implement and prove account erasure/pseudonymisation, league transfer/archive and backup treatment.
- [ ] Update the PR #246 before-state to the reviewed after-state without weakening its full action inventory.

No C2 schema, function, policy, ownership or deletion change may enter C1 for convenience.

## Stage D — ingestion and headless rehearsal

- [ ] Confirm provider terms, coverage, timezone and exceptional-state mappings with dated evidence.
- [ ] Implement independent adapters behind one internal model.
- [ ] Start storing raw provider responses from the first poll.
- [ ] Keep ingestion provisional and replay-safe.
- [ ] Audit kickoff, round and result changes.
- [ ] Build deterministic anomaly fixtures for events not observed live.
- [ ] Prove stale/unavailable data fails closed.
- [ ] Build bulk review/confirmation ergonomics without allowing feeds to become official truth.
- [ ] Run the headless season and maintain an anomaly/evidence log.
- [ ] Introduce the closed cohort only after the provisional pipeline has demonstrated stability.

## Stage E — season Predictor

- [ ] Build only from ADR 0012 and its future scoring authority.
- [ ] Add recurring matchweek submission scheduling around the existing tournament submission mechanism.
- [ ] Extend TypeScript/PostgreSQL parity for season scoring.
- [ ] Build the fast phone entry and completion flow.
- [ ] Cover late entry, unbanked rounds, defaults, partial completion, reschedules and corrections.
- [ ] Build matchweek, monthly and form standings as first-class retention surfaces that never feed back into the canonical total.
- [ ] Measure completion and low-rank retention during the closed cohort and record the result.

## Stage F — season Last Man Standing

- [ ] Build only from ADR 0013.
- [ ] Cover public/private lifecycle, repeating competitions and registration boundaries.
- [ ] Cover managed entrants and organiser audit/ownership paths.
- [ ] Cover all exception, depletion, reduced-round, reset and endgame paths.
- [ ] Enforce one-entry and lock rules server-side.
- [ ] Prove the consolidated weekly-picks read model.

## Stage G — season Predictor Cup

- [ ] Build only from ADR 0014.
- [ ] Reuse existing draw, qualification, bracket and Penalty Number machinery.
- [ ] Replace the tournament points source through an explicit neutral contract.
- [ ] Prove format selection and schedules across supported field sizes and remaining-round counts.
- [ ] Cover settlement with reduced fixture sets and visible explanation.

## Stage H — hub and social product

- [ ] Build the cross-competition dashboard.
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
