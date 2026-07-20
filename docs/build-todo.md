# Euro 2028 Predictor — Build To-Do List

No dates, no deadlines. Just tick things off in order. Each tier is fully usable on its own — don't feel pressure to rush to the next one.

**How to use this:** work top to bottom within a tier. Don't skip ahead to a later tier's item just because it's more fun — the domain logic tier is the one thing every later tier depends on, so get it right first.

**Companion doc:** `roadmap.md` is the full-horizon map (every decision + the far phases, with detail); this file is the near-term, tick-as-you-go checklist. When they disagree, reconcile — they're meant to stay in sync.

---

## TIER 0 — Foundations (do this before any UI)

- [x] Confirm final scoring rules (write them down in plain English, one page, no code) — see `scoring-rules.md`
- [x] Confirm tie-break rules for leagues
- [x] Confirm tie-break rules for group tables
- [x] Set up GitHub repo
- [x] Set up Supabase project (dev) — client wired in `src/services/supabase/client.ts`; v0.1 schema + RLS in `supabase/migrations/`, fixture skeleton in `supabase/seed.sql` (run via dashboard SQL editor)
- [x] Set up Netlify site linked to repo — live at euro28predictor.netlify.app; env vars (Supabase URL + publishable key) set in Netlify; SPA redirect in `d1f6284`. **Points at the dev Supabase project for now** — the production-project split is a Phase 2 exit gate.
- [x] Scaffold Vite + React + TypeScript project
- [x] Set up folder structure (`app/`, `features/`, `domain/`, `services/`, `styles/`, `tests/`)
- [x] Set up Vitest, confirm a dummy test runs
- [x] Write the tournament data by hand (teams, groups, fixture skeleton, kickoff times) as seed data — placeholder version done, swap in real teams once qualifying is confirmed

---

## TIER 1 — Domain logic (build and test in isolation, no UI, no database)

This is the highest-risk part of the whole project. Get it fully correct and tested before writing a single screen.

