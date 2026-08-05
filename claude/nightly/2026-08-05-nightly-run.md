# Nightly run — 5 August 2026

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
