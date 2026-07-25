# Golden Boot search availability reconciliation

**Date:** 25 July 2026  
**Finding:** `UX-002`  
**Scope:** Review-page Golden Boot player search

## Problem

The Review page converted every failed player search into an empty result. The Golden Boot picker then displayed the successful-empty explanation that squads were not yet confirmed, even when the actual cause was a network, permission or service failure.

That false state could mislead a user into believing no player data existed and gave them no retry path.

## Implemented boundary

- player search now retains explicit `idle`, `loading`, `ready` and `unavailable` states;
- only a successful empty response displays the squads-pending explanation;
- failed searches display safe, stable unavailable copy and a retry action;
- retry repeats the current query without changing Golden Boot scoring or persistence;
- superseded query requests cannot overwrite the current search state after cleanup;
- selecting or clearing a player retains the existing save path.

## Executable evidence

Focused hook and picker tests prove:

- a successful empty response remains a genuine empty state;
- rejected searches cannot masquerade as missing squads;
- internal database text is not exposed;
- retry recovers from unavailable state and renders returned players;
- loading, unavailable and successful-empty rendering remain distinct.

Final-head CI, Browser E2E and Netlify preview evidence are retained on the pull request before promotion.

## Safety boundary

No migration, schema, RLS policy, RPC, scoring value, Golden Boot save contract, stored prediction, production data, Supabase configuration, Netlify environment or deployment-contract value changed.

## Finding movement

`UX-002` remains **open but materially improved**. Home, League hub, own Profile, Match Centre league-scope discovery and Golden Boot search now distinguish unavailable sources from genuine zero or empty results. The provider-level optional entry slices and any other remaining consumers still require review before closure.
