# Contract 62 post-lock and final-standings reconciliation

**Date:** 29 July 2026  
**Scope:** PR #193 development batch  
**Production boundary:** unchanged at contract 60

## Outcome

The planned post-lock product batch has been rebuilt from current `main` rather than applying the stale `agent/post-lock-consensus` draft. The replacement uses fresh canonical migrations 61–62 and avoids the old timestamp collision with contract 60.

Development Supabase and Netlify non-production contexts are aligned at contract 62. Production Supabase and Netlify production remain aligned and locked at contract 60.

## Contract 61 — post-lock consensus

`20260729122100_prediction_consensus.sql` adds one bounded authenticated RPC:

- includes submitted Original Predictor entries only;
- remains hidden until the tournament lock;
- excludes all Bonus Games data;
- returns bounded champion, predicted-final, Golden Boot, agreement/division, trusted-team and goals-spread aggregates;
- returns at most six caller-only uniqueness cards;
- exposes no peer identity, raw entry or private league data;
- is executable by authenticated/service roles only, with an empty search path.

The application adds:

- a dedicated `/prediction-trends` route;
- pre-lock, loading, retry, empty and populated states;
- champion race, people's final, award picks, group-match signals, trusted team and goals distribution;
- caller-only “Only you called it” content;
- More navigation and automated axe coverage.

## Richer locked My Entry

After a submitted Original entry locks, `/predict` now becomes a post-lock My Entry view rather than leaving the editable journey as the primary surface. It includes:

- clear Submitted and Locked status;
- champion headline and preserved-pick summary;
- direct Trends and full-entry review actions;
- still-open per-match joker management;
- Profile/points and Overall standings shortcuts.

Pre-lock and unsubmitted users retain the existing predictor hub.

## Contract 62 — final standings

`20260729122200_final_standings_tiebreaks.sql` keeps live overall/private standings on total points. Only after every tournament fixture is confirmed or corrected does it apply:

1. exact group-stage scores;
2. correct group-stage outcomes;
3. correct knockout teams;
4. correct champion;
5. closest predicted group-stage goals total.

Players still equal after all five share the position. Cursor mode is bound to live/final state so a page token cannot cross the activation boundary.

The internal metrics helper is not executable by browser roles. Overall and private-league surfaces display the same final-standings explanation.

## Verification

The candidate passed before hosted development promotion:

- application build and lint;
- complete Vitest suite and dependency audit;
- clean 62-migration disposable rebuild;
- database lint;
- all pgTAP suites, including 14 consensus assertions and 15 final-standings assertions;
- TypeScript/PostgreSQL differential parity;
- all five tie-break levels, pagination and overall/private parity.

Development hosted verification then confirmed:

- exactly 62 canonical migration versions through `20260729122200`;
- authenticated-only public consensus/standings RPCs;
- no anonymous execution;
- empty function search paths;
- no browser execution of `predictor_internal.standing_metrics`;
- Netlify `dev`, `branch-deploy` and `deploy-preview` declare 62 and use development Supabase;
- exact contract-62 deploy-preview HTTP and Chromium smoke passes.

The final PR head also runs the full authenticated desktop/phone Browser E2E suite, signup/recovery, targeted Trends fixture and mobile-overflow proof.

## Safety and production state

No production database function, migration, data row, environment value or application deploy was changed.

Production remains:

- 60 migrations;
- latest version `20260729110000`;
- production Netlify contract 60;
- production Supabase isolated from every non-production context;
- Bonus Games registration closed.

Promotion of contracts 61–62 is a separate milestone requiring fresh preflight/recovery evidence, explicit owner approval and exact production release verification.

## Superseded work

Draft PR #176 and branch `agent/post-lock-consensus` are superseded by PR #193. Their design intent was reviewed, but their colliding migration was not applied.

## Next batch

Secondary resilience, invite trust and manual accessibility:

1. complete loading/empty/retry/unavailable states on comparison, transfer/search and invitation surfaces;
2. provide trustworthy pre-auth invite context without exposing private membership or predictions, with aggregate-disclosure abuse review;
3. document keyboard, screen-reader and contrast review across core desktop/phone journeys;
4. close defects with targeted Browser E2E and axe tests before official-data ingestion.
