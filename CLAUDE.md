# CLAUDE.md — Euro 2028 Predictor

Convenience summary for coding-agent sessions. `AGENTS.md` and `docs/quality/current-status.md` are authoritative.

## Baseline

- React 19, TypeScript, Vite, Supabase and Netlify.
- Repository, development and production are aligned at contract 38.
- Development Supabase: `iouzoutneyjpugbbtdem`.
- Production Supabase: `vkfnsqdyhvtwyqkisxhk`.
- Production milestone deploy `6a67560deb88202a74108c37` is verified and locked.
- Normal work happens against development; production promotion is milestone-only.

Do not import rules or features from previous projects, old branches, prototypes or chats.

## Proportionate checks

- UI/copy/docs: CI and a targeted preview/UI check when relevant.
- Features/development schema: CI plus relevant Database parity or Browser E2E.
- Production schema/auth/scoring/destructive work: fresh recovery evidence where needed, preflight, explicit approval, full verification and dated evidence.

Ordinary development does not require production backup, production smoke or a new reconciliation document.

## Architecture

- Tournament rules live under `src/domain/tournament/`.
- Components render domain results rather than inventing rules.
- Browser Supabase access goes through `src/services/supabase/`.
- Database rules are authoritative for locks, submission, results, progression and scoring.
- Original Predictor and bonus games remain separate.
- Predicted and real brackets never blend.
- Knockout UI consumes authoritative winner/result-method data.

## Scoring

`docs/scoring-rules.md` is authoritative:

- group result 3; exact score 5 total;
- five Jokers, group-match points only;
- positions 2 each plus 5 full-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group goals 40 / 30 / 20.

## Current order

1. Complete administrator result mutation forms, confirmation review and E2E.
2. Run the first complete pre-tournament → live → correction → scoring → finish simulation.
3. Repair authoritative knockout-result consumption.
4. Add automatic valid-entry submission.
5. Continue core experience, accessibility and operational readiness.
6. Add bonus competitions only after the Original Predictor lifecycle is proven.

## Hard boundaries

- No direct push to `main`.
- No unapproved production mutation, reset or repair.
- No direct-table fallback around protected RPCs.
- No Netlify/Supabase context crossing or guard bypass.
- No current-project modification of the legacy World Cup deployment.
- No scoring or rule change without authority and test updates.
- No hosted claim without evidence.
