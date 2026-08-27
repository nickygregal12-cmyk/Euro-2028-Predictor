# Football Hub cutover — rollback procedure

**Authority class:** reference (repeatable operational procedure)
**Governs:** how to withdraw one or more vNext Football Hub destinations and put
the legacy journey back in front of players
**Does not govern:** hosted database contracts or migrations
([`ops-hosted-migration-rollout.md`](ops-hosted-migration-rollout.md) and the
machine records own those); which contract any environment is at
([`../../NOW.md`](../../NOW.md) is generated and is the only home for that)

---

## What this rollback is, and what it deliberately is not

It is a **frontend build-configuration change and a redeploy**. Nothing else.

- **no migration** — the cutover applied none;
- **no backfill** — it wrote no data;
- **no data rollback** — the vNext surfaces read and write through the same
  server contracts the legacy ones do, so a prediction saved through the vNext
  Match Predictor is the same row the legacy page would have written;
- **no coordination with Supabase** — the two lanes are independent, and a
  database promotion is separately authorised whatever this page says.

That is the property the whole cutover was designed around, and it is why the
switch is a set of build-time flags rather than a code revert. Reverting the
merge would also withdraw everything that shipped alongside the cutover; this
withdraws exactly the destinations named and nothing else.

**It requires a redeploy.** `VITE_*` values are build-time in Vite, so the flags
cannot be flipped on a bundle that is already live. There is no runtime kill
switch and deliberately so: `src/app/routeFlags.ts` records the reasoning —
a flag that could be flipped on a live bundle could also be flipped by accident.

---

## The switch

Fourteen values in `[build.environment]` in [`../../netlify.toml`](../../netlify.toml),
one per destination:

| Variable | Destination | Off restores |
| --- | --- | --- |
| `VITE_UI_FOOTBALL_HUB_HOME` | Home, `/`, the competition front door, `/play` and the competition `play` | `CompetitionDashboardPage`, `HomeDestination`, `PlayDestination`, `SeasonPlayRoute` — **four routes, not one** |
| `VITE_UI_FOOTBALL_HUB_MATCHES` | Matches, the Match Centre and `/matches` | `SeasonMatchesRoute`, `SeasonMatchCentreRoute`, `MatchesDestination` |
| `VITE_UI_FOOTBALL_HUB_GAMES` | Games and `/more/scoring` | `CompetitionGamesPage`, `ScoringRulesPage` |
| `VITE_UI_FOOTBALL_HUB_LEAGUES` | Leagues, `/leagues` and the Match Predictor standings | `SeasonLeaguesRoute`, `LeaguesDestination`, `SeasonStandingsRoute` |
| `VITE_UI_FOOTBALL_HUB_PLAYER_PROFILE` | A player's season | `SeasonPlayerProfileRoute` |
| `VITE_UI_FOOTBALL_HUB_DISCOVERY` | Discovery | `ExploreCompetitionsPage` |
| `VITE_UI_FOOTBALL_HUB_ACCOUNT` | You / Account, `/more` and `/profile` | `AccountPage`, `MorePage`, `PlatformProfilePage` |
| `VITE_UI_FOOTBALL_HUB_LMS` | Last Man Standing | `SeasonLmsRoute` |
| `VITE_UI_FOOTBALL_HUB_CHAMPIONSHIP` | Predictor Championship | `SeasonChampionshipRouter` |
| `VITE_UI_FOOTBALL_HUB_PREDICTOR` | Match Predictor | `SeasonMatchPredictorRoute` |
| `VITE_UI_FOOTBALL_HUB_ONBOARDING` | First sign-in, `/welcome` | `WelcomePage` |
| `VITE_UI_FOOTBALL_HUB_INVITE` | The invite deep link, `/join/:code` | `JoinLandingPage` |
| `VITE_UI_FOOTBALL_HUB_CREATE` | Create private play | **nothing — withdraws the address** |
| `VITE_UI_FOOTBALL_HUB_WRAPPED` | Season Wrapped | **nothing — withdraws the address** |

**The row set is not maintained here by hand.**
`tests/vnext/vnextCutoverRouting.test.tsx` compares its destination table
against the flag declaration in `src/app/routeFlags.ts`, so a flag added without
a row fails that test. If this table and that one disagree about WHICH FLAGS
EXIST, **that one is right** and this page is stale.

