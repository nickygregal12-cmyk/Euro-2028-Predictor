# Nightly runs — 10 August 2026

TWO unattended sessions ran on the night of 10 August 2026 and each wrote
its report to this path, so the file carries both in full rather than
whichever merged second. They are separate records of separate work:
`claude/cool-lamport-lsdx69` (contract 145, the rate limiter) and
`claude/bold-ride-02igjf` (`EURO-002`, the publication-state control).
Neither is a revision of the other, and dated evidence is preserved rather
than rewritten.

---


**Session branch:** `claude/cool-lamport-lsdx69`
**Batch:** Contract 145 — the rate limiter decides atomically (risk register `DATA-007`)
**Merge outcome:** **held for your review.** It is a database migration and it changes an abuse-control enforcement path. Green CI is the precondition for your decision, not a substitute for it.

This is an unattended run's report. Everything below is stated as evidence or as
an assumption, never as a hope. Where a suite could not run in this environment,
it says so rather than implying coverage.

---

## 1. What I inspected

In the order the standing instructions require: `main`, then repository
authorities, then migrations and schema, then code, then tests, then deployment
posture.

- **Current `main`.** My branch began level with it — zero commits ahead, zero
  behind. `main` carries #628 (progress handover), #627 (`EURO-004` route guard)
  and #624 (UI Alpha batch H).
- **Open pull requests, in full.** Only two, and both are documentation:
  #630 (03:00 progress handover) and #629 (Euro publication authority
  reconciliation). **No open branch holds a migration**, so contract 145 could
  be claimed without a double-claim, and nothing I touched is contested.
- **Repository authorities.** `CLAUDE.md`, `AGENTS.md`, `NOW.md`,
  `docs/quality/current-status.md`, `docs/roadmap.md` including the 7 August
  Domestic Frontend Alpha amendment, `docs/quality/accepted-requirements.md`,
  `docs/quality/risk-register.md` and `docs/ops/ops-pending-migrations.md`, plus
  the three machine contract records in `config/`.
- **Prior nightly runs**, including 9 August's, which recorded `DATA-007` as its
  own recommended next batch and said explicitly why it had not folded it into
  the contract-134 privileges change.
- **The defect itself, in the migration rather than in the register's
  description of it.** `20260720210000_rate_limits.sql` lines 51–60.
- **The repository's existing answer to the same shape**, so this would reuse a
  pattern rather than invent one:
  `20260727191942_operating_cap_enforcement.sql`, which serialises the two
  site-wide counters on fixed advisory-lock keys, and the twelve other migrations
  that already use `pg_catalog.pg_advisory_xact_lock`.
- **Baseline test state on the unmodified tree**, before I changed anything:
  `npm ci`, `npx oxlint --deny-warnings`, `npx tsc -b`, full `vitest run`,
  `npm run build`.
- **Deployed app: not touched.** No hosted Supabase or Netlify state was read or
  written by this work.

### Current-state findings worth recording

1. **The Euro publication sequence is no longer the highest-value open item.**
   `EURO-002` landed as contract 143, `EURO-004` landed as #627, and `EURO-001`
   and `EURO-003` are implemented in the repository — #629 is the reconciliation
   of the register to that fact. That is steps 3 of the Alpha order closed, and
   it removed my first candidate batch.
2. **`DATA-007` is real, is in the enforcement path, and had been deferred three
   times** — once by the 6 August audit ("requires a migration"), once by the 9
   August contract-134 run (correctly, to keep a privileges-only change
   reviewable), and implicitly by every contract since.
3. **The race is not theoretical, and the register understates which limit it
   matters for.** The 60/min prediction-save limit is self-scoped: row-level
   security confines a caller to their own entry, so overshooting it wastes this
   platform's capacity and nobody else's. The 5/min league-membership limit is
   the control that makes invite-code probing expensive (`SEC-001`, `ACQ-R10`),
   and a control that can be overshot by running the attempts in parallel is the
   wrong control for an attacker who was always going to run them in parallel.
4. **Docker is unavailable in this sandbox** — the client is present, there is no
   daemon. This is the fourth consecutive night an independent session has
   recorded it. It moves the pgTAP and Database-parity half of the verification
   into CI, and section 4 says exactly which half.

---

## 2. The batch I chose, and why

