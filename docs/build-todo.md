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
- [ ] Jokers overview screen + placement on cards
- [ ] Awards / bonus predictions screen (golden boot, total goals)
- [ ] Review & submit (validity gating)
- [ ] Server-enforced lock at tournament kickoff
- [ ] Flat overall leaderboard (basic)
- [ ] Auth screens per auth-plan Phase 1 exit requirements
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
