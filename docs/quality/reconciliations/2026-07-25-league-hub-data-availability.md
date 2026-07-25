# League hub data-availability reconciliation

**Date:** 25 July 2026  
**Finding:** `UX-002`  
**Pull request:** #82  
**Scope:** League hub private-league read and rendering

## Problem

The League hub loaded overall standings and the user's private leagues independently, but converted every `fetchMyLeagues` failure into an empty array. That meant an unavailable service or permission failure displayed the successful empty-account message `No leagues yet` and invited the user to create a league.

This was a convincing false state: existing leagues could still be stored safely while the screen claimed none existed.

## Implemented boundary

- overall standings remain the hub's required source and retain their existing hard-error boundary;
- the private-league list now has explicit `loading`, `ready` and `unavailable` states;
- `No leagues yet` appears only after a successful empty response;
- a failed private-league read displays a safe in-flow warning while preserving the loaded standings summary and create/join actions;
- retry refreshes only the private-league source and does not refetch or hide the standings summary;
- the service-layer comment now states that callers must not convert unavailable league data into a successful empty account.

## Executable evidence

Focused page tests prove:

- a successful empty response renders the genuine empty state;
- a rejected league read renders an unavailable warning and never the empty state;
- available standings and league actions remain visible during a private-league failure;
- retry invokes only `fetchMyLeagues` and renders the recovered league row;
- an unavailable overall leaderboard retains the existing hard-error boundary.

Final-head CI, Browser E2E and Netlify preview evidence are retained on PR #82 before promotion.

## Safety boundary

No migration, RLS policy, database privilege, scoring rule, stored prediction, production data, Supabase configuration, Netlify environment or deployment-contract value changed.

## Finding movement

`UX-002` remains **open but materially improved**. Home and the League hub now distinguish unavailable data from genuine zero/empty states. Remaining screens and service consumers still require review before the finding can close.