**Chosen: close the atomicity half of `DATA-007` — make `enforce_rate_limit`
decide one caller at a time — and guard it against silent regression.**

Against the stated priority order:

- **(a) Defects threatening scoring, data integrity, auth or admin safety.**
  This is the batch, at the abuse-control end of (a). `enforce_rate_limit`
  counts, compares and then inserts with nothing between the read and the write.
  Under the read-committed isolation the Data API uses, N concurrent
  transactions for one caller each take their own snapshot, each sees a count
  below the ceiling because none of the others has committed, and all N proceed.
  The ceiling is therefore not a ceiling under exactly the condition it exists
  for. A human clicking is serialised by their own latency and never sees this;
  a script is not, and does not.
- **(b) Unblocking partially-implemented work.** The 9 August run named this as
  the next batch and left it deliberately unstarted. Taking a predecessor's
  explicit handover is the cleanest form of (b) available tonight.
- **(c) Highest-value active roadmap item.** The Euro sequence closed while I was
  reading (finding 1), and the remaining Alpha frontend steps are large,
  multi-session surfaces I could not finish and verify in one run.
- **(d) Hardening.** The parity guard is here: `rateLimitParity.test.ts` now
  fails if a later redefinition drops the lock, or makes it session-scoped.

**Value against tournament-time risk.** The change is one statement added to one
function. It moves no relation, policy, trigger, threshold, grant or rule, and
touches no scoring, lock, settlement, progression or reveal path. It uses the
idiom this repository already uses for the same problem in the same schema. Set
against that: a named, audited, three-times-deferred finding in an enforcement
path is reduced with its specified evidence, and the specific control that makes
invite-code probing expensive starts actually holding under concurrency.

**The design decision inside it, since it is the only one worth a review
argument.** The lock key is **per caller, never per (caller, action)**.
Per-action keys would let one transaction hold two of these locks, and two
transactions acquiring the same two keys in opposite orders is a deadlock.
Nothing in the repository writes `match_predictions` and `league_members` in one
transaction today, but "nothing does today" is a weaker guarantee than "this
function can only ever hold one of its own locks", and the cost of the stronger
one is that a single caller's league join serialises against that same caller's
own prediction save. That is not a real concurrent workload. Different callers
never contend at all.

**What I deliberately did not do.** `DATA-007`'s closure asks for four things,
and this takes one. Invalid operations still consume no limit — an unmatched
invite code fails before any `league_members` insert, so probing is still
unbounded in that specific sense, and that fix belongs to the invite-code path
and to `SEC-001`, not to the limiter. The expensive read RPCs are still outside
the limiter entirely. There are still no edge or IP controls beside the per-user
database limit, and no alerting. The register row and the migration header both
say so; the finding is marked **open, reduced**, not closed.

**One thing I noticed and did not act on**, recorded so it is not lost: the
prediction-save trigger is `for each row`, so a single statement writing 36
predictions consumes 36 of the 60-per-minute allowance, while
`src/domain/rateLimit.ts` justifies the ceiling as though each save were one
event. Whether that is a defect depends on whether the client sends rows singly,
which I did not verify. It is a threshold question, not an atomicity one, and
folding it in would have put a behaviour change in a correctness fix.

---

## 3. Exactly what changed

**Branch** `claude/cool-lamport-lsdx69`. Contract **144 → 145**.

### Database objects

| Object | Change |
| --- | --- |
| `public.enforce_rate_limit(text, int)` | Redefined. Takes `pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rate_limit_events:' \|\| auth.uid()::text, 0))` before the prune, the count and the insert. Signature, `security definer`, pinned `search_path` and body logic otherwise unchanged. |
| everything else | Unchanged. No relation, policy, trigger, threshold, grant, index or rule moves. `public.rate_limit_events`, both trigger bindings and both ceilings (60/min, 5/min) are untouched. |

### Files

