# Nightly run — 9 August 2026

Unattended scheduled session. British English throughout. Every figure below was
produced by a command that actually ran in this session; where a suite could not
run, that is stated rather than worked around.

## 1. What I inspected

**Git and GitHub, first.** `origin/main` at `7e6aeac` ("docs: record 2026-08-09
01:00 predictor progress", #601). The designated branch
`claude/bold-ride-ic2fkh` existed on the remote and was identical to
`origin/main` — no prior commits, so no restart or rebase was needed. Six pull
requests were open at the start of this run: #593 (private Championship player
UI), #597 (docs reconciliation), #600 (DFA-004 canonical weekly routes), #602
and #605 (**both claiming contract 134**), and #604 (docs handover). That
duplicate contract claim is the single most important fact for choosing work
tonight: it rules out any batch that would need a contract number.

**Authority documents, in the order `CLAUDE.md` prescribes.** `NOW.md`
(repository contract 133, development hosted 132, production 132 with promotion
**not** authorised; one pending development migration),
`docs/quality/current-status.md`, `docs/roadmap.md` including the 7 August
Domestic Frontend Alpha amendment, `docs/quality/risk-register.md` in full,
`docs/quality/accepted-requirements.md`, and the two prior nightly reports in
`claude/nightly/`.

**Environment, verified rather than assumed.** `docker info` fails on
`/var/run/docker.sock` — **there is no Docker daemon here.** This is the third
independent session to record the same constraint (5 and 6 August). It means
`supabase start`, pgTAP and Database parity cannot run in this sandbox, so any
migration, RPC, RLS or policy work is unverifiable locally tonight.

**Code and tests, measured before changing anything.** `npm ci`, then a full
`vitest run` on untouched `main`: **350 files passed, 3 skipped; 3154 tests
passed, 26 skipped, 0 failed.** That is the baseline every later figure is
compared against.

**A targeted defect hunt** rather than only reading the register. The repository
has one recurring defect shape, named explicitly in `CLAUDE.md` and in six
contract records: *a read written for a tournament, never widened for a season,
returning a plausible but wrong answer.* Contracts 86, 98, 116, 118, 120 and 128
each fixed an instance. I looked for the **browser-side** version of the same
shape — a server authority that exists and that nothing can call — and found
one.

### Current-state findings

- **`get_season_league_standings` (contract 128, merged 6 August) had no
  browser caller.** Grepping the whole repository for it returned only
  `tests/database-parity/seasonLeagueStandingsParity.test.ts` and a comment in
  `e2e/seed-contract.ts`. No service wrapper, no hook, no surface.
- Meanwhile `src/features/season/gameLeaguesModel.ts` still produced a
  `standingsNote` reading *"League tables are not open yet… so no table is shown
  rather than one that would read zero for everybody"*, and
  `SeasonLeaguesPage.tsx` rendered it. That sentence was **correct until
  contract 128 and false afterwards.**
- The register's remaining open findings were checked and deliberately not
  taken: `DB-005` needs a migration **and is already the subject of PR #605**;
  `DATA-007` (count-then-insert rate limiter) and `SEC-001` (six-character
  invite codes) both need migrations; `AUTH-002` is a hosted Supabase Auth
  setting, not repository-verifiable; `SEC-002` (CSP `unsafe-inline`) is
  explicitly recorded as a gradual campaign whose failure mode is discovered in
  production — a poor choice for an unattended run; `ACQ-R19`'s remaining half
  is SHA-pinning third-party GitHub Actions, which would mean resolving commit
  hashes for repositories outside this session's GitHub scope, so I left it.
- No new scoring, data-integrity, auth or admin-safety defect surfaced.
  `DATA-009`, the last live scoring finding, remains closed at contract 106 with
  pgTAP evidence.

## 2. The batch I chose, and why

**Chosen: open a season private league into its own table — wire contract 128's
`get_season_league_standings` through to the Leagues surface.**

Where it sits in the stated priority order: **(b), unblocking work already in
progress**, and it is the cleanest available instance of it. Contract 128 did
the hard, rule-bearing half — totals from `season_standings` so a league can
never disagree with the season, rank recomputed inside the league because a
private league is its own table, and the tournament read taught to refuse a
season league by naming the one that answers. The remaining half was browser
plumbing with no rule in it.

Why it is worth doing rather than the next roadmap item:

- **A read nobody can call is, to a player, a read that does not exist.** This
  repository has fixed that shape six times on the server side. Leaving the
  browser side open recreates it.
- **The surface was actively saying something untrue.** A note explaining why
  there is no table is worse than useless once the table is available.
- **It is finishable and verifiable here.** No SQL, so nothing depends on the
  absent Docker daemon; the whole batch is provable by lint, typecheck, the full
  Vitest suite and a production build, all of which ran.