- [x] `calculateGroupTable()` — played/won/drawn/lost/GF/GA/GD/points from a list of match scores
- [x] Unit tests: home win, away win, draw, exact score, goal difference sorting
- [x] `resolveGroupTies()` — deterministic tie-break order
- [x] Unit tests: 2-way tie, 3-way tie, fully tied group
- [x] `rankThirdPlacedTeams()` — ranks all 6 third-place teams, picks top 4
- [x] Unit tests: every valid third-place qualifying combination (this is the classic bug source — don't skip)
- [x] `resolveRoundOf16()` — maps group winners/runners-up/best-thirds into fixtures
- [x] Unit tests: at least one full valid tournament scenario end-to-end through this function
- [x] `advanceBracket()` — takes winner selections, produces next round
- [x] Unit tests: full run from R16 to champion
- [x] `calculateScore()` — pure function, takes prediction + result, returns points + explanation
- [x] Unit tests: every scoring rule (correct result, exact score, wrong result, group position points, knockout progression points)
- [x] `calculateLeagueRank()` — sorts entries by total points + tie-break order
- [x] Unit tests: tied totals resolved correctly

**Milestone check:** all domain functions pass tests using only hand-written fake data — no database, no UI involved yet.

---

## NOW — Phase 1: finish the v0.1 spine (was Tier 2)
- [x] Dev auto-login per docs/auth-plan.md (seeded dev user, env-gated, fail-closed in production builds) — shim in `src/services/supabase/{autoLoginPolicy,devAutoLogin}.ts`, runtime + build-time fail-closed guards, policy unit-tested, dev user seeded via `supabase/dev-user.sql`
- [x] App skeleton: 4-tab nav, Predict hub, group predictor screens wired to autosave (assembly prompt) — React Router in `PageShell`; Predict hub with live per-stage status; group predictor (A–F) with match cards + debounced Supabase autosave + live table; Home / League / More (persisted theme, how-scoring-works, dev sign-out). Third-place computed; bracket/review are placeholders pending their own steps.
- [x] Third-place screen (incl. tie-resolution prompt) — `buildThirdPlacePipeline` runs the domain (`resolveGroupTies` → `rankThirdPlacedTeams`) with/without the user's manual resolutions to rank the thirds and list every tie needing a call; `ThirdPlacePage` renders the `ThirdPlaceTable` plus a `TieResolver` per tie (up/down ordering, 44px, accessible). Resolutions persist to `predicted_tie_resolutions` (own-row RLS) and feed back into the pipeline, so a resolved order changes the third-place ranking and the R16 mapping (`resolveRoundOf16`); domain stays pure (resolutions are input). Hub shows "N tie(s) need your call" and Review stays locked while any tie is unresolved.
- [x] Bracket screens per spec (cascade confirm, auto-advance, vs divider, venue flags) — `src/features/bracket/`: `BracketRound` (one round at a time) with `RoundSwitcher`, `TieCard` (v divider, venue flags, dashed placeholders for undecided feeders), `ChampionCard` (accent, never gold). Progression logic is domain-only: pure `bracketPicks.ts` (`applyBracketPick` cascade, `winnersToProgression`, `winnersFromProgression` reconstruction via `advanceBracket`) + `resolveRoundOf16`, all unit-tested; `buildBracketPipeline` shapes the round views. Cascade-confirm fires only when downstream picks exist and lists the rounds cleared; auto-advance smooth-scrolls to the next unpicked tie (jump-cut under reduced-motion) then advances the round; picks persist to `predicted_progression` (own-row RLS) via debounced autosave that diffs desired vs stored. Hub shows "N of 15 winners picked" from the same pipeline and Review unlocks at 15. Every state in `/dev/components`.
- [x] Jokers overview screen + placement on cards — `JokersPage` (read-and-manage, not a second placement UI): header `JokerCounter` + one-line explainer; a `PlacedJokerCard` per placed joker (flags, teams, predicted score, matchday/date) in movable (gold "Joker on" tint pill + remove/move actions) or committed (gold "Committed · 2× locked in", no actions) state; "N still to place" affordance + empty-state CTA into Groups. Placement stays on the group match cards. Commitment boundary is a pure, unit-tested policy (`src/domain/tournament/jokerPolicy.ts`: `isJokerCommitted`, `canToggleJoker`) that mirrors the server rules; `PredictionsProvider.toggleJoker` now uses it (max-5 + kickoff-aware). Server is authoritative: migration `20260719150000_enforce_joker_rules.sql` adds a `match_predictions` trigger enforcing max-5-per-entry and the no-set/change-after-kickoff lock (independent of the score lock). Hub row counts placed jokers and ticks at 5. States in `/dev/components`.
- [~] Awards / bonus predictions screen (golden boot, total goals) — shipped as the Awards card on the Review page: golden-boot search picker (final UI, honest empty state until squads confirmed) storing a nullable player reference in `bonus_predictions`; group-stage total goals shown as a live derived sum of the 36 predicted scores (`domain/groupGoals.ts`), never stored. A standalone awards screen (if wanted) can reuse these pieces.
- [x] Review & submit (validity gating) — `ReviewPage`: checklist card mirroring the hub stages (tick/amber, "Fix ›" deep links) from the same `computeHubStatus` pipeline; your-tournament card (champion hero + predicted final line + "Full bracket ›"); awards card (golden-boot picker + derived group goals); submit flow (blocked names the blocker → accent Submit → confirm Modal → submitted banner "You're in. Editable until [deadline]" + Share stub). Submission goes through the server-side `submit_entry()` function (`20260719160000_add_bonus_and_submit.sql`) which validates completeness (all 36 group matches, full 15-winner bracket) before stamping `submitted_at` — the client never gates submission alone. Submission does not freeze the entry: edits keep autosaving and the entry stays submitted. Hub Review row unlocks at completion and shows the submitted state. Picker states in `/dev/components`.
- [x] Server-enforced lock at tournament kickoff — `20260719170000_lock_and_leaderboard.sql` adds `tournaments.lock_at` (the lock instant lives in tournament data, never a client clock; dev overrides that row) and BEFORE triggers that reject score, tie-resolution, progression and golden-boot writes once `now() >= lock_at`. Jokers are exempt — a joker-only change still passes (their own per-match kickoff-commitment lock applies). Pure `isEntryLocked` (`src/domain/tournament/entryLock.ts`, boundary-tested) mirrors it for the UI: group predictor shows locked `MatchCard`s (static chips, lock icon, per-match countdown; jokers still actionable), and the hub + Review reflect locked. Server is the authority; the UI only reflects.
- [x] Flat overall leaderboard (basic) — League tab v0.1: `get_leaderboard` security-definer function reads all submitted entries' display name + total without loosening profiles/entries RLS; `rankLeaderboard` (pure, tested) applies standard-competition ranking (shared ranks, alphabetical within ties) and returns null ranks pre-results. `LeaguePage` shows the Overall standings card (globe, "All players, everywhere", entry-count framing pre-results) + the full `LeaderboardRow` table, current user highlighted + scrolled into view. Totals are 0 until scoring lands. States in `/dev/components`.
- [x] Auth screens per auth-plan Phase 1 exit requirements — `src/features/auth/`: presentational `AuthScreen` shell + `LoginForm`/`SignUpForm` (own field state, error via `Alert`, no Supabase logic → previewed in `/dev/components`), wired by `LoginPage`/`SignUpPage`. Sign up creates the auth user + matching `profiles` row (`signUpWithPassword` → `createMyProfile`); log in / real log out; session restore with no logged-out flash via routing gates (`AuthLayout` → `RequireAuth`/`RedirectIfAuthed` in `src/app/Providers.tsx`) that show a neutral splash while the session resolves. Friendly errors (`friendlyAuthError`, never raw Supabase messages) + sign-up field validation (`validateSignUp`, mirrors server constraints) — both pure + unit-tested. Dev auto-login stays a startup-only path; fail-closed production build guard still holds. See docs/auth-plan.md §3.
- [x] Netlify deploy — site live at euro28predictor.netlify.app behind real auth; auth gating + a real sign-up verified on the deployed site. (Broader friends test is the single-tester friction test at the Phase 2 exit gate.)

## NEXT — Phase 2 prep: component pack + Home dashboard
- [x] LeaderboardRow component (rank, movement, player, latest pts, total, you-highlight) — shipped at v0.1; extended to reuse the shared `initialsOf` and take an optional champion-pick flag (dims when eliminated) for league rows. The full expandable league-detail row (latest-MD column, stat triple, Profile/H2H buttons, no-entry state) lands with the **League detail page** build, where its header grid + reveal rules are decided together.
- [x] PointsBreakdown component (renders score_events + total) — `src/features/scoring/PointsBreakdown.tsx`: collapsible category rows + subtotals, expandable events (flag + explanation + points), gold joker pills, "0 · pending" for unscored categories, pinned total that always equals the sum. Driven by the domain `score_events` shape (`src/domain/tournament/scoreEvents.ts` — type + pure `groupScoreEvents`/`scoreEventsFromBreakdown`, unit-tested); no `score_events` table yet (scoring tier). States in `/dev/components`.
- [x] PlayerChip component (avatar initials + name) — `src/design-system/PlayerChip.tsx`: astral-safe initials + truncating name, sm/md/lg, you state; exports the shared `initialsOf`. States in `/dev/components`.
- [x] StatCard component (big number + label) — `src/design-system/StatCard.tsx`: profile stat-grid tile, accent/movement/tappable variants. States in `/dev/components`.
- [x] Dev seed — fake mid-tournament (hostile-data rule) — `scripts/seed-dev/`: repeatable, **dev-only**, fail-closed (`seedPolicy.ts`, unit-tested, mirrors the auto-login guard) and idempotent seed of ~20 hostile-named test users with complete submitted entries (36 group scores, orders, full progression, ≤5 jokers) and ~12 results; scores computed through the real `calculateScore` pipeline. Dry-run by default (writes nothing); `--commit` writes to the dev DB. Run via `npx tsx scripts/seed-dev/index.ts` (no repo dependency added). See `scripts/seed-dev/README.md`.
- [x] Home dashboard design session (phase-aware: pre / during / post tournament) — captured in design-system §6 (Home dashboard); post-tournament layout stays a reserved slot (Phase 3).

## Phase 2 — Original Predictor leagues + social layer (was v0.5)
Detail for every item lives in `roadmap.md` § Phase 2.
- [x] Home dashboard build — full layered layout (stat strip, Today card, catch-up line, league snapshot); during-tournament layers activate as data exists. Phase-aware `src/features/home/`: pure `homeDashboard.ts` (phase / points-today / best-league / catch-up, tested) + `useHomeData` orchestration (during-data fetches each fail soft) + presentational StatStrip / TodayCard / CatchUpLine / LeagueSnapshot. During layers render once results exist; pre-tournament keeps completion/continue + submitted-banner/champion/invite. `/match/:matchRef` stub route added for Today's chevrons (full page Phase 3). Catch-up snapshot via `profiles.last_seen_at`/`last_seen_points` (`20260720150000_add_last_seen.sql`). Rank movement omitted with a TODO pending rank_history. States in `/dev/components`; verified live against the seed (during layout). **Migration to apply:** `20260720150000_add_last_seen.sql`.
- [x] League create / invite link + code / join / leave (create → immediate share sheet; leave via overflow menu + confirm; owners transfer or delete — no orphaned leagues) — `20260719180000_add_leagues.sql` (`leagues` + `league_members`, own-membership RLS, SECURITY DEFINER access/mutation functions; `leave_league()` refuses owners server-side, `transfer_ownership`/`delete_league` are the owner paths). UI in `src/features/leagues/`: League hub (overall summary card → `OverallStandingsPage`, My-leagues list, Create + Join), `CreateLeagueModal` → immediate `InvitePanel` share moment, `JoinLeagueModal` (code-entry + preview), `LeagueDetailPage` overflow menu (Leave/Delete/Transfer behind confirms). Services in `src/services/supabase/leagues.ts`. **Migration still to run in the dashboard** before it works end-to-end (fails soft until then).
- [x] Invite deep links survive logged-out — tap link → sign up → land back in the pending join — `/join/:code` (`JoinLandingPage`, outside the auth gate): signed out → stash code (`pendingJoin.ts`) → sign up → `RedirectIfAuthed` returns to `/join/:code`; signed in → league preview (`LeaguePreviewCard`) with Join/Decline. Invite links wrap the code (`inviteUrl`), one system.
- [x] League detail page (incl. exact-score count, correct-result count, predicted champion, max remaining points; member rows collapsed/expanded; entry-progress display pre-deadline; no-entry state) — finishes the expandable `LeaderboardRow` — `LeagueDetailPage` + `LeagueMemberRow` (collapsed grid → tap-to-expand Exact/Correct/Max-left triple + Profile/H2H stubs), champion flag + stats reveal-gated on `isEntryLocked`, no-entry rows dimmed with pre-deadline "N/36 predicted", current user highlighted + scrolled into view, standard-competition ranking via the shared `rankLeaderboard`. Exact/Correct/Max-left values are pending until scoring lands (shown as dashes). All states in `/dev/components` (hostile data, both themes).
- [x] Max-remaining-points calculation in domain layer — pure, unit-tested `src/domain/tournament/maxRemainingPoints.ts` (the "Max left" hope metric): the optimistic ceiling of points an entry can still earn given results so far, per scoring category, values from `scoringConfig`.
- [ ] Reveal-after-lock RLS policy (designed once, reused by all later competitions; champion flags hidden pre-lock; view-full-entry post-lock only)
- [~] Player profiles (StatCards + PointsBreakdown + revealed predictions; pre-lock hidden state; own profile via More tab) — **own profile shipped** (`src/features/profile/`): identity header (avatar, champion w/ tombstone, leagues), four-up stat grid (Points / Overall rank accent / Exact / Accuracy — pure tested `profileStats`), the reused `PointsBreakdown` card (component unchanged; `/more/points` not regressed), post-lock view-full-entry row. Reached via More → Profile (`/profile`); verified live against the seed (9 pts, 16th, 25%). Pure `profileVisibility` + presentational other-player/pre-lock-hidden states shipped in `/dev/components`. **Viewing OTHER players' profiles is deferred to the reveal-after-lock RLS** (next item) — no endpoint exposes another user's stats/predictions yet, so it can't be wired securely; league-row Profile buttons stay coming-soon stubs.
- [ ] H2H page build, pass 1 (designed) — face-off header, stat-vs-stat, where-you-split strip; post-lock only; H2H links from league rows
- [ ] `rank_history` schema — per-user per-matchday rank snapshots; capture MUST start from the first scored result (Phase 2/3 boundary; not retrofittable)
- [x] Scoring engine into the database — `20260720130000_add_scoring.sql`: `score_events` (canonical shape, own-entry read RLS, no client writes) + `entry_totals` VIEW (total === sum of events by construction) + `recompute_tournament_scores()` (delete-and-rederive per tournament from predictions + results + jokers — deterministic, idempotent, never double-counts) + a `matches` result trigger (synchronous recompute on score change). plpgsql (justified: atomic with the result write, no external infra); scores §1 group matches in SQL, defers §2/§3/§4 to a TS-domain invocation (they need derived actuals — rule 6 — and score 0 on current data, so §1-only == the full TS pipeline today). `get_leaderboard`/`get_league_members` read real totals. Reference/acceptance test: `tests/scripts/scoreEntries.test.ts` locks the seed's overall leaderboard.
- [x] Points breakdown live — driven by real `score_events` — "My points" view under More (`/more/points`) renders `PointsBreakdown` from the user's real `score_events` (`fetchMyScoreEvents`; RLS own-entry). Group predictor also shows the scored `MatchCard` state (result hero + points pill incl. joker variants) for resulted matches, points via the domain scorer. (The league detail stat-triple + leaderboard latest-column stay pending until per-matchday scoring data exists.)
- [ ] **Scoring engine completion** (Phase 2/3 boundary — blocks the Phase 3 dress rehearsal) — §2 group positions, §3 knockout progression, §4 awards must write `score_events` once derivable (group completion / KO results / awards decided); mechanism TBD (the TS pipeline invoked server-side, or SQL against stored derived actuals) — the seed dry-run pipeline remains the reference implementation and equality with it remains the acceptance test (`tests/scripts/scoreEntries.test.ts`).
- [x] Result entry documented for Phase 2 (`docs/ops-result-entry.md`) — enter / correct / clear a result via SQL, the automatic recompute trigger, manual backfill (`recompute_all_scores`), and verification queries, written from the live schema. Interim mechanism; correction is already safe (delete-and-rederive, no double-count). **The admin result-entry page is deferred to Phase 3** (below).
- [x] /welcome page (design session + build) — post-first-signin orientation, 3 steps, "Start with Group A →", seen-tracked (`welcomed_at` on profiles); shown once before Home. `src/features/welcome/` (presentational `WelcomeScreen` in `/dev/components` + `WelcomePage` + `RequireWelcome` gate); pure `welcomeGating.ts` (tested); marked seen on ENTRY (exactly-once regardless of exit path); dev + seed users pre-stamped so the dev auto-login user never sees it (gate stays generic — no rule-8 violation). **Migration to apply:** `20260720160000_add_profile_welcomed_at.sql`.
- [ ] Auto-submit at lock — server auto-submits any VALID never-submitted entry at the lock instant (scoring-rules §7); incomplete entries stay out of standings; auto-submitted marked internally
- [ ] Deadline reminder emails — "entries lock in 48h/24h, you're N% done" to incomplete entries (needs custom SMTP, pulled forward)
- [ ] Destructive-action polish (design-system §7) — sign-out confirm modal + joker-removal undo-toast (kickoff-aware copy)
- [ ] Tie-breaks at final standings — show the tie-break explanation prominently when final league standings are computed
- [ ] Bracket un-pick — add a clear/unpick action (only "change" exists today; parked from the review build)
- [x] Admin bootstrapping documented — the one-time SQL granting the first admin role, written into a repo ops note (`docs/ops-admin-bootstrap.md`; self-flags to verify the role column/value against the live schema before first use)
- [ ] Auth hardening (one combined build) — confirmation-aware sign-up + server-side profile creation via `auth.users` trigger (remove client `createMyProfile`; **confirmed live 2026-07-20** — confirmation half-created the user then failed the client insert under RLS); `friendlyAuthError` distinguish the no-session case; password reset flow (Supabase `resetPasswordForEmail`, "if an account exists" copy); custom SMTP for auth emails; Turnstile on sign up / log in; rate limiting (auth, prediction save, league join); display-name moderation; decide on email verification
- [ ] CI — GitHub Actions running the test suite on every push

### Phase 2 exit gates
- [ ] Separate production Supabase project — fresh migrations + real data; dev project keeps the test mess; Netlify env vars switch to prod
- [ ] Single-tester scripted entry-flow friction test (one trusted person, defined script; findings triaged before Phase 3) — a friction check, not a launch. **Script written: `docs/test-script.md`**; the run + triage are the remaining gate.

## Phase 3 — Core tournament experience (was Tier 4)
Detail in `roadmap.md` § Phase 3.
- [ ] Admin result-entry page (moved from Phase 2; **must exist before the dress rehearsal**) — protected route, scoring-impact preview before confirm, correction flow. Deferred to build once against the final feature set (incl. what bonus games need from results); correction is already safe via delete-and-rederive, and Phase 2 uses `docs/ops-result-entry.md` (SQL entry) meanwhile.
- [ ] Match Centre — **designed** (design-system §6, per-fixture page); Matches joins nav as 5th tab (Matches tab also specced, §6); league-scoped views by deep link. Enable the MatchCard chevron/navigation flag (`FEATURES.matchCardNavigation`) when this ships.
- [ ] Live match strip (League tab + league detail; cyan, pulsing dot, league-context line)
- [ ] Live tables with Predicted/Live switcher + "You" column (designed)
- [ ] H2H pass 2 — rank-over-time graph + bracket-health-vs-real + compare-full-brackets side by side
- [ ] Full profiles extensions — rank history (from `rank_history`), bracket comparisons
- [ ] Phase-aware Home states (during/after) live
- [ ] Shareable cards build (Phase 3-adjacent) — the self-contained image-generation capability specced in design-system §6 (Shareable cards): one 1080×1080 dark-navy renderer, three content states (quick tease / full bracket / during-tournament brag) + league-context variant; the Share stubs on Review + Home (and league contexts) route here. Supersedes the older "Shareable entry summary" line below.
- [ ] Shareable entry summary (feeds the Share stubs on Review + Home) — now specced as **Shareable cards** (design-system §6); tracked by the item above
- [ ] Landing page — public front door (3-step explainer, demo before account); before any public sharing
- [ ] Independent-app disclaimer + privacy notice / terms in footer
- [ ] Error monitoring (Sentry free tier) — wired before the dress rehearsal
- [ ] Analytics — Plausible (free tier) at Phase 3; privacy-friendly, no cookie banner required
- [ ] Account deletion + data export (right to erasure; policy for league memberships + leaderboard rows). **FK semantics already set** (`20260720120000_league_fk_semantics.sql`): `league_members.user_id` CASCADE (memberships vanish), but `leagues.owner_id` RESTRICT — so the deletion flow MUST first transfer each owned league to a remaining member (or delete it if they're the last one) before the account can be removed; the DB blocks a silent cascade that would orphan/destroy other members' leagues.
- [ ] E2E tests (Playwright), staging env, audit logs, accessibility pass
- [ ] Full dress rehearsal — simulate the whole competition with friends playing along; launch-blocking

## Standing data/ops items (no phase — do when triggered)
- [ ] Real teams into seed data once qualifying completes (Dec 2026 draw onward); host slots per roadmap
- [ ] Verify tournament-structure doc against final UEFA 2028 regulations (esp. the 15-combination third-place table)
- [ ] Players table population once squads confirmed (golden-boot search goes live; UI already final)
- [ ] Per-matchday kickoff times after the 2027 schedule announcement
- [ ] Free-tier ceilings check before real users; custom domain (optional); backup/export process before the tournament

## Phase 4 — Bonus Games platform (hub at More → Games; see docs/competition-structure.md)
## Phase 5 — KO Predictor
## Phase 6 — Last Man Standing
## Phase 7 — Fan Duels (staged per competition-structure doc)

## Parking lot (unchanged)
- Native apps, push notifications, chat/social feeds, avatar uploads, live-score API automation, additional scoring modes
