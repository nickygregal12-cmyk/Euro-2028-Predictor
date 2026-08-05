# Nightly run — 5 August 2026


Two unattended sessions ran overnight on 5 August 2026 and each wrote a report
at this path. Both are kept: they inspected different things and reached
different conclusions, and a dated evidence file that silently holds one of two
concurrent runs is worse than one that holds both.

---

## Session A

Unattended overnight session against `nickygregal12-cmyk/Euro-2028-Predictor`. British English throughout, per instructions.

## 1. What I inspected

Sources of truth, in the order specified:

- **GitHub `main`**: at session start, `main` was at `653511a` ("Record the 104 and 105 development rollout with corroborating evidence", #464). Two open PRs existed: #465 (a docs-only finding from an earlier scheduled run, still awaiting human review) and #462 (a docs-only automation handover record, green, base slightly behind `main`).
- **Repo docs**: `AGENTS.md`, `CLAUDE.md`, `docs/quality/current-status.md`, `docs/roadmap.md`, `MASTER-TODO.md`, `docs/quality/risk-register.md`.
- **Existing `claude/…` automation history**: `docs/automation-runs/2026-08-04-0100-*`, `2026-08-04-0300-*`, `2026-08-05-0100-*` (the established pattern for dated handover records). No prior `claude/nightly/` reports existed — this is the first.
- **Code and tests**: full repository build, lint, typecheck and unit-test suite; targeted reading of `src/features/trends/`, `src/services/supabase/predictionConsensus*.ts`, `src/features/home/` (as the established "unavailable vs empty" pattern), and the risk register's open Low/Medium items, cross-checked against actual code rather than trusted at face value.
- **Deployed app**: not touched. No Netlify or Supabase inspection was needed or performed this session (read-only or otherwise) — the chosen batch was application-code-only.

**Key finding on environment constraints, verified directly:** this sandbox has no Docker daemon at all (`docker pull` fails with "no such file or directory" on `/var/run/docker.sock`), so `supabase start`, pgTAP and Database parity cannot be run here. This matches what PR #465's author reported for their own session. Any SQL/migration/RPC/RLS work is therefore unverifiable in this environment and was correctly ruled out as a candidate batch, per the "fail closed" instruction.

## 2. Housekeeping done before selecting new work

Two pre-existing open PRs needed a decision before starting fresh work:

- **PR #462** ("Docs: record 2026-08-05 03:00 progress handover") — a pure documentation addition (`docs/automation-runs/2026-08-05-0300-predictor-progress.md`, new file only) matching the repository's established dated-handover pattern. CI was green, Netlify preview was green, and the content was superseded-but-still-accurate historical record (in the same spirit as the other immutable dated documents in that directory). **Merged** (squash) as a low-risk documentation record.
- **PR #465** ("Docs: record contract-104 recompute completion-gate risk; correct stale contract-105 wording") — also docs-only and CI-green, but its author deliberately left it open for human review because its content documents a live scoring-authority finding (`DATA-009`: a latent correctness risk in the contract-104 `live_competition_id` scoping that would make a post-completion KO Predictor/LMS correction silently no-op, currently unreachable because no writer sets `completed_at` on those game keys yet). That is a sound, deliberate hold, not an oversight — I left it exactly as is. **It still needs your attention**, see §6.

## 3. The batch I chose and why

**Batch: distinguish a failed player-name read from a genuinely player-less pick on the Prediction Trends page (risk-register item `UX-002`).**

Selection reasoning, against the stated priority order:

- (a) **Scoring/data-integrity/auth/admin defects**: the one live candidate (`DATA-009`, above) is already reported and correctly held — attempting an unverified fix to scoring-authoritative SQL in an environment with no way to run pgTAP would be exactly the kind of action the "fail closed" instruction rules out. Nothing else at this severity was found.
- (b) **Unblocking in-progress work**: `MASTER-TODO.md`'s Stage E/F "next slice" markers (recurring matchweek scheduler, LMS settlement job) turned out to be **stale** — `docs/quality/current-status.md` and the actual migrations (`20260804113000_season_matchweek_scheduler.sql`, `20260804173000_lms_settlement_job.sql`) show both already landed. There was no genuine in-progress application-code gap here to unblock.
- (c) **Highest-value active roadmap item**: the next real roadmap items (Cup split-stage persistence decision, provider-ingestion custody) are schema/SQL-shaped and out of reach in this sandbox.
- (d) **Hardening**: this is where the batch landed. I had a research agent survey the risk register's open Low/Medium items against actual code (not the register's wording, which drifts). Most candidates were already resolved-but-undocumented (`SEO-001`, `TYPE-001`) or too large/risky for one unattended session without integration coverage (`CODE-001`'s 892-line `PredictionsProvider.tsx`). `UX-002` on `PredictionTrendsPage.tsx` was live, small, self-contained, and had an established, well-tested fix pattern already proven elsewhere in the codebase (`useHomeData.ts`'s `unavailable` set, `HomePage`'s warning banner, `MatchCentrePage`'s league-scope handling) — so the fix isn't inventing a new UX convention, it's applying an existing one to a surface that was missed.

