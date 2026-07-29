# CLAUDE.md — Euro 2028 Predictor

Convenience summary for coding-agent sessions. `AGENTS.md` and `docs/quality/current-status.md` are authoritative.

## Baseline

- React 19, TypeScript, Vite, Supabase and Netlify.
- Repository, development Supabase and production Supabase are aligned at contract 60.
- Development Supabase: `iouzoutneyjpugbbtdem`.
- Production Supabase: `vkfnsqdyhvtwyqkisxhk`.
- Contract 60 contains the complete Bonus Games programme, private Account controls, non-resurrecting clear-entry semantics and lint-safe Predictor Cup qualification/progression.
- The 55→60 production promotion passed encrypted backup/restore, exact dry-runs, preserved-data checks, privilege verification and hosted database lint.
- The production application is published only from the exact contract-60 release-alignment merge and must report contract 60 against the production Supabase project.
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

1. Build the post-lock consensus/trends surface and richer My-entry state from the stable contract-60 baseline.
2. Activate final league tie-breaker standings and explanation UI.
3. Complete remaining mobile, empty/error-state and manual accessibility work alongside each feature.
4. Perform the later official-data integration and full product dress rehearsal.

The Bonus Games programme, Match Centre resilience, Account/privacy/contact-admin controls, automated accessibility scanning and Matches tournament-information page are delivered and production-aligned.

## Hard boundaries

- No direct push to `main`.
- No unapproved production mutation, reset or repair.
- No direct-table fallback around protected RPCs.
- No Netlify/Supabase context crossing or guard bypass.
- No current-project modification of the legacy World Cup deployment.
- No scoring or rule change without authority and test updates.
- No hosted claim without evidence.
