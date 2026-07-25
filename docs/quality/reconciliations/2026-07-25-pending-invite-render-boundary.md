# Pending invite render-boundary reconciliation

**Date:** 25 July 2026  
**Finding:** `UX-001`  
**Related finding:** `TEST-001`  
**Scope:** Client navigation/storage boundary and disposable browser evidence

## Problem

`JoinLandingPage` persisted the pending league invite by calling `localStorage.setItem` through `setPendingJoin()` during render. Although the helper failed soft when storage was unavailable, render-time mutation was not a valid React boundary and could run more than once under replayed rendering.

Email-confirmation links also land a first-time account on `/welcome`. A pending invite therefore needed an explicit continuation after the one-time welcome screen rather than assuming the auth-route redirect would always run first.

## Implemented boundary

- signed-out `/join/:code` persistence now runs in an effect after React commits;
- the route holds the neutral Auth splash until the exact current invite code has been stored;
- exact-code tracking prevents an in-place route-param change from redirecting with an older pending invite;
- authenticated invite loading and pending-code consumption remain in the existing effect;
- the one-time Welcome screen detects a pending invite captured on arrival;
- its primary CTA becomes `Continue to league invite →` and resumes `/join/:code`;
- ordinary first-use accounts retain `Start with Group A →`;
- users who already completed Welcome are still redirected Home rather than replaying the screen.

## Executable evidence

Focused tests prove:

- a signed-out invite is stored before the signup redirect commits;
- an authenticated invite is consumed and its preview loads;
- Welcome resumes a pending invite;
- Welcome keeps Group A as the default path;
- an already-welcomed account does not replay an invite through `/welcome`.

The disposable Auth browser lifecycle now proves:

1. a signed-out visitor enters through `/join/AUTH28`;
2. the app persists the code and redirects to signup;
3. signup confirmation lands on the required one-time Welcome screen;
4. Welcome offers and follows the invite continuation;
5. the authenticated league preview loads;
6. the account joins the league and reaches its real detail route;
7. Welcome persistence, normal login, password recovery and cleanup continue to pass.

Implementation head `e0010def1d794eefa26b926f23349beaad2cf7e3` passed CI run 384 and Browser E2E run 116, including complete disposable migration rebuild and local-data deletion.

## Safety boundary

No migration, RLS policy, function privilege, scoring rule, production data, Netlify environment or deployment-contract value changed. Test fixtures remain guarded to loopback Supabase and are removed with the disposable stack.

## Finding movement

`UX-001` is **partially improved**:

- the render-time storage mutation is resolved;
- signed-out deep-link persistence through confirmation and Welcome is browser-proven;
- trustworthy league context is still not shown before generic signup.

Complete closure requires a separate privacy/abuse decision on what league metadata may be disclosed anonymously, followed by an approved pre-auth preview design and executable tests. No anonymous database privilege was added by this change.
