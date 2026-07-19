# CLAUDE.md — Euro 2028 Predictor

Project conventions for Claude Code sessions. Read this before making changes.

## What this project is

A mobile-first Euro 2028 football predictor web app. Users predict every group match, build a knockout bracket, pick a champion, and compete in private leagues. Free-tier hosting (Netlify + Supabase).

**Source-of-truth documents (in repo root):**
- `docs/scoring-rules.md` — the complete scoring and tie-break specification. All scoring logic implements exactly this. Never invent or change a rule without updating this doc first.
- `docs/tournament-structure.md` — tournament facts, fixture skeleton, third-place ranking rules, and the round-of-16 allocation table. Bracket/structure logic implements exactly this. Never invent or change a rule (especially the R16 allocation table) without updating this doc first.
- `docs/build-todo.md` — the tiered build plan. Work top-to-bottom within the current tier. Tick items off when done. New ideas go in the parking lot, not the current tier.
- `docs/competition-structure.md` — how the Original Predictor and bonus games relate (the separation law), navigation, private-league scope, bonus-game specs, and build order. Never blur competition boundaries without updating this doc first.
- `docs/auth-plan.md` — how development proceeds without auth screens (dev auto-login) and exactly what auth work lands when. Never change the dev-user or auth approach without updating this doc first.

## Stack

- React + TypeScript + Vite
- React Router (`react-router-dom`) for app routing
- Custom design system with CSS modules (no Tailwind)
- Supabase (Postgres, Auth, RLS) — dev project live; client in `src/services/supabase/client.ts` (only this folder may import it); v0.1 schema/RLS in `supabase/migrations/`, seed in `supabase/seed.sql`
- Vitest (+ React Testing Library) for tests; Playwright later
- Netlify hosting — not wired up yet

## Architecture rules (non-negotiable)

1. **Domain-first.** All tournament logic lives in `src/domain/tournament/` as pure functions: data in, data out. No React imports, no database access, no side effects. Follow the pattern in `calculateGroupTable.ts`.
2. **No business logic in components.** Pages and components call domain functions and render results. If a component is computing standings, scores, or bracket progression inline, that's wrong — extract it.
3. **Every domain function ships with unit tests in the same commit.** A domain function without tests is not done. Tests live in `tests/domain/`.
4. **The server is the authority on deadlines and locks.** Browser countdowns are cosmetic. Lock enforcement happens in Postgres functions / RLS, never client-side alone.
5. **Scoring must be deterministic and recalculable.** Given the same predictions and results, scoring always produces the same output, and the system can fully recalculate all points from source data. Corrections must never double-count.
6. **One source of truth for rules.** If code and `docs/scoring-rules.md` disagree, the doc wins — fix the code, or consciously update the doc first.
7. **Competitions are separate.** Original Predictor and bonus games are fully separate competitions — entries, predictions, and score events always carry their competition type; leagues belong to the Original Predictor only (`docs/competition-structure.md`).
8. **Dev user is invisible to the app.** No code outside the dev auto-login shim may special-case the dev user (`docs/auth-plan.md`).

## Folder structure

```
src/
  app/            # app shell, routing
  features/       # UI features (auth, predictor, groups, bracket, matches, leagues, scoring, admin)
  domain/
    tournament/   # pure domain functions ONLY
  services/
    supabase/     # Supabase client + query wrappers (nothing else talks to Supabase)
  styles/         # design system
tests/
  domain/         # unit tests mirroring src/domain/
```

## Git discipline

- Stage specific files — never `git add .`
- One logical change per commit (e.g. "add resolveGroupTies + tests"), not batches of unrelated work
- Run `npx vitest run` before committing; don't commit red tests
- Push to GitHub after each completed piece of work
- Never commit `.env` files (already gitignored)

## Current status

Tier 0 done bar Netlify (scaffold, Vitest, seed data, GitHub repo, Supabase dev project all set up).
Tier 1 domain logic **complete** — all functions done and tested: `calculateGroupTable()`, `resolveGroupTies()`, `rankThirdPlacedTeams()`, `resolveRoundOf16()` (R16 allocation table in `roundOf16Allocation.ts`), `advanceBracket()` (post-R16 feed-through in `knockoutBracket.ts`), `calculateScore()` and `calculateLeagueRank()` (point values in `scoringConfig.ts`). Full suite green (`npx vitest run`).