| File | Change |
| --- | --- |
| `supabase/migrations/20260810010000_rate_limit_atomicity.sql` | **New.** The redefinition, and a header that states the defect, the fix, the per-caller key decision, and the three quarters of `DATA-007` it does not close. Re-states the original `revoke all ... from public` for readability; `create or replace` had already preserved it. |
| `supabase/tests/195_rate_limit_atomicity.sql` | **New.** 17 assertions. |
| `tests/database-parity/rateLimitParity.test.ts` | One new case: the effective SQL takes a transaction-scoped advisory lock, and takes it *before* the count. |
| `src/domain/rateLimit.ts` | Comment only. The pure module claims to mirror the SQL gate; it now records that the rule only holds because the SQL side serialises. |
| `config/deployment-contract.json` | `contractVersion` and `requiredMigrationCount` 144 → 145; notes extended. |
| `e2e/seed-contract.ts` | `SEED_REVIEWED_AT_CONTRACT` 144 → 145, with the reasoning for why the seeded prediction-save journey is unaffected. |
| `docs/quality/risk-register.md` | New correction record for 10 August; the `DATA-007` row rewritten to **open, reduced**. |
| `docs/ops/ops-pending-migrations.md` | New eighth "Current state" entry; the seventh demoted to Superseded rather than edited. |
| `AGENTS.md`, `docs/quality/current-status.md` | Repository contract 145 and what it is. |
| `NOW.md` | Regenerated by `npm run generate:now`. |
| `CLAUDE.md`, `MASTER-TODO.md`, `docs/roadmap.md`, `docs/adr/README.md`, `docs/design/README.md`, `docs/competition-structure.md`, `docs/quality/feature-baseline.md`, `docs/architecture/programme-plan.md`, `docs/architecture/multi-competition-hub-build-plan.md` | The contract-145 boundary note, as `scripts/check-documentation-authorities.mjs` requires. |

### What the pgTAP file asserts, and what it honestly cannot

Two sessions cannot be driven from inside one pgTAP transaction, so it does not
reproduce the race. It proves the **mechanism**: it drives `enforce_rate_limit`
and then reads `pg_locks` to show the caller's own transaction-scoped advisory
lock is genuinely held, reassembling the 64-bit key from `classid`/`objid` and
comparing it against the documented derivation. It also proves a *different*
caller's key is not locked (two players never wait on each other), and that a
second action by the same caller takes no second key (the function cannot
deadlock against itself).

The rest is there because a lock added to a working control is exactly the
change that can quietly stop it working, so the ceiling, the refusal, the fact
that a refusal logs nothing, the recovery once the window slides, the hourly
prune, the unauthenticated no-op and both trigger bindings are all driven again
after the redefinition.

The lock's **scope** — transaction rather than session, so it cannot leak into a
pooled connection — is not observable in `pg_locks`, and is proved statically by
the parity test instead. That split is stated in both files rather than left for
a reader to discover.

---

## 4. What I tested, and the results

