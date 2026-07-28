# CLAUDE.md — Euro 2028 Predictor

Convenience summary for coding-agent sessions. `AGENTS.md` and `docs/quality/current-status.md` are authoritative.

## Baseline

- React 19, TypeScript, Vite, Supabase and Netlify.
- Repository, development Supabase, production Supabase and all Netlify contexts are aligned at contract 55.
- Production Supabase and the published production application are aligned and locked at contract 55 (the Bonus Games B2–B7b milestone).
- Development Supabase: `iouzoutneyjpugbbtdem`.
- Production Supabase: `vkfnsqdyhvtwyqkisxhk`.
- Production deploy: `6a68e4f9ee76002a26ffbee6` from commit `af5aa15a151f5c4236ba3f2756faab4b357f31ee`; exact release identity, HTTP smoke and Chromium smoke passed.
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
- Keep pure response parsing/models separate from configured Supabase wrappers.
- Database rules are authoritative for locks, submission, results, progression, scoring and profile reveal/access boundaries.
- Original Predictor and bonus games remain separate.
- Predicted and real brackets never blend.
- Knockout UI consumes authoritative winner/result-method data.
- Profile/H2H headline totals and ranks come from bounded server reads; browser domain logic derives only comparison/accuracy views.
- Other-player profiles remain limited to authenticated league co-members; overall standings are not a global profile directory.

## Scoring

`docs/scoring-rules.md` is authoritative:

- group result 3; exact score 5 total;
- five Jokers, group-match points only;
- positions 2 each plus 5 full-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group goals 40 / 30 / 20;
- KO Predictor (separate score system, §8): exact 5 / result 3 / through +2;
- Last Man Standing (§8): tournament format — win to survive groups, advance in knockouts, one team once, wipeout voids.

## Current order

1. Expand Match Centre/tournament states, then account/privacy/contact-admin and post-lock trends (richer H2H is delivered at contract 48).
3. Build resilient mobile/loading/empty/retry/error/accessibility states alongside each feature.
4. Bonus Games platform, KO Predictor, Last Man Standing and the Cup through group-stage scoring (ADR-0010 B1–B7b) are built through contract 55; Cup knockouts (B7c) remain.

Admin result control, the full lifecycle simulation, authoritative knockout consumption, automatic valid-entry submission, paginated overall/private-league reads, operating-cap enforcement, Stage 3C2 evidence and secure co-member player profiles are complete or contained in PR #143.

## Hard boundaries

- No direct push to `main`.
- No unapproved production mutation, reset or repair.
- No direct-table fallback around protected RPCs.
- No Netlify/Supabase context crossing or guard bypass.
- No current-project modification of the legacy World Cup deployment.
- No scoring or rule change without authority and test updates.
- No hosted claim without evidence.