Tier 2 (v0.1) started: Supabase client wired (fail-closed on missing env). The initial migration (`supabase/migrations/20260719120000_init_v0_1.sql`) has been **applied** to the dev DB. Migrations are append-only — do not edit an applied migration; add a new timestamped file (e.g. the joker column lives in `20260719130000_add_match_prediction_joker.sql`; manual tie-resolutions live in `20260719140000_add_predicted_tie_resolutions.sql`). Still to run via the dashboard SQL editor: the joker follow-up migration, the tie-resolutions migration (`predicted_tie_resolutions`), and `supabase/seed.sql` (the fixture skeleton) if not already seeded. (The tie-resolutions load is best-effort, so the app still runs before that migration is applied — resolutions just won't persist.) Schema covers only the v0.1 tables (profiles, tournament reference data, entries, predictions) with RLS on every table; leagues/score_events/admin tables are deliberately deferred to later tiers.

Tier 2 UI — **design-system basics done**. Presentational primitives live in `src/design-system/` (CSS Modules, tokens only, dark + light, all states; public API via `index.ts`), previewable at `/dev/components` (`src/dev/ComponentsPreview.tsx`, path-routed in `App.tsx`). Shipped: tournament components (`TeamFlag` — now with a `champion` 38×25 size, `ScoreInput`, `JokerButton`, `JokerCounter`, `MatchCard`, `GroupTable`, `ThirdPlaceTable`, `TieResolver`) and core UI (`Button`, `TextInput`, `PageShell`+`BottomNav`, `Toast`, `Alert`, `Skeleton`, `EmptyState`, `Modal`+`ConfirmModal`, `ProgressBar`, `StatusBadge`). The bracket-specific components (`RoundSwitcher`, `TieCard`, `ChampionCard`) live in `src/features/bracket/` but are previewed alongside the rest in `/dev/components`. Semantic tints use `color-mix()` on tokens; a `--scrim` token backs modals. See `docs/design-system.md` §5.

Dev auto-login shim shipped (`docs/auth-plan.md` §1): `src/services/supabase/autoLoginPolicy.ts` (pure policy + fail-closed error, unit-tested) and `devAutoLogin.ts` (`initDevAuth()`, called from `src/main.tsx`). Env-gated on `import.meta.env.DEV` **and** `VITE_DEV_AUTOLOGIN=true`; fail-closed at both runtime and build time (`vite.config.ts`) so a production build with the flag on refuses to start. Dev user seeded via `supabase/dev-user.sql`; env vars in `.env.example`. These two files are the only code that may reference the dev user (rule 8).

v0.1 app skeleton assembled (design-system §6): React Router routes inside `PageShell` with the 4-tab nav (`src/app/` — `Providers`, `AppShell`; providers for theme/auth/tournament-data/predictions). Screens in `src/features/` — Home, Predict hub (live per-stage status), group predictor A–F (match cards + debounced Supabase autosave + live table via `resolveGroupTies`), League empty state, More (persisted theme toggle, how-scoring-works from `scoringConfig`, dev sign-out). All DB access stays behind `src/services/supabase/` query wrappers. Bracket/jokers/review screens are placeholders pending their own Phase 1 steps. Verified end-to-end against the dev Supabase (autosave persists).

Third-place stage **done**: manual tie-resolutions (scoring-rules §6 step 7, tournament-structure §6) are threaded through the pure domain as input — `resolveGroupTies()` and `rankThirdPlacedTeams()` take an optional `resolutions` arg (helper in `src/domain/tournament/tieResolutions.ts`), so a user-chosen order changes the third-place ranking and the R16 mapping while the functions stay pure. `src/features/predict/thirdPlacePipeline.ts` shapes predictions + resolutions into the ranked table and the list of pending ties (consumed by the third-place screen, the hub, Home and Review). `TieResolver` provides accessible up/down ordering. Resolutions persist to `predicted_tie_resolutions` behind the supabase service boundary; the load is best-effort (fail-soft to unresolved so Review stays honestly locked).

Knockout bracket stage **done** (`src/features/bracket/`): mobile one-round-at-a-time winner picking. Progression logic is domain-only — pure `src/domain/tournament/bracketPicks.ts` (unit-tested) holds the two representations and the moves: `winnersToProgression`/`winnersFromProgression` convert between the UI's winners map and the `predicted_progression` furthest-stage-per-team model (reconstruction walks the tree via `advanceBracket`), `applyBracketPick` sets a pick and returns which downstream picks cascade-clear, and `PARENT_OF` is derived from `KNOCKOUT_BRACKET` (never a fresh transcription). `buildBracketPipeline` shapes the R16 draw (`resolveRoundOf16`) + forward rounds into round views with provenance eyebrows, venue flags and dashed placeholders for undecided feeders. `BracketRound` wires `RoundSwitcher` + `TieCard` + `ChampionCard`, the cascade-confirm dialog (only when downstream picks exist; lists the rounds cleared; never silent, never blocked) and auto-advance (smooth-scroll to next unpicked tie, jump-cut under `prefers-reduced-motion`, then next round). Picks persist to `predicted_progression` (own-row RLS) via `PredictionsProvider` — a debounced autosave that diffs the desired map against what's stored (upsert changed teams, delete removed), best-effort load like tie-resolutions. The hub's "N of 15 winners picked" comes from the same pipeline (`hubStatus.ts`), and Review unlocks only at 15.

**Next up:** Tier 2 / Phase 1 — jokers overview screen, review & submit, server-enforced lock. Real auth screens per auth-plan Phase 1 exit. See `docs/build-todo.md`.

## Things NOT to do

- Don't add features from later tiers while the current tier is incomplete
- Don't install libraries beyond the stack above without discussion (especially no Tailwind, no state-management libs yet)
- Don't touch Supabase production data or keys once they exist (dev project only until explicitly told otherwise)
- Don't mark a to-do item complete unless code works, tests pass, and the doc is updated
- Don't put team names, fixtures, or scoring values as hardcoded literals inside logic — they come from seed data / config
