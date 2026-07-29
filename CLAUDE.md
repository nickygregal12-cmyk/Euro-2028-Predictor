# CLAUDE.md — multi-competition prediction platform

Convenience summary for coding-agent sessions. [`AGENTS.md`](AGENTS.md) and [`docs/quality/current-status.md`](docs/quality/current-status.md) are authoritative.

## Project framing

- This is a multi-competition football prediction platform.
- Euro 2028 is the first completed competition baseline, preserved at `euro-2028-baseline`, and its remaining work returns in January 2028.
- Platform decisions are in [`docs/adr/README.md`](docs/adr/README.md); do not infer season rules from the tournament implementation.
- Forward work follows [`docs/roadmap.md`](docs/roadmap.md) and the detailed inventory in [`MASTER-TODO.md`](MASTER-TODO.md).
- Do not import rules or features from previous projects, old branches, prototypes or chats.

## Baseline

- React 19, TypeScript, Vite, Supabase and Netlify.
- The tagged Euro baseline is contract 63 at `1fb8ffd36ad113079181829a8bcc47175c43b6da`.
- Development Supabase: `iouzoutneyjpugbbtdem`.
- Production Supabase: `vkfnsqdyhvtwyqkisxhk`.
- The hosted contract/deploy statements above were last owner-verified on 29 July 2026; **REQUIRES OWNER VERIFICATION** via `docs/quality/current-status.md` before operational reliance.
- Normal work happens against development; production promotion is milestone-only.
- Stage A/B is active: authority/control alignment, then the pure context-engine foundation and separate behaviour-preserving surface migrations.

## Proportionate checks

- UI/copy/docs: CI and a targeted preview/UI check when relevant.
- Features/development schema: CI plus relevant Database parity or Browser E2E.
- Production schema/auth/scoring/destructive work: fresh recovery evidence where needed, preflight, explicit approval, full verification and dated evidence.

Ordinary development does not require production backup, production smoke or a new reconciliation document.

## Architecture

- Shared competition rules live under `src/domain/competition/` and follow ADR 0011.
- Tournament-only rules remain under `src/domain/tournament/`.
- Season-only rules belong under the future `src/domain/season/`.
- The shared domain may not import tournament/season implementations; tournament and season implementations may not import each other.
- Domain code is pure: no storage, network or ambient clock reads; time is an input.
- Components render domain results rather than inventing rules.
- Browser Supabase access goes through `src/services/supabase/`.
- Keep pure response parsing/models separate from configured Supabase wrappers.
- Database rules are authoritative for locks, submission, results, progression, scoring and profile reveal/access boundaries.
- Competition entries, scoring and standings remain separate under ADRs 0011 and 0015.
- Predicted and real brackets never blend.
- Knockout UI consumes authoritative winner/result-method data.
- Profile/H2H headline totals and ranks come from bounded server reads; browser domain logic derives only comparison/accuracy views.
- Other-player profiles remain limited to authenticated league co-members unless a later privacy authority changes that boundary.
- Feeds remain display-only; confirmation is the official scoring/progression gate.

## Scoring

[`docs/scoring-rules.md`](docs/scoring-rules.md) remains authoritative for the Euro 2028 tournament configuration. Preserve the existing values, but never treat them as universal platform defaults:

- group result 3; exact score 5 total;
- five Jokers, group-match points only;
- positions 2 each plus 5 full-order bonus;
- knockout 10 / 15 / 20 / 25 / 40, stacking;
- Golden Boot 25;
- group goals 40 / 30 / 20;
- KO Predictor: exact 5 / result 3 / through +2;
- Last Man Standing: the existing tournament format.

Season rules come from ADR 0012, ADR 0013 and their future dedicated scoring authorities. Do not merge tournament and season implementations because terminology overlaps.

## Current order

1. Land ADRs 0011–0018 and the reframed forward authorities.
2. Reconcile `docs/architecture-and-tournament-states.md` with the ADRs.
3. Make Database parity apply to all `src/domain/**`.
4. Land the pure competition-context foundation without wiring any surface.
5. Migrate `entryLock.ts`, `matchCentre.ts`, `matchesTab.ts` and `homeDashboard.ts` separately, each with behaviour-equivalence evidence.
6. Proceed to competition-season schema and ingestion only after the seam is proven.

The tournament baseline, Bonus Games programme, Match Centre resilience, Account/privacy/contact-admin controls, automated accessibility scanning and Matches tournament-information page remain delivered foundations, not assumptions that season behaviour already exists.

## Hard boundaries

- No direct push to `main`.
- No unapproved production mutation, reset or repair.
- No direct-table fallback around protected RPCs.
- No Netlify/Supabase context crossing or guard bypass.
- No current-project modification of the legacy World Cup deployment.
- No scoring or rule change without authority and test updates.
- No hosted claim without evidence.
- No combined cross-competition entry, score or standings path.
- No removal of a control document as cleanup; archive it.
