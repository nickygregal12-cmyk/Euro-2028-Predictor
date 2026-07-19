# Euro 2028 Predictor — Build To-Do List

No dates, no deadlines. Just tick things off in order. Each tier is fully usable on its own — don't feel pressure to rush to the next one.

**How to use this:** work top to bottom within a tier. Don't skip ahead to a later tier's item just because it's more fun — the domain logic tier is the one thing every later tier depends on, so get it right first.

---

## TIER 0 — Foundations (do this before any UI)

- [x] Confirm final scoring rules (write them down in plain English, one page, no code) — see `euro2028-scoring-rules.md`
- [x] Confirm tie-break rules for leagues
- [x] Confirm tie-break rules for group tables
- [ ] Set up GitHub repo
- [ ] Set up Supabase project (dev)
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
- [ ] `resolveGroupTies()` — deterministic tie-break order
- [ ] Unit tests: 2-way tie, 3-way tie, fully tied group
- [ ] `rankThirdPlacedTeams()` — ranks all 6 third-place teams, picks top 4
- [ ] Unit tests: every valid third-place qualifying combination (this is the classic bug source — don't skip)
- [ ] `resolveRoundOf16()` — maps group winners/runners-up/best-thirds into fixtures
- [ ] Unit tests: at least one full valid tournament scenario end-to-end through this function
- [ ] `advanceBracket()` — takes winner selections, produces next round
- [ ] Unit tests: full run from R16 to champion
- [ ] `calculateScore()` — pure function, takes prediction + result, returns points + explanation
- [ ] Unit tests: every scoring rule (correct result, exact score, wrong result, group position points, knockout progression points)
- [ ] `calculateLeagueRank()` — sorts entries by total points + tie-break order
- [ ] Unit tests: tied totals resolved correctly

**Milestone check:** all domain functions pass tests using only hand-written fake data — no database, no UI involved yet.

---

## TIER 2 — v0.1: "I can actually use this for the tournament"

- [ ] Design system basics: button, score input, match card, table, page layout (5–6 components, nothing fancy)
- [ ] Auth: sign up / log in (Supabase Auth, magic link or email+password)
- [ ] Group prediction screens (one per group, score inputs, autosave)
- [ ] Wire autosave to Supabase (predictions table)
- [ ] Group tables render live from predictions (using Tier 1 function)
- [ ] Best third-place ranking screen (using Tier 1 function)
- [ ] Round-of-16 screen, auto-generated from group results
- [ ] Knockout bracket — winner-only selection, mobile = one round at a time
- [ ] Review screen — blocks submission if anything's incomplete
- [ ] Server-side lock check at tournament kickoff (timestamp comparison, not trust-the-browser)
- [ ] One flat leaderboard — everyone in a single pool
- [ ] Manual result entry via Supabase Studio directly (no admin UI yet)
- [ ] Scoring calculation wired up as a Postgres function calling into the logic from Tier 1
- [ ] Mobile responsive pass — test on an actual phone, not just DevTools
- [ ] Deploy to Netlify, confirm it works end-to-end on a real device

**Milestone check:** you and a few friends can create an account, complete a full prediction, and see a working leaderboard once you manually enter results.

---

## TIER 3 — v0.5: "Ready to share more widely"

- [ ] Private leagues: create league, generate invite code
- [ ] Join league via code
- [ ] League-scoped leaderboard
- [ ] Leave league
- [ ] Minimal admin page: protected route, result entry with a scoring-impact preview before confirming
- [ ] Result correction flow — test that re-entering a corrected result doesn't double-count points
- [ ] Score explanations — store individual score events, show a simple breakdown to the user
- [ ] Basic player profile: total points, accuracy %, rank
- [ ] Add Cloudflare Turnstile to sign up / log in
- [ ] Basic rate limiting on prediction save and league join
- [ ] Tie-resolution prompt for genuinely ambiguous group ties (replace the silent default from Tier 2)
- [ ] Set up GitHub Actions to run unit tests on every push

**Milestone check:** multiple friend groups can run their own private leagues, and a wrong result can be corrected safely.

---

## TIER 4 — v1.0: full original spec

- [ ] Match centre pages — before/during/after states for every fixture
- [ ] Bonus predictions (golden boot, total goals band, etc.)
- [ ] Tournament-phase-aware home screen (before / during / after tournament views)
- [ ] Full design system component inventory (modal, drawer, toast, tooltip, skeleton, empty states, locked states)
- [ ] Integration tests: signup, save, resume, submit, lock enforcement, league join
- [ ] Playwright E2E: new user full entry, returning user resume, league join, deadline passing, result entry, corrected result
- [ ] Separate staging environment (own Supabase project, own Netlify site)
- [ ] Admin audit log
- [ ] Maintenance mode
- [ ] Accessibility pass: keyboard nav, focus states, contrast, screen reader labels
- [ ] Full simulated tournament rehearsal — run one complete tournament start to finish with test data
- [ ] Independent-app disclaimer added to footer
- [ ] Privacy notice / terms page

**Milestone check:** matches the original full spec's "minimum viable launch" definition.

---

## Not doing yet (parking lot — revisit only after Tier 4)

- Live knockout predictor mode (separate from original bracket)
- Native mobile apps
- Push notifications
- Real-time chat / social feed
- Avatar uploads
- Automated live-score API integration
- Additional scoring modes
- Public user-created (non-private) competitions

---

## Keeping this list alive

- Tick items off as you go — don't batch it up, do it the moment something's done.
- If you find yourself skipping an item because it's boring (admin UI, tests), move it to a visible "skipped for now" note rather than deleting it — you'll want the reminder.
- If a new idea comes up mid-build, put it straight in the parking lot rather than the current tier, unless it blocks something you're actively doing.
