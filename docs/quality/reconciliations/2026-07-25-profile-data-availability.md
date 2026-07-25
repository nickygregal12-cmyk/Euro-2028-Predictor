# Profile data-availability reconciliation

**Date:** 25 July 2026  
**Finding:** `UX-002`  
**Pull request:** #84  
**Scope:** Own-profile leaderboard, private-league and score-event reads

## Problem

The own Profile page independently requested the overall leaderboard, the user's private leagues and their score events, but converted every failure into an empty array. The resulting screen could therefore claim zero points, zero leagues or an empty points breakdown when a source was unavailable.

Those states were convincing but unsafe: a temporary service, session or permission failure could be mistaken for lost profile and scoring data.

## Implemented boundary

- leaderboard, private-league and score-event requests settle independently;
- unavailable leaderboard totals and rank remain `null` and render as unavailable rather than zero;
- unavailable league count remains `null` and renders as unavailable rather than `0 leagues`;
- unavailable score events do not render pending categories and a false total of zero;
- successful zero and empty responses keep their legitimate existing presentation;
- locally derived exact-score and accuracy statistics remain visible when remote sources fail;
- a safe warning explains that stored entry and scoring data are unaffected.

## Executable evidence

Focused source and presentational tests prove:

- healthy zero points, zero leagues and empty score events remain genuine values;
- a leaderboard rejection marks points and rank unavailable while preserving successful league and score-event data;
- a league rejection never renders `0 leagues`;
- a score-event rejection never renders an empty points breakdown or false total;
- all unavailable labels and the partial-data warning are visible without hiding the rest of the profile.

Final-head CI, Browser E2E and Netlify preview evidence are retained on PR #84 before promotion.

## Safety boundary

No migration, RLS policy, database privilege, scoring rule, stored prediction, production data, Supabase configuration, Netlify environment or deployment-contract value changed.

## Finding movement

`UX-002` remains **open but materially improved**. Home, the League hub and own Profile now distinguish unavailable sources from genuine zero or empty results. Remaining consumers still require review before closure.
