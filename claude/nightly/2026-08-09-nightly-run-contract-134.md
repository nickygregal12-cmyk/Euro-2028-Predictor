# Nightly run — 9 August 2026 — contract 134 / `DB-005`

> **Two independent nightly sessions ran on 9 August 2026 and both wrote a dated
> report.** The other one — a season private league table, PR #606, branch
> `claude/bold-ride-ic2fkh` — holds the unsuffixed
> [`2026-08-09-nightly-run.md`](2026-08-09-nightly-run.md). Both files are that
> session's own evidence and neither is edited by the other. This one is suffixed
> because the collision was discovered after theirs had landed, and overwriting
> another session's dated record to reclaim a filename is exactly what the
> standing rules forbid.

**Session branch:** `claude/cool-lamport-4pmhiq`
**Pull request:** [#605](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/605) — Contract 134: `rate_limit_events` holds no browser privilege (`DB-005`)
**CI:** all thirteen checks green, including `local-supabase` (pgTAP + Database parity) and `authenticated-browser` (Browser E2E).
**Merge outcome:** held open by this session by policy, then **merged by another actor** as `a942f18`. Merged `main` re-verified green afterwards. See section 5.

This is an unattended run's report. Everything below is stated as evidence or as an
assumption, never as a hope. Where a suite could not run in this environment, it
says so rather than implying coverage.

> **Addendum — the branch was restacked by another session after this report was
> first written, and everything below has been re-verified against the result.**
> While this run was finishing, another automation session merged PR #608 into
> this branch, rebuilding contract 134 on top of the #593/#597/#600/#606/#607
> chain that had landed on `main` meanwhile. I neither authorised nor performed
> that restack; what I did was check it rather than trust it. My migration, the
> pgTAP file, the exposure guard and the `DB-005` register row all survived
> intact, `main` is still at contract 133 with 133 migrations so **contract 134
> needed no renumbering**, and the full local verification was re-run on the
> merged result: lint, `tsc -b`, **3241 passed / 26 skipped / 0 failed** (356
> files), `npm run build`, and all three contract/documentation checkers.
>
> **This report file did not survive.** The other 9 August session wrote its
> report to the same dated filename, and the merge kept theirs — so my report was
> silently replaced in the tree and is restored here under a suffixed name. That
> is a real process defect, not a one-off: `claude/nightly/<date>-nightly-run.md`
> has no room for two runs on one date, and the loser is overwritten without a
> conflict anyone reads. Recommendation in section 7.
>
> Two facts moved and are corrected in section 6: **hosted Development is now at
> contract 133** (Fast Lane run 31276698062), and **the contract-134 collision
> with #602 is resolved**. I also fixed a contradiction the merge left in
> `docs/ops/ops-pending-migrations.md`, where the Production row said "one behind
> contract 134" while the same document's opening paragraph correctly said two.
>
> Sections 1–4 describe the state **as measured during the run** and are left as
> written — dated evidence, not a live status page. Where section 1 says
> Development was verified at 132, that was true when measured, and section 6
> records that it has since moved.

---

## 1. What I inspected

**In the order the standing instructions require: `main`, then repository authorities, then migrations/schema, then code, then tests, then deployment posture.**

- **Current `main`** at `7e6aeac` (`docs: record 2026-08-09 01:00 predictor progress` #601). My branch started level with it — zero commits ahead or behind before I began.
- **Open pull requests**, in full, because five sessions are active on this repository tonight: #604 (docs handover), #602 (draft, `EURO-002` publication state, **claims contract 134**), #600 (draft, `DFA-004` canonical routes), #597 (draft, docs reconciliation), #593 (draft, private Championship UI). This shaped the batch decision more than anything else — the three highest-value roadmap items are all already claimed by open branches.
- **Repository authorities**: `CLAUDE.md`, `AGENTS.md`, `NOW.md`, `docs/quality/current-status.md`, `docs/roadmap.md` (including the 7 August Domestic Frontend Alpha amendment and its fourteen-step order), `docs/quality/accepted-requirements.md` (30 outstanding, 6 blocked), `docs/quality/risk-register.md` in full, `docs/ops/ops-pending-migrations.md`, and `config/deployment-contract.json` / `development-hosted-contract.json` / `production-hosted-contract.json`.
- **Prior nightly runs**: `claude/nightly/2026-08-05-nightly-run.md` and `2026-08-06-nightly-run.md`, including their recorded environment constraints and recommendations.
- **Migrations and schema, measured rather than read about.** I parsed all 133 committed migrations and computed which `public` tables are revoked from browser roles: 36 of 52 carry an explicit revoke. Of the 16 that do not, 15 are the original Euro tournament relations the application reads directly under RLS — and one, `rate_limit_events`, is a server-only table whose own creating migration says browser roles have no access. That measurement is what produced the batch.
- **Code**, to check the claim rather than assume it: `grep` across `src/`, `e2e/` and `scripts/` returns **no application reference to `rate_limit_events` at all**, confirming there is no browser read path to preserve.
- **Baseline test state on unmodified `main`**: `npm ci`, `npx oxlint --deny-warnings`, `npx tsc -b`, full `vitest run`, `npm run build`, `npm audit --omit=dev --audit-level=high` — all green before I changed anything.
- **Environment constraint, verified rather than assumed:** `docker info` fails — the client is present, there is no daemon. So `supabase start`, `supabase test db --local` and the Database parity job **cannot run in this sandbox**. This is the third consecutive night this has been recorded (5, 6 and 9 August, by independent sessions). It did not rule the batch out this time, but it does move part of the verification into CI, and section 4 says exactly which part.
- **Deployed app: not touched.** No hosted Supabase or Netlify state was read or written by this work.

### Current-state findings worth recording

1. **The repository is well ahead of both hosted environments and that is deliberate.** Repository was at contract 133; Development and Production are both independently verified at 132. Production promotion is not authorised and the contract gate keeps the last good deploy live. Nothing in this run changes any of that.
2. **Documentation describing a feature is not proof it exists — and one such gap was real.** `20260720210000_rate_limits.sql` states in a comment that `rate_limit_events` has "No client access at all". That statement had never been true: no `revoke` exists anywhere for it, and Supabase's default privileges grant every ordinary privilege on a new `public` table to `anon` and `authenticated`.
3. **The guard that should have caught it was structurally unable to.** `tests/database-parity/dataApiExposure.test.ts` pinned explicit `grant` statements. No `grant` on this table was ever written — the *default* privileges did it. A guard that reads grants cannot see a table that was never granted and never revoked.
4. **Nothing at higher severity was open.** No unresolved scoring, ranking, settlement or auth defect surfaced in the risk register or the issue tracker. `DATA-009`, the last live scoring finding, is recorded resolved at contract 106 with pgTAP evidence.

---

## 2. The batch I chose, and why

**Chosen: close `DB-005` — the browser privileges Supabase's default grants left on the rate-limit event log — and close the guard blind spot that allowed it.**

Against the stated priority order:

- **(a) Defects threatening scoring, data integrity, auth or admin safety.** This is the batch, at the security end of (a). `rate_limit_events` is the enforcement record for the platform's two abuse controls: 60 prediction saves/minute and 5 league-membership writes/minute. Browser roles held `delete` and `truncate` on it. Today RLS denies every row, so this is **latent, not live, and the PR says so plainly** — I am not dressing a hardening fix up as an incident. What makes it worth a night is the failure mode: the table is protected by one control where its design intended two, and the second control's absence is invisible. One future migration that disables RLS to investigate something, or adds a single broad policy, silently hands a signed-in user the ability to erase their own rate-limit history.
- **(b) Unblocking partially-implemented work.** Not applicable without colliding. The three items I would otherwise have picked up — `DFA-004` routes, `EURO-001`/`EURO-002` publication state, the private Championship UI — are all live on other sessions' open branches (#600, #602, #593). `CLAUDE.md` forbids restacking or merging another session's branch without establishing ownership, so I stayed clear.
- **(c) Highest-value active roadmap item.** Same answer: steps 2, 3 and part of 9 of the Domestic Frontend Alpha order are claimed. Starting a fourth frontend slice tonight would have produced a fourth branch competing for the same files.
- **(d) Hardening / least privilege.** The third part of this batch — the exhaustive public-table exposure guard — is squarely here, and is the part with the longest-lived value.

**Value against tournament-time risk.** The change is two `revoke` statements. It alters no rule, no scoring, no lock, no ranking, no read, no write path and no user-visible surface, and it removes privileges rather than granting any — the direction that fails closed if I am wrong about something. Set against that: a named, audited, open security finding is closed with its specified evidence, and the class of defect is made impossible to repeat silently.

**What I deliberately did not do, and why.** `DATA-007` is the *other* open finding in the same limiter — enforcement is count-then-insert, so concurrent transactions can each see a count below the ceiling and all proceed. It is untouched and stays open. It is a defect in `enforce_rate_limit`'s body needing an atomic counter or advisory lock, with different evidence and a real behavioural risk; folding it into a privileges-only change would have made both harder to review and would have put actual limiter behaviour in a PR I cannot fully verify in this sandbox. It is my recommended next batch (section 7).

---

## 3. Exactly what changed

**Branch** `claude/cool-lamport-4pmhiq`, one commit `757e586`. **PR** [#605](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/605).

### Database objects

| Object | Change |
| --- | --- |
| `public.rate_limit_events` (table) | `revoke all … from anon, authenticated` |
| its identity sequence | `revoke all on sequence … from anon, authenticated` |

Nothing else. **Unchanged on purpose:** row-level security (still enabled), both RLS-adjacent controls, the 60/min and 5/min thresholds, `enforce_rate_limit`'s definition, both `before` triggers, every policy, every other relation, and `service_role`'s privileges.

`service_role` is left alone deliberately: it is not a browser role, `DB-005` does not name it, and narrowing the server key's reach across the schema is a separate decision that needs its own evidence. The pgTAP file asserts it is still there, so the omission is recorded rather than accidental.

The sequence revoke is included because `rate_limit_events.id` is this repository's **only** `generated always as identity` column, so its sequence is the only one Supabase's default sequence privileges reach on a table meant to have no client access. An identity column advances its sequence through PostgreSQL's internal `nextval`, which performs no ACL check — so the revoke cannot take the definer function's insert away. That is proven by driving the insert, not by citing the documentation.

### Files

**Added**

- `supabase/migrations/20260809030000_rate_limit_events_client_revoke.sql` — the migration. Additive, idempotent, privileges only.
- `supabase/tests/187_rate_limit_events_client_revoke.sql` — 22 pgTAP assertions in four sections:
  - *the boundary* — `table_privs_are` for the exact empty ACL on each browser role; the identity sequence unreachable by both; `enforce_rate_limit` still uncallable by `authenticated`, so the log has no browser-reachable writer either;
  - *the behaviour, driven as the browser roles* — `select`, `insert`, `update`, `delete` and `truncate` as `authenticated`, and `select` as `anon`, each refused `42501`. This is the assertion that distinguishes before from after: previously a browser `select` returned zero rows through RLS, which looks identical to being refused and stops looking identical the moment someone disables RLS. It uses the repository's own `pg_temp.capture_sqlstate` idiom from `030_entry_boundary_integrity.sql` rather than inventing a pattern;
  - *the limiter still works* — the half `DB-005` did not ask for, and the one that matters most. After the revoke, `enforce_rate_limit` logs a first and second event, is refused at the ceiling on the third with exactly two rows written, and prunes a two-hour-old event on a separate action. A revoke on a table only a `security definer` function touches is precisely the change that can disarm a control with nothing failing, so it is exercised;
  - *the deliberate non-changes* — `service_role` still holds its privileges; both limiter triggers still bound to their tables.

**Modified**

- `tests/database-parity/dataApiExposure.test.ts` — the durable half. Adds an exhaustive pin: every `public` table is either revoked from **both** browser roles, or on a named 16-entry `RLS_ONLY_TABLES` list. Four cases, including an anti-vacuity check (the table scan must find >40 tables) and a reverse-drift check (a table that is in fact revoked must not stay on the list). Comments record what it *cannot* check — whether those 16 tables' RLS policies are correct — so the coverage is not overread.
- `config/deployment-contract.json` — contract 133 → 134, migration count 133 → 134, plus the contract note. No RPC signature added; this contract creates no function.
- `e2e/seed-contract.ts` — `SEED_REVIEWED_AT_CONTRACT` 133 → 134, with a longer-than-usual note because this is the only entry in that list changing privileges on an *existing* table: a seeded user never reads `rate_limit_events`, but every seeded prediction save writes to it through the trigger, and the note explains why the definer boundary means the revoke cannot reach that path and which evidence proves it.
- `docs/quality/risk-register.md` — `DB-005` rewritten to "Resolved in the repository at contract 134; hosted rollout pending", with the original finding preserved verbatim inside the row rather than overwritten, plus a dated 9 August correction record. The 6 August audit line saying `DB-005` was "deliberately not acted on" is left as written with a parenthetical pointing forward — the history is not rewritten to look cleaner.
- Live authorities brought to contract 134: `AGENTS.md`, `docs/quality/current-status.md`, `docs/ops/ops-pending-migrations.md` (now recording **two** pending development migrations and both hosted environments as two behind), and `NOW.md` regenerated by `npm run generate:now`.
- Contract-134 boundary notes appended to the nine documents the authority-freshness checker requires: `CLAUDE.md`, `MASTER-TODO.md`, `docs/roadmap.md`, `docs/adr/README.md`, `docs/design/README.md`, `docs/competition-structure.md`, `docs/quality/feature-baseline.md`, `docs/architecture/programme-plan.md`, `docs/architecture/multi-competition-hub-build-plan.md`. Each says what this contract does *not* change in that document's domain, because for almost all of them the answer is "nothing".

**No `src/` file was touched.** No scoring, lock, ranking, settlement, progression, membership or route code changed. No RLS policy changed. No hosted state was read or written.

---

## 4. What I tested, and the results

**Ran locally, at the pushed head:**

| Check | Result |
| --- | --- |
| `npx oxlint --deny-warnings` | pass |
| `npx tsc -b` | pass |
| Full `vitest run` | **3159 passed / 26 skipped / 0 failed** (350 files passed, 3 skipped) |
| `tests/scripts/` + `tests/database-parity/` re-run after the final SQL edit | 1311 passed / 15 skipped / 0 failed |
| `npm run build` | pass |
| `npm run check:now` | `NOW.md is current: repository 134` |
| `npm run check:documentation-authorities` | `Documentation authorities agree with contract 134` |
| `node scripts/check-migration-timestamps.mjs` | pass — the added migration is strictly ordered above `main`'s highest |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |

**The guards were mutant-tested rather than trusted green,** because a new guard that passes proves nothing until it has been made to fail:

- delete the table revoke → the new suite fails (2 cases);
- weaken it to `from anon` alone → the new suite fails (2 cases);
- restore → 9 passed.

I also confirmed the *existing* contract-count guard is live: my uncommitted migration made `deploymentContractGuard` fail with "Repository has 134 migrations but deployment contract requires 133" before I bumped the contract, which is the guard doing exactly its job.

**Could not run here, stated rather than glossed:**

- **pgTAP (`supabase test db --local`) and the Database parity job** — no Docker daemon in this sandbox. The 22 new pgTAP assertions are verified by CI's `local-supabase` job on PR #605, not by me locally.
- **Browser E2E** — same constraint. It matters for this PR specifically, because `SEED_REVIEWED_AT_CONTRACT` was raised: CI's `authenticated-browser` job is what re-verifies the seeded prediction-save journey through the limiter trigger.

**CI on PR #605: all thirteen checks green.** Verified after they completed, not assumed:

| Check | Conclusion |
| --- | --- |
| `ci` | success |
| `local-supabase` (pgTAP + Database parity) | **success** — this is the evidence for the 22 new pgTAP assertions |
| `migration-transition` | success |
| `authenticated-browser` (Browser E2E) | **success** — this is the re-verification behind the raised `SEED_REVIEWED_AT_CONTRACT` |
| `verify` | success |
| `deploy-preview-smoke` | success |
| `CodeQL` + `Analyse actions` + `Analyse javascript-typescript` | success |
| Netlify `Header rules` / `Redirect rules` | success |
| Netlify `Pages changed` | neutral (informational) |
| `Supabase Preview` | skipped |

So both CI-only halves of the verification came back green: the pgTAP file's 22 assertions ran against a real PostgreSQL rebuilt from all 134 migrations, and the authenticated browser journey — which writes through the limiter trigger on every prediction save — passed against the revoked table.

**One process note, recorded because it nearly produced a false claim.** My first attempt to watch CI from this sandbox used the *unauthenticated* GitHub API, hit its hourly rate limit, and my filter treated the resulting error as "no checks in progress" — briefly reporting all checks settled when four were still running. The environment's `GITHUB_TOKEN` is a 14-character placeholder that returns HTTP 401, so authenticated polling is not available here either. The watcher was rewritten to treat an API error as *still waiting* and to say so out loud, which is how the four real results above were obtained. Worth knowing for future runs: a CI watcher in this sandbox must fail loud, because silence and success look identical.

**Netlify deploy preview built successfully** ([preview](https://deploy-preview-605--euro28predictor.netlify.app)). Its Lighthouse comparison reports performance 20 against production's 76 — that is a cold unoptimised preview measured against a much older production build, and this PR touches no `src/` file at all, so it cannot be the cause. Recorded rather than actioned.

---

## 5. Merge outcome

**Final outcome: merged to `main` as `a942f18` — but not by this session.** PR #605 was
held open deliberately, as recorded below, and was then merged by another actor while this
run was still verifying the restacked branch. Recorded plainly because the distinction
matters: this session did not merge a database migration, and did not enable auto-merge on
one.

What the merge means in practice:

- `main` is now at contract **134** with 134 migrations, and the batch is complete there —
  migration, pgTAP file, exposure guard, `DB-005` register row and both 9 August reports.
- Merged `main` was re-verified after the fact rather than assumed: `npx oxlint
  --deny-warnings` clean, **3241 passed / 26 skipped / 0 failed** (356 files), `npm run
  check:now` and `npm run check:documentation-authorities` both agreeing at contract 134.
- The three points below were "awaiting review before merge". Two of them are now
  *unreviewed decisions already on `main`*, which is worth knowing even though the change
  itself is conservative.

**What this session intended, and why it held:**

The overnight merge policy holds anything touching database migrations, and this batch also
changes privileges on a table in the abuse-control path. Both conditions applied, so the PR
was left open with green CI as the precondition for a decision rather than for a merge.

**Still outstanding despite the merge:**
1. the `service_role` scope decision — it was deliberately left untouched (reasoning in
   section 3) and the opposite call is defensible; it is now merged as-is, so changing it
   would need its own contract;
2. whether the hosted Development fast-lane apply should follow — **this is the one that
   still matters most.** Merging to `main` does not close `DB-005` anywhere: both hosted
   environments still grant every ordinary privilege on `rate_limit_events` to both browser
   roles until contract 134 is actually applied;
3. whether an unattended session's "hold for review" should be able to be overridden by
   another automated actor, which is a process question rather than a code one.

---

## 6. What remains uncertain, and what I need from you

1. **The contract-134 collision is resolved; this branch needs no renumbering.** When first written this report flagged draft PR #602 as also claiming 134 and asked for a merge-order decision. Re-checked after the #608 restack: `main` is at contract 133 with 133 migrations, so `20260809030000_rate_limit_events_client_revoke.sql` is the only migration above it here and 134 is correctly and solely claimed. The mitigation still stands if #602 revives — its migration timestamp (`20260809001500`) and pgTAP index (`186`) both sort *below* this branch's, so only documentation numbers would ever need bumping, never the chain order. **No decision needed on this any more**; it is recorded because the earlier notification asked for one.
2. **`DB-005` is not closed in either hosted environment, and this PR does not claim it is.** The revoke reaches Development only through the guarded additive fast lane, and Production only through its own approved promotion. Until then both environments still grant every ordinary privilege on that table to both browser roles. The register row and the ops record both say so. **Do you want the fast-lane apply run after merge?** The hosted position moved during this run: Development is now at contract 133 (Fast Lane run 31276698062, postflight-verified), so contract 134 would be Development's *only* pending migration — one additive privileges-only step. Production remains at 132 and needs both 133 and 134.
3. **Still no Docker daemon in this environment — third consecutive night, three independent sessions.** Tonight I chose a batch whose CI-only half is narrow and clearly named, but this is now a recurring structural limit on what a scheduled run can verify. Worth deciding whether these runs should be pointed at an environment with Docker access, or should be permanently scoped to batches whose evidence is fully local.
4. **Concurrent-session traffic was heavy, and two collisions came out of it — both needing a rule, not a fix.** Five PRs were open when I started (#593, #597, #600, #602, #604) and I stayed off every one of their branches. Then (a) another session merged PR #608 *into* this run's branch to restack it, which is the opposite direction and not something I asked for, and (b) the other 9 August session's report overwrote mine at the shared dated filename. Both outcomes were recoverable and both were verified rather than assumed, but `CLAUDE.md` says concurrent work must be kept separate and that a session's branch must not be restacked without establishing ownership. **Two decisions needed:** who owns a designated session branch, and whether nightly runs should triage other sessions' stale drafts or leave them as I did.
5. **One reasoned claim in the migration is not locally proven, only CI-proven:** that revoking the identity sequence cannot break the definer insert, because PostgreSQL advances an identity column's sequence without an ACL check. The pgTAP file drives the insert to prove it, so CI's `local-supabase` job is the evidence. If that job fails on the insert, the sequence revoke is the first thing to drop — the table revoke alone still closes `DB-005` as specified.

---

## 7. Recommended next batch

1. **`DATA-007` — make rate-limit enforcement atomic.** Same subsystem, now with a pgTAP file and an exposure guard in place to build on, and the natural sequel to tonight. `enforce_rate_limit` does `select count(*)`, compares, then inserts, with no advisory lock or atomic upsert, so concurrent transactions can each observe a count below the ceiling and all proceed. Coverage is also narrower than it reads: both limits are triggers on the *written* table, so an **invalid** league code fails before any insert and consumes no limit at all — which is exactly what makes invite-code probing unbounded, and links this to `SEC-001`. It needs a Docker-capable environment or acceptance that CI is the only verifier, and it should be held for review like tonight's.
2. **Apply contract 134 (and 133) to hosted Development through the guarded additive fast lane, then verify the ACL there.** Cheap, and it is what actually closes `DB-005` rather than closing it in the repository only. Also the run that finally proves or disproves `OPS-010`, whose closure condition is the next fast-lane rollout opening its pull request unaided.
3. **`SEC-001` — invite-code strength and preview disclosure.** The register already specifies the closure: at least 10 characters from cryptographically secure bytes, an atomic limiter covering previews and failed joins, minimal preview disclosure, and code rotation. It shares the limiter work in (1), so doing them adjacently is cheaper than doing them apart — but they are separate PRs, since one changes an abuse control's arithmetic and the other changes a user-visible code format.
4. **A one-line process fix worth taking before the next multi-session night:** make the nightly report path carry the run, not just the date — `claude/nightly/<date>-<slug>.md`, or a per-session suffix. Two runs on one date currently collide on one filename, and git resolves it by silently keeping whichever merged last. Tonight that cost a report that had to be recovered from an earlier commit; the cheap guard is a test asserting no two committed nightly reports share a date-and-name, or simply a naming convention that cannot collide.
5. **If a fully-local batch is wanted instead:** last night's recommendation is still open and still small — `src/services/supabase/seasonLeaderboard.ts`'s `fetchSeasonLeaderboardPage` has no direct unit test and no adapter matching `SeasonStandingsGateway`'s shape, one game short of the coverage the 6 August run added for the other two.
