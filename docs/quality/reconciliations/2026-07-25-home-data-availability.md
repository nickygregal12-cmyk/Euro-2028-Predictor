# Home data-availability reconciliation

**Date:** 25 July 2026  
**Finding:** `UX-002`  
**Scope:** Home dashboard client state and rendering

## Problem

During-tournament Home reads were intentionally independent, but failed leaderboard, score-event and league requests were converted into successful-looking empty values:

- unavailable leaderboard data appeared as zero points and zero entries;
- unavailable score events appeared as zero points today;
- unavailable league data appeared as no leagues, inviting the user to create one;
- an unavailable last-seen snapshot was indistinguishable from no catch-up activity.

That could tell a convincing but false story while the user's saved predictions remained intact.

## Implemented boundary

- leaderboard, score-event, league and catch-up availability are tracked independently;
- unavailable numeric values are represented as `null`, never as zero;
- genuine loaded zeroes remain zero;
- Home displays an in-flow warning while retaining available fixtures and prediction content;
- the stat strip labels unavailable Points, Today, Rank and Leagues explicitly;
- the league snapshot distinguishes an unavailable read from a successful empty account;
- standing-share output is withheld when leaderboard totals are unavailable;
- `fetchLastSeenRead` preserves last-seen source availability while the existing fail-soft compatibility wrapper remains available to optional callers;
- pre-tournament Home behaviour is unchanged.

## Executable evidence

Focused tests prove:

- unavailable statistics do not become false zeroes;
- genuine zero and no-league states remain distinct;
- loaded ranks and league snapshots still render correctly;
- an unavailable league request cannot display the create-league prompt;
- partial Home data displays a warning without hiding available tournament content;
- the standing-share action is absent when its required totals are unavailable.

A temporary diagnostic workflow was used only to expose an initial dev-gallery type mismatch and focused-test setup failure. Both were repaired, the diagnostics were removed from the branch, and the resulting build plus eight focused tests passed before final CI.

Final-head CI, Browser E2E and preview evidence are retained on PR #81 before promotion.

## Safety boundary

No database migration, RLS policy, scoring rule, stored prediction, production data, Supabase configuration, Netlify environment or deployment-contract value changed.

## Finding movement

`UX-002` is **partially resolved for Home**. The Home dashboard now distinguishes unavailable, empty and zero states for its independent remote reads. The wider finding remains open until equivalent boundaries are verified across the remaining affected screens and services.