Everything below actually ran, in this sandbox, at the branch head.

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npx oxlint --deny-warnings` | **Pass**, no output |
| Types | `npx tsc -b` | **Pass**, exit 0 |
| Full unit/parity suite | `npx vitest run` | **Pass** — 377 files, 3468 tests, 3 files / 26 tests skipped, 0 failures |
| Production build | `npm run build` | **Pass**, built in 847 ms |
| Migration additivity | `node scripts/check-migration-additive.mjs …` | **additive** |
| Hosted inventory alignment | `node scripts/check-hosted-migration-inventory.mjs` | **Pass** — repository 145, development 144, production 132 |
| Documentation authorities | `node scripts/check-documentation-authorities.mjs` | **Pass** — agree with contract 145 |

**The new parity case earned its place before it passed.** Its first version read
the whole migration file and failed: contract 145's header quotes the very
count-then-insert sequence it removes, so the search found the defect's own
description before the fix and reported the lock as being in the wrong place. It
now reads from the `create or replace` onwards, and the reason is a comment in
the test.

**What did NOT run here, and was read from CI instead:**

- `supabase/tests/195_rate_limit_atomicity.sql` — the pgTAP file. `docker info`
  fails in this sandbox (client present, no daemon), so `supabase start` and
  `supabase test db --local` cannot run. CI's `local-supabase` job was the first
  execution of that file and of the migration itself, against a database rebuilt
  from all 145 migrations.
- Browser E2E (`authenticated-browser`), for the same reason. It is the job that
  re-verifies the seeded prediction-save journey through the redefined trigger,
  which is why `SEED_REVIEWED_AT_CONTRACT` was raised with reasoning rather than
  on assertion.

**CI outcome on PR #632, at commit `d03ee49`: all fourteen checks completed, none
failed.** `local-supabase` **passed** at 03:33:40Z, so the migration applies to a
database built from all 145 migrations and all 17 pgTAP assertions hold —
including the `pg_locks` reads, which is the part this sandbox could not verify
at all. `authenticated-browser` **passed** at 03:36:34Z, so the seeded
prediction-save journey still works through the redefined trigger. Also green:
`ci`, `verify`, `migration-transition`, `visual`, `deploy-preview-smoke`,
`CodeQL`, both CodeQL analyses and the two Netlify rules checks. `Supabase
Preview` is skipped and `Pages changed` is neutral, as on every recent pull
request.

**One thing on that run needs saying so nobody chases it.** Netlify's Lighthouse
comment reports performance 19, "down 77 from production". It is not a
regression and this pull request changes no runtime code —
`docs/quality/lighthouse-baseline.md` § "Why it audits a local build and not the
deploy preview" records that two earlier pull requests which changed **no runtime
code at all** scored 20 and 21 on their previews while the same bundle scores
89–95 locally. That documented artefact is the entire reason the repository
audits a local build. The only `src/` edit here is a comment in a module the
application never imports.

---

## 5. Merge outcome

**Held for your review. Not merged, and auto-merge not enabled — with CI fully
green.** The hold is not a CI outcome and was never going to be resolved by one.

It falls squarely inside the hold list: it is a database migration, and it
changes an enforcement path that gates writes. It touches no scoring, ranking,
lock or official tournament data, and it makes the control stricter rather than
more permissive — but "stricter" is still a behaviour change to a path every
prediction save runs through, and the failure mode of a wrong lock is a wedged
write path rather than a wrong number, which is the sort of thing an owner
should choose to accept.

**Hosted impact: none, and none is claimed.** `DATA-007` is not closed in either
hosted environment by this merge. Development receives contract 145 only through
the guarded additive fast lane; Production only through its own separately
approved promotion, which remains blocked on `SUPABASE_PROD_DB_URL` naming the
IPv6-only direct host.

---

## 6. What remains uncertain, and what I need from you

1. ~~Two suites are unverified locally.~~ **Resolved during the run:**
   `local-supabase` and `authenticated-browser` both passed in CI (section 4).
   Nothing about this batch is now unverified for want of a runner.
2. **The per-caller lock key is a judgement call, and it is the one thing in
   this batch worth disagreeing with.** Section 2 states the reasoning and the
   cost. If you would rather have per-(caller, action) keys and accept the
   theoretical deadlock, say so and it is a one-line change.
3. **Isolation-level boundary, stated rather than hidden.** The guarantee holds
   under read committed, which is what PostgREST uses. Under repeatable read or
   serializable a waiter's snapshot predates the holder's commit whatever this
   function does. Nothing in this platform runs those levels today.
4. **`DATA-007` stays open.** Three quarters of its closure is untouched. Please
   do not read a green CI run on this PR as the finding being closed.
5. **The per-row trigger observation** in section 2 needs a decision from
   someone who knows whether the autosave sends predictions singly or in
   batches. If it batches, the 60/min ceiling is roughly a 1.6-saves-per-minute
   ceiling, and that is a threshold question for you rather than a bug for me.
6. **No approval is needed to proceed with anything else** — nothing in this
   batch is blocked on you except its own merge.

---

## 7. The next batch I would recommend

**`SEC-001` / `ACQ-R10` — invite-code enumeration**, and specifically its first
two clauses only: generate codes from `gen_random_bytes` at ten characters
instead of six from `random()`, and make an invalid code consume limit.

Why it is next: contract 145 makes the league-membership limiter hold under
concurrency, which is precisely half of what makes probing expensive. The other
half is that an invalid code currently costs an attacker nothing at all, because
the limiter is a trigger on `league_members` and a failed lookup never reaches an
insert. Doing the two together is what actually closes the enumeration path, and
the second is now worth doing *because* the first is done.

Scope it to those two clauses. Minimal preview disclosure and code
rotation/revocation are separate changes with their own product decisions —
rotating a code invalidates links people have already shared, which is an owner's
call rather than an engineer's.

A smaller alternative if you want something mergeable without a migration:
`DB-003`'s measured evidence. Capture `EXPLAIN (ANALYZE, BUFFERS)` for the joins,
deletion checks and settlement jobs the advisors name, so the index decision
stops waiting on evidence nobody has gathered. It ends in a document, not a
schema change, and it unblocks a finding that has been open on "needs
measurement" for weeks.

---


Unattended overnight run. British English throughout. Every claim below is
either something that ran in this session or a file that was read; nothing is
described as done that was not done.

## 1. What I inspected

**Sources of truth, in order.**

- `origin/main` at `18efb4f` ("UI Alpha batch I", #631). The designated branch
  `claude/bold-ride-02igjf` was level with it — zero commits either way — so it
  was used as the working branch rather than restacked.
- `NOW.md` (generated): repository contract **144**; hosted Development **144**,
  verified 2026-08-09; Production **132**, promotion not authorised; no pending
  development migrations; next free contract number 145.
- `docs/roadmap.md` — the Domestic Frontend Alpha amendment of 7 August is the
  current order. Item 3 is Euro absence/publication (`EURO-001`–`EURO-004`).
- `docs/quality/accepted-requirements.md` — the `DFA-*`, `EURO-*` and `SITE-*`
  registers.
- `docs/quality/risk-register.md` — open findings, to check nothing higher
  priority was going unattended.
- `docs/automation-runs/2026-08-10-0100-predictor-progress.md` — the previous
  session's handover.
- Open pull requests: **#632** (Contract 145, atomic rate limiter, `DATA-007`),
  **#630** (03:00 handover), **#629** (Euro authority documentation
  reconciliation). All three belong to other sessions.
- Code and migrations: `supabase/migrations/20260809130000_euro_publication_state.sql`,
  `src/app/TournamentJourney.tsx`, `src/services/supabase/euroPublication.ts`,
  `src/App.tsx`, `src/features/admin/**`, the route/axe/parent coverage guards
  in `tests/app/**`, and `netlify.toml`.

**Current-state findings.**

1. Production remains blocked at the mandatory backup gate — `SUPABASE_PROD_DB_URL`
   resolves through an IPv6-only host and the GitHub runner is IPv4-only. This is
   a repository-secret repair I have no write surface for. Production was not
   touched, read-only or otherwise, in this run.
2. The register's `DFA-009` row claims no browser read exposes the staged
   provider proposals. That is **stale**: Contract 138's read is consumed by
   `src/features/admin/ProviderReviewPanel.tsx`. What genuinely remains absent
   there is the staged *calendar list* and the entrant enumeration — both need a
   new database read, which would need a migration.
3. `DATA-007` (count-then-insert rate limiting) is being closed by open PR #632.
   I deliberately did not touch it.
4. **The finding this run acted on.** I measured every `public.*` function
   granted to `anon`/`authenticated` in the migration chain against callers in
   `src/`. Five had no caller. Three are explained (`join_competition_game` and
   `leave_competition_game` are reached through `register_bonus_competition` and
   `withdraw_bonus_competition`; the two Contract 132 provider-approval writers
   are absent by a documented decision, because no browser read shows the list
   they would act on). The fifth is not explained:
   **`admin_transition_euro_publication_state` had no caller anywhere.**

   Contract 143 built the whole publication authority and PR #627 — merged at
   01:00 this morning — taught `TournamentJourney` to *consume* it, so the
   application now refuses player-facing Euro routes while the state is `hidden`
   and had no way to stop refusing them. The tournament could be hidden and
   could not be published. The only remaining route to an owner decision was
   hand-written SQL against a hosted database, which this project's own hard
   boundaries forbid. ADR 0026 wants publication to be "an operational act with
   a recorded approval"; an act nobody can perform is not one.

## 2. The batch I chose, and why

**Give the Euro publication state the one control that moves it — `/admin/euro`.**

Priority class **(b)**, unblocking partially-implemented work already in
progress, and it also serves the roadmap's Alpha item 3 directly. It is the
completion of last night's `EURO-004` merge rather than a new direction.

Why this over the alternatives:

- it is the seventh instance of this repository's most-repeated defect (an
  authority that exists, is correct and is unreachable from a browser), and the
  worst-consequence instance of it, because the workaround is a boundary
  violation;
- it needs **no migration**, so it does not collide with #632's contract 145
  claim and does not add motion the production blocker cannot absorb;
- it touches no scoring, ranking, lock, permission or tournament data path;
- it was finishable and verifiable within the run.

Deliberately **not** chosen: anything needing a migration (contract-number
contention plus a held PR either way); `SEC-001` invite enumeration (its closure
overlaps #632's limiter work); the `/admin/season` provider-approval and
entrant-disqualification gaps (both need a new database read first).

## 3. Exactly what changed

**Branch:** `claude/bold-ride-02igjf`
**Commit:** `391639d`
**PR:** https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/633

| File | Change |
| --- | --- |
| `src/features/admin/EuroPublicationPage.tsx` | **new** — the operator surface |
| `src/features/admin/euroPublicationAdminModel.ts` | **new** — operator copy and the server-refusal reader (pure) |
| `src/services/supabase/euroPublicationModel.ts` | **new** — states, type, guard, adjacency (pure; no Supabase import) |
| `src/services/supabase/euroPublication.ts` | adds `transitionEuroPublicationState`; the state list/type move to the pure model and are re-exported |
| `src/App.tsx` | registers `/admin/euro`, lazily, inside `RequireAdmin` and outside `TournamentJourney` |
| `src/app/RouteAccessibility.tsx` | route title |
| `src/features/admin/AdminLayout.tsx` | "Euro publication" nav item |
| `netlify.toml` | `/admin/euro` answers 200 rather than the catch-all 404 (the `SEO-001` guard requires it) |
| `src/features/admin/SeasonAdminPage.module.css` → `adminPanels.module.css` | renamed; two admin pages now share it |
| `docs/architecture/euro-publication-lifecycle.md` | records the operator surface and its evidence |
| `e2e/weekly-admin-access.spec.ts` | adds `/admin/euro` reachability and an axe scan |
| `tests/services/euroPublicationModel.test.ts` | **new** |
| `tests/features/admin/euroPublicationAdminModel.test.ts` | **new** |
| `tests/features/admin/EuroPublicationPage.test.tsx` | **new** |

**Database objects: none.** No migration, no grant, no policy, no function, no
contract number claimed.

**What the surface does.** Reads `euro_publication_state()`; reports the state
and the instant it last changed; offers the one adjacent step the lifecycle
permits and nothing at `archived`; sends the state it last read as
`p_expected_state`, so two operators on one stale page cannot both succeed;
sends the reason as typed — including absent — so the empty-reason refusal is
the server's rather than the browser's; offers no publication control at all
when the state cannot be read, so an outage cannot become an accidental launch;
and re-reads after a successful write rather than trusting the returned row,
which is what proves the write landed where the route guard reads from.

It adds no rule. Who may act, which step is legal, whether the expected state
still holds, that a reason was given and the append-only history row all remain
Contract 143's.

**Something the build measured rather than assumed.** The operator copy started
beside the lifecycle in `services/supabase/`, which `TournamentJourney` can
reach and which therefore lands in the entry chunk. That put roughly 0.7 KB
gzipped of administrator sentences into every player's first download and
**took the entry chunk over its budget** — a real regression, caught by
`check:bundle-budget`, not by review. Moving the copy into the lazily-routed
admin feature fixed it. The entry chunk goes 75.4 → 75.6 KB gz against a 76 KB
budget: within it, but tight enough that the next small addition to the entry
chunk will fail, and someone should decide whether to trim it or raise the
budget with a reason.

## 4. What I tested, and the results

Everything below ran locally on the exact branch head.

| Check | Result |
| --- | --- |
| `npx oxlint --deny-warnings` | **passed**, clean |
| `npx tsc -b` | **passed**, clean |
| `npm test` (full Vitest suite) | **381 files passed, 3 skipped; 3508 tests passed, 26 skipped** |
| `npm run build` | **passed** |
| `npm run check:bundle-budget` | **passed** — over budget on the first attempt; fixed, then re-run |
| `npm run check:documentation-authorities` | **passed** — agrees with contract 144 |
| `npm run check:now` | **passed** — `NOW.md` current |
| `npm run check:migration-timestamps` | **passed** — no migrations added |
| Browser E2E | **not run here** — no harness in this environment. `/admin/euro` is added to `e2e/weekly-admin-access.spec.ts` with an axe scan and is left to CI |
| Database parity / pgTAP | **not run here** and not applicable — no database object changed |

New coverage is deliberately weighted to failure and correction paths, not the
happy path: refused capability (`42501`), concurrent change (`40001`), missing
reason (`22023`), missing state row (`55000`), an unreadable state, no control
at `archived`, and exactly one control — never a way back — at every
intermediate state. `tests/services/euroPublicationModel.test.ts` pins the
offered adjacency against the migration's own `if not (...)` guard rather than
against the array the model iterates, so reordering that array fails here rather
than quietly offering a step the server refuses.

No existing test was weakened, skipped or deleted.

**CI status.** On the first pushed head (`391639d`) the following completed
**successfully**: CodeQL (both analyses), `deploy-preview-smoke`, the Netlify
deploy preview, and its redirect-rule and header-rule checks — the redirect
check is the one that matters for the `netlify.toml` line, and it passed. The
three long suites — `ci`, `visual` and `authenticated-browser` — were still
running after roughly half an hour and had not reported when this report was
committed. **This report's own commit re-triggers all of them on the final
head, and that is the run a reviewer should read.** No merge decision depends
on it: the PR is held regardless, for the reason in §5.

## 5. Merge outcome

**Held for your review. Not merged, and auto-merge not enabled.**

Nothing in the batch touches scoring, points, ranking, locks, permissions,
migrations or official tournament data — by the letter of the merge policy it
is low risk. It is held anyway, on one judgement: the **action it makes
possible** is the owner's Euro 2028 publication decision, which is the exact
business risk ADR 0026 exists to protect. A control that can move Euro out of
`hidden` should exist because you agreed it should, not because a nightly run
found the RPC had no caller. The server still refuses everyone but a signed-in
`super_admin`, and nothing in this PR advances any state.

## 6. What remains uncertain, and what I need from you

1. **Approve or refuse `/admin/euro` itself.** This is the decision the hold is
   waiting on. If you would rather publication stayed a deliberate manual act
   outside the product, say so and I will close #633 — but then the boundary
   against hand-written hosted SQL needs an explicit exception written down,
   because today there is no other way to publish.
2. **`SUPABASE_PROD_DB_URL` is still the production blocker.** It needs
   repointing at the eu-west-2 session pooler on port 5432, or the project's
   IPv4 add-on enabling. Until then Production stays at contract 132 and no
   application release should be published, because the merged `EURO-004` guard
   needs contract 143 hosted there. I have no repository-secret write surface.
3. **The register rows will need a further line.** `EURO-002`'s acceptance
   evidence is "persisted state with one authority, and a transition record" —
   arguably satisfied by contract 143 alone, but the requirement is only
   *operable* with #633. PR #629 is already rewriting those rows, so I avoided
   `accepted-requirements.md`, ADR 0026 and `NOW.md` entirely rather than
   competing with it. Whoever merges second should add the line.
4. **The entry chunk is at 75.6 KB gz against a 76 KB budget.** Not a defect
   today; the next small addition to the entry chunk will fail the gate.
5. **Two stale claims found and deliberately not fixed here**, because they sit
   in files another PR owns or in scope this batch did not cover: the `DFA-009`
   register row says no browser read exposes the staged provider proposals
   (contract 138's read *is* consumed by `ProviderReviewPanel`), and the header
   comment of `tests/app/euroAbsentFromPublicSurfaces.test.ts` still says the
   server-owned state is unbuilt.

## 7. The next batch I would recommend

**Give `/admin/season` the staged provider calendar it can already approve.**

Contract 132 granted `admin_approve_initial_provider_fixtures` and
`admin_reject_initial_provider_fixtures` to administrators, and `/admin/season`
names their absence in its own interface: the review panel reports *how many*
fixtures are waiting and offers no decision, because a button over a list nobody
can inspect is worse than no button. It is the same defect this run just fixed
for Euro publication, one surface along, and it is the last thing standing
between real provider calendars and a competition an administrator can actually
open.

It needs a new bounded read of the staged proposals — so a migration, the next
free contract number (**146**, since #632 claims 145), a Development fast-lane
apply and a held PR. That is a bigger batch than tonight's and should start with
the read, not the buttons.

If you would rather stay off migrations until the production secret is repaired,
the best non-migration alternative is `DFA-006`'s remaining third — current rank
and cross-competition recap on the Hub, from `season_standings` through the
reads contracts 128 and 122 already provide.
