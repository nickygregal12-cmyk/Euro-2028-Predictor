# Nightly run — 10 August 2026

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
