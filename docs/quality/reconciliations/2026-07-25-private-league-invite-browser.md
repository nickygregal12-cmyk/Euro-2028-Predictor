# Private league invite browser reconciliation

**Date:** 25 July 2026  
**Finding:** `TEST-001`  
**Related finding:** `UX-001`  
**Scope:** Disposable local Supabase and authenticated browser evidence only

## Implemented journey

`e2e/private-league-invite.spec.ts` proves the primary signed-in private-league lifecycle through the real application and RPC boundaries:

1. the established E2E owner opens the League hub;
2. the owner creates a league through `CreateLeagueModal`;
3. the post-create share moment exposes a valid six-character invite code;
4. a separate Auth user and profile are created through the loopback-only test fixture;
5. that account signs in through the real login form;
6. `/join/:code` displays the correct league name, owner and pre-join member count;
7. `join_league` succeeds and routes to the league detail page;
8. the joining account sees both members;
9. the owner reloads and sees the invited member;
10. the extra league and Auth user are deleted before the disposable stack is destroyed.

## Safety controls

- the fixture uses `createLocalAdmin()`, which rejects any Supabase origin except local HTTP on port `54321`;
- the invited account uses a random local-only email and password;
- the product assertions are not retried or bypassed through service-role writes;
- service role is used only to prepare and clean the disposable fixture;
- the workflow rebuilds all 35 committed migrations and deletes the entire local stack afterward;
- no production or shared-development credentials, data, migrations or environment values are touched.

## Evidence

Initial implementation head `3b545e0ccbbfd86bbebfdeadde8456583a55fd23` passed:

- CI run 374;
- Browser E2E run 107, including the new two-account journey, signup/password recovery and disposable cleanup;
- a ready Netlify preview with Accessibility, Best Practices and SEO at 100.

Final-head evidence after documentation reconciliation is retained on PR #79.

## Finding movement

`TEST-001` remains partially resolved, but private league create/invite/join is no longer an untested browser gap. Remaining material gaps are:

- result administration after an approved admin model exists;
- manual screen-reader review for `A11Y-001`;
- authenticated smoke testing against a compatible production application/database pair.

`UX-001` remains open. This journey begins with an authenticated invitee and does not claim that signed-out users receive trustworthy invite context before generic signup. The existing render-time pending-join storage mutation is also outside this PR.
