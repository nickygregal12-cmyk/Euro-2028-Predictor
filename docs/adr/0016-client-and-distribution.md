# ADR 0016 — Client and distribution strategy

- **Status:** Accepted direction — Phase 1 partially implemented
- **Date:** 29 July 2026

## Context

The application is a React SPA served by Netlify, reachable only through a browser. The stated long-term objective is a product present in the App Store and Play Store rather than a website people bookmark.

Three things make the client question urgent rather than cosmetic.

**A weekly-deadline product lives on push notifications.** "Your picks lock in two hours" delivered as a push is the single strongest retention mechanism available to this product, and email is a poor substitute. ADR 0011's per-matchweek locking exists partly to make one consolidated weekly notification possible; without a delivery channel, that benefit is theoretical.

**Store presence changes what the asset is.** Discovery, credibility, and a materially stronger position in any acquisition conversation. An app with store listings, ratings and install figures is a different proposition from a URL.

**And the decision constrains work starting now.** Routing, authentication redirects, deep links and storage all behave differently inside a native webview. Honouring those constraints from the first commit costs nothing; retrofitting them costs a great deal.

## Decision

**Capacitor shell over the existing SPA.**

The layer laws already keep business rules pure in `src/domain/**` and data access confined to `src/services/supabase/**`, which is exactly the separation a native shell requires. One codebase, one test suite, one deployment of domain logic, with native push, biometrics, deep links and share sheets available where they matter.

**Delivery is phased, deliberately:**

- **Phase 1 — installable PWA, by the August 2027 launch.** Manifest, service worker, offline shell and web push. Web push works on Android and, for installed progressive web apps, on iOS 16.4 and above. This delivers most of the retention value with none of the store risk, and it ships alongside the public launch rather than blocking it.
- **Phase 2 — Capacitor shell, September 2027 to March 2028.** Native push via APNs and FCM, biometric unlock, deep links so invite URLs open the app, native share sheet.
- **Phase 3 — store submission, around March 2028.** Deliberately months ahead of Euro 2028, so a rejection and resubmission costs nothing.

**Every routing, authentication-redirect, deep-link and storage decision from now on must work inside a webview**, whether or not the shell exists yet.

> **Clarified by [ADR 0026](0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md), 6 August 2026:** one codebase may emit **two domain-specific web deployments** — the weekly platform and Euro 2028 — before any of the phases above begin. The shared delivery pipeline and common application foundations this record depends on are unchanged: two builds of one codebase differing in configuration, one test suite, one deployment of domain logic. The webview constraint above now applies to **two origins rather than one**, which makes it more important rather than less: an authentication redirect or deep link must name which site it means, and the redirect allow-list must carry both production domains (`SITE-006`). Whether the eventual native shell wraps one site or two is not decided here and is not on this record's critical path.

## Implementation progress — 20 August 2026

**Phase 1's installable web application exists; Phase 1's web push does not.** The
distinction is the whole of this note, because "installable PWA" is routinely
read as the whole phase and the retention mechanism this record was written for
is the notification, not the icon.

What landed:

- **A generated web app manifest per deployment.** `src/app/site/webAppManifest.ts`,
  emitted by `vite.config.ts` beside the sitemap and `robots.txt` and linked from
  the generated document head. It is generated rather than committed for the same
  reason the head is: `public/` is copied verbatim into both builds, so one
  manifest there would install the Hub under the tournament's name.
- **An icon set per deployment**, in `assets/site-icons/<variant>/`, redrawn from
  `scripts/og/generate-site-icons.mjs`. `favicon.svg`, `favicon.ico` and
  `apple-touch-icon.png` left `public/` at the same time: they had been one
  Euro-branded set shipping to both products, which is the same defect in the
  strongest possible place — an installed icon outlives the tab.
- **A conservative service worker and offline shell**, `src/app/pwa/serviceWorker.ts`.
  It precaches the document, the entry chunk and its static imports, the
  stylesheet and the latin font subsets; it serves lazily-imported route chunks
  cache-first once they have been fetched; and it refuses three things by
  construction — any non-`GET` request, any cross-origin request, and any form of
  queue, replay or background sync. `tests/app/serviceWorker.test.ts` executes the
  built artefact against a fake worker scope and asserts each refusal, because a
  worker that could answer a write is a worker that could report a prediction as
  saved when the server never saw it.
- **An install experience and an update flow**, `src/app/pwa/`. Nothing is offered
  on a first visit; a dismissal is honoured for two months; iOS gets Safari's own
  steps rather than a button pretending to be an install API; and a new build
  waits rather than taking over a page, so no player is refreshed mid-edit.

What this does NOT close, named rather than implied:

- **Web push.** No `PushManager` subscription, no VAPID keys, no delivery. The
  weekly deadline notification this record calls "the single strongest retention
  mechanism available" is still theoretical, and the phase is not finished
  without it. `docs/ops/notification-delivery.md` remains the authority.
- **Offline reads.** Nothing private is cached, deliberately, so an offline
  application shows its own failure and empty states rather than yesterday's
  standings. Labelling stale competitive data is a product decision nobody has
  made, and inventing one here would have created a second reveal rule.
- **A route not yet visited is not available offline.** Only the shell is
  precached. Opening an unvisited surface with no connection fails as it always
  did.
- **Phases 2 and 3.** No Capacitor shell, no store work, no native anything. The
  webview constraints this record imposes on routing, redirects and deep links
  are untouched by the above: the manifest's `start_url` and `scope` are
  root-relative, so nothing here binds either deployment to an origin.

## Consequences

- **Apple guideline 4.2 rejects bare webview wrappers.** The native capabilities above are not polish; they are the admission ticket. Push, deep links and biometric unlock must exist before submission.
- **Same-day hotfixes end once native shipping begins.** Store review means a native build cannot be relied upon to ship on the day it is needed. Keep the shell thin, keep web as the fast path, and never design an operational recovery that requires a same-day native release. Updates to interpreted JavaScript remain permissible within Apple's rules, but must not be the recovery plan.
- **Supabase OAuth redirect flows need explicit handling** under a custom scheme or universal links. This must be designed during Stage A rather than discovered during Phase 2.
- **Store review is straightforward because of ADR 0015.** With no stake and no prize, this is an ordinary free application on both stores — no gambling category, no elevated age rating on that basis, no per-territory gating. Entry fees would have produced substantially stricter review on both platforms.
- **Developer accounts must be enrolled early.** The Apple Developer Program is an annual fee and Google Play a one-off registration, and enrolment with verification can take weeks. Budget the time, not just the cost.
- Device smoke testing joins the test surface: push delivery, deep-link resolution and authentication round-trip on both platforms, plus a locked entry rendering offline.
- Store privacy disclosures and data-use labels become a launch requirement.

## Rejected alternatives

- **Installable PWA only, with no store presence.** Rejected: it forfeits discovery, credibility and the acquisition argument, and iOS web push requires the user to install the progressive web app first, which most never will. Retained as Phase 1 rather than as the destination.
- **A React Native or Expo rebuild of the interface layer.** Rejected: it forks the UI layer for a solo developer with no proven audience, doubling the maintenance surface before the product has earned it. It remains available later if scale justifies it, and the pure domain layer means such a move would not be a rewrite from nothing.
- **Building the native shell before the 2027/28 launch.** Rejected: it would place a store review queue on the critical path of a launch that does not need one. The PWA delivers the retention value on time.
- **Deferring the webview constraints until Phase 2.** Rejected: authentication redirects and deep links are the expensive retrofits, and honouring them from the start costs nothing.