**The defect, concretely:** `PredictionTrendsPage.tsx` fetched Golden Boot player names with `fetchConsensusPlayers(...).catch(() => [])`. Every label reading from the result already has a fallback (`?? 'Official squad player'`), so a genuine read *failure* (network blip, RLS hiccup) rendered identically to a pick that legitimately has no matching player row — the viewer had no way to tell "this is just how the data is" from "something didn't load, try again."

## 4. Exactly what changed

**Branch:** `claude/prediction-trends-player-name-availability`
**PR:** [#466](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/466)

Files:

- `src/features/trends/PredictionTrendsPage.tsx` — the player-name fetch now tracks its own failure (`playersUnavailable: boolean`) separately from the consensus fetch's own error handling, instead of swallowing it. When it fails **and** there are Golden Boot picks that would actually be mislabelled, a `warning`-variant `Alert` ("Player names are temporarily unavailable") renders above the trends content — the same visual pattern as `HomePage`'s "Some dashboard data is unavailable" banner. A failure with zero Golden Boot picks stays silent (nothing to mislabel).
- `tests/features/trends/PredictionTrendsPage.test.tsx` — new file, four cases: failed read shows the warning + existing fallback label; successful read shows real names with no warning; no warning when there are no Golden Boot picks (the exact case that was previously indistinguishable from a failure); the suppressed-consensus path never calls `fetchConsensusPlayers` at all.
- `docs/quality/risk-register.md` — recorded this partial `UX-002` closure against the still-open register item (other secondary surfaces remain, per the register's own wording).

No SQL, RPC, RLS policy, migration, scoring, or lock logic touched. No database object changed. No production, Supabase or Netlify state touched or inspected.

## 5. What I tested and the results

All run against the final (rebased-onto-latest-`main`) branch head in this sandbox:

| Check | Result |
| --- | --- |
| `npx oxlint --deny-warnings` | Pass |
| `npx tsc -b` | Pass |
| `./node_modules/.bin/vitest run` (full suite) | **2303 passed, 26 skipped, 0 failed** — the 26 skips are the pre-existing DB-gated (`databaseEnabled`) and git-worktree-gated suites, unchanged from `main`; not a new gap |
| `tests/scripts/riskRegisterIntegrity.test.ts`, `ciTestDiscoveryFloor.test.ts`, `documentationContractFreshness.test.ts` (targeted, before and after the docs edit) | Pass |
| `npm run build` | Pass |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| Database parity / pgTAP | **Not run — not applicable.** No SQL was touched, and this sandbox has no Docker daemon to run local Supabase even if it had been needed. |
| Browser E2E (Playwright) | Not run. The change is unit-test-covered React state/rendering logic with no new route or critical journey; `scripts/select-browser-journeys.mjs`-style judgement says this doesn't need it. CI's own browser-journey selection will still run against the PR. |
| CI (GitHub Actions) | **Pending at time of writing** — the PR is subscribed and I'm watching for it to go green before deciding merge. |

## 6. Merge outcome

**PR #466 (this run's batch): held pending CI, will auto-merge once green.** This is a low-risk, application-only change (UI + test + docs, no scoring/auth/schema surface) with full local verification passing; per the stated merge policy I will merge it as soon as CI reports green, and will report back if CI fails and I can't fix it within this run.

**PR #465 (from an earlier scheduled run): still HOLD, awaiting your review.** Not touched by me — its author's own reasoning for holding it is sound (see §2) and I have nothing to add to the investigation itself. It needs a human decision on `DATA-009`, not another automated pass.

**PR #462: merged** (squash) — see §2.

## 7. What remains uncertain / decisions needed from you

1. **`DATA-009` (PR #465, `docs/quality/investigations/2026-08-05-tournament-bonus-recompute-completion-gate.md`)**: a real but currently-unreachable correctness risk in contract 104's `live_competition_id`-scoped recompute callers. Needs your read and a decision on remedy (mirror the `current_public_competition_id` fallback vs. explicitly decide+test that tournament-path Bonus Games are frozen against post-completion correction) before the next writer of `bonus_competitions.completed_at` on those game keys (most plausibly a future LMS restart driver) makes it reachable. This is the one item in this report that actually needs your judgement, not just your merge button.
2. **This sandbox's DB access is a standing constraint**, not just tonight's: any future batch that needs a migration, an RPC, an RLS change, or pgTAP/Database-parity verification cannot be safely completed unattended here. Worth deciding whether future scheduled runs should be pointed at an environment with Docker/local-Supabase access, or should keep being scoped to application-code-only batches as I did tonight.
3. `MASTER-TODO.md`'s Stage E/F status lines are stale against `docs/quality/current-status.md` and the actual migrations (both "next slice" items are in fact landed). I did not edit `MASTER-TODO.md` myself — it's explicitly the "detailed active/parked inventory" and reconciling it is arguably its own small docs batch, not something to fold silently into an unrelated PR. Flagging it here rather than touching it opportunistically.

## 8. Recommended next batch

In priority order, for whoever/whatever picks up next:

1. **Resolve `DATA-009`** (needs your decision first, then a coded/tested fix — but that fix needs pgTAP, so it needs an environment with DB access).
2. **Reconcile `MASTER-TODO.md`'s Stage E/F entries** against `docs/quality/current-status.md` — small, docs-only, safe for an unattended session.
3. If another DB-free application batch is wanted: the research this session did also surfaced `src/domain/tournament/homeDashboard.ts`'s `catchUpSummary()`, which hard-codes `rankDelta: null` even though `rank_history` storage already exists and is populated — a real, medium-sized (multi-file: service query + domain calc + wiring + tests) feature-completion candidate, fully vitest-verifiable, no migration needed. Left for a future run rather than attempted alongside tonight's batch, to keep this PR to one coherent concern.
4. A quick, very low-risk win if a DB-adjacent environment becomes available: add `tests/database-parity/rateLimitParity.test.ts` asserting the `RATE_LIMITS`/`RATE_LIMIT_WINDOW_MS` constants in `src/domain/rateLimit.ts` against the literals in `supabase/migrations/20260720210000_rate_limits.sql` — this is a **text-based** parity test (reads migration SQL as a string) so it needs no live database, and it directly discharges the one concrete follow-up named in `docs/quality/investigations/2026-07-30-hygiene-002-module-reachability.md`.

---

## Session B

Unattended overnight session on `Euro-2028-Predictor`. British English throughout.

## 1. What I inspected

- **GitHub `main`**: fetched fresh; head was `653511a999a57b9dffa1894fd322c61b3c60627f`, repository contract 105 (105 canonical migrations through `20260805010000_cup_split_group_tables.sql`).
- **My assigned branch, `claude/nifty-mendel-u302sn`**: found it far behind `main` with zero unmerged commits of its own and no open PR against it, so I restarted it from `origin/main` per the standing instruction for a branch whose prior work is already superseded/merged.
- **Authoritative docs**: `AGENTS.md`, `CLAUDE.md`, `docs/quality/current-status.md`, `docs/roadmap.md`, `MASTER-TODO.md`, `docs/quality/risk-register.md`, the most recent hourly handover (`docs/automation-runs/2026-08-05-0300-predictor-progress.md`) and its open follow-up PR (#462).
- **A second, independent automation stream**: an hourly "predictor progress" session series is already actively driving the contract-by-contract database migration/rollout sequence (it landed contracts 104 and 105 earlier tonight and has PR #462 open recording a 03:00 handover, with contract 106 — the LMS restart driver — named as its next step). I deliberately did not touch migrations or the contract sequence to avoid colliding with that concurrent, tightly-sequenced work.
- **Current code state, directly, not from docs**: ran `npm ci`, `npx oxlint --deny-warnings`, `npx tsc -b`, `npx vitest run` (full suite) and `npm run build` against a clean checkout of `main` before changing anything. All green: 265 test files / 2299 tests passed, 26 skipped, 0 failed; lint, typecheck and build all clean.
- **Local Supabase/pgTAP availability**: attempted `docker pull postgres:17-alpine` and `npx supabase start` to get a real database for verification. Both failed closed with `403 Forbidden` from the registry (Docker Hub CDN and GHCR blob storage respectively) — this sandbox's network allow-list does not cover container registries. No pgTAP/Database-parity harness could be run this session; this is an execution-surface limitation, not a test failure, and is stated as such rather than worked around.
- **Open GitHub issues** (#303, #272, #175, #129, #121, #33, #28, #27) and `docs/quality/risk-register.md`, to check for a live, low-risk, non-DB defect matching my priority order.
- Delegated a focused, read-only security/correctness audit (background agent) of the two freshest, least-reviewed migrations — contracts 104 and 105 — plus their pgTAP/TypeScript boundary tests, cross-referenced against CLAUDE.md's hard boundaries. I independently re-verified its headline finding by reading the actual SQL rather than trusting the summary (see below).

## 2. The batch I chose, and why

**Investigation and documentation correction, not a code change**, for two reasons that both trace back to the same constraint: I could not stand up a real Postgres instance in this sandbox (see above), and this repository holds *every* scoring-authoritative SQL change to pgTAP + TypeScript/PostgreSQL parity evidence proven against a real database. Writing a plausible-looking SQL fix with zero database evidence would fail this repository's own evidence standard and CLAUDE.md's instruction to fail closed when unsure.

What I found and verified by hand (not just from the audit agent's summary):

1. **A real, timely correctness risk in contract 104** (landed hours before this session). `predictor_internal.recompute_ko_predictor_for_match` and `predictor_internal.recompute_lms_for_tournament` (`supabase/migrations/20260805001000_live_competition_callers.sql`) now resolve their competition through `predictor_internal.live_competition_id`, which excludes any row with `completed_at is not null`. I diffed this against the immediately preceding version of both functions (`20260804283000_bonus_rederive_tournament_lock.sql`), which matched on `tournament_id`+`game_key` alone with no completion condition — confirming this is a genuine behavioural change, not a pre-existing gap. It means a post-completion correction to a KO Predictor/Last Man Standing result would silently no-op instead of rederiving scores — the opposite of what the season LMS settlement job (contract 89) deliberately does for the identical problem, and documents at length why ("a result restated after a competition finished … could never re-derive, and the wrong player would keep the title for ever").

   I then traced every writer of `bonus_competitions.completed_at` in the committed migrations myself and confirmed the risk is **not reachable today**: the only two writers touching the relevant game keys are scoped to `tournaments.kind = 'league_season'` (contract 89) or `game_key = 'predictor_cup'`; nothing writes it for a tournament-kind `ko_predictor`/`last_man_standing` row. `restart_all_reentered` — the likeliest future writer — is confirmed absent from the repository by the existing `tests/database-parity/liveCompetitionCallerBoundary.test.ts` guard. So this is latent risk worth recording now, ahead of the other automation's planned contract 106 (the LMS restart driver), rather than a live defect to fix under pressure.

2. **A stale, self-contradictory line in the project's declared live-status authority.** `docs/quality/current-status.md`'s "Next executable issue" row still described contract 105 as *"the restart lifecycle function itself"*; contract 105 actually shipped as the Cup split-ancestry/derived-standings work. The file calls itself *"the only live implementation and hosted-status authority"*, so this was actively misleading about what had and hadn't landed.

This sits squarely in priority (a) of the run's stated ordering — a defect that, if it becomes reachable, threatens scoring/data integrity — surfaced and recorded before it can bite, at effectively zero execution risk (no code, schema or behaviour touched).

## 3. Exactly what changed

**Branch:** `claude/nifty-mendel-u302sn` (reset onto `origin/main` first, per the merged-branch instruction)
**PR:** [#465](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/465) — "Docs: record contract-104 recompute completion-gate risk; correct stale contract-105 wording"

Files changed (documentation only, 72 insertions, 1 deletion, no code/schema/migration/RLS/RPC touched):

- `docs/quality/current-status.md` — corrected the "Next executable issue" row.
- `docs/quality/risk-register.md` — added `DATA-009` for the completion-gate risk.
- `docs/quality/investigations/2026-08-05-tournament-bonus-recompute-completion-gate.md` — new. Full trace: the exact pre/post-contract-104 code diff, every `completed_at` writer and its scope, why it's unreachable today, why it wasn't fixed blind, and the two remedy options for whoever picks it up.

No database object, migration, RPC, RLS policy or test file was added or changed — nothing to list there.

## 4. What I tested, and the results

- `npx oxlint --deny-warnings` — pass, before and after.
- `npx tsc -b` — pass, before and after.
- `npx vitest run` (full suite, 268 files) — **2299 passed, 26 skipped, 0 failed**, both before my change (establishing baseline) and after (confirming no regression), including `tests/scripts/documentationContractFreshness.test.ts`, which specifically guards `current-status.md` against stale or self-contradictory contract claims and passed cleanly against my edit.
- `npm run build` — pass, before and after.
- pgTAP / Database parity harness — **not run**, and explicitly stated as not run rather than assumed. `supabase start` and `docker pull` both returned `403 Forbidden` in this sandbox. Not applicable to this PR's actual diff (docs only), but it is exactly the gate that blocks resolving `DATA-009` itself.
- GitHub PR checks as of writing: `ci` queued, Netlify deploy-preview checks in progress, `Supabase Preview` skipped (expected — no schema change). I'm subscribed to PR #465 and will react to CI/review events as they arrive rather than poll.

## 5. Merge outcome

**Left open for your review — not auto-merged**, despite being low-risk (docs only, full green local evidence). Reason: its content is a finding about scoring-authoritative code, and the recommended remedy is itself a scoring-authority decision CLAUDE.md reserves for explicit authority plus test updates ("No scoring or rule change without authority and test updates"). The documentation edits themselves are safe to merge independently of that decision; I flagged rather than pre-judged it.

## 6. What remains uncertain, and what I need from you

- **Decide the DATA-009 remedy**, or explicitly accept it as a documented latent risk for later: either give the two tournament-path recompute functions a resolver that also covers the latest *completed* competition (mirroring `predictor_internal.current_public_competition_id`'s fallback), or deliberately decide — and prove with pgTAP, the way `152_euro_post_lock_reveal_scope.sql` proves the reveal-scope decisions — that a completed tournament Bonus Games competition is meant to be frozen against correction. Either answer needs a database engineer with real Postgres access, which I didn't have tonight.
- **This session had no way to run pgTAP/Database parity or Browser E2E at all** (container registry access is blocked in this sandbox). If future scheduled runs need to touch schema, migrations or anything requiring the disposable-local Supabase harness, that constraint needs addressing (network allow-list, or routing DB-adjacent work to an environment that has it) — otherwise any such work here would have to be reported rather than implemented, as tonight's was.
- **Two independent automated workstreams are now touching this repository concurrently** (the hourly contract-rollout series and this nightly run). Tonight I stayed deliberately clear of the migration/contract sequence to avoid collision; worth confirming that's the right long-term division of labour, or whether the two should be more explicitly coordinated (e.g. a shared "claimed contract number" ledger) as both continue.
- Everything else established tonight (baseline green suite, restarted branch, no production/Supabase/Netlify mutation) is fact, not a decision needed from you.

## 7. Recommended next batch

Once DATA-009 is resolved (or explicitly deferred) and PR #465 is merged: the next-highest-value, lowest-risk **non-DB** batch I'd pick is closing out `docs/quality/investigations/2026-07-30-hygiene-002-module-reachability.md`'s remaining open item — relocating the three stray `src/**/*.test.*` files (`src/domain/tournament/matchNavigation.test.ts`, `src/features/matches/MatchCentreScreen.test.tsx`, `src/services/supabase/adminAccess.test.ts`) into `tests/`, which that investigation found blocked only by since-completed Stage B work and is otherwise mechanical and fully `vitest`-verifiable. If the goal instead is DB/contract progress, that lane already belongs to the hourly automation stream (next: contract 106, the LMS restart driver) and I'd defer to it rather than duplicate.

No production, Supabase, or Netlify mutation was made or attempted. All work is on `claude/nifty-mendel-u302sn` / PR #465, unmerged pending your review.
