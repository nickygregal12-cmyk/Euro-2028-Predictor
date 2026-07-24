# Bottom-navigation link semantics reconciliation

**Date:** 24 July 2026  
**Finding:** `A11Y-003` — bottom navigation is imperative rather than link-semantic

## Implemented

The fixed primary navigation now renders five React Router links rather than buttons with an imperative `navigate(...)` callback:

- Home → `/`;
- Predict → `/predict`;
- Matches → `/matches`;
- League → `/league`;
- More → `/more`.

The active destination retains `aria-current="page"`, and the existing focus treatment, touch target and visual active state remain unchanged.

The dev-only component gallery retains an optional click override so it can demonstrate tab states without leaving the gallery. The production `AppShell` does not pass that override and uses normal link behaviour.

## Regression protection

`tests/design-system/BottomNav.test.tsx` verifies:

- every primary destination is exposed with link semantics;
- each link has the expected href;
- the active Matches destination uses `aria-current="page"`;
- the Primary navigation landmark remains present;
- no button-role navigation items remain.

## Verification

Final implementation head `b0928dd2293133c12516ded2cec4eef1345aa7be` passed:

- `npm ci`;
- guarded environment/database-contract build;
- lint;
- the complete Vitest suite, including semantic navigation coverage;
- production dependency audit.

## Safety

No Supabase project, Auth configuration, database schema, migration history, production data, Netlify environment variable, deployment contract or legacy World Cup environment changed.