**The "Off restores" column is a different matter and nothing holds it.** That
test asserts a route COUNT per flag, not which components those routes mount, so
this column is the one part of the page a reader should verify against
`src/App.tsx` before acting on it. Several flags restore more than one route —
`..._HOME` restores four — and an operator who reads a single component name
will under-estimate what a rollback changes.

### The two that withdraw an address

`..._CREATE` and `..._WRAPPED` gate addresses that **did not exist before vNext
built them**, so their off branch is a deliberate Not Found rather than a legacy
screen. Turning either off is still a valid rollback and still loses no
capability — creating private play stays reachable from `/leagues`, and finished
seasons stay listed in Account — but an operator should expect a 404 at those two
addresses afterwards rather than an older page, and should not read it as a
failed rollback.

### It fails closed

`routeFlags.ts` accepts exactly `"true"` after a trim. An unset, empty,
misspelled, `"TRUE"`, `"1"` or `"yes"` value all select the legacy journey. So
the safe way to roll back is to set the value to anything else at all —
`"false"` is conventional and is what the examples below use — and a typo
degrades towards the legacy journey rather than towards an exposed surface.

---

## Deciding to roll back

### What a single-surface failure looks like now, and why it is not automatically a rollback

`src/app/vnext/VNextSurfaceBoundary.tsx` contains a vNext render failure to the
destination it happened on. The player keeps the shell, keeps the navigation and
can move to a working destination; the failure is reported to Sentry under a
correlation reference of the form `FPH-<14 digits>-<4 hex>`, which is the same
reference the player is shown and can quote.

So a report of "the Championship broke" is now evidence about **one destination**
rather than about the application, and the proportionate first response is to
turn off that one flag rather than the cutover.

**A surface that fails twice in a row at the same address escalates** to
`ApplicationErrorBoundary`, which is the full-page fallback with reload and
local-sign-out recovery. A player reaching that has lost the session's chrome,
so repeated escalations on one destination are the strongest single signal that
that destination should be rolled back.

### Triggers

Roll back the named destination when any of these is true:

1. a reproducible failure on that destination that has no same-day fix;
2. a rate of `FPH-` references from that destination that is materially above
   its normal background;
3. any defect on that destination that could cause a player to lose or
   mis-enter a prediction, a lock, an entry or a league membership — this one
   does not wait for a rate, because the legacy journey is known-good and the
   cost of a wrong prediction is the player's, not the operator's;
4. an accessibility or interaction defect that makes the destination unusable on
   a phone, since that is most of the traffic.

Do **not** roll back for a presentation defect a player can work around, or for
a failure whose cause is a server contract rather than the surface — rolling
back the surface would leave the legacy page failing on the same read, and would
disguise where the fault is.

### Prefer one flag to all fourteen

Rolling back all fourteen is available and is the right move only when the fault
is in the shell or the seam itself — the navigation, the competition switcher,
the attention layer or the action feed — because those are shared by every
destination. Anything scoped to one surface should be rolled back at one flag.

---

## The procedure

### 1. Record why, before changing anything

Note the destination, the symptom, at least one `FPH-` reference if there is one,
and the exact deploy that is live. The reference matters most: after the
redeploy, the failing bundle is gone and the reference is the only way back to
what happened.

### 2. Change the flag

Edit [`../../netlify.toml`](../../netlify.toml) and set the named variable to
`"false"`:

```toml
[build.environment]
  # Rolled back <date>: <one line, and the FPH reference>.
  VITE_UI_FOOTBALL_HUB_CHAMPIONSHIP = "false"
```

`netlify.toml` is shared by both deployments, so this withdraws the destination
on the Hub and on the Euro build alike. That is safe and is the intended
behaviour: every one of these flags gates a **domestic competition** route, and
the Euro deployment's own journeys sit behind `TournamentJourney` and are
untouched by any value in this table.

Commit it as its own change on `main`. Do not bundle a rollback with anything
else — a rollback commit must be trivially readable and trivially revertible.

### 3. Deploy

Through the normal deployment path for the site. No migration step, no backup
gate, no rehearsal: none of those apply to a frontend build-configuration change.

