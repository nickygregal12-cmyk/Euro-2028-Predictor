# Profile data-availability reconciliation

**Date:** 25 July 2026  
**Finding:** `UX-002`  
**Scope:** Own-profile remote data state and rendering

## Problem

The Profile page loaded leaderboard totals, league membership and score-event history independently, but converted every failed request into an empty array. A temporary network or service failure could therefore present a convincing false state:

- unavailable leaderboard data appeared as zero points and no overall rank;
- unavailable league data appeared as membership in zero leagues;
- unavailable score-event data rendered a complete-looking points breakdown with every category at zero or pending.

Locally derived exact-score and accuracy figures remained available from loaded tournament results and the user's persisted predictions, but the page gave no indication that the remote sections had failed.

## Implemented boundary

- leaderboard, league-list and score-event reads retain independent availability;
- unavailable leaderboard values use `null` and explicit labels rather than false zeroes;
- a successful empty league list remains `0 leagues`, while a failed read becomes `Leagues unavailable`;
- an unavailable score-event read replaces the false empty breakdown with an explicit warning;
- locally derived exact-score and accuracy statistics remain visible;
- the page shows an in-flow warning while preserving all available profile content;
- existing healthy, new-user and reveal-gated profile behavior remains unchanged.

## Executable evidence

Focused tests prove:

- leaderboard rejection marks points and rank unavailable while preserving local accuracy, league count and score-event history;
- a fulfilled empty league list remains a genuine zero-league state;
- league-list rejection cannot masquerade as zero leagues and does not hide successful points/history data;
- score-event rejection cannot render a false zero/pending breakdown;
- the presentational Profile screen labels every unavailable section explicitly while retaining local exact-score and accuracy figures.

Final CI, Browser E2E and deploy-preview evidence are retained on the pull request before promotion.

## Safety boundary

No database migration, RLS policy, RPC, scoring rule, stored prediction, production data, Supabase configuration, Netlify environment or deployment-contract value changed.

## Finding movement

`UX-002` is **partially resolved for Home, the League hub and own Profile**. Equivalent unavailable/error/empty distinctions still require review across the remaining affected screens and services, so the finding remains open.
