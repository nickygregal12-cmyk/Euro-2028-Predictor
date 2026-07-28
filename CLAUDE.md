# CLAUDE.md — Euro 2028 Predictor

Convenience summary for coding-agent sessions. `AGENTS.md` and `docs/quality/current-status.md` are authoritative.

## Baseline

- React 19, TypeScript, Vite, Supabase and Netlify.
- Repository, development Supabase and non-production Netlify are at contract 46.
- Production Supabase and the published production application are aligned and locked at contract 44.
- Development Supabase: `iouzoutneyjpugbbtdem`.
- Production Supabase: `vkfnsqdyhvtwyqkisxhk`.
- Production deploy: `6a686e30f2f13c07f10e30d8` from `515e794aa483a779c971e16a364fcbd243fa7ee6`.
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
- Profile/H2H headline totals come from bounded server reads; browser domain logic derives only comparison statistics that are not already authoritative.

## Scoring

`docs/scoring-rules.md` is authoritative:

- group result 3; exact score 5 total;
- five Jokers, group-match points only;
- positions 2 each plus 5 full-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group goals 40 / 30 / 20.

## Current order

1. Complete and merge PR #141 after exact-head CI, authenticated Browser E2E and preview smoke.
2. Start Stage 4 with other-player profile completion and the richer H2H layer.
3. Add rank-over-time and bracket health.
4. Expand Match Centre/tournament states, then account/privacy/contact-admin and post-lock trends.
5. Build resilient mobile/loading/empty/retry/error/accessibility states alongside each feature.
6. Add bonus competitions only after the Original Predictor lifecycle and scale stage are proven.

Admin result control, the full lifecycle simulation, authoritative knockout consumption, automatic valid-entry submission, paginated overall/private-league reads, operating-cap enforcement and both 250-entry/member evidence tranches are complete. PR #141 closes the remaining Stage 3C2 Profile/H2H surface pass.

## Hard boundaries

- No direct push to `main`.
- No unapproved production mutation, reset or repair.
- No direct-table fallback around protected RPCs.
- No Netlify/Supabase context crossing or guard bypass.
- No current-project modification of the legacy World Cup deployment.
- No scoring or rule change without authority and test updates.
- No hosted claim without evidence.
