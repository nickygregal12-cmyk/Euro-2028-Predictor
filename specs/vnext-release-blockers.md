# vNext first-release blocker closure

## Problem and outcome

Real Football Hub use has exposed shipping-vNext failures that existing browser coverage did not catch: inert Home navigation, shell traps outside competition-scoped routes, an unrecognisable account fallback, weak Matches row composition, missing secondary standings context, unclear competition switching, and unreliable private-play creation corridors.

This batch closes those release blockers at the shared seams and adds application-level browser evidence that behaves like a player rather than proving isolated Storybook worlds or direct route arrival.

## Governing authorities

- [`AGENTS.md`](../AGENTS.md)
- [`docs/product/ui.md`](../docs/product/ui.md)
- [`docs/product/vnext-shell-ia.md`](../docs/product/vnext-shell-ia.md)
- [`docs/product/vnext-matches.md`](../docs/product/vnext-matches.md)
- [`docs/product/vnext-leagues.md`](../docs/product/vnext-leagues.md)
- [`src/vnext/AGENTS.md`](../src/vnext/AGENTS.md)
- existing application route helpers, player-competition authority, standings reads, private-play presentation/write authorities and RPCs

Repository code, executable tests and those authorities outrank this specification if they disagree.

## In scope

1. Repair Home `Find a league` through an explicit presentation intent and the existing application route seam.
2. Make shell destination navigation from Account, Explore/Discovery, About, player profile, Wrapped, create-private-play and game-specific routes preserve or resolve the player's relevant competition context without inventing one.
3. Replace the account-control dot artefact with deliberate loading/missing-name fallbacks and retain recognisable account affordance across mobile and desktop.
4. Improve Matches team-row composition for phone and desktop while preserving state meaning, tap targets and full club-name readability.
5. Add an optional current-competition league table to Matches using the existing standings authority, with phone disclosure and desktop secondary-column treatment where appropriate.
6. Turn the prominent competition identity into the existing shell-owned switcher entry: identity-only for one competition, bounded chooser for a small set, scalable Jump/search behaviour for many.
7. Repair ordinary Match Predictor private-league creation and Last Man Standing creation through their real shipping-vNext entry points, authoritative writes and rereads.
8. Add a coherent pointer-hover vocabulary using existing tokens/motion and `hover: hover` + `pointer: fine` where appropriate.
9. Add shipping-vNext application browser journeys, inert-control detection, pointer assertions, real-app screenshots and console/network cleanliness checks.
10. Treat genuine additional defects found while traversing ordinary Football Hub seams as part of this batch when they are reproducible and within the same UI/application boundary.

## Explicitly out of scope

- scoring, locks, settlement, reveal, progression or membership-rule changes;
- new database authority, schema migration or Production mutation;
- paid provider calls;
- a second competition-selection, standings or private-play authority;
- broad legacy redesign;
- weakening route flags or rollback behaviour.

## Acceptance scenarios

### Navigation and shell

- From shipping-vNext Home, pressing the visible `Find a league` control reaches the usable Leagues/private-play journey; Enter/Space works and browser Back returns sensibly.
- From Account and Discovery, Home, Matches, Games and Leagues all work through the shared shell seam.
- The same seam remains usable from About, profile, Wrapped, create-private-play and game-specific routes wherever the common shell is present.
- Outside a competition, the shell resolves ordinary landing navigation from the existing player-competition authority. It never fabricates a competition.
- Switching competition A to B lands on B Home and subsequent primary destinations stay in B.

### Account affordance

- A named player, loading profile, missing optional avatar, missing display name and longest supported display name all retain a recognisable account control on phone and desktop.
- No loading or fallback state renders a lone dot/one-character artefact.

### Matches

- Real application screenshots at 360, 390, 430, 768, 1024, 1440 and 1920 show a legible football-scoreboard hierarchy across scheduled/live/completed/postponed fixtures and long/short club names.
- Optional standings context is secondary to fixtures, uses authoritative data, handles absent/loading/failed/stale/not-started states without fake zeros, and is measured for request/performance impact.

### Private play

- Shipping-vNext Match Predictor private-league creation completes create → invite/share → open → hard reload → second-user join → reopen using disposable local Supabase and authoritative rereads.
- Shipping-vNext LMS creation completes configure → create → invite → open → reload → second-user join → first valid pick reachability, including refusal/loading/double-submit/network-failure cases.

### Browser evidence

- A dedicated shipping-vNext journey suite runs against the real router, seeded local Supabase and authenticated identities on desktop Chromium and Pixel-7-class mobile Chromium using the shipping route flags.
- Navigation assertions start from the preceding UI and press the visible control rather than `goto()`-ing the destination under test.
- The suite covers the user-found regression matrix, representative hover state changes, important-control observable effects, unexpected console errors, unhandled rejections, failed first-party requests, 404 assets/chunks and hidden Supabase RPC failures.
- Real-application screenshots are retained for the canonical release pages at 390, 768 and 1440, with wider/narrower coverage for materially changed surfaces.

## Implementation plan

1. Shared seam first: add failing route/intent tests for outside-competition navigation and Home CTA; fix the shell/app routing boundary; fix the account fallback.
2. Matches: add browser geometry/visual cases, adjust row composition, wire existing standings read as secondary context and add toggle states.
3. Competition switcher and hover vocabulary at shell/shared-primitive level.
4. Private-play creation: reproduce against shipping-vNext, add authoritative browser lifecycles, then fix application/adapters without route-specific write hacks.
5. Add the shipping-vNext journey/crawl/cleanliness/screenshot suite and include the executable user-found matrix.
6. Run focused tests first, then full affected Vitest, architecture checks, CSS lint, type/build and application browser projects. CI/browser runs at the exact PR head are required before closure.

## Migration / provider / Production effect

None. This is a frontend/application/E2E release-blocker batch. It must not add a migration, mutate hosted Development/Production or consume paid provider credits.

## Completion predicate

The batch is complete only when every named blocker has a reproducible root cause, a shipping-vNext application browser regression, a fix at the appropriate shared authority/seam, phone and desktop evidence where relevant, adjacent journey proof, and no unexpected console/network failure at the exact branch head. A component test or code inspection alone cannot close a blocker.