### 4. Verify — by opening the destination

**This is the primary step, not the supplement.** Open the rolled-back address
and confirm the legacy journey is what appears — or a Not Found, for the two that
withdraw an address. Check a phone width as well as a desktop one: the two
journeys have different layouts, and a rollback that renders the legacy page
unusably is not a completed rollback.

It has to be done by hand, and it is worth knowing why rather than assuming the
smoke covers it. `npm run smoke:production` **does not assert which UI a route
renders** — every route returns the same SPA shell whether a flag is on or off,
so it cannot tell a rolled-back destination from a live one. That is not a gap in
the script; it is what a shell-level check can see.

### 4b. Then run the smoke, if it can reach the site

```bash
npm run smoke:production
```

It proves the shell, the brand, the security headers byte-for-byte against
`netlify.toml`, the release identity in `/release.json`, that every declared SPA
route returns the shell, that an unknown path 404s rather than soft-200s, that
every asset fetches, and that the bundle names the expected Supabase project and
no other. All of that is worth having after a redeploy, none of it is the
rollback check.

**IT MAY REFUSE TO RUN, AND THAT IS EXPECTED RATHER THAN A FAULT.** The script is
an anonymous HTTP check by construction and both Production sites currently sit
behind Netlify password protection, so it answers `HTTP 401` and stops. See
`OPS-013` in [`../quality/risk-register.md`](../quality/risk-register.md) for the
measurement and for what closing it would take. Until then, step 4 is the
verification and this step is a bonus when the site is reachable — do not read a
401 here as a failed rollback.

### 5. Confirm the bundle actually shrank

Optional, and the strongest available evidence that the flag did what it says.
`App.tsx` reads each variable a second time INLINE — `import.meta.env.<NAME> ===
'true'` — which Vite folds to a literal so Rollup drops the whole subtree. A
correct rollback therefore removes the vNext destination's JavaScript from the
artifact, not merely its route. If the deploy's bundle size is unchanged, the
build did not see the new value.

### 6. Record it

Add a dated record under [`records/`](records/) naming the destination, the
reason, the `FPH-` references, the deploy id and the commit. That directory is
evidence and is never rewritten to look current.

---

## Rolling forward again

The same change in reverse: set the value back to `"true"`, commit, deploy,
verify by opening the destination. There is no state to reconcile in between,
because the rollback wrote none.

Before rolling forward, the defect that caused the rollback must have a merged
fix with an executable test that fails without it. A rollback that is reverted
because the symptom stopped being reported is a rollback that will be needed
again.

---

## What monitoring is available while this is happening

- **Sentry** — `src/services/observability/sentryReporter.ts`, initialised from
  `src/instrument.ts` on the first line of `src/main.tsx`. It is gated on
  `VITE_SENTRY_ENABLED === 'true'` plus a valid `VITE_SENTRY_DSN`.
  **Neither variable is in `netlify.toml`**, so whether reporting is live in a
  given environment depends on variables set in the Netlify UI and cannot be
  read from this repository. Confirm it in the Netlify site settings before
  relying on an absence of reports as evidence of health.
  Setup is [`../ops-sentry.md`](../ops-sentry.md).
- **Global capture** — `installGlobalErrorCapture()` in
  `src/services/observability/clientObservability.ts` registers `error`,
  `unhandledrejection` and CSP-violation listeners.
- **React render failures** — React 19's `onCaughtError` / `onUncaughtError` /
  `onRecoverableError` are all routed to `reportClientError` in `src/main.tsx`.
- **The correlation reference** — generated by
  `correlationReference()` in `src/app/fatalRecovery.ts`, shown to the player and
  attached to the report, by both `ApplicationErrorBoundary` and
  `VNextSurfaceBoundary`. It is derived from the clock and never from the error,
  so it is safe to quote in a support conversation and carries nothing about what
  failed.
- **Product analytics** — PostHog, `src/services/analytics/productAnalytics.ts`.
  It is not an error channel and should not be used as one.

---

## What this page must never become

A record of which flags are currently set. That is `netlify.toml`, and `NOW.md`
generates the journey-flag table from it. A copy here would be wrong the first
time somebody changed one and right-looking for as long as nobody checked.