- **It claims no contract number**, which matters on a night when two open pull
  requests are already claiming 134.

Why not the alternatives: anything touching the database is unverifiable here
and contested on numbering; the highest-value *named* roadmap items (DFA-004
routes, EURO-002 publication state, the Championship player UI) are each already
owned by an open pull request, and `CLAUDE.md` forbids restacking another
session's branch.

**Risk:** low in mechanism — no migration, no scoring, no lock, settlement or
progression change, no new grant, and no second ranking authority in the browser
(page, rank, ordering and cursor all remain the server's). But the *subject* is
a ranking table, which the merge policy names explicitly. See §5.

## 3. Exactly what changed

**Branch:** `claude/bold-ride-ic2fkh`
**Commit:** `a88657b` — "Open a season private league into its own table"
**Pull request:** https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/606

17 files, 1,667 insertions, 60 deletions.

**New source**

| File | What it is |
| --- | --- |
| `src/services/supabase/seasonLeagueStandingsModel.ts` | Pure response parser. Refuses a row missing matchweeks played (ADR 0012 pairs it with points), a row missing `hasEntry`/`isOwner`/`isYou`, and a page claiming more rows while offering no cursor. |
| `src/services/supabase/seasonLeagueStandings.ts` | The RPC wrapper for `get_season_league_standings`, with an explicit prohibition on ever growing a direct-table fallback. |
| `src/features/season/leagueStandingsModel.ts` | Presentation model and code-keyed refusal classification. |
| `src/features/season/useSeasonLeagueStandings.ts` | Accumulating paging, server cursor passed back untouched, late-response guard, reset when the league changes. |
| `src/features/season/SeasonLeagueStandings.tsx` + `.module.css` | The table itself, phone-first, tokens only. |

**Changed source**

- `src/features/season/SeasonLeaguesPage.tsx` — each league card gains a
  "View <league> table" control that expands the table in place; the
  `standingsNote` paragraph is gone. The standings gateway is a **required**
  prop, not optional, so the surface cannot quietly go back to having no table.
- `src/features/season/gameLeaguesModel.ts` — `standingsNote` removed from the
  view and its rationale comment rewritten to record why it existed and why it
  no longer does.
- `src/features/season/SeasonLeaguesPage.module.css` — the note's style removed
  with it.
- `src/features/season/SeasonGameRoutes.tsx` — wires the real read (13 lines).

**Database objects: none.** No migration, no function, no grant, no policy, no
row. No contract number claimed.

**Tests** — 60 new, across four new files and three updated ones. Deliberately
weighted to failure and correction paths: RPC refusal propagation; nine
malformed-payload variants; a missing matchweek count; a page claiming more rows
with no cursor; an append failure that keeps the loaded rows on screen; retry
from page one after a first-read failure; a membership lost mid-read; a member
with no entry in the game.

Three judgement calls worth recording, because they are decisions rather than
plumbing:

1. **A league member who has not entered the game shows "Not entered", never a
   zero.** The read includes them on purpose — its boundary is league
   membership, not game entry, because the alternative hides a league from the
   person who created it. But a "0 points from 0 matchweeks" row beside players
   who have actually played misrepresents them, so the numbers are replaced by a
   word and their rank is not read out to assistive technology either.
2. **One table open at a time.** Two open tables of the same players invite
   exactly the cross-league comparison neither of them means.
3. **`aria-controls` is set only while the panel is in the document.** A
   dangling reference is what axe reports, and this repository counts axe's
   `incomplete` results rather than discarding them.

## 4. What I tested, and the results

| Check | Result |
| --- | --- |
| `npx oxlint --deny-warnings` | **Pass** |
| `npx tsc -b` | **Pass** |
| Full `npx vitest run` | **354 files passed, 3 skipped; 3214 tests passed, 26 skipped, 0 failed** |
| Baseline for comparison (on untouched `main`) | 350 files / 3154 tests passed |
| `npm run build` (incl. `prebuild` contract validation) | **Pass** |
| `npm run check:dead-code` (knip) | No findings against any new module |
| `npm audit --omit=dev --audit-level=high` | **0 vulnerabilities** |
| Database parity / pgTAP | **Not run — no Docker daemon in this sandbox.** No SQL changed, so there is nothing new for it to assert. |
| Browser E2E / axe | **Not runnable here** (same reason). `/competitions/premier-league/2026-27/leagues` is already in the axe route list and now carries a new expandable control, so CI is the only place this can be proven. |

**The deploy preview's Lighthouse run reported Performance 21, down 75 from
production — and it is not attributable to this change.** Accessibility stayed
at 100. I checked rather than assuming: building `origin/main` in a separate
worktree and comparing chunk-for-chunk, the entry chunk (`index`, 247.05 kB) and
`LandingPage` (21.65 kB) are byte-identical to this branch's. The only chunk
that moved is `SeasonGameRouteBundle`, 60.07 kB → 66.91 kB raw (16.84 → 18.00 kB
gzipped), and it is lazily loaded on the season routes rather than on the path
Lighthouse audited. The drop is preview noise or a pre-existing regression on
`main`; either way it is worth someone looking at, and it is not this diff.

One real regression was caught and fixed during the run rather than shipped:
`SeasonGameRoutes.test.tsx` mocks each Supabase service module, and the new
static import made it construct the real client, which throws without
`VITE_SUPABASE_*`. The mock was added, and a route-level test now asserts that
the browser reaches contract 128's read at all — the precise thing that was
missing.

**CI: green in full.** Observed complete against commit `1148bf7`, and matching
the earlier run against the code commit `a88657b` up to the point that run was
superseded. Every check passed, with nothing skipped that should have run:

| Check | Result |
| --- | --- |
| `ci` — migration timestamps, documentation authorities, generated current-state, git-less hygiene, build, **compressed bundle budgets**, lint, domain-coverage thresholds, full Vitest, production dependency audit | **success** |
| `authenticated-browser` — full Browser E2E, including the axe accessibility sweep over the leagues route | **success** |
| `deploy-preview-smoke` | **success** |
| CodeQL — `javascript-typescript` and `actions` | **success** |
| Netlify header rules, redirect rules | **success** |
| Supabase Preview | skipped (no migration) |

The Browser E2E and bundle-budget results are the two this sandbox could not
produce, and both are the ones that most needed CI: the first exercises the new
expandable control against axe, and the second proves the season bundle's growth
stays inside budget.

## 5. Merge outcome

**Held for your review. Not merged, and auto-merge not enabled. CI is green —
the hold is a policy decision, not a red build.**

The stated policy holds a batch that touches "scoring or points,
ranking/leaderboards … or anything that could affect official tournament data".
This batch renders a ranking table, so it is held on the face of the rule even
though the mechanism is conservative: it adds no migration, changes no scoring,
lock, settlement or progression rule, adds no grant, and recomputes nothing in
the browser — every number, the ordering and the paging cursor come from the
server authority contract 128 already reviewed and merged.

If you would rather this class of change (a browser read of an
already-approved server ranking authority, with no rule of its own) merged
automatically in future, that is a one-line change to the standing instruction
and I will follow it.

## 6. What remains uncertain, and what I need from you

1. **Two open pull requests both claim contract 134** (#602 "own Euro
   publication state on the server" and #605 "`rate_limit_events` holds no
   browser privilege"). The repository has already been made unmergeable once by
   a duplicate claim. One of them needs renumbering, and that is an ownership
   call between those two sessions rather than mine to make.
2. **This sandbox still has no Docker daemon** — now recorded by three separate
   sessions. Every migration-shaped item left in the risk register (`DB-003`
   indexes, `DATA-007` atomic rate limiting, `SEC-001` invite-code entropy) is
   therefore unreachable by an unattended run here. Either point these runs at
   an environment with Docker, or accept that they will keep selecting
   application-layer batches. This is the single biggest constraint on what
   these nights can achieve.
3. **I edited no authority document.** `docs/quality/current-status.md` records
   contract-level truth and this batch claims no contract; #597 and #604 are
   both open documentation pull requests, and adding a third editor to those
   files tonight would have created a conflict for no benefit. If you want the
   Leagues surface's new state recorded there, say so and I will add one line in
   a follow-up rather than guessing at the right section.
4. **`e2e/seed-contract.ts` mentions contract 128's read but no E2E spec
   exercises the new surface.** A browser journey opening a league table on
   seeded development data would be the honest proof this change works
   end-to-end, and I could not write and run one here.

## 7. Recommended next batch

1. **A browser E2E journey for the season league table**, in an environment with
   Docker: open `/competitions/premier-league/2026-27/leagues` as a seeded
   member, expand a league, assert the seeded totals agree with the season
   standings for the same players, and assert the "Not entered" row for a member
   with no entry. That closes the one gap tonight's batch leaves.
2. **`get_rival_entry`'s browser half (contract 129) and the round-keyed
   consensus (contract 130)** — I did not verify these tonight, but they are the
   same shape as what I fixed: server reads added on 6–7 August whose callers
   may or may not exist. Fifteen minutes of grepping will tell you, and if a
   caller is missing it is the same low-risk, no-migration batch again.
3. **`SEC-001` / `DATA-007` together, in a Docker-capable session.** Six
   characters from `random()` over a 31-character alphabet, previewable with no
   rate limit because the limiter is a trigger on the *written* table, is the
   most serious repository-fixable finding still open. It needs one migration
   and pgTAP, and it needs an environment that can run them.

No production, Supabase or Netlify mutation was made or attempted in this
session. Production investigation was not required and was not performed.
