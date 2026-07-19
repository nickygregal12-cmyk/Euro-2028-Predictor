# Euro 2028 Predictor — Build To-Do List

No dates, no deadlines. Just tick things off in order. Each tier is fully usable on its own — don't feel pressure to rush to the next one.

**How to use this:** work top to bottom within a tier. Don't skip ahead to a later tier's item just because it's more fun — the domain logic tier is the one thing every later tier depends on, so get it right first.

---

## TIER 0 — Foundations (do this before any UI)

- [x] Confirm final scoring rules (write them down in plain English, one page, no code) — see `scoring-rules.md`
- [x] Confirm tie-break rules for leagues
- [x] Confirm tie-break rules for group tables
- [x] Set up GitHub repo
- [x] Set up Supabase project (dev) — client wired in `src/services/supabase/client.ts`; v0.1 schema + RLS in `supabase/migrations/`, fixture skeleton in `supabase/seed.sql` (run via dashboard SQL editor)
- [ ] Set up Netlify site linked to repo
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
- [ ] Netlify deploy + real-phone test with 3–4 friends through a full entry

## NEXT — Phase 2 prep: component pack + Home dashboard
- [ ] LeaderboardRow component (rank, movement, player, latest pts, total, you-highlight)
- [ ] PointsBreakdown component (renders score_events + total)
- [ ] PlayerChip component (avatar initials + name)
- [ ] StatCard component (big number + label)
- [ ] Home dashboard design session (phase-aware: pre / during / post tournament)

## Phase 2 — Original Predictor leagues (was v0.5)
- [ ] League create / invite link + code / join / leave
- [ ] League table page (incl. exact-score count, correct-result count, predicted champion, max remaining points)
- [ ] Max-remaining-points calculation in domain layer
- [ ] Reveal-after-lock RLS policy (designed once, reused by all later competitions)
- [ ] Player profiles (StatCards + PointsBreakdown + revealed predictions)
- [ ] H2H links from league rows
- [ ] Minimal admin result-entry page + correction flow
- [ ] Turnstile + rate limiting + CI running tests

## Phase 3 — Core tournament experience (was Tier 4)
- [ ] Match Centre; Matches joins nav as 5th tab
- [ ] Full profiles, H2H pages, rank history, bracket comparisons
- [ ] Live tables with Predicted/Live switcher + "You" column (designed)
- [ ] Phase-aware Home states (during/after)
- [ ] E2E tests, staging env, audit logs, accessibility pass, full rehearsal

## Phase 4 — Bonus Games platform (hub at More → Games; see docs/competition-structure.md)
## Phase 5 — KO Predictor
## Phase 6 — Last Man Standing
## Phase 7 — Fan Duels (staged per competition-structure doc)

## Parking lot (unchanged)
- Native apps, push notifications, chat/social feeds, avatar uploads, live-score API automation, additional scoring modes
